function doGet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var snapshotInfo = getRuntimeStatus();

  return jsonResponse({
    ok: true,
    service: "llw-google-sheets-sync",
    spreadsheetId: spreadsheet.getId(),
    revision: snapshotInfo.revision || 0,
    updatedAt: snapshotInfo.updatedAt || "",
    sheets: spreadsheet.getSheets().map(function (sheet) {
      return {
        name: sheet.getName(),
        rows: Math.max(sheet.getLastRow() - 1, 0)
      };
    })
  });
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var result;

    if (payload.action === "read_runtime_snapshot") {
      result = readRuntimeSnapshot();
    } else if (payload.type === "runtime_snapshot") {
      result = writeRuntimeSnapshot(payload);
    } else if (payload.type === "event_batch") {
      result = appendEventBatch(payload);
    } else if (payload.type === "full_sync") {
      result = appendFullSync(payload);
    } else {
      result = { ok: false, message: "Unsupported payload type." };
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error && error.message ? error.message : String(error)
    });
  }
}

function readRuntimeSnapshot() {
  var snapshotInfo = getRuntimeStatus();
  return {
    ok: true,
    revision: snapshotInfo.revision || 0,
    updatedAt: snapshotInfo.updatedAt || "",
    checksum: snapshotInfo.checksum || "",
    snapshot: buildRuntimeSnapshotFromSheets()
  };
}

function writeRuntimeSnapshot(payload) {
  var snapshot = payload && payload.snapshot ? payload.snapshot : {};
  var collections = payload && payload.collections ? payload.collections : {};
  var events = Array.isArray(payload && payload.events) ? payload.events : [];
  var generatedAt = payload.generated_at || new Date().toISOString();
  var revision = Number(payload.revision || 0);
  var checksum = String(payload.checksum || "");
  var source = String(payload.source || "");
  var appUrl = String(payload.app_url || "");
  var reason = String(payload.reason || "persist");
  var syncRunId = String(payload.sync_run_id || "");

  appendRows("runtime_snapshots", [{
    revision: revision,
    updated_at: generatedAt,
    checksum: checksum,
    reason: reason,
    source: source,
    app_url: appUrl,
    sync_run_id: syncRunId,
    collection_count: Object.keys(collections).length,
    event_count: events.length
  }]);

  Object.keys(collections).forEach(function (sheetName) {
    var records = Array.isArray(collections[sheetName]) ? collections[sheetName] : [];
    replaceRows(sheetName, records.map(function (record, index) {
      return decorateStateRow(sheetName, record, {
        revision: revision,
        updatedAt: generatedAt,
        source: source,
        appUrl: appUrl,
        index: index
      });
    }));
  });

  if (events.length) {
    appendRows("sync_events", events.map(function (eventRow) {
      return normalizeRow(eventRow);
    }));
  }

  replaceRows("sync_status", [{
    revision: revision,
    updated_at: generatedAt,
    checksum: checksum,
    reason: reason,
    source: source,
    app_url: appUrl,
    sync_run_id: syncRunId,
    collection_count: Object.keys(collections).length,
    event_count: events.length
  }]);

  return {
    ok: true,
    type: "runtime_snapshot",
    revision: revision,
    eventCount: events.length,
    sheets: Object.keys(collections)
  };
}

function appendFullSync(payload) {
  var sheets = payload && payload.sheets ? payload.sheets : {};
  var appended = {};

  Object.keys(sheets).forEach(function (sheetName) {
    var rows = Array.isArray(sheets[sheetName]) ? sheets[sheetName] : [];
    appended[sheetName] = appendRows(sheetName, rows);
  });

  return {
    ok: true,
    type: "full_sync",
    syncRunId: payload.sync_run_id || "",
    appended: appended
  };
}

function appendEventBatch(payload) {
  var events = Array.isArray(payload && payload.events) ? payload.events : [];
  var grouped = {};

  events.forEach(function (eventRow) {
    var sheetName = String(eventRow.__sheet || "events");
    if (!grouped[sheetName]) grouped[sheetName] = [];
    grouped[sheetName].push(eventRow);
  });

  var appended = {};
  Object.keys(grouped).forEach(function (sheetName) {
    appended[sheetName] = appendRows(sheetName, grouped[sheetName]);
  });

  appendRows("sync_events", events);

  return {
    ok: true,
    type: "event_batch",
    syncRunId: payload.sync_run_id || "",
    eventCount: events.length,
    appended: appended
  };
}

function decorateStateRow(sheetName, record, meta) {
  var normalizedRecord = normalizeRow(record);
  return mergeObjects({
    __sheet: sheetName,
    __revision: meta.revision,
    __updated_at: meta.updatedAt,
    __source: meta.source,
    __app_url: meta.appUrl,
    __record_id: buildRecordId(sheetName, record, meta.index),
    __payload_json: JSON.stringify(record)
  }, flattenRecord(normalizedRecord));
}

