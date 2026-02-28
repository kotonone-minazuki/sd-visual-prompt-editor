/**
 * spreadsheet-editor.js - スプレッドシート操作
 */
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

      input.onchange = (e) => updateCell(rIndex, cIndex, e.target.value);
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
}

function updateCell(row, col, value) {
  if (row === 0) return;
  if (spreadsheetData[row]) {
    spreadsheetData[row][col] = value;
    saveToLocalStorage();
  }
}

function addRow() {
  const cols = spreadsheetData[0] ? spreadsheetData[0].length : 5;
  spreadsheetData.push(new Array(cols).fill(""));
  renderSpreadsheet();
  saveToLocalStorage();
}

function addCol() {
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
  if (!confirm("データをクリアし、初期状態に戻しますか？")) return;
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
