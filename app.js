const DATA = window.DATA;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ROT_ORDER = [1, 6, 5, 4, 3, 2];
const SERIES = [
  "#b8431f", "#1f4e79", "#1d6b45", "#8a6a12", "#6b3fa0", "#c47b2b",
  "#0e7490", "#9f1239", "#3f6212", "#1e3a8a", "#a16207", "#7c3aed",
  "#be185d", "#047857", "#b45309", "#334155", "#0369a1", "#4d7c0f",
];

/** Bump when you deploy user-visible site changes (shown in the page footer). */
const SITE_VERSION = "2026.09.26.1";

const STATS = [
  {
    id: "hitting",
    label: "Hitting %",
    kind: "hitting",
    sample: "attackAttempts",
    sampleLabel: "attack attempts",
    format: "hitting",
    hint: "Kills minus kill errors, divided by attack attempts, added up across the selected matches.",
  },
  {
    id: "kills",
    label: "Kills",
    kind: "sum",
    field: "kills",
    sample: "attackAttempts",
    sampleLabel: "attack attempts",
    format: "int",
    perMatch: true,
    hint: "Balls the player put away.",
  },
  {
    id: "killErrors",
    label: "Kill errors",
    kind: "sum",
    field: "killErrors",
    sample: "attackAttempts",
    sampleLabel: "attack attempts",
    format: "int",
    perMatch: true,
    hint: "Attacks that hit the net, went out, or were otherwise errors.",
  },
  {
    id: "attackAttempts",
    label: "Attack attempts",
    kind: "sum",
    field: "attackAttempts",
    sample: "attackAttempts",
    sampleLabel: "attack attempts",
    format: "int",
    perMatch: true,
    hint: "Swings, including kills and errors.",
  },
  {
    id: "digs",
    label: "Digs",
    kind: "sum",
    field: "digs",
    format: "int",
    perMatch: true,
    hint: "Balls played up on defense.",
  },
  {
    id: "assists",
    label: "Assists",
    kind: "sum",
    field: "assists",
    format: "int",
    perMatch: true,
    hint: "Sets that led to a kill.",
  },
  {
    id: "aces",
    label: "Aces",
    kind: "sum",
    field: "aces",
    sample: "serveAttempts",
    sampleLabel: "serves",
    format: "int",
    perMatch: true,
    hint: "Serves that scored outright.",
  },
  {
    id: "acePct",
    label: "Ace %",
    kind: "ratio",
    num: "aces",
    den: "serveAttempts",
    sample: "serveAttempts",
    sampleLabel: "serves",
    format: "pct",
    scaleMax: 1,
    hint: "Aces divided by serve attempts.",
  },
  {
    id: "serveErrors",
    label: "Serve errors",
    kind: "sum",
    field: "serveErrors",
    sample: "serveAttempts",
    sampleLabel: "serves",
    format: "int",
    perMatch: true,
    hint: "Serves that went out, into the net, or otherwise gave the point away.",
  },
  {
    id: "serveRating",
    label: "Serve rating",
    kind: "weighted",
    field: "serveRating",
    weight: "serveAttempts",
    sample: "serveAttempts",
    sampleLabel: "serves",
    format: "rating",
    scaleMax: 5,
    hint: "Average serve score, weighted by attempts. 5 ace, 3 out of system, 2 in system, 1 perfect pass, 0 error.",
  },
  {
    id: "receiveRating",
    label: "Serve receive",
    kind: "weighted",
    field: "receiveRating",
    weight: "receiveAttempts",
    sample: "receiveAttempts",
    sampleLabel: "passes",
    format: "rating",
    scaleMax: 3,
    hint: "Average pass grade, weighted by attempts. 3 perfect to the setter, 2 average, 1 out of system, 0 ace.",
  },
  {
    id: "freeballRating",
    label: "Freeball rating",
    kind: "weighted",
    field: "freeballRating",
    weight: "freeballAttempts",
    sample: "freeballAttempts",
    sampleLabel: "freeballs",
    format: "rating",
    scaleMax: 3,
    hint: "Freeball passes on the same 0–3 scale as serve receive.",
  },
  {
    id: "stuffBlocks",
    label: "Stuff blocks",
    kind: "sum",
    field: "stuffBlocks",
    format: "int",
    perMatch: true,
    hint: "Blocks that ended the rally.",
  },
  {
    id: "blockTouches",
    label: "Block touches",
    kind: "sum",
    field: "blockTouches",
    format: "int",
    perMatch: true,
    hint: "Blocks that touched the ball and stayed alive.",
  },
  {
    id: "unforcedErrors",
    label: "Unforced errors",
    kind: "sum",
    field: "unforcedErrors",
    format: "int",
    perMatch: true,
    hint: "Avoidable mistakes: overpass, bad set, dropped ball on a miscommunication.",
  },
];

const TABLE_STATS = [
  "matches",
  "attackAttempts",
  "kills",
  "killErrors",
  "hitting",
  "digs",
  "assists",
  "aces",
  "serveErrors",
  "serveRating",
  "receiveRating",
  "stuffBlocks",
  "unforcedErrors",
];

const state = {
  view: "players",
  matchKeys: new Set(),
  statId: "hitting",
  perMatch: false,
  minSample: 5,
  sortKey: "hitting",
  sortDir: "desc",
  compare: [],
  nameQuery: "",
};

let charts = [];

function matchKey(row) {
  return row.date + "|" + row.opponent;
}

function shortDate(iso) {
  const parts = iso.split("-").map(Number);
  return MONTHS[parts[1] - 1] + " " + parts[2];
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function statById(id) {
  return STATS.find(function (stat) { return stat.id === id; }) || STATS[0];
}

function allMatchKeys() {
  const keys = DATA.matches.map(matchKey);
  keys.sort();
  return keys;
}

function selectedMatchKeys() {
  return allMatchKeys().filter(function (key) { return state.matchKeys.has(key); });
}

function inSelectedMatches(row) {
  return state.matchKeys.has(matchKey(row));
}

function sumField(rows, field) {
  let any = false;
  let total = 0;
  rows.forEach(function (row) {
    if (row[field] != null) {
      any = true;
      total += row[field];
    }
  });
  return any ? total : null;
}

function weighted(rows, field, weight) {
  let weightSum = 0;
  let total = 0;
  rows.forEach(function (row) {
    if (row[field] == null || !row[weight]) return;
    weightSum += row[weight];
    total += row[field] * row[weight];
  });
  return weightSum ? total / weightSum : null;
}

function hittingOf(rows) {
  const attempts = sumField(rows, "attackAttempts");
  if (!attempts) return null;
  const kills = sumField(rows, "kills") || 0;
  const errors = sumField(rows, "killErrors") || 0;
  return (kills - errors) / attempts;
}

const COUNT_FIELDS = ["attackAttempts", "kills", "killErrors", "digs", "assists", "aces", "serveErrors", "unforcedErrors", "stuffBlocks", "blockTouches", "serveAttempts", "receiveAttempts", "freeballAttempts"];

function aggregatePlayers(rows) {
  const groups = new Map();
  rows.forEach(function (row) {
    if (!groups.has(row.player)) groups.set(row.player, []);
    groups.get(row.player).push(row);
  });
  const list = [];
  groups.forEach(function (playerRows, player) {
    const record = {
      player: player,
      matches: playerRows.length,
      attackAttempts: sumField(playerRows, "attackAttempts"),
      kills: sumField(playerRows, "kills"),
      killErrors: sumField(playerRows, "killErrors"),
      digs: sumField(playerRows, "digs"),
      assists: sumField(playerRows, "assists"),
      aces: sumField(playerRows, "aces"),
      serveAttempts: sumField(playerRows, "serveAttempts"),
      serveErrors: sumField(playerRows, "serveErrors"),
      unforcedErrors: sumField(playerRows, "unforcedErrors"),
      stuffBlocks: sumField(playerRows, "stuffBlocks"),
      blockTouches: sumField(playerRows, "blockTouches"),
      receiveAttempts: sumField(playerRows, "receiveAttempts"),
      freeballAttempts: sumField(playerRows, "freeballAttempts"),
      hitting: hittingOf(playerRows),
      serveRating: weighted(playerRows, "serveRating", "serveAttempts"),
      receiveRating: weighted(playerRows, "receiveRating", "receiveAttempts"),
      freeballRating: weighted(playerRows, "freeballRating", "freeballAttempts"),
    };
    const aces = record.aces || 0;
    record.acePct = record.serveAttempts ? aces / record.serveAttempts : null;
    list.push(record);
  });
  return list;
}

function displayRecord(record) {
  if (!state.perMatch || !record.matches) return record;
  const copy = Object.assign({}, record);
  COUNT_FIELDS.forEach(function (field) {
    if (copy[field] != null) copy[field] = copy[field] / record.matches;
  });
  const aces = copy.aces || 0;
  copy.acePct = copy.serveAttempts ? aces / copy.serveAttempts : record.acePct;
  return copy;
}

function formatValue(format, value) {
  if (value == null || Number.isNaN(value)) return "—";
  if (format === "int") {
    if (Math.abs(value - Math.round(value)) < 0.05) return String(Math.round(value));
    return value.toFixed(1);
  }
  if (format === "hitting") {
    const negative = value < 0;
    const abs = Math.abs(value);
    const text = abs >= 1 ? abs.toFixed(3) : abs.toFixed(3).replace(/^0/, "");
    return (negative ? "-" : "") + text;
  }
  if (format === "rating") return value.toFixed(2);
  if (format === "pct") return Math.round(value * 100) + "%";
  return String(value);
}

function formatStat(stat, value) {
  return formatValue(stat.format || "int", value);
}

function valueOf(record, stat) {
  if (stat.kind === "sum") return record[stat.field];
  return record[stat.id];
}

function passesSample(record, stat) {
  if (!stat.sample) return true;
  return (record[stat.sample] || 0) >= state.minSample;
}

function sortRecords(records) {
  const dir = state.sortDir === "asc" ? 1 : -1;
  return records.slice().sort(function (a, b) {
    const av = a[state.sortKey];
    const bv = b[state.sortKey];
    if (av == null && bv == null) return a.player.localeCompare(b.player);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
      return dir * String(av).localeCompare(String(bv));
    }
    return dir * (av - bv);
  });
}

function destroyCharts() {
  charts.forEach(function (chart) { chart.destroy(); });
  charts = [];
}

function chartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.font.family = "Outfit, Segoe UI, sans-serif";
  Chart.defaults.color = "#645d53";
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.boxHeight = 12;
}

