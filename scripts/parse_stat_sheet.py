"""Parse a varsity volleyball stat-sheet PDF into rows."""
import os
import re

import fitz

NUM_RE = re.compile(r"^-?\d+(?:\.\d+)?%?$")

PLAYER_COLS = [
    ("digs", 100, 145),
    ("assists", 146, 175),
    ("attack_attempts", 176, 205),
    ("kills", 206, 230),
    ("kill_errors", 231, 270),
    ("kill_efficiency", 271, 315),
    ("serve_attempts", 316, 340),
    ("aces", 341, 365),
    ("serve_errors", 366, 381),
    ("serve_rating", 430, 455),
    ("unforced_errors", 460, 500),
    ("blocks_stuff", 501, 530),
    ("blocks_touch", 531, 565),
    ("serve_receive_attempts", 566, 582),
    ("serve_receive_rating", 620, 655),
    ("fb_pass_attempts", 656, 680),
    ("fb_receive_rating", 720, 760),
]

ROT_COLS = [
    ("assists", 145, 175),
    ("attack_attempts", 176, 205),
    ("kills", 206, 230),
    ("kill_errors", 231, 270),
    ("kill_efficiency", 271, 315),
    ("unforced_errors", 316, 370),
    ("serve_receive_attempts", 390, 415),
    ("serve_receive_avg", 460, 500),
    ("serve_aces", 501, 530),
    ("serve_errors", 531, 565),
    ("points_scored", 566, 595),
    ("points_against", 596, 625),
    ("net_score", 626, 670),
]

SET_COLS = [
    ("aces_us", 110, 145),
    ("serve_errors_us", 146, 175),
    ("ace_pct_us", 176, 198),
    ("serve_error_pct_us", 199, 230),
    ("aces_them", 231, 270),
    ("serve_errors_them", 271, 310),
    ("ace_pct_them", 311, 335),
    ("serve_error_pct_them", 336, 370),
]

SET_STAT_KEYS = [key for key, _lo, _hi in SET_COLS]

SKIP_NAMES = {
    "Player", "Rotation", "Team", "Set", "Total", "Unforced", "Error",
    "Dig", "Assist", "Attack", "Kill", "Serve", "Serving", "Block",
    "Points", "Efficiency",
}


def parse_filename(name):
    base = os.path.basename(name).replace(".pdf", "")
    rest = base.split("Varsity - ", 1)[1]
    match = re.search(r"(\d{1,2})_(\d{1,2})$", rest)
    if not match:
        raise ValueError(name)
    month, day = int(match.group(1)), int(match.group(2))
    opponent = rest[: match.start()].strip(" -")
    date = "2026-{:02d}-{:02d}".format(month, day)
    return date, opponent


def num(token):
    text = token.replace("%", "")
    if "." in text:
        return float(text)
    return int(text)


def assign(cols, token, x1):
    if not NUM_RE.match(token):
        return None
    for key, lo, hi in cols:
        if lo <= x1 <= hi:
            return key, num(token)
    return None


def y_of(words, text, x_max=200):
    hits = [word[1] for word in words if word[4] == text and word[0] < x_max]
    return min(hits) if hits else None


def name_line_words(words, y, x_min=80, tol=1.6):
    return [word for word in words if abs(word[1] - y) < tol and word[0] >= x_min]


def fill_row(cols, line_words):
    row = {}
    for word in line_words:
        hit = assign(cols, word[4], word[2])
        if not hit:
            continue
        key, value = hit
        if key in row:
            row.setdefault("_conflicts", []).append((key, row[key], value, word[4]))
        else:
            row[key] = value
    return row


def digits_in(token):
    if token in {"-", "–", "—"} or "." in token:
        return []
    return [int(part) for part in re.findall(r"\d+", token)]


def cluster_lines(words, x0_lo, x0_hi, y_lo, y_hi):
    picked = [
        word
        for word in words
        if y_lo <= word[1] < y_hi and x0_lo <= word[0] < x0_hi and digits_in(word[4])
    ]
    picked.sort(key=lambda word: (word[1], word[0]))
    lines = []
    for word in picked:
        if lines and abs(word[1] - lines[-1][0]) < 1.4:
            lines[-1][1].append(word)
        else:
            lines.append([word[1], [word]])
    out = []
    for y, toks in lines:
        toks.sort(key=lambda word: word[0])
        nums = []
        for tok in toks:
            nums.extend(digits_in(tok[4]))
        if nums:
            out.append((y, nums))
    return out


