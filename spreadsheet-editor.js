/**
 * spreadsheet-editor.js - スプレッドシート操作
 */

// Undo用の履歴スタック
let spreadsheetUndoStack = [];
const MAX_UNDO_STACK = 20;

/**
 * 現在のspreadsheetDataの状態を履歴に保存し、Undoボタンの有効/無効を切り替える
 */
function saveSpreadsheetState() {
  const deepCopy = JSON.parse(JSON.stringify(spreadsheetData));
  spreadsheetUndoStack.push(deepCopy);
  if (spreadsheetUndoStack.length > MAX_UNDO_STACK) {
    spreadsheetUndoStack.shift();
  }
  updateUndoButtonState();
}

/**
 * 履歴から直前の状態を復元する
 */
function undoSpreadsheet() {
  if (spreadsheetUndoStack.length === 0) return;

  const previousState = spreadsheetUndoStack.pop();
  spreadsheetData = previousState;
  renderSpreadsheet();
  saveToLocalStorage();
  updateUndoButtonState();
}

/**
 * Undoボタンの有効/無効を切り替える
 */
function updateUndoButtonState() {
  const btn = document.getElementById("btnUndoSpreadsheet");
  if (btn) {
    btn.disabled = spreadsheetUndoStack.length === 0;
    // 無効時は少し透明にする（視覚的なフィードバック）
    btn.style.opacity = btn.disabled ? "0.5" : "1";
    btn.style.cursor = btn.disabled ? "not-allowed" : "pointer";
  }
}

// Ctrl+Z 押下時に Undo を発火させるイベントリスナー
document.addEventListener("keydown", (e) => {
  // スプレッドシートタブが表示されている時のみ動作させる
  if (currentMode !== "spreadsheet") return;

  // Ctrl+Z (Macの場合は Cmd+Z)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    // デフォルトの戻る挙動（インプットボックスの文字戻りなど）をキャンセル
    e.preventDefault();
    undoSpreadsheet();
  }
});

function renderSpreadsheet() {
  const container = document.getElementById("spreadsheetContainer");
  const table = document.createElement("table");
  table.className = "spreadsheet-table";

  spreadsheetData.forEach((rowData, rIndex) => {
    const tr = document.createElement("tr");
    if (rIndex === 0) tr.className = "spreadsheet-header-row";

    rowData.forEach((cellData, cIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = cellData;
      input.dataset.row = rIndex;
      input.dataset.col = cIndex;

      if (rIndex === 0) {
        input.readOnly = true;
        input.classList.add("header-cell");
        input.tabIndex = -1;
      }

      // focus時に変更前の値を保持し、無駄な履歴保存を防ぐ
      input.addEventListener("focus", function () {
        input.dataset.oldValue = input.value;
      });

      input.onchange = (e) => {
        // 値が実際に変更された場合のみ処理を行う
        if (input.dataset.oldValue !== e.target.value) {
          updateCell(rIndex, cIndex, e.target.value);
          input.dataset.oldValue = e.target.value; // 新しい値を保存
        }
      };

      input.onpaste = (e) => handlePaste(e, rIndex, cIndex);

      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const nextInput = document.querySelector(
            `input[data-row="${rIndex + 1}"][data-col="${cIndex}"]`,
          );
          if (nextInput) nextInput.focus();
        } else if (e.key === "ArrowUp") {
          const prevInput = document.querySelector(
            `input[data-row="${rIndex - 1}"][data-col="${cIndex}"]`,
          );
          if (prevInput) prevInput.focus();
        } else if (e.key === "ArrowDown") {
          const nextInput = document.querySelector(
            `input[data-row="${rIndex + 1}"][data-col="${cIndex}"]`,
          );
          if (nextInput) nextInput.focus();
        }
      };

      td.appendChild(input);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.innerHTML = "";
  container.appendChild(table);

  // 描画後、Undoボタンの状態を最新にする
  updateUndoButtonState();
}

function updateCell(row, col, value) {
  if (row === 0) return;
  if (spreadsheetData[row]) {
    saveSpreadsheetState(); // 変更前に状態を保存
    spreadsheetData[row][col] = value;
    saveToLocalStorage();
  }
}

function addRow() {
  saveSpreadsheetState(); // 変更前に状態を保存
  const cols = spreadsheetData[0] ? spreadsheetData[0].length : 5;
  spreadsheetData.push(new Array(cols).fill(""));
  renderSpreadsheet();
  saveToLocalStorage();
}

function addCol() {
  saveSpreadsheetState(); // 変更前に状態を保存
  spreadsheetData.forEach((row, rIndex) => {
    if (rIndex === 0) {
      row.push("Tag " + row.length);
    } else {
      row.push("");
    }
  });
  renderSpreadsheet();
  saveToLocalStorage();
}

function clearSpreadsheet() {
  // Undo機能が実装されたため、確認ダイアログ(confirm)を削除しました
  saveSpreadsheetState(); // 変更前に状態を保存
  const defaultHeader = [
    "Comment",
    "Tag 1",
    "Tag 2",
    "Tag 3",
    "Tag 4",
    "Tag 5",
  ];
  spreadsheetData = [
    [...defaultHeader],
    ...Array.from({ length: 5 }, () => new Array(6).fill("")),
  ];
  renderSpreadsheet();
  saveToLocalStorage();
}

function handlePaste(e, startRow, startCol) {
  e.preventDefault();
  if (startRow === 0) return;

  saveSpreadsheetState(); // 変更前に状態を保存

  const pasteData = (e.clipboardData || window.clipboardData).getData("text");
  const rows = pasteData.split(/\r\n|\n|\r/);
  rows.forEach((rowStr, i) => {
    if (rowStr === "" && i === rows.length - 1) return;
    const cols = rowStr.split("\t");
    const targetRow = startRow + i;
    if (targetRow >= spreadsheetData.length) {
      spreadsheetData.push(new Array(spreadsheetData[0].length).fill(""));
    }
    cols.forEach((value, j) => {
      const targetCol = startCol + j;
      if (targetCol >= spreadsheetData[targetRow].length) {
        spreadsheetData.forEach((r, rIdx) => {
          if (rIdx === 0) r.push("Tag " + r.length);
          else r.push("");
        });
      }
      spreadsheetData[targetRow][targetCol] = value.trim();
    });
  });
  renderSpreadsheet();
  saveToLocalStorage();
}