function baseScales(stat, horizontal) {
  const valueScale = {
    beginAtZero: true,
    suggestedMax: stat && stat.scaleMax ? stat.scaleMax : undefined,
    grid: { color: "#efe8dc" },
    ticks: {
      callback: function (value) {
        return stat ? formatStat(stat, value) : value;
      },
    },
  };
  const category = { grid: { display: false } };
  return horizontal ? { x: valueScale, y: category } : { x: category, y: valueScale };
}

function chartLayoutPadding() {
  return { top: 4, right: 8, bottom: 4, left: 4 };
}

function shortenOpponent(name, max) {
  const limit = max || 16;
  if (name.length <= limit) return name;
  return name.slice(0, limit - 1) + "\u2026";
}

function gameChartLabels(keys, compact) {
  const tight = compact || keys.length > 7;
  return keys.map(function (key) {
    const parts = key.split("|");
    if (tight) return shortDate(parts[0]);
    return [shortDate(parts[0]), shortenOpponent(parts[1])];
  });
}

function gameAxisTicks(keys, compact) {
  const many = compact || keys.length > 7;
  return {
    maxRotation: many ? 45 : 0,
    minRotation: many ? 45 : 0,
    autoSkip: keys.length > 14,
    maxTicksLimit: keys.length > 14 ? Math.ceil(keys.length / 2) : undefined,
    font: { size: many ? 10 : 11 },
  };
}

function gradeAxisLabels(field, bins) {
  if (field === "receiveGrades") {
    const map = { 0: "Ace", 1: "Out of system", 2: "Average", 3: "Perfect" };
    return bins.map(function (bin) { return map[bin] || String(bin); });
  }
  if (field === "serveScores") {
    const map = { 0: "Error", 1: "Perfect pass", 2: "In system", 3: "Out of system", 5: "Ace" };
    return bins.map(function (bin) { return map[bin] || String(bin); });
  }
  return bins.map(String);
}

function minChartHeight(spec) {
  if (spec.kind === "trend") return 240;
  if (spec.kind === "grades") return 220;
  if (spec.kind === "players") return Math.max(200, previewHeight(spec));
  if (spec.kind === "matches" || spec.kind === "aces" || spec.kind === "acePct") return 220;
  if (spec.kind === "rotations") return 240;
  return 180;
}