def assign_wrapped_lists(players, fragments, attempts_key, rating_key):
    n = len(players)
    if n == 0:
        return []
    ys = [player["_y"] for player in players]
    name_nums = [player["_name_nums"] for player in players]
    prefix = [nums for y, nums in fragments if y < ys[0] - 1.6]
    suffix = [nums for y, nums in fragments if y > ys[-1] + 1.6]
    gaps = []
    for i in range(n - 1):
        gaps.append([nums for y, nums in fragments if ys[i] + 1.6 < y < ys[i + 1] - 1.6])

    def cost(i, nums):
        attempts = players[i].get(attempts_key)
        rating = players[i].get(rating_key)
        if attempts is None:
            return len(nums) * 20
        score = abs(len(nums) - int(attempts)) * 20
        if nums and len(nums) == int(attempts) and rating is not None:
            score += abs(sum(nums) / float(len(nums)) - float(rating))
        return score

    cache = {}

    def solve(i, incoming_cut):
        key = (i, incoming_cut)
        if key in cache:
            return cache[key]
        incoming = prefix if i == 0 else gaps[i - 1][incoming_cut:]
        if i == n - 1:
            nums = []
            for frag in incoming:
                nums.extend(frag)
            nums.extend(name_nums[i])
            for frag in suffix:
                nums.extend(frag)
            result = (cost(i, nums), ())
            cache[key] = result
            return result
        best = None
        gap = gaps[i]
        for cut in range(len(gap) + 1):
            nums = []
            for frag in incoming:
                nums.extend(frag)
            nums.extend(name_nums[i])
            for frag in gap[:cut]:
                nums.extend(frag)
            rest_cost, rest_cuts = solve(i + 1, cut)
            total = cost(i, nums) + rest_cost
            if best is None or total < best[0] - 1e-9:
                best = (total, (cut,) + rest_cuts)
        cache[key] = best
        return best

    _total, cuts = solve(0, 0)
    result = []
    incoming_cut = 0
    for i in range(n):
        incoming = prefix if i == 0 else gaps[i - 1][incoming_cut:]
        if i == n - 1:
            below = suffix
        else:
            cut = cuts[i]
            below = gaps[i][:cut]
            incoming_cut = cut
        nums = []
        for frag in incoming:
            nums.extend(frag)
        nums.extend(name_nums[i])
        for frag in below:
            nums.extend(frag)
        result.append(nums)
    return result


def nearly(a, b, tol=0.03):
    if a is None or b is None:
        return True
    return abs(float(a) - float(b)) <= tol


def check_player(row):
    issues = []
    name = "{} {} {}".format(row["date"], row["opponent"], row["player"])
    if row.get("_conflicts"):
        issues.append(name + " COLUMN CONFLICT " + str(row["_conflicts"]))

    def check_seq(label, seq, attempts, rating, lo, hi):
        if not seq and not attempts:
            return
        if attempts is not None and len(seq) != int(attempts):
            issues.append("{} {} count {} != attempts {}".format(name, label, len(seq), attempts))
        elif seq and rating is not None:
            avg = sum(seq) / len(seq)
            if not nearly(avg, rating, 0.02):
                issues.append("{} {} avg {:.3f} != rating {}".format(name, label, avg, rating))
        if seq and (min(seq) < lo or max(seq) > hi):
            issues.append("{} {} out of range {}".format(name, label, seq))

    check_seq("serve", row["serving_scores"], row.get("serve_attempts"), row.get("serve_rating"), 0, 5)
    check_seq("receive", row["sr_grades"], row.get("serve_receive_attempts"), row.get("serve_receive_rating"), 0, 3)
    check_seq("freeball", row["fb_grades"], row.get("fb_pass_attempts"), row.get("fb_receive_rating"), 0, 3)

    attempts = row.get("attack_attempts")
    kills = row.get("kills")
    errors = row.get("kill_errors")
    efficiency = row.get("kill_efficiency")
    if attempts and efficiency is not None and (kills is not None or errors is not None):
        calc = ((kills or 0) - (errors or 0)) / attempts
        if not nearly(calc, efficiency, 0.02):
            issues.append("{} kill eff calc {:.3f} != {}".format(name, calc, efficiency))
    return issues


def calculated_efficiency(row):
    attempts = row.get("attack_attempts")
    if not attempts:
        return None
    if row.get("kills") is None and row.get("kill_errors") is None:
        return None
    kills = row.get("kills") or 0
    errors = row.get("kill_errors") or 0
    return round((kills - errors) / float(attempts), 3)


def checked_sequence(seq, attempts, rating, lo, hi):
    if not seq or attempts is None or len(seq) != int(attempts):
        return None
    if min(seq) < lo or max(seq) > hi:
        return None
    if rating is not None and abs(sum(seq) / float(len(seq)) - float(rating)) > 0.055:
        return None
    return " ".join(str(n) for n in seq)