function buildRecordId(sheetName, record, index) {
  var candidates = [
    record && record.id,
    record && record.payment_id,
    record && record.order_id,
    record && record.refund_id,
    record && record.transaction_id,
    record && record.slug,
    record && record.code,
    record && record.email,
    record && record.key,
    record && record.name,
    record && record.label,
    record && record.minute
  ];

  for (var i = 0; i < candidates.length; i += 1) {
    var candidate = candidates[i];
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== "") {
      return String(candidate).trim();
    }
  }

  if (sheetName === "settings") return "settings:singleton";
  return sheetName + ":" + String(index || 0);
}

function getRuntimeStatus() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("sync_status");
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return {
      revision: 0,
      updatedAt: "",
      checksum: ""
    };
  }

  var headers = getHeaders(sheet);
  if (!headers.length) {
    return {
      revision: 0,
      updatedAt: "",
      checksum: ""
    };
  }

  var lastRow = sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = {};
  headers.forEach(function (header, index) {
    row[header] = lastRow[index];
  });

  return {
    revision: Number(row.revision || 0),
    updatedAt: String(row.updated_at || ""),
    checksum: String(row.checksum || "")
  };
}

function buildRuntimeSnapshotFromSheets() {
  var snapshot = {};
  var arrayCollections = [
    "team",
    "students",
    "products",
    "orders",
    "payment_records",
    "due_promises",
    "refunds",
    "links",
    "webinars",
    "webinarSessions",
    "webinarAttendance",
    "bootcamps",
    "instructors",
    "marketing_spend",
    "attendanceTimeline"
  ];

  arrayCollections.forEach(function (sheetName) {
    snapshot[sheetName] = readStateSheetRows(sheetName);
  });

  var settingsRows = readStateSheetRows("settings");
  snapshot.settings = settingsRows.length ? settingsRows[0] : {};

  return snapshot;
}

function readStateSheetRows(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];

  var headers = getHeaders(sheet);
  if (!headers.length) return [];

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return values.map(function (row) {
    var record = {};
    headers.forEach(function (header, index) {
      record[header] = row[index];
    });
    if (record.__payload_json) {
      return JSON.parse(String(record.__payload_json));
    }
    return record;
  });
}

function appendRows(sheetName, rows) {
  if (!rows.length) return 0;

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  var normalizedRows = rows.map(normalizeRow);
  var existingHeaders = getHeaders(sheet);
  var headers = mergeHeaders(existingHeaders, normalizedRows);

  if (!existingHeaders.length) {
    writeHeaders(sheet, headers);
  } else if (headers.length !== existingHeaders.length || headers.some(function (header, index) { return header !== existingHeaders[index]; })) {
    rewriteHeaders(sheet, headers);
  }

  var values = normalizedRows.map(function (row) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(row, header) ? row[header] : "";
    });
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  return values.length;
}

function replaceRows(sheetName, rows) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  var normalizedRows = rows.map(normalizeRow);
  var headers = mergeHeaders([], normalizedRows);

  sheet.clearContents();

  if (!headers.length) {
    return 0;
  }

  writeHeaders(sheet, headers);

  var values = normalizedRows.map(function (row) {
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(row, header) ? row[header] : "";
    });
  });

  if (values.length) {
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  return values.length;
}

function flattenRecord(value, prefix, target) {
  var output = target || {};
  var basePrefix = prefix || "";

  if (Array.isArray(value)) {
    if (basePrefix) output[basePrefix] = JSON.stringify(value);
    return output;
  }

  if (value && Object.prototype.toString.call(value) === "[object Object]") {
    var keys = Object.keys(value);
    if (!keys.length && basePrefix) {
      output[basePrefix] = "";
      return output;
    }

    keys.forEach(function (key) {
      flattenRecord(value[key], basePrefix ? basePrefix + "." + key : key, output);
    });
    return output;
  }

  if (basePrefix) output[basePrefix] = normalizeValue(value);
  return output;
}

function normalizeRow(row) {
  var normalized = {};
  Object.keys(row || {}).forEach(function (key) {
    normalized[key] = normalizeValue(row[key]);
  });
  return normalized;
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || Object.prototype.toString.call(value) === "[object Object]") {
    return JSON.stringify(value);
  }
  return value;
}

function mergeObjects(left, right) {
  var merged = {};
  Object.keys(left || {}).forEach(function (key) {
    merged[key] = left[key];
  });
  Object.keys(right || {}).forEach(function (key) {
    merged[key] = right[key];
  });
  return merged;
}

function getHeaders(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].filter(function (value) {
    return String(value || "").trim() !== "";
  });
}

function mergeHeaders(existingHeaders, rows) {
  var headers = existingHeaders.slice();
  rows.forEach(function (row) {
    Object.keys(row).forEach(function (key) {
      if (headers.indexOf(key) === -1) headers.push(key);
    });
  });
  return headers;
}

function writeHeaders(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function rewriteHeaders(sheet, headers) {
  var existingData = [];
  if (sheet.getLastRow() > 1 && sheet.getLastColumn() > 0) {
    existingData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  }

  var oldHeaders = getHeaders(sheet);
  sheet.clearContents();
  writeHeaders(sheet, headers);

  if (!existingData.length) return;

  var remapped = existingData.map(function (row) {
    var record = {};
    oldHeaders.forEach(function (header, index) {
      record[header] = row[index];
    });
    return headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
    });
  });

  sheet.getRange(2, 1, remapped.length, headers.length).setValues(remapped);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