function withAlpha(hex, alpha) {
  const n = String(hex).replace("#", "");
  if (n.length !== 6) return hex;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

function seriesColor(dataset) {
  if (typeof dataset.borderColor === "string" && dataset.borderColor.charAt(0) === "#") return dataset.borderColor;
  if (typeof dataset.backgroundColor === "string" && dataset.backgroundColor.charAt(0) === "#") return dataset.backgroundColor;
  return null;
}

function applyLegendFocus(chart, index) {
  const isLine = chart.config.type === "line";
  chart.data.datasets.forEach(function (dataset, i) {
    const color = dataset._baseColor;
    if (!color) return;
    const faded = index != null && i !== index;
    const hovered = index != null && i === index;
    if (isLine) {
      dataset.borderWidth = hovered ? 6 : (faded ? 1.25 : 2.5);
      dataset.pointRadius = hovered ? 6 : (faded ? 0 : dataset._basePointRadius);
      dataset.borderColor = faded ? withAlpha(color, 0.16) : color;
      dataset.pointBackgroundColor = dataset.borderColor;
      dataset.pointBorderColor = dataset.borderColor;
    } else {
      dataset.backgroundColor = faded ? withAlpha(color, 0.18) : color;
    }
  });
  chart.update("none");
}

function setChartFocus(chart, index) {
  if (chart.$focus === index) return;
  chart.$focus = index;
  applyLegendFocus(chart, index);
}

function makeChart(canvas, config, track) {
  if (!window.Chart || !canvas) return;
  const datasets = (config.data && config.data.datasets) || [];
  const colors = datasets.map(seriesColor);
  const canFocus = colors.length > 1 && colors.every(Boolean);
  if (canFocus) {
    datasets.forEach(function (dataset, i) {
      dataset._baseColor = colors[i];
      if (config.type === "line") {
        dataset._basePointRadius = dataset.pointRadius == null ? 3 : dataset.pointRadius;
        dataset.borderWidth = 2.5;
      }
    });
    config.options = config.options || {};
    config.options.plugins = config.options.plugins || {};
    const legend = config.options.plugins.legend || {};
    const labels = legend.labels || {};
    const previousLabels = labels.generateLabels;
    labels.generateLabels = function (chart) {
      const items = previousLabels
        ? previousLabels(chart)
        : Chart.defaults.plugins.legend.labels.generateLabels(chart);
      items.forEach(function (item) {
        const dataset = chart.data.datasets[item.datasetIndex];
        if (!dataset || !dataset._baseColor) return;
        item.fillStyle = dataset._baseColor;
        item.strokeStyle = dataset._baseColor;
      });
      return items;
    };
    legend.labels = labels;
    const prevLegendHover = legend.onHover;
    legend.onHover = function (event, legendItem, legend) {
      if (prevLegendHover) prevLegendHover.call(this, event, legendItem, legend);
      setChartFocus(legend.chart, legendItem.datasetIndex);
      if (event.native && event.native.target) event.native.target.style.cursor = "pointer";
    };
    const prevLegendLeave = legend.onLeave;
    legend.onLeave = function (event, legendItem, legend) {
      if (prevLegendLeave) prevLegendLeave.call(this, event, legendItem, legend);
      if (event.native && event.native.target) event.native.target.style.cursor = "default";
    };
    config.options.plugins.legend = legend;
    const prevOnHover = config.options.onHover;
    config.options.onHover = function (event, elements, chart) {
      if (prevOnHover) prevOnHover.call(this, event, elements, chart);
      if (elements.length) setChartFocus(chart, elements[0].datasetIndex);
    };
    config.plugins = config.plugins || [];
    config.plugins.push({
      id: "legendFocus",
      afterDatasetsDraw: function (chart) {
        if (chart.$focus == null) return;
        const meta = chart.getDatasetMeta(chart.$focus);
        if (!meta || meta.hidden || !meta.controller) return;
        const area = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
        ctx.clip();
        meta.controller.draw();
        ctx.restore();
      },
    });
  }
  const chart = new Chart(canvas, config);
  if (track !== false) charts.push(chart);
  if (!canFocus) return chart;
  canvas.addEventListener("mouseleave", function () {
    canvas.style.cursor = "default";
    if (chart.$focus == null) return;
    chart.$focus = null;
    applyLegendFocus(chart, null);
  });
  return chart;
}

function selectedPlayerRows() {
  return DATA.players.filter(inSelectedMatches);
}

function selectedRotations() {
  return DATA.rotations.filter(inSelectedMatches);
}

function selectedServingTotals() {
  return DATA.serving.filter(function (row) {
    return inSelectedMatches(row) && String(row.set) === "Total";
  });
}

function renderRange() {
  const keys = selectedMatchKeys();
  const el = document.getElementById("range");
  if (!keys.length) {
    el.textContent = "No matches selected";
    return;
  }
  const first = keys[0].split("|")[0];
  const last = keys[keys.length - 1].split("|")[0];
  el.textContent = shortDate(first) + " – " + shortDate(last) + " · " + keys.length + " of " + allMatchKeys().length + " matches";
}

function renderMatchChips() {
  const wrap = document.getElementById("match-chips");
  const keys = allMatchKeys();
  const allOn = keys.every(function (key) { return state.matchKeys.has(key); });
  let html = '<button type="button" class="chip" data-match="all" aria-pressed="' + allOn + '">All</button>';
  html += '<button type="button" class="chip" data-match="none">None</button>';
  keys.forEach(function (key) {
    const parts = key.split("|");
    const on = state.matchKeys.has(key);
    html += '<button type="button" class="chip" data-match="' + esc(key) + '" aria-pressed="' + on + '">' + esc(shortDate(parts[0]) + " · " + parts[1]) + "</button>";
  });
  wrap.innerHTML = html;
}

function controlsHtml() {
  const stat = statById(state.statId);
  let html = '<div class="controls">';
  html += '<label class="control"><span class="control-label">Stat</span>';
  html += '<select class="select" id="stat-select">';
  STATS.forEach(function (item) {
    html += '<option value="' + item.id + '"' + (item.id === state.statId ? " selected" : "") + ">" + esc(item.label) + "</option>";
  });
  html += "</select></label>";
  if (stat.perMatch && state.view === "players") {
    html += '<div class="control"><span class="control-label">Count</span><div class="segment">';
    html += '<button type="button" id="mode-total" aria-pressed="' + (!state.perMatch) + '">Total</button>';
    html += '<button type="button" id="mode-per" aria-pressed="' + state.perMatch + '">Per match</button>';
    html += "</div></div>";
  }
  if (stat.sample && state.view === "players") {
    html += '<label class="control"><span class="control-label">At least ' + state.minSample + " " + esc(stat.sampleLabel) + '</span>';
    html += '<input class="slider" id="min-sample" type="range" min="0" max="40" value="' + state.minSample + '"></label>';
  }
  if (state.view === "players") {
    html += '<label class="control"><span class="control-label">Name</span>';
    html += '<input class="search" id="name-query" type="search" placeholder="Filter players" value="' + esc(state.nameQuery) + '"></label>';
  }
  html += "</div>";
  html += '<p class="hint">' + esc(stat.hint) + "</p>";
  return html;
}

function tableHtml(columns, rows, sortKey) {
  let html = '<div class="table-wrap"><table><thead><tr>';
  columns.forEach(function (col) {
    const sorted = col.key === sortKey;
    const arrow = sorted ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
    html += '<th data-sort="' + col.key + '" class="' + (col.left ? "left " : "") + (col.sticky ? "sticky " : "") + (sorted ? "sorted" : "") + '">' + esc(col.label) + arrow + "</th>";
  });
  html += "</tr></thead><tbody>";
  rows.forEach(function (row) {
    html += "<tr>";
    columns.forEach(function (col) {
      const raw = row[col.key];
      const text = col.format ? formatValue(col.format, raw) : (raw == null ? "—" : String(raw));
      const neg = typeof raw === "number" && raw < 0;
      html += '<td class="' + (col.left ? "left " : "") + (col.sticky ? "sticky " : "") + (neg ? "neg" : "") + '">' + esc(text) + "</td>";
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  return html;
}

function downloadCsv(filename, columns, rows) {
  const lines = [columns.map(function (col) { return col.label; }).join(",")];
  rows.forEach(function (row) {
    lines.push(columns.map(function (col) {
      const value = row[col.key];
      const text = value == null ? "" : String(col.format ? formatValue(col.format, value) : value);
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function playerColumns() {
  const labels = {
    player: "Player",
    matches: "Matches",
    attackAttempts: "Attacks",
    kills: "Kills",
    killErrors: "Errors",
    hitting: "Hitting",
    digs: "Digs",
    assists: "Assists",
    aces: "Aces",
    serveErrors: "Serve errors",
    serveRating: "Serve rating",
    receiveRating: "Receive",
    stuffBlocks: "Stuffs",
    unforcedErrors: "Unforced",
  };
  const formats = {
    hitting: "hitting",
    serveRating: "rating",
    receiveRating: "rating",
  };
  return [{ key: "player", label: "Player", left: true, sticky: true }].concat(TABLE_STATS.map(function (key) {
    return { key: key, label: labels[key], format: formats[key] || (key === "matches" ? null : "int") };
  }));
}

function renderPlayers() {
  const stat = statById(state.statId);
  const usePerMatch = state.perMatch && !!stat.perMatch;
  const savedPerMatch = state.perMatch;
  if (!usePerMatch) state.perMatch = false;
  let records = aggregatePlayers(selectedPlayerRows());
  const query = state.nameQuery.trim().toLowerCase();
  if (query) {
    records = records.filter(function (row) { return row.player.toLowerCase().indexOf(query) !== -1; });
  }
  const qualified = records.filter(function (row) { return passesSample(row, stat) && valueOf(row, stat) != null; });
  state.perMatch = usePerMatch;
  const chartRecords = sortRecords(qualified.map(displayRecord));
  const tableRecords = sortRecords(records.map(displayRecord));
  state.perMatch = savedPerMatch;
  const attacks = sumField(selectedPlayerRows(), "attackAttempts");
  const kills = sumField(selectedPlayerRows(), "kills") || 0;
  const errors = sumField(selectedPlayerRows(), "killErrors") || 0;
  const teamHitting = attacks ? (kills - errors) / attacks : null;

  let html = controlsHtml();
  html += '<section class="strip">';
  html += metric("Hitting", formatValue("hitting", teamHitting));
  html += metric("Kills", formatValue("int", sumField(selectedPlayerRows(), "kills")));
  html += metric("Aces", formatValue("int", sumField(selectedPlayerRows(), "aces")));
  html += metric("Digs", formatValue("int", sumField(selectedPlayerRows(), "digs")));
  html += "</section>";
  html += '<section class="card"><div class="card-head"><div><h2>' + esc(stat.label + (usePerMatch ? " per match" : "") + " by player") + "</h2>";
  html += '<p class="sub">' + esc(chartRecords.length + " player" + (chartRecords.length === 1 ? "" : "s") + (stat.sample ? " with at least " + state.minSample + " " + stat.sampleLabel : "") + ". " + matchSpan(selectedMatchKeys()) + ".") + "</p></div>";
  if (chartRecords.length) html += saveButton("players");
  html += "</div>";
  if (!chartRecords.length) {
    html += '<p class="empty">No players match this filter. Lower the minimum or clear the name.</p>';
  } else {
    const height = Math.max(240, chartRecords.length * 34 + 24);
    html += '<div class="chart-box" style="height:' + height + 'px"><canvas id="player-chart"></canvas></div>';
  }
  html += "</section>";
  const columns = playerColumns();
  html += '<section class="card"><div class="card-head"><div><h2>All stats</h2><p class="sub">Click a column to sort. Rates stay weighted even when counts are per match.</p></div>';
  html += '<button type="button" class="text-btn" id="download-players">Download CSV</button></div>';
  html += tableRecords.length ? tableHtml(columns, tableRecords, state.sortKey) : '<p class="empty">Nobody in the selected matches.</p>';
  html += "</section>";
  return { html: html, draw: function () { drawPlayerChart(chartRecords, stat, usePerMatch); }, csv: function () { downloadCsv("player-stats.csv", columns, tableRecords); } };
}

function metric(label, value) {
  return "<article><span class=\"value\">" + esc(value) + "</span><span class=\"label\">" + esc(label) + "</span></article>";
}

function playerChartConfig(records, stat, valueLabel) {
  const values = records.map(function (row) { return valueOf(row, stat); });
  const scales = baseScales(stat, true);
  scales.x.title = { display: true, text: valueLabel || stat.label };
  return {
    type: "bar",
    data: {
      labels: records.map(function (row) { return row.player; }),
      datasets: [{
        data: values,
        backgroundColor: values.map(function (value) { return value < 0 ? "#a3262c" : "#b8431f"; }),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: chartLayoutPadding() },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (item) {
              const row = records[item.dataIndex];
              const sample = stat.sample && row[stat.sample] != null ? " · " + formatValue("int", row[stat.sample]) + " " + stat.sampleLabel : "";
              return formatStat(stat, item.parsed.x) + sample;
            },
          },
        },
      },
      scales: scales,
    },
  };
}

function drawPlayerChart(records, stat, perMatch) {
  const canvas = document.getElementById("player-chart");
  if (!canvas) return;
  makeChart(canvas, playerChartConfig(records, stat, stat.label + (perMatch ? " per match" : "")));
}

function renderCompare() {
  const stat = statById(state.statId);
  const names = playerNamesInView();
  let html = controlsHtml();
  html += playerPicker(names);
  const chosen = chosenPlayers(names);
  if (!chosen.length) {
    html += '<p class="empty">Pick a player. All selects everyone in the matches above.</p>';
    return { html: html, draw: function () {} };
  }
  html += '<section class="card" style="margin-top:14px"><div class="card-head"><div><h2>' + esc(stat.label) + ' by game</h2><p class="sub">' + esc(trendCaption(chosen, stat, selectedMatchKeys())) + '</p></div>';
  html += saveButton("trend");
  html += "</div>";
  html += '<div class="chart-box" style="height:' + chartHeight(chosen.length) + 'px"><canvas id="trend-chart"></canvas></div></section>';
  const records = aggregatePlayers(selectedPlayerRows()).filter(function (row) {
    return chosen.indexOf(row.player) !== -1;
  });
  const order = new Map(chosen.map(function (name, index) { return [name, index]; }));
  records.sort(function (a, b) { return order.get(a.player) - order.get(b.player); });
  html += '<section class="card"><div class="card-head"><div><h2>Side by side</h2><p class="sub">Season totals for the selected matches.</p></div>';
  html += '<button type="button" class="text-btn" id="download-compare">Download CSV</button></div>';
  const columns = playerColumns();
  html += tableHtml(columns, records, null);
  html += "</section>";
  html += gradeCard("Serve scores", "How often each serve score shows up. 5 is an ace and 0 is an error.", chosen, "serveScores", [0, 1, 2, 3, 5], "serve-chart");
  html += gradeCard("Serve receive grades", "3 is a perfect pass. 0 is an ace against.", chosen, "receiveGrades", [0, 1, 2, 3], "receive-chart");
  return {
    html: html,
    draw: function () {
      drawTrend(chosen, stat);
      drawGrades(chosen, "serveScores", [0, 1, 2, 3, 5], "serve-chart");
      drawGrades(chosen, "receiveGrades", [0, 1, 2, 3], "receive-chart");
    },
    csv: function () { downloadCsv("player-comparison.csv", columns, records); },
  };
}

function chartHeight(count) {
  return 280 + Math.ceil(count / 3) * 22;
}

function playerPicker(names) {
  const allOn = names.length > 0 && names.every(function (name) { return state.compare.indexOf(name) !== -1; });
  let html = '<div class="chips" id="player-chips">';
  html += '<button type="button" class="chip" data-players="all" aria-pressed="' + allOn + '">All</button>';
  html += '<button type="button" class="chip" data-players="none">None</button>';
  names.forEach(function (name) {
    const on = state.compare.indexOf(name) !== -1;
    html += '<button type="button" class="chip" data-player="' + esc(name) + '" aria-pressed="' + on + '">' + esc(name) + "</button>";
  });
  html += "</div>";
  return html;
}

function chosenPlayers(names) {
  return state.compare.filter(function (name) { return names.indexOf(name) !== -1; });
}

function gameValue(player, key, stat, rows) {
  const source = rows || selectedPlayerRows();
  const mine = source.filter(function (row) {
    return matchKey(row) === key && row.player === player;
  });
  if (!mine.length) return null;
  return valueOf(aggregatePlayers(mine)[0], stat);
}

function renderByGame() {
  const stat = statById(state.statId);
  const names = playerNamesInView();
  const chosen = chosenPlayers(names);
  let html = controlsHtml();
  html += playerPicker(names);
  if (!chosen.length) {
    html += '<p class="empty">Pick one player, or several, to graph this stat game by game.</p>';
    return { html: html, draw: function () {} };
  }
  const keys = selectedMatchKeys();
  html += '<section class="card" style="margin-top:14px"><div class="card-head"><div><h2>' + esc(stat.label) + ' by game</h2>';
  html += '<p class="sub">' + esc(trendCaption(chosen, stat, keys)) + '</p></div>';
  html += saveButton("trend");
  html += "</div>";
  html += '<div class="chart-box" style="height:' + (chartHeight(chosen.length) + 28) + 'px"><canvas id="trend-chart"></canvas></div></section>';
  const columns = [{ key: "game", label: "Game", left: true, sticky: true }].concat(chosen.map(function (name) {
    return { key: name, label: name, format: stat.format || "int" };
  }));
  const tableRows = keys.map(function (key) {
    const parts = key.split("|");
    const row = { game: shortDate(parts[0]) + " " + parts[1] };
    chosen.forEach(function (name) { row[name] = gameValue(name, key, stat); });
    return row;
  });
  html += '<section class="card"><div class="card-head"><div><h2>Game by game</h2><p class="sub">Same numbers as the chart. A dash means that player has no line for that game.</p></div>';
  html += '<button type="button" class="text-btn" id="download-bygame">Download CSV</button></div>';
  html += tableHtml(columns, tableRows, null);
  html += "</section>";
  return {
    html: html,
    draw: function () { drawTrend(chosen, stat); },
    csv: function () { downloadCsv("by-game.csv", columns, tableRows); },
  };
}

function playerNamesInView() {
  const names = [];
  selectedPlayerRows().forEach(function (row) {
    if (names.indexOf(row.player) === -1) names.push(row.player);
  });
  names.sort();
  return names;
}

function gradeCard(title, sub, players, field, bins, canvasId) {
  const any = selectedPlayerRows().some(function (row) {
    return players.indexOf(row.player) !== -1 && row[field] && row[field].length;
  });
  if (!any) return "";
  const height = chartHeight(players.length);
  const shareTitle = field === "receiveGrades" ? "Share of serve receives" : "Share of serves";
  const shareSub = field === "receiveGrades"
    ? "Percent of that player's passes in each grade. One player's bars add up to 100%."
    : "Percent of that player's serves in each score. One player's bars add up to 100%.";
  let html = '<section class="card"><div class="card-head"><div><h2>' + esc(title) + '</h2><p class="sub">' + esc(sub + " " + nameList(players) + ". " + matchSpan(selectedMatchKeys()) + ".") + '</p></div>' + saveButton("grades", field) + '</div>';
  html += '<div class="chart-box" style="height:' + height + 'px"><canvas id="' + canvasId + '"></canvas></div>';
  html += '<div class="card-head" style="margin-top:18px"><div><h2>' + esc(shareTitle) + '</h2><p class="sub">' + esc(shareSub) + '</p></div>' + saveButton("grades", field, true) + '</div>';
  html += '<div class="chart-box" style="height:' + height + 'px"><canvas id="' + canvasId + '-share"></canvas></div></section>';
  return html;
}

function trendConfig(players, stat, keys, rows, opts) {
  const compact = opts && opts.compact;
  const labels = gameChartLabels(keys, compact);
  const datasets = players.map(function (player, index) {
    return {
      label: player,
      data: keys.map(function (key) { return gameValue(player, key, stat, rows); }),
      borderColor: SERIES[index % SERIES.length],
      backgroundColor: SERIES[index % SERIES.length],
      tension: 0.25,
      spanGaps: false,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });
  const scales = baseScales(stat, false);
  scales.y.title = { display: true, text: stat.label };
  scales.x.title = { display: !compact, text: "Game" };
  scales.x.ticks = gameAxisTicks(keys, compact);
  return {
    type: "line",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: chartLayoutPadding() },
      plugins: {
        legend: { position: "bottom", labels: { padding: 12, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            title: function (items) {
              const parts = keys[items[0].dataIndex].split("|");
              return shortDate(parts[0]) + " · " + parts[1];
            },
            label: function (item) {
              return item.dataset.label + ": " + formatStat(stat, item.parsed.y);
            },
          },
        },
      },
      scales: scales,
    },
  };
}

function drawTrend(players, stat) {
  const canvas = document.getElementById("trend-chart");
  if (!canvas) return;
  makeChart(canvas, trendConfig(players, stat, selectedMatchKeys(), selectedPlayerRows()));
}

function gradeCounts(players, field, bins, rows) {
  return players.map(function (player) {
    const counts = bins.map(function () { return 0; });
    rows.forEach(function (row) {
      if (row.player !== player) return;
      (row[field] || []).forEach(function (score) {
        const at = bins.indexOf(score);
        if (at >= 0) counts[at] += 1;
      });
    });
    return counts;
  });
}

function gradePercents(counts) {
  const total = counts.reduce(function (sum, n) { return sum + n; }, 0);
  if (!total) return counts.map(function () { return null; });
  return counts.map(function (n) { return Math.round((n / total) * 1000) / 10; });
}

function formatGradePercent(value) {
  if (value == null || isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return (rounded % 1 === 0 ? String(rounded.toFixed(0)) : String(rounded)) + "%";
}

function gradeConfig(players, field, bins, rows, opts) {
  const compact = opts && opts.compact;
  const asPercent = opts && opts.percent;
  const datasets = gradeCounts(players, field, bins, rows).map(function (counts, index) {
    return {
      label: players[index],
      data: asPercent ? gradePercents(counts) : counts,
      counts: counts,
      backgroundColor: SERIES[index % SERIES.length],
      borderRadius: 3,
    };
  });
  const yTitle = asPercent
    ? (field === "receiveGrades" ? "Percent of passes" : "Percent of serves")
    : "How many";
  return {
    type: "bar",
    data: {
      labels: gradeAxisLabels(field, bins),
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: chartLayoutPadding() },
      plugins: {
        legend: { position: "bottom", labels: { padding: 12, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (item) {
              const counts = item.dataset.counts || [];
              const count = counts[item.dataIndex];
              if (!asPercent) return item.dataset.label + ": " + item.parsed.y;
              const share = formatGradePercent(item.parsed.y);
              const detail = count == null ? share : share + " (" + count + ")";
              return item.dataset.label + ": " + detail;
            },
          },
        },
      },
      datasets: { bar: { categoryPercentage: 0.72, barPercentage: 0.9 } },
      scales: {
        x: {
          title: { display: !compact, text: "Score" },
          grid: { display: false },
          ticks: { maxRotation: compact ? 45 : 0, minRotation: compact ? 45 : 0, font: { size: compact ? 10 : 11 } },
        },
        y: asPercent
          ? {
            beginAtZero: true,
            max: 100,
            ticks: { callback: function (value) { return value + "%"; } },
            grid: { color: "#efe8dc" },
            title: { display: true, text: yTitle },
          }
          : { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#efe8dc" }, title: { display: true, text: yTitle } },
      },
    },
  };
}

function drawGrades(players, field, bins, canvasId) {
  const rows = selectedPlayerRows();
  const canvas = document.getElementById(canvasId);
  if (canvas) makeChart(canvas, gradeConfig(players, field, bins, rows));
  const share = document.getElementById(canvasId + "-share");
  if (share) makeChart(share, gradeConfig(players, field, bins, rows, { percent: true }));
}

function matchRows(keys) {
  const set = new Set(keys || []);
  return DATA.matches.filter(function (match) { return set.has(matchKey(match)); }).map(function (match) {
    const playerRows = DATA.players.filter(function (row) {
      return row.date === match.date && row.opponent === match.opponent;
    });
    const attacks = sumField(playerRows, "attackAttempts");
    const kills = sumField(playerRows, "kills") || 0;
    const errors = sumField(playerRows, "killErrors") || 0;
    const serve = DATA.serving.find(function (row) {
      return row.date === match.date && row.opponent === match.opponent && String(row.set) === "Total";
    }) || {};
    const rots = DATA.rotations.filter(function (row) {
      return row.date === match.date && row.opponent === match.opponent;
    });
    return {
      label: shortDate(match.date),
      date: match.date,
      opponent: match.opponent,
      sheetHitting: match.teamHitting,
      playerHitting: attacks ? (kills - errors) / attacks : null,
      kills: sumField(playerRows, "kills"),
      killErrors: sumField(playerRows, "killErrors"),
      attackAttempts: attacks,
      acesUs: serve.acesUs,
      acesThem: serve.acesThem,
      errorsUs: serve.errorsUs,
      errorsThem: serve.errorsThem,
      pointsFor: rots.length ? sumField(rots, "pointsFor") : null,
      pointsAgainst: rots.length ? sumField(rots, "pointsAgainst") : null,
      note: match.note,
    };
  });
}

function renderMatches() {
  const rows = matchRows(selectedMatchKeys());
  const gaps = rows.filter(function (row) {
    return row.sheetHitting != null && row.playerHitting != null && Math.abs(row.sheetHitting - row.playerHitting) > 0.01;
  });
  let html = "";
  if (gaps.length) {
    html += '<div class="callout">';
    gaps.forEach(function (row) {
      html += esc(shortDate(row.date) + " " + row.opponent) + " is written as " + formatValue("hitting", row.sheetHitting) + " on the sheet, and " + formatValue("hitting", row.playerHitting) + " if you add up the player lines. ";
    });
    html += "</div>";
  }
  html += '<section class="card"><div class="card-head"><div><h2>Team hitting by match</h2><p class="sub">' + esc("The navy bars are the hitting percentage written on the stat sheet. The red bars use the same formula on every player line. " + matchSpan(selectedMatchKeys()) + ".") + '</p></div>';
  if (rows.length) html += saveButton("matches");
  html += "</div>";
  html += rows.length ? '<div class="chart-box" style="height:300px"><canvas id="match-chart"></canvas></div>' : '<p class="empty">No matches selected.</p>';
  html += "</section>";
  const columns = [
    { key: "date", label: "Date", left: true, sticky: true },
    { key: "opponent", label: "Opponent", left: true },
    { key: "sheetHitting", label: "Sheet hitting", format: "hitting" },
    { key: "playerHitting", label: "From players", format: "hitting" },
    { key: "kills", label: "Kills", format: "int" },
    { key: "killErrors", label: "Errors", format: "int" },
    { key: "attackAttempts", label: "Attacks", format: "int" },
    { key: "acesUs", label: "Aces us", format: "int" },
    { key: "acesThem", label: "Aces them", format: "int" },
    { key: "errorsUs", label: "Serve errors us", format: "int" },
    { key: "errorsThem", label: "Serve errors them", format: "int" },
    { key: "pointsFor", label: "Rotation points for", format: "int" },
    { key: "pointsAgainst", label: "Rotation points against", format: "int" },
  ];
  const display = rows.map(function (row) {
    return Object.assign({}, row, { date: shortDate(row.date) });
  });
  html += '<section class="card"><div class="card-head"><div><h2>Match table</h2><p class="sub">Rotation points are only filled in when that sheet had a rotation table.</p></div>';
  html += '<button type="button" class="text-btn" id="download-matches">Download CSV</button></div>';
  html += tableHtml(columns, display, null);
  html += "</section>";
  return { html: html, draw: function () { drawMatchChart(rows); }, csv: function () { downloadCsv("matches.csv", columns, display); } };
}

function matchChartConfig(rows) {
  const scales = baseScales(statById("hitting"), false);
  scales.y.title = { display: true, text: "Hitting %" };
  scales.x.title = { display: true, text: "Match" };
  scales.x.ticks = gameAxisTicks(rows.map(function (row) { return row.date + "|" + row.opponent; }), rows.length > 6);
  return {
    type: "bar",
    data: {
      labels: rows.map(function (row) { return shortDate(row.date) + " " + row.opponent; }),
      datasets: [
        { label: "Written on the sheet", data: rows.map(function (row) { return row.sheetHitting; }), backgroundColor: "#1f4e79", borderRadius: 4 },
        { label: "Added up from players", data: rows.map(function (row) { return row.playerHitting; }), backgroundColor: "#b8431f", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: chartLayoutPadding() },
      plugins: { legend: { position: "bottom", labels: { padding: 12, boxWidth: 12 } } },
      scales: scales,
    },
  };
}

function drawMatchChart(rows) {
  const canvas = document.getElementById("match-chart");
  if (!canvas) return;
  makeChart(canvas, matchChartConfig(rows));
}

function renderRotations() {
  const rows = selectedRotations();
  const missing = DATA.matches.filter(function (match) {
    return inSelectedMatches(match) && !DATA.rotations.some(function (row) {
      return row.date === match.date && row.opponent === match.opponent;
    });
  });
  let html = "";
  if (missing.length) {
    html += '<p class="hint">No rotation table for ' + esc(missing.map(function (match) {
      return shortDate(match.date) + " " + match.opponent;
    }).join(", ")) + ".</p>";
  }
  if (!rows.length) {
    html += '<p class="empty">None of the selected matches have rotation stats.</p>';
    return { html: html, draw: function () {} };
  }
  const byRot = ROT_ORDER.map(function (rotation) {
    const group = rows.filter(function (row) { return row.rotation === rotation; });
    return {
      rotation: "Rotation " + rotation,
      pointsFor: sumField(group, "pointsFor"),
      pointsAgainst: sumField(group, "pointsAgainst"),
      net: sumField(group, "net"),
      hitting: hittingOf(group),
      attackAttempts: sumField(group, "attackAttempts"),
      kills: sumField(group, "kills"),
      killErrors: sumField(group, "killErrors"),
    };
  });
  html += '<section class="card"><div class="card-head"><div><h2>Points by rotation</h2><p class="sub">' + esc("Setter starting position, in the order the sheet uses: 1, 6, 5, 4, 3, 2. Net is points scored minus points against. " + matchSpan(selectedMatchKeys()) + ".") + '</p></div>';
  html += saveButton("rotations");
  html += "</div>";
  html += '<div class="chart-box" style="height:320px"><canvas id="rot-chart"></canvas></div></section>';
  const columns = [
    { key: "rotation", label: "Rotation", left: true, sticky: true },
    { key: "pointsFor", label: "Points for", format: "int" },
    { key: "pointsAgainst", label: "Points against", format: "int" },
    { key: "net", label: "Net", format: "int" },
    { key: "attackAttempts", label: "Attacks", format: "int" },
    { key: "kills", label: "Kills", format: "int" },
    { key: "killErrors", label: "Errors", format: "int" },
    { key: "hitting", label: "Hitting", format: "hitting" },
  ];
  html += '<section class="card"><div class="card-head"><div><h2>Rotation totals</h2></div>';
  html += '<button type="button" class="text-btn" id="download-rot">Download CSV</button></div>';
  html += tableHtml(columns, byRot, null);
  html += "</section>";
  return { html: html, draw: function () { drawRotChart(byRot); }, csv: function () { downloadCsv("rotations.csv", columns, byRot); } };
}

function rotChartConfig(rows) {
  return {
    type: "bar",
    data: {
      labels: rows.map(function (row) { return row.rotation; }),
      datasets: [
        { label: "Points for", data: rows.map(function (row) { return row.pointsFor; }), backgroundColor: "#1d6b45", borderRadius: 4 },
        { label: "Points against", data: rows.map(function (row) { return row.pointsAgainst; }), backgroundColor: "#a3262c", borderRadius: 4 },
        { label: "Net", data: rows.map(function (row) { return row.net; }), backgroundColor: "#1f4e79", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Rotation" }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: "Points" }, grid: { color: "#efe8dc" } },
      },
    },
  };
}

function drawRotChart(rows) {
  const canvas = document.getElementById("rot-chart");
  if (!canvas) return;
  makeChart(canvas, rotChartConfig(rows));
}

function renderServing() {
  const totals = selectedServingTotals();
  let html = '<section class="card"><div class="card-head"><div><h2>Aces by match</h2><p class="sub">' + esc("Match totals. An ace is a serve that ended the rally. " + matchSpan(selectedMatchKeys()) + ".") + '</p></div>';
  if (totals.length) html += saveButton("aces");
  html += "</div>";
  html += totals.length ? '<div class="chart-box" style="height:300px"><canvas id="ace-chart"></canvas></div>' : '<p class="empty">No serving lines for these matches.</p>';
  html += "</section>";
  html += '<section class="card"><div class="card-head"><div><h2>Ace percentage by match</h2><p class="sub">' + esc("As written on the sheet: aces divided by serves in the match. " + matchSpan(selectedMatchKeys()) + ".") + '</p></div>';
  if (totals.length) html += saveButton("acePct");
  html += "</div>";
  html += totals.length ? '<div class="chart-box" style="height:300px"><canvas id="acepct-chart"></canvas></div>' : "";
  html += "</section>";
  const setRows = DATA.serving.filter(function (row) {
    return inSelectedMatches(row) && String(row.set) !== "Total";
  }).map(function (row) {
    return {
      date: shortDate(row.date),
      opponent: row.opponent,
      set: row.set,
      acesUs: row.acesUs,
      errorsUs: row.errorsUs,
      acePctUs: row.acePctUs,
      errorPctUs: row.errorPctUs,
      acesThem: row.acesThem,
      errorsThem: row.errorsThem,
      acePctThem: row.acePctThem,
      errorPctThem: row.errorPctThem,
    };
  });
  const columns = [
    { key: "date", label: "Date", left: true, sticky: true },
    { key: "opponent", label: "Opponent", left: true },
    { key: "set", label: "Set" },
    { key: "acesUs", label: "Aces us", format: "int" },
    { key: "errorsUs", label: "Errors us", format: "int" },
    { key: "acePctUs", label: "Ace % us", format: "pct" },
    { key: "errorPctUs", label: "Error % us", format: "pct" },
    { key: "acesThem", label: "Aces them", format: "int" },
    { key: "errorsThem", label: "Errors them", format: "int" },
    { key: "acePctThem", label: "Ace % them", format: "pct" },
    { key: "errorPctThem", label: "Error % them", format: "pct" },
  ];
  html += '<section class="card"><div class="card-head"><div><h2>By set</h2><p class="sub">Percentages are blank on sets where the sheet did not fill them in. Sep 4 New Hope only wrote percents for set 1.</p></div>';
  html += '<button type="button" class="text-btn" id="download-serve">Download CSV</button></div>';
  html += tableHtml(columns, setRows, null);
  html += "</section>";
  return { html: html, draw: function () { drawServing(totals); }, csv: function () { downloadCsv("serving-by-set.csv", columns, setRows); } };
}

function aceChartConfig(rows) {
  const tickKeys = rows.map(function (row) { return row.date + "|" + row.opponent; });
  const labels = gameChartLabels(tickKeys, rows.length > 6);
  return {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        { label: "Us", data: rows.map(function (row) { return row.acesUs; }), backgroundColor: "#1f4e79", borderRadius: 4 },
        { label: "Them", data: rows.map(function (row) { return row.acesThem; }), backgroundColor: "#b8431f", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Match" }, grid: { display: false }, ticks: gameAxisTicks(tickKeys, rows.length > 6) },
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Aces" }, grid: { color: "#efe8dc" } },
      },
    },
  };
}

function acePctChartConfig(rows) {
  const pctStat = { format: "pct", scaleMax: 0.5 };
  const scales = baseScales(pctStat, false);
  scales.y.title = { display: true, text: "Ace %" };
  scales.x.title = { display: true, text: "Match" };
  const tickKeys = rows.map(function (row) { return row.date + "|" + row.opponent; });
  scales.x.ticks = gameAxisTicks(tickKeys, rows.length > 6);
  return {
    type: "bar",
    data: {
      labels: gameChartLabels(tickKeys, rows.length > 6),
      datasets: [
        { label: "Us", data: rows.map(function (row) { return row.acePctUs; }), backgroundColor: "#1f4e79", borderRadius: 4 },
        { label: "Them", data: rows.map(function (row) { return row.acePctThem; }), backgroundColor: "#b8431f", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: { callbacks: { label: function (item) { return item.dataset.label + ": " + formatValue("pct", item.parsed.y); } } },
      },
      scales: scales,
    },
  };
}

function drawServing(rows) {
  const ace = document.getElementById("ace-chart");
  const pct = document.getElementById("acepct-chart");
  if (ace) makeChart(ace, aceChartConfig(rows));
  if (pct) makeChart(pct, acePctChartConfig(rows));
}

const GRAPH_KEY = "vball-graphs";
let savedGraphs = [];
let pdfMessage = "";
let sharedReport = null;

function playerRowsFor(keys) {
  const set = new Set(keys || []);
  return DATA.players.filter(function (row) { return set.has(matchKey(row)); });
}

function servingTotalsFor(keys) {
  const set = new Set(keys || []);
  return DATA.serving.filter(function (row) {
    return set.has(matchKey(row)) && String(row.set) === "Total";
  });
}

function rotationTotals(keys) {
  const set = new Set(keys || []);
  const rows = DATA.rotations.filter(function (row) { return set.has(matchKey(row)); });
  return ROT_ORDER.map(function (rotation) {
    const group = rows.filter(function (row) { return row.rotation === rotation; });
    return {
      rotation: "Rotation " + rotation,
      pointsFor: sumField(group, "pointsFor"),
      pointsAgainst: sumField(group, "pointsAgainst"),
      net: sumField(group, "net"),
    };
  });
}

function saveButton(kind, field, percent) {
  let extra = field ? ' data-field="' + field + '"' : "";
  if (percent) extra += ' data-percent="1"';
  return '<button type="button" class="text-btn" data-save="' + kind + '"' + extra + ">Save graph</button>";
}

function nameList(names) {
  const list = names || [];
  if (!list.length) return "no players selected";
  if (list.length === 1) return list[0];
  if (list.length === 2) return list[0] + " and " + list[1];
  return list.slice(0, -1).join(", ") + ", and " + list[list.length - 1];
}

function matchSpan(keys) {
  const ordered = (keys || []).slice().sort();
  if (!ordered.length) return "No matches selected";
  const all = allMatchKeys();
  const indexes = ordered.map(function (key) { return all.indexOf(key); });
  const contiguous = indexes.every(function (value, index) {
    return index === 0 || value === indexes[index - 1] + 1;
  });
  function label(key) {
    const parts = key.split("|");
    return shortDate(parts[0]) + " " + parts[1];
  }
  if (ordered.length === all.length) {
    return "All " + all.length + " matches, " + label(ordered[0]) + " through " + label(ordered[ordered.length - 1]);
  }
  if (ordered.length === 1) return label(ordered[0]);
  if (contiguous) return label(ordered[0]) + " through " + label(ordered[ordered.length - 1]) + " (" + ordered.length + " matches)";
  if (ordered.length <= 6) return ordered.map(label).join(", ");
  return ordered.slice(0, 5).map(label).join(", ") + ", and " + (ordered.length - 5) + " more";
}

function trendCaption(players, stat, keys) {
  return "Each point is that player’s " + stat.label.toLowerCase() + " in one game. " + stat.hint + " Players: " + nameList(players) + ". " + matchSpan(keys) + ". A gap means that player has no line for that game.";
}

function gradeBins(field) {
  return field === "receiveGrades" ? [0, 1, 2, 3] : [0, 1, 2, 3, 5];
}

function withChartState(spec, fn) {
  const saved = {
    perMatch: state.perMatch,
    minSample: state.minSample,
    sortKey: state.sortKey,
    sortDir: state.sortDir,
  };
  state.perMatch = !!spec.perMatch;
  if (typeof spec.minSample === "number") state.minSample = spec.minSample;
  if (spec.sortKey) state.sortKey = spec.sortKey;
  if (spec.sortDir) state.sortDir = spec.sortDir;
  try {
    return fn();
  } finally {
    state.perMatch = saved.perMatch;
    state.minSample = saved.minSample;
    state.sortKey = saved.sortKey;
    state.sortDir = saved.sortDir;
  }
}

function playerChartRecords(spec) {
  return withChartState(spec, function () {
    const stat = statById(spec.statId);
    let records = aggregatePlayers(playerRowsFor(spec.matchKeys || []));
    const query = (spec.nameQuery || "").trim().toLowerCase();
    if (query) {
      records = records.filter(function (row) { return row.player.toLowerCase().indexOf(query) !== -1; });
    }
    const picked = spec.players || [];
    if (picked.length) {
      const order = new Map(picked.map(function (name, index) { return [name, index]; }));
      records = records.filter(function (row) { return order.has(row.player); });
      records.sort(function (a, b) { return order.get(a.player) - order.get(b.player); });
    }
    const qualified = records.filter(function (row) {
      return passesSample(row, stat) && valueOf(row, stat) != null;
    });
    const displayed = qualified.map(displayRecord);
    if (picked.length) return displayed;
    return sortRecords(displayed);
  });
}

function defaultTitle(spec) {
  const stat = statById(spec.statId);
  if (spec.kind === "players") return stat.label + (spec.perMatch ? " per match" : "") + " by player";
  if (spec.kind === "trend") return stat.label + " by game";
  if (spec.kind === "grades") {
    const base = spec.field === "receiveGrades" ? "Serve receive grades" : "Serve scores";
    return spec.percent ? base + " (%)" : base;
  }
  if (spec.kind === "matches") return "Team hitting by match";
  if (spec.kind === "rotations") return "Points by rotation";
  if (spec.kind === "aces") return "Aces by match";
  if (spec.kind === "acePct") return "Ace percentage by match";
  return "Graph";
}

function describeSpec(spec) {
  const stat = statById(spec.statId);
  const span = matchSpan(spec.matchKeys || []);
  if (spec.kind === "players") {
    const count = playerChartRecords(spec).length;
    const sample = stat.sample ? " with at least " + spec.minSample + " " + stat.sampleLabel : "";
    const mode = spec.perMatch ? " Counts are per match played." : "";
    const named = spec.nameQuery ? " Name filter: " + spec.nameQuery + "." : "";
    return stat.hint + mode + named + " " + count + " player" + (count === 1 ? "" : "s") + sample + ". " + span + ".";
  }
  if (spec.kind === "trend") return trendCaption(spec.players || [], stat, spec.matchKeys || []);
  if (spec.kind === "grades") {
    const meaning = spec.field === "receiveGrades"
      ? "Serve receive grades. 3 is a perfect pass to the setter, 2 is average, 1 is out of system, and 0 is an ace against."
      : "Serve scores. 5 is an ace, 3 is out of system, 2 is in system, 1 is a perfect pass, and 0 is an error.";
    const measure = spec.percent
      ? " Bars show the percent of that player's attempts in each bucket."
      : " Bars count how often each score shows up.";
    return meaning + measure + " Players: " + nameList(spec.players || []) + ". " + span + ".";
  }
  if (spec.kind === "matches") {
    return "Team hitting percentage by match. Navy bars are the figure written on the stat sheet. Red bars add up every player line: (kills - errors) / attack attempts. " + span + ".";
  }
  if (spec.kind === "rotations") {
    const keys = spec.matchKeys || [];
    const missing = DATA.matches.filter(function (match) {
      return keys.indexOf(matchKey(match)) !== -1 && !DATA.rotations.some(function (row) {
        return row.date === match.date && row.opponent === match.opponent;
      });
    });
    let text = "Points by the setter’s starting position, in the order on the sheet: 1, 6, 5, 4, 3, 2. Green is points scored, red is points against, and blue is the net. " + span + ".";
    if (missing.length) {
      text += " No rotation table for " + missing.map(function (match) {
        return shortDate(match.date) + " " + match.opponent;
      }).join(", ") + ".";
    }
    return text;
  }
  if (spec.kind === "aces") return "Aces in the match, us and them. An ace is a serve that ended the rally. " + span + ".";
  if (spec.kind === "acePct") return "Ace percentage as written on the sheet: aces divided by serves in the match, us and them. " + span + ".";
  return span + ".";
}

function liveSpec(kind, extra) {
  const stat = statById(state.statId);
  const spec = {
    kind: kind,
    statId: state.statId,
    matchKeys: selectedMatchKeys(),
    players: chosenPlayers(playerNamesInView()),
    perMatch: !!(state.perMatch && stat.perMatch),
    minSample: state.minSample,
    nameQuery: state.nameQuery.trim(),
    sortKey: state.sortKey,
    sortDir: state.sortDir,
    include: true,
    note: "",
  };
  if (extra) Object.assign(spec, extra);
  return spec;
}

function buildSpec(kind, extra) {
  const spec = liveSpec(kind, extra);
  spec.id = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  spec.created = new Date().toISOString();
  spec.title = defaultTitle(spec);
  return spec;
}

function graphConfig(spec, opts) {
  const stat = statById(spec.statId);
  const keys = (spec.matchKeys || []).slice().sort();
  if (spec.kind === "players") {
    const records = playerChartRecords(spec);
    if (!records.length) return null;
    return playerChartConfig(records, stat, stat.label + (spec.perMatch ? " per match" : ""));
  }
  if (spec.kind === "trend") {
    if (!(spec.players || []).length || !keys.length) return null;
    return trendConfig(spec.players, stat, keys, playerRowsFor(keys), opts);
  }
  if (spec.kind === "grades") {
    if (!(spec.players || []).length) return null;
    return gradeConfig(spec.players, spec.field, gradeBins(spec.field), playerRowsFor(keys), Object.assign({}, opts, { percent: !!spec.percent }));
  }
  if (spec.kind === "matches") {
    const rows = matchRows(keys);
    if (!rows.length) return null;
    return matchChartConfig(rows);
  }
  if (spec.kind === "rotations") return rotChartConfig(rotationTotals(keys));
  if (spec.kind === "aces") {
    const rows = servingTotalsFor(keys);
    if (!rows.length) return null;
    return aceChartConfig(rows);
  }
  if (spec.kind === "acePct") {
    const rows = servingTotalsFor(keys);
    if (!rows.length) return null;
    return acePctChartConfig(rows);
  }
  return null;
}

function previewHeight(spec) {
  if (spec.kind === "players") return Math.max(240, playerChartRecords(spec).length * 34 + 24);
  if (spec.kind === "trend" || spec.kind === "grades") return chartHeight((spec.players || []).length) + 28;
  return 320;
}

function findGraph(id) {
  return savedGraphs.find(function (graph) { return graph.id === id; });
}

function persistGraphs() {
  try {
    localStorage.setItem(GRAPH_KEY, JSON.stringify(savedGraphs));
  } catch (err) {
    /* private mode or full storage */
  }
}

function loadGraphs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GRAPH_KEY) || "[]");
    if (!Array.isArray(parsed)) return;
    savedGraphs = parsed.filter(function (spec) {
      return spec && typeof spec.id === "string" && /^[a-z0-9]+$/i.test(spec.id) && typeof spec.kind === "string" && Array.isArray(spec.matchKeys);
    }).map(function (spec) {
      if (typeof spec.include !== "boolean") spec.include = true;
      if (typeof spec.title !== "string") spec.title = defaultTitle(spec);
      if (typeof spec.note !== "string") spec.note = "";
      return spec;
    });
  } catch (err) {
    savedGraphs = [];
  }
}

function renderSaved() {
  const selected = savedGraphs.filter(function (graph) { return graph.include; }).length;
  let html = '<div class="saved-bar"><div><h2>Saved graphs</h2>';
  html += '<p class="sub">Set up a chart on any other tab and click Save graph. Check the ones to include, then download a PDF or copy a link to a page that shows those same graphs.</p></div>';
  html += '<div class="card-actions">';
  html += '<button type="button" class="text-btn" data-graphs="all">All</button>';
  html += '<button type="button" class="text-btn" data-graphs="none">None</button>';
  html += '<button type="button" class="text-btn" id="share-report"' + (selected ? "" : " disabled") + ">Copy share link</button>";
  html += '<button type="button" class="text-btn primary" id="download-pdf"' + (selected ? "" : " disabled") + ">Download PDF" + (selected ? " (" + selected + ")" : "") + "</button>";
  html += "</div></div>";
  html += '<p class="hint" id="pdf-status"></p>';
  if (!savedGraphs.length) {
    html += '<p class="empty">No saved graphs yet.</p>';
    return { html: html, draw: function () {} };
  }
  savedGraphs.forEach(function (spec) {
    const ready = !!graphConfig(spec);
    html += '<section class="card graph-card">';
    html += '<div class="graph-top"><label class="check"><input type="checkbox" data-graph-check="' + esc(spec.id) + '"' + (spec.include ? " checked" : "") + "> Include</label>";
    html += '<button type="button" class="text-btn" data-graph-delete="' + esc(spec.id) + '">Remove</button></div>';
    html += '<label class="control"><span class="control-label">Title</span>';
    html += '<input class="search graph-title" data-graph-title="' + esc(spec.id) + '" value="' + esc(spec.title || "") + '"></label>';
    html += '<p class="sub graph-detail">' + esc(describeSpec(spec)) + "</p>";
    html += '<label class="control"><span class="control-label">Note on the PDF</span>';
    html += '<input class="search" data-graph-note="' + esc(spec.id) + '" placeholder="Optional" value="' + esc(spec.note || "") + '"></label>';
    if (ready) {
      html += '<div class="chart-box" style="height:' + previewHeight(spec) + 'px;margin-top:12px"><canvas id="saved-' + esc(spec.id) + '"></canvas></div>';
    } else {
      html += '<p class="empty">This graph has no rows for the matches it was saved with.</p>';
    }
    html += "</section>";
  });
  return {
    html: html,
    draw: function () {
      savedGraphs.forEach(function (spec) {
        const canvas = document.getElementById("saved-" + spec.id);
        const config = canvas && graphConfig(spec);
        if (config) makeChart(canvas, config);
      });
    },
  };
}

function pdfText(value) {
  return String(value)
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/\u00f7/g, "/")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function chartPng(spec) {
  const config = graphConfig(spec, { compact: true });
  if (!config || !window.Chart) return null;
  const height = previewHeight(spec);
  const width = 1000;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-12000px;top:0;width:" + width + "px;height:" + height + "px;";
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  document.body.appendChild(host);
  config.options = config.options || {};
  config.options.animation = false;
  config.options.responsive = true;
  config.options.maintainAspectRatio = false;
  config.options.devicePixelRatio = 2;
  config.plugins = config.plugins || [];
  config.plugins.push({
    id: "exportBg",
    beforeDraw: function (chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = "#fffdf9";
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  });
  const chart = makeChart(canvas, config, false);
  let url = null;
  if (chart) {
    chart.resize();
    url = chart.toBase64Image("image/png", 1);
    chart.destroy();
  }
  host.remove();
  if (!url) return null;
  return { url: url, width: width, height: height };
}

function pdfBlock(doc, spec, width) {
  const shot = chartPng(spec);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const titleLines = doc.splitTextToSize(pdfText(spec.title || defaultTitle(spec)), width);
  const titleH = titleLines.length * doc.getLineHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const detailLines = doc.splitTextToSize(pdfText(describeSpec(spec)), width);
  const detailH = detailLines.length * doc.getLineHeight();
  const note = spec.note && spec.note.trim() ? pdfText(spec.note.trim()) : "";
  const noteLines = note ? doc.splitTextToSize(note, width) : [];
  const noteH = noteLines.length ? noteLines.length * doc.getLineHeight() + 2 : 0;
  const textH = titleH + detailH + noteH + 8;
  const aspect = shot ? shot.width / shot.height : 1;
  const chartH = shot ? width / aspect : 14;
  return {
    shot: shot,
    titleLines: titleLines,
    detailLines: detailLines,
    noteLines: noteLines,
    textH: textH,
    chartH: chartH,
    aspect: aspect,
  };
}

function packPdf(doc, blocks) {
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const width = pageW - margin * 2;
  const top = 54;
  const bottom = pageH - 34;
  const gap = 16;
  const room = bottom - top;
  const pages = [];
  let page = [];
  let y = top;
  blocks.forEach(function (block) {
    let chartH = block.chartH;
    let height = block.textH + chartH;
    if (height > room) {
      chartH = Math.max(72, room - block.textH);
      height = block.textH + chartH;
    }
    if (page.length && y + height > bottom) {
      pages.push(page);
      page = [];
      y = top;
    }
    page.push({ block: block, chartH: chartH, y: y, height: height });
    y += height + gap;
  });
  if (page.length) pages.push(page);
  return { pages: pages, margin: margin, width: width, pageW: pageW, pageH: pageH };
}

function drawPdfBlock(doc, item, margin, width) {
  const block = item.block;
  let y = item.y;
  doc.setTextColor(28, 25, 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(block.titleLines, margin, y);
  y += block.titleLines.length * doc.getLineHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 74, 66);
  doc.text(block.detailLines, margin, y);
  y += block.detailLines.length * doc.getLineHeight() + 2;
  if (block.noteLines.length) {
    doc.setTextColor(28, 25, 21);
    doc.text(block.noteLines, margin, y);
    y += block.noteLines.length * doc.getLineHeight() + 2;
  }
  y += 6;
  if (!block.shot) {
    doc.setTextColor(80, 74, 66);
    doc.text("This graph has no rows for the matches it was saved with.", margin, y);
    return;
  }
  const drawW = Math.min(width, item.chartH * block.aspect);
  const drawH = drawW / block.aspect;
  const x = margin + (width - drawW) / 2;
  doc.addImage(block.shot.url, "PNG", x, y, drawW, drawH);
}

function paintPdf(doc, layout) {
  const total = layout.pages.length;
  layout.pages.forEach(function (items, index) {
    if (index) doc.addPage("letter", "portrait");
    doc.setFillColor(244, 240, 232);
    doc.rect(0, 0, layout.pageW, layout.pageH, "F");
    doc.setTextColor(184, 67, 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("DEFENDERS VARSITY VOLLEYBALL", layout.margin, 32);
    items.forEach(function (item, itemIndex) {
      if (itemIndex) {
        doc.setDrawColor(227, 219, 207);
        doc.setLineWidth(0.6);
        doc.line(layout.margin, item.y - 8, layout.margin + layout.width, item.y - 8);
      }
      drawPdfBlock(doc, item, layout.margin, layout.width);
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 112, 102);
    doc.text((index + 1) + " of " + total, layout.pageW - layout.margin, layout.pageH - 18, { align: "right" });
  });
}

function base64url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(function (b) { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(text) {
  const pad = text.length % 4 === 0 ? "" : "====".slice(text.length % 4);
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeReport(graphs) {
  const payload = graphs.map(function (spec) {
    const item = {
      k: spec.kind,
      s: spec.statId,
      t: spec.title || "",
      m: spec.matchKeys || [],
    };
    if (spec.note) item.n = spec.note;
    if (spec.players && spec.players.length) item.p = spec.players;
    if (spec.perMatch) item.pm = 1;
    if (typeof spec.minSample === "number") item.min = spec.minSample;
    if (spec.nameQuery) item.q = spec.nameQuery;
    if (spec.sortKey) item.sk = spec.sortKey;
    if (spec.sortDir) item.sd = spec.sortDir;
    if (spec.field) item.f = spec.field;
    return item;
  });
  return base64url(JSON.stringify(payload));
}

function decodeReport(text) {
  const data = JSON.parse(fromBase64url(text));
  if (!Array.isArray(data)) return [];
  return data.map(function (item, index) {
    const spec = {
      id: "r" + index,
      kind: item.k,
      statId: item.s,
      title: item.t || "",
      note: item.n || "",
      players: item.p || [],
      matchKeys: item.m || [],
      perMatch: !!item.pm,
      minSample: typeof item.min === "number" ? item.min : 0,
      nameQuery: item.q || "",
      sortKey: item.sk || item.s,
      sortDir: item.sd || "desc",
      field: item.f || "",
      include: true,
    };
    if (!spec.title) spec.title = defaultTitle(spec);
    return spec;
  }).filter(function (spec) {
    return spec.kind && spec.statId && Array.isArray(spec.matchKeys);
  });
}

function reportSpecsFromLocation() {
  const hash = location.hash || "";
  if (hash.indexOf("#r=") !== 0) return null;
  try {
    return decodeReport(hash.slice(3));
  } catch (err) {
    return [];
  }
}

function shareUrl(graphs) {
  return location.href.split("#")[0] + "#r=" + encodeReport(graphs);
}

function copyShareLink() {
  const chosen = savedGraphs.filter(function (graph) { return graph.include; });
  const status = document.getElementById("pdf-status");
  if (!chosen.length) return;
  const url = shareUrl(chosen);
  const done = function (copied) {
    if (!status) return;
    status.textContent = copied ? "Link copied. Anyone with it sees these graphs." : url;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
  } else {
    done(false);
  }
}

function sheetGraphHtml(spec, chartH) {
  let html = '<section class="sheet-graph">';
  html += "<h2>" + esc(spec.title || defaultTitle(spec)) + "</h2>";
  html += '<p class="sheet-detail">' + esc(describeSpec(spec)) + "</p>";
  if (spec.note && spec.note.trim()) html += '<p class="sheet-note">' + esc(spec.note.trim()) + "</p>";
  if (graphConfig(spec)) {
    html += '<div class="chart-box" style="height:' + Math.round(chartH) + 'px"><canvas id="report-' + esc(spec.id) + '"></canvas></div>';
  } else {
    html += '<p class="sheet-detail">This graph has no rows for the matches it was saved with.</p>';
  }
  html += "</section>";
  return html;
}

function packReportSpecs(specs, contentWidth, contentHeight) {
  const gap = 16;
  const blocks = specs.map(function (spec) {
    const probe = document.createElement("div");
    probe.className = "sheet-graph";
    probe.style.position = "absolute";
    probe.style.left = "-10000px";
    probe.style.top = "0";
    probe.style.width = contentWidth + "px";
    probe.innerHTML = "<h2>" + esc(spec.title || defaultTitle(spec)) + "</h2>" +
      '<p class="sheet-detail">' + esc(describeSpec(spec)) + "</p>" +
      (spec.note && spec.note.trim() ? '<p class="sheet-note">' + esc(spec.note.trim()) + "</p>" : "");
    document.body.appendChild(probe);
    const textH = probe.offsetHeight;
    probe.remove();
    const ready = !!graphConfig(spec);
    let chartH = ready ? contentWidth * previewHeight(spec) / 1000 : 0;
    if (ready) chartH = Math.max(chartH, minChartHeight(spec));
    let total = textH + chartH + (ready ? 8 : 0);
    const floor = ready ? minChartHeight(spec) : 0;
    if (total > contentHeight) {
      chartH = Math.max(floor, contentHeight - textH - 8);
      total = textH + chartH + 8;
    }
    return { spec: spec, chartH: chartH, total: total };
  });
  const pages = [];
  let page = [];
  let used = 0;
  blocks.forEach(function (block) {
    const extra = page.length ? gap : 0;
    if (page.length && used + extra + block.total > contentHeight) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(block);
    used += (page.length > 1 ? gap : 0) + block.total;
  });
  if (page.length) pages.push(page);
  return pages;
}

function renderSharedReport(specs) {
  sharedReport = specs;
  document.body.classList.add("report-mode");
  document.title = "Defenders Varsity Volleyball";
  const view = document.getElementById("view");
  if (!specs.length) {
    view.innerHTML = '<p class="empty">This link does not contain any graphs.</p>';
    return;
  }
  const gauge = document.createElement("article");
  gauge.className = "sheet";
  gauge.innerHTML = '<p class="sheet-brand">Defenders Varsity Volleyball</p><div class="sheet-body"></div><p class="sheet-page">1</p>';
  view.appendChild(gauge);
  const body = gauge.querySelector(".sheet-body");
  const contentWidth = body.clientWidth || 720;
  const contentHeight = body.clientHeight || 860;
  gauge.remove();
  const pages = packReportSpecs(specs, contentWidth, contentHeight);
  let html = '<div class="report-bar"><a href="./">Stats</a>';
  html += '<button type="button" class="text-btn" id="download-pdf">Download PDF</button></div>';
  html += '<div class="sheets">';
  pages.forEach(function (page, pageIndex) {
    html += '<article class="sheet">';
    html += '<p class="sheet-brand">Defenders Varsity Volleyball</p>';
    html += '<div class="sheet-body">';
    page.forEach(function (block) {
      html += sheetGraphHtml(block.spec, block.chartH);
    });
    html += "</div>";
    html += '<p class="sheet-page">' + (pageIndex + 1) + " of " + pages.length + "</p>";
    html += "</article>";
  });
  html += "</div>";
  html += '<p class="site-version report-version">Site version ' + esc(SITE_VERSION) + "</p>";
  view.innerHTML = html;
  pages.forEach(function (page) {
    page.forEach(function (block) {
      const canvas = document.getElementById("report-" + block.spec.id);
      const config = canvas && graphConfig(block.spec, { compact: true });
      if (!config) return;
      config.options = config.options || {};
      config.options.animation = false;
      const chart = makeChart(canvas, config);
      if (chart) chart.resize();
    });
  });
}
function downloadPdf() {
  const button = document.getElementById("download-pdf");
  const chosen = sharedReport || savedGraphs.filter(function (graph) { return graph.include; });
  const status = document.getElementById("pdf-status");
  if (!chosen.length) return;
  if (!window.jspdf || !window.jspdf.jsPDF) {
    if (status) status.textContent = "The PDF library did not load. Refresh while online, then try again.";
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing PDF...";
  }
  setTimeout(function () {
    try {
      const doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const width = doc.internal.pageSize.getWidth() - 80;
      const blocks = chosen.map(function (spec) { return pdfBlock(doc, spec, width); });
      paintPdf(doc, packPdf(doc, blocks));
      doc.save("defenders-volleyball-graphs.pdf");
      pdfMessage = "";
    } catch (err) {
      pdfMessage = "Could not build the PDF.";
    }
    if (sharedReport) {
      if (button) {
        button.disabled = false;
        button.textContent = "Download PDF";
      }
      return;
    }
    render();
    const status = document.getElementById("pdf-status");
    if (status && pdfMessage) status.textContent = pdfMessage;
  }, 30);
}

const VIEWS = {
  players: renderPlayers,
  compare: renderCompare,
  bygame: renderByGame,
  matches: renderMatches,
  rotations: renderRotations,
  serving: renderServing,
  saved: renderSaved,
};

let csvAction = null;

function render() {
  destroyCharts();
  renderRange();
  renderMatchChips();
  const filters = document.querySelector(".filters");
  if (filters) filters.hidden = state.view === "saved";
  document.querySelectorAll("#tabs button").forEach(function (button) {
    button.setAttribute("aria-selected", button.dataset.view === state.view ? "true" : "false");
    if (button.dataset.view === "saved") {
      button.textContent = savedGraphs.length ? "Saved (" + savedGraphs.length + ")" : "Saved";
    }
  });
  const built = VIEWS[state.view]();
  document.getElementById("view").innerHTML = built.html;
  csvAction = built.csv || null;
  built.draw();
  saveState();
}

function saveState() {
  try {
    localStorage.setItem("vball-explorer", JSON.stringify({
      view: state.view,
      matchKeys: Array.from(state.matchKeys),
      statId: state.statId,
      perMatch: state.perMatch,
      minSample: state.minSample,
      sortKey: state.sortKey,
      sortDir: state.sortDir,
      compare: state.compare,
    }));
  } catch (err) {
    /* private mode */
  }
}

function loadState() {
  const keys = allMatchKeys();
  keys.forEach(function (key) { state.matchKeys.add(key); });
  const totals = aggregatePlayers(DATA.players).sort(function (a, b) {
    return (b.attackAttempts || 0) - (a.attackAttempts || 0);
  });
  state.compare = totals.slice(0, 4).map(function (row) { return row.player; });
  try {
    const saved = JSON.parse(localStorage.getItem("vball-explorer") || "null");
    if (!saved) return;
    if (VIEWS[saved.view]) state.view = saved.view;
    if (Array.isArray(saved.matchKeys) && saved.matchKeys.length) {
      state.matchKeys = new Set(saved.matchKeys.filter(function (key) { return keys.indexOf(key) !== -1; }));
    }
    if (statById(saved.statId).id === saved.statId) state.statId = saved.statId;
    if (typeof saved.perMatch === "boolean") state.perMatch = saved.perMatch;
    if (typeof saved.minSample === "number") state.minSample = saved.minSample;
    if (saved.sortKey) state.sortKey = saved.sortKey;
    if (saved.sortDir) state.sortDir = saved.sortDir;
    if (Array.isArray(saved.compare) && saved.compare.length) state.compare = saved.compare;
  } catch (err) {
    /* ignore broken storage */
  }
}

function onClick(event) {
  const tab = event.target.closest("#tabs button");
  if (tab) {
    state.view = tab.dataset.view;
    render();
    return;
  }
  const match = event.target.closest("[data-match]");
  if (match) {
    if (match.dataset.match === "all") {
      allMatchKeys().forEach(function (key) { state.matchKeys.add(key); });
    } else if (match.dataset.match === "none") {
      state.matchKeys.clear();
    } else if (state.matchKeys.has(match.dataset.match)) {
      state.matchKeys.delete(match.dataset.match);
    } else {
      state.matchKeys.add(match.dataset.match);
    }
    render();
    return;
  }
  const playerGroup = event.target.closest("[data-players]");
  if (playerGroup) {
    state.compare = playerGroup.dataset.players === "all" ? playerNamesInView() : [];
    render();
    return;
  }
  const player = event.target.closest("[data-player]");
  if (player) {
    const name = player.dataset.player;
    const at = state.compare.indexOf(name);
    if (at === -1) state.compare.push(name);
    else state.compare.splice(at, 1);
    render();
    return;
  }
  if (event.target.id === "mode-total") {
    state.perMatch = false;
    render();
    return;
  }
  if (event.target.id === "mode-per") {
    state.perMatch = true;
    render();
    return;
  }
  const sort = event.target.closest("[data-sort]");
  if (sort && state.view === "players") {
    const key = sort.dataset.sort;
    if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else {
      state.sortKey = key;
      state.sortDir = key === "player" ? "asc" : "desc";
    }
    render();
    return;
  }
  const save = event.target.closest("[data-save]");
  if (save) {
    const extra = {};
    if (save.dataset.field) extra.field = save.dataset.field;
    if (save.dataset.percent) extra.percent = true;
    savedGraphs.unshift(buildSpec(save.dataset.save, extra));
    persistGraphs();
    save.disabled = true;
    save.textContent = "Saved";
    const tab = document.querySelector('#tabs button[data-view="saved"]');
    if (tab) tab.textContent = "Saved (" + savedGraphs.length + ")";
    return;
  }
  const remove = event.target.closest("[data-graph-delete]");
  if (remove) {
    savedGraphs = savedGraphs.filter(function (graph) { return graph.id !== remove.dataset.graphDelete; });
    persistGraphs();
    render();
    return;
  }
  const pick = event.target.closest("[data-graphs]");
  if (pick) {
    const on = pick.dataset.graphs === "all";
    savedGraphs.forEach(function (graph) { graph.include = on; });
    persistGraphs();
    render();
    return;
  }
  if (event.target.id === "download-pdf") {
    downloadPdf();
    return;
  }
  if (event.target.id === "share-report") {
    copyShareLink();
    return;
  }
  if (event.target.id && event.target.id.indexOf("download-") === 0 && csvAction) csvAction();
}

function onChange(event) {
  if (event.target.dataset.graphCheck) {
    const graph = findGraph(event.target.dataset.graphCheck);
    if (graph) {
      graph.include = event.target.checked;
      persistGraphs();
    }
    const button = document.getElementById("download-pdf");
    const count = savedGraphs.filter(function (item) { return item.include; }).length;
    const share = document.getElementById("share-report");
    if (button) {
      button.disabled = !count;
      button.textContent = count ? "Download PDF (" + count + ")" : "Download PDF";
    }
    if (share) share.disabled = !count;
    return;
  }
  if (event.target.id === "stat-select") {
    state.statId = event.target.value;
    state.sortKey = event.target.value;
    state.sortDir = "desc";
    if (!statById(state.statId).perMatch) state.perMatch = false;
    render();
  }
  if (event.target.id === "min-sample") {
    state.minSample = Number(event.target.value);
    render();
  }
}

function onInput(event) {
  if (event.target.dataset.graphTitle || event.target.dataset.graphNote) {
    const graph = findGraph(event.target.dataset.graphTitle || event.target.dataset.graphNote);
    if (graph) {
      if (event.target.dataset.graphTitle) graph.title = event.target.value;
      else graph.note = event.target.value;
      persistGraphs();
    }
    return;
  }
  if (event.target.id === "min-sample") {
    state.minSample = Number(event.target.value);
    const label = event.target.parentElement && event.target.parentElement.querySelector(".control-label");
    const stat = statById(state.statId);
    if (label) label.textContent = "At least " + state.minSample + " " + stat.sampleLabel;
  }
  if (event.target.id === "name-query") {
    state.nameQuery = event.target.value;
    render();
    const input = document.getElementById("name-query");
    if (input) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }
}

function renderSiteVersion() {
  const foot = document.querySelector(".foot");
  if (!foot) return;
  let el = document.getElementById("site-version");
  if (!el) {
    el = document.createElement("p");
    el.id = "site-version";
    el.className = "site-version";
    foot.appendChild(el);
  }
  el.textContent = "Site version " + SITE_VERSION + " · Ctrl+F5 if this looks old after an update";
}

function init() {
  if (!DATA) {
    document.getElementById("view").innerHTML = '<p class="empty">Stats data did not load.</p>';
    renderSiteVersion();
    return;
  }
  chartDefaults();
  renderSiteVersion();
  const shared = reportSpecsFromLocation();
  if (shared) {
    renderSharedReport(shared);
    document.body.addEventListener("click", onClick);
    return;
  }
  loadState();
  loadGraphs();
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("change", onChange);
  document.body.addEventListener("input", onInput);
  render();
}

init();
