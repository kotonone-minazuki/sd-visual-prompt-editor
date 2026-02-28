/**
 * file-io.js - ファイル入出力
 */
function getTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${h}${min}${s}`;
}

function downloadFile(content, baseFilename, mimeType) {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const extIndex = baseFilename.lastIndexOf(".");
  const name =
    extIndex > 0 ? baseFilename.substring(0, extIndex) : baseFilename;
  const ext = extIndex > 0 ? baseFilename.substring(extIndex) : "";
  const filename = `${name}_${getTimestamp()}${ext}`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleFileUpload(inputElement, callback) {
  const file = inputElement.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    callback(e.target.result);
    inputElement.value = "";
  };
  reader.readAsText(file);
}

function saveNormalTxt() {
  const content = editorNormal.getValue();
  downloadFile(content, "prompt_editor.txt", "text/plain;charset=utf-8");
}

function loadNormalTxt(input) {
  const current = editorNormal.getValue();
  if (
    current.trim() !== "" &&
    !confirm("現在の内容を上書きしてもよろしいですか？")
  ) {
    input.value = "";
    return;
  }
  handleFileUpload(input, (text) => {
    editorNormal.setValue(text);
    saveToLocalStorage();
  });
}

function saveSpreadsheetJson() {
  const content = JSON.stringify(spreadsheetData, null, 2);
  downloadFile(content, "prompt_project.json", "application/json");
}

function loadSpreadsheetJson(input) {
  if (!confirm("スプレッドシートの内容を上書きしてもよろしいですか？")) {
    input.value = "";
    return;
  }
  handleFileUpload(input, (text) => {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        spreadsheetData = data;
        renderSpreadsheet();
        saveToLocalStorage();
      } else {
        alert("無効なJSONファイルです。");
      }
    } catch (e) {
      alert("ファイルの読み込みに失敗しました: " + e.message);
    }
  });
}

function saveSpreadsheetTsv() {
  const content = spreadsheetData.map((row) => row.join("\t")).join("\n");
  downloadFile(
    content,
    "prompt_sheet.tsv",
    "text/tab-separated-values;charset=utf-8",
  );
}

function loadSpreadsheetTsv(input) {
  if (!confirm("スプレッドシートの内容を上書きしてもよろしいですか？")) {
    input.value = "";
    return;
  }
  handleFileUpload(input, (text) => {
    const rows = text.split(/\r\n|\n|\r/);
    const newData = [];
    rows.forEach((rowStr) => {
      if (rowStr === "" && newData.length > 0) return;
      newData.push(rowStr.split("\t"));
    });
    if (newData.length > 0) {
      const maxCols = newData.reduce(
        (max, row) => Math.max(max, row.length),
        0,
      );
      newData.forEach((row) => {
        while (row.length < maxCols) row.push("");
      });
      spreadsheetData = newData;
      renderSpreadsheet();
      saveToLocalStorage();
    }
  });
}
