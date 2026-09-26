/**
 * Receives reading results from the practice website and adds one row
 * to the "test result" sheet:
 * TimeDates | studentName | unitName | correctPercentageforReading | mistakeQuestionNumber
 *
 * Paste this into Extensions > Apps Script of the results spreadsheet,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('test result');
    sheet.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'),
      String(d.studentName || '').slice(0, 80),
      String(d.unitName || '').slice(0, 80),
      String(d.correctPercentageforReading || ''),
      String(d.mistakeQuestionNumber || '')
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Results receiver is running.');
}