def parse_pdf(path):
    date, opponent = parse_filename(path)
    page = fitz.open(path)[0]
    words = page.get_text("words")

    player_header_y = y_of(words, "Player", 80)
    rotation_y = y_of(words, "Rotation", 80)
    team_ys = [word[1] for word in words if word[4] == "Team" and word[0] < 70]
    team_y = max(team_ys) if team_ys else None
    set_ys = sorted(word[1] for word in words if word[4] == "Set" and word[0] < 70)
    total_ys = [word[1] for word in words if word[4] == "Total" and word[0] < 80]
    total_y = max(total_ys) if total_ys else None
    if player_header_y is None:
        raise RuntimeError("No player header in " + path)

    section_end = rotation_y if rotation_y else (team_y or 500)
    names = [
        word
        for word in words
        if word[0] < 80
        and player_header_y + 8 < word[1] < section_end - 4
        and word[4][:1].isalpha()
        and word[4] not in SKIP_NAMES
        and NUM_RE.match(word[4]) is None
    ]
    names.sort(key=lambda word: word[1])

    header_bottom = player_header_y + 4.5
    section_bottom = section_end - 3
    players = []
    for name in names:
        row = fill_row(PLAYER_COLS, name_line_words(words, name[1]))
        row.update({"date": date, "opponent": opponent, "player": name[4], "_y": name[1]})
        players.append(row)

    list_specs = [
        ("serving_scores", "serve_attempts", "serve_rating", 381, 430),
        ("sr_grades", "serve_receive_attempts", "serve_receive_rating", 582, 620),
        ("fb_grades", "fb_pass_attempts", "fb_receive_rating", 680, 720),
    ]
    for seq_key, att_key, rating_key, x0, x1 in list_specs:
        lines = cluster_lines(words, x0, x1, header_bottom, section_bottom)
        for player in players:
            name_line = [nums for y, nums in lines if abs(y - player["_y"]) < 1.6]
            player["_name_nums"] = name_line[0] if name_line else []
        off_name = [
            (y, nums)
            for y, nums in lines
            if not any(abs(y - player["_y"]) < 1.6 for player in players)
        ]
        assigned = assign_wrapped_lists(players, off_name, att_key, rating_key)
        for player, nums in zip(players, assigned):
            player[seq_key] = nums

    issues = []
    for row in players:
        issues.extend(check_player(row))

    rotations = []
    if rotation_y and team_y:
        rot_labels = [
            word
            for word in words
            if rotation_y + 4 < word[1] < team_y - 8
            and 70 <= word[0] < 110
            and word[4] in list("123456")
        ]
        rot_labels.sort(key=lambda word: word[1])
        for name in rot_labels:
            row = fill_row(ROT_COLS, name_line_words(words, name[1], x_min=110))
            row.update({"date": date, "opponent": opponent, "rotation": int(name[4])})
            rotations.append(row)

    sets = []
    for sy in set_ys:
        line = [word for word in words if abs(word[1] - sy) < 1.6]
        set_no = None
        for word in line:
            if word[4] in list("12345") and 55 <= word[0] <= 70:
                set_no = int(word[4])
        row = fill_row(SET_COLS, line)
        if set_no is None:
            continue
        if all(row.get(key) is None for key in SET_STAT_KEYS):
            continue
        row.update({"date": date, "opponent": opponent, "set": set_no, "row_type": "set"})
        sets.append(row)

    match_total = {"date": date, "opponent": opponent, "set": "Total", "row_type": "total"}
    if total_y:
        line = [word for word in words if abs(word[1] - total_y) < 1.6]
        match_total.update(fill_row(SET_COLS, line))

    kill_eff = None
    attack_note = ""
    games = [word for word in words if word[4] == "games)"]
    if games:
        label = games[-1]
        nearby = [
            word
            for word in words
            if label[1] - 1 < word[1] < label[1] + 18 and 70 < word[0] < 200
        ]
        nearby.sort(key=lambda word: (word[1], word[0]))
        for word in nearby:
            if word[4] in {"Team", "Kill", "Efficiency", "(all", "games)"}:
                continue
            if NUM_RE.match(word[4]) and kill_eff is None:
                kill_eff = num(word[4])
                continue
            attack_note += (" " if attack_note else "") + word[4].replace("%", "")

    match = {
        "date": date,
        "opponent": opponent,
        "team_kill_efficiency": kill_eff,
        "note": attack_note.strip(),
    }
    return {
        "match": match,
        "players": players,
        "rotations": rotations,
        "sets": sets,
        "total": match_total,
        "issues": issues,
    }
