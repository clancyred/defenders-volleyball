/**
 * Watches the varsity stat Google Sheet and commits it to GitHub when its values change.
 * The "Rebuild data from stat sheet" workflow then rebuilds data.js and redeploys the site.
 *
 * Setup (once, in the Google account the sheet is shared with):
 * 1. Go to https://script.new and paste this file into Code.gs.
 * 2. Project Settings: tick "Show appsscript.json manifest file in editor", then paste
 *    scripts/sheet_sync/appsscript.json over the manifest. SpreadsheetApp.openById needs the
 *    full spreadsheets scope even though this script only reads.
 * 3. Project Settings > Script properties: add GITHUB_TOKEN, a fine-grained GitHub token
 *    limited to clancyred/defenders-volleyball with Contents: Read and write.
 * 4. In the editor, run syncNow once and approve the permissions. It pushes the sheet right away.
 * 5. Run installTrigger once. From then on checkSheet runs every 5 minutes.
 */

const SHEET_ID = "1WQ93Pf9_Ct8sqLAs6VJH_vRfUD8SyKRTtalC6xIbvC4";
const REPO = "clancyred/defenders-volleyball";
const BRANCH = "main";
const REPO_PATH = "source/varsity_stat_workbook.xlsx";
const CHECK_EVERY_MINUTES = 5;

function checkSheet() {
  sync_(false);
}

function syncNow() {
  sync_(true);
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "checkSheet") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("checkSheet").timeBased().everyMinutes(CHECK_EVERY_MINUTES).create();
  Logger.log("checkSheet will run every " + CHECK_EVERY_MINUTES + " minutes.");
}

function sync_(force) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty("GITHUB_TOKEN");
    if (!token) throw new Error("Add a GITHUB_TOKEN script property first.");

    const hash = valuesHash_();
    if (!force && hash === props.getProperty("LAST_HASH")) return;

    commitToGitHub_(token, exportXlsx_(), "Update stat workbook from Google Sheet");
    props.setProperty("LAST_HASH", hash);
    Logger.log("Pushed the sheet to " + REPO + "/" + REPO_PATH);
  } finally {
    lock.releaseLock();
  }
}

// Drive's modified time also moves on formatting and view changes, so compare cell values instead.
function valuesHash_() {
  const tabs = SpreadsheetApp.openById(SHEET_ID).getSheets().map(function (sheet) {
    return [sheet.getName(), sheet.getDataRange().getValues()];
  });
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(tabs));
  return Utilities.base64Encode(digest);
}

function exportXlsx_() {
  const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=xlsx";
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  const type = String(res.getHeaders()["Content-Type"] || "");
  if (res.getResponseCode() !== 200 || type.indexOf("html") !== -1) {
    throw new Error("Could not export the sheet as xlsx (HTTP " + res.getResponseCode() + "). "
      + "The owner may have turned off downloads for viewers.");
  }
  return res.getBlob().getBytes();
}

function commitToGitHub_(token, bytes, message) {
  const url = "https://api.github.com/repos/" + REPO + "/contents/" + REPO_PATH;
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const current = UrlFetchApp.fetch(url + "?ref=" + BRANCH, { headers: headers, muteHttpExceptions: true });
  const body = { message: message, content: Utilities.base64Encode(bytes), branch: BRANCH };
  if (current.getResponseCode() === 200) body.sha = JSON.parse(current.getContentText()).sha;

  const res = UrlFetchApp.fetch(url, {
    method: "put",
    headers: headers,
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error("GitHub commit failed (HTTP " + res.getResponseCode() + "): " + res.getContentText());
  }
}
