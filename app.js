/**
 * @fileoverview SD Visual Prompt Editor のメインアプリケーションロジック。
 * UIイベントのハンドリング、タブ切り替え、データの同期、クリップボード操作、
 * ファイル保存・読込、自動保存などを担当します。
 */

// --- グローバル変数 ---

let tagDatabase = [];
let tagMap = new Map();
let allThresholds = [];
let currentThresholds = [];
let currentMode = "normal";

// CodeMirror インスタンス (Normalのみ)
let editorNormal;

// スプレッドシート用データ (2次元配列)
// ヘッダーを英語表記に設定
let spreadsheetData = [
  ["Category", "Tag 1", "Tag 2", "Tag 3", "Tag 4", "Tag 5"],
  ["", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["", "", "", "", "", ""],
];

// --- i18n Dictionary ---
const i18n = {
  ja: {
    title: "SD Visual Prompt Editor",
    help: "📘 使い方",
    kofi: "☕ 支援 (Ko-fi)",
    syntax: "📜 SD構文",
    darkMode: "🌙 ダークモード",
    loading: "🔄 データ取得中...",
    loaded: "✅ 取得完了: ",
    loadFail: "❌ 取得失敗",
    tabNormal: "プロンプトエディタ",
    tabSpread: "スプレッドシート",
    labelNormal: "1. プロンプトエディタ",
    labelSpread: "1. スプレッドシート (Excel/Sheetsからコピペ可能)",
    copy: "コピー",
    copySuccess: "✅ コピー完了！",
    copyFail: "❌ 失敗",
    btnConvert:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬇️</span> ビジュアルエディタに反映",
    btnReflectN:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> プロンプトエディタに反映",
    btnReflectS:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> スプレッドシートに反映",
    stripLabels: "コメントアウトを除去",
    breakLabels: "行末にBREAKを付加",
    labelVisual:
      "2. ビジュアルエディタ (ドラッグ＆ドロップで追加・移動・枠外へ削除)",
    copyPrompt: "プロンプトとしてコピー",
    searchPalette: "タグ検索パレット",
    searchPlaceholder: "キーワードを入力...",
    placeholderNormal:
      "1girl, solo, (looking at viewer:1.2), <lora:my_lora:1.0>...",
    dataSource: "※データソース: Danbooruタグデータセット",
    // ボタンラベル
    saveTxt: "Save .txt",
    loadTxt: "Load .txt",
    saveJson: "Save JSON",
    loadJson: "Load JSON",
    saveTsv: "Save TSV",
    loadTsv: "Load TSV",
    addRow: "+ 行追加",
    addCol: "+ 列追加",
    clear: "クリア",
  },
  en: {
    title: "SD Visual Prompt Editor",
    help: "📘 Guide",
    kofi: "☕ Support (Ko-fi)",
    syntax: "📜 SD Syntax",
    darkMode: "🌙 Dark Mode",
    loading: "🔄 Loading...",
    loaded: "✅ Loaded: ",
    loadFail: "❌ Failed",
    tabNormal: "Prompt Editor",
    tabSpread: "Spreadsheet",
    labelNormal: "1. Prompt Editor",
    labelSpread: "1. Spreadsheet (Supports Copy & Paste from Excel)",
    copy: "Copy",
    copySuccess: "✅ Copied!",
    copyFail: "❌ Failed",
    btnConvert:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬇️</span> Reflect to Visual Editor",
    btnReflectN:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> Reflect to Prompt Editor",
    btnReflectS:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> Reflect to Spreadsheet",
    stripLabels: "Hide Comments/Headers",
    breakLabels: "Append BREAK to line ends",
    labelVisual:
      "2. Visual Editor (Drag & Drop to add/move, drop outside to delete)",
    copyPrompt: "Copy as Prompt",
    searchPalette: "Tag Search Palette",
    searchPlaceholder: "Enter keyword...",
    placeholderNormal:
      "1girl, solo, (looking at viewer:1.2), <lora:my_lora:1.0>...",
    dataSource: "*Data source: Danbooru tag dataset",
    // Button labels
    saveTxt: "Save .txt",
    loadTxt: "Load .txt",
    saveJson: "Save JSON",
    loadJson: "Load JSON",
    saveTsv: "Save TSV",
    loadTsv: "Load TSV",
    addRow: "+ Add Row",
    addCol: "+ Add Col",
    clear: "Clear",
  },
};

let currentLang = localStorage.getItem("lang") || "ja";

// --- 初期化処理 ---

if (typeof CodeMirror !== "undefined") {
  CodeMirror.defineMode("sd-prompt-mode", function () {
    return {
      token: function (stream) {
        if (stream.sol() && stream.match("#")) {
          stream.skipToEnd();
          return "comment";
        }
        stream.next();
        return null;
      },
    };
  });
}

window.onload = () => {
  if (typeof MobileDragDrop !== "undefined") {
    MobileDragDrop.polyfill({ holdToDrag: 250 });
    window.addEventListener("touchmove", function () {}, { passive: false });
  }

  initTheme();

  editorNormal = CodeMirror.fromTextArea(
    document.getElementById("inputNormal"),
    {
      lineNumbers: true,
      lineWrapping: true,
      mode: "sd-prompt-mode",
      tabSize: 4,
    },
  );

  // 変更検知：自動保存 (Debounceなしでも軽いので即時保存)
  editorNormal.on("change", function () {
    saveToLocalStorage();
  });

  restoreFromLocalStorage(); // 自動保存データの復元

  applyLanguage();
  fetchFromDB();
  initDragAndDrop();
  renderSpreadsheet(); // 初回レンダリング

  setTimeout(() => {
    if (editorNormal) editorNormal.refresh();
  }, 100);
};

// --- ローカルストレージ (自動保存) 機能 ---

function saveToLocalStorage() {
  const normalContent = editorNormal ? editorNormal.getValue() : "";
  localStorage.setItem("autosave_normal", normalContent);
  localStorage.setItem("autosave_spreadsheet", JSON.stringify(spreadsheetData));
  localStorage.setItem("autosave_mode", currentMode); // タブの状態も保存
}

function restoreFromLocalStorage() {
  // 修正ポイント1: スプレッドシートを「先に」復元する
  // (エディタ復元時のイベント発火で上書きされるのを防ぐため)
  const spreadContent = localStorage.getItem("autosave_spreadsheet");
  if (spreadContent !== null) {
    try {
      const parsed = JSON.parse(spreadContent);
      if (Array.isArray(parsed) && parsed.length > 0) {
        spreadsheetData = parsed;
        // まだ描画はしない(onloadの最後でやるか、ここでやるかだが、データが入っていればOK)
      }
    } catch (e) {
      console.error("Auto-save restore failed", e);
    }
  }

  // 修正ポイント2: 次にエディタを復元
  const normalContent = localStorage.getItem("autosave_normal");
  if (normalContent !== null && editorNormal) {
    editorNormal.setValue(normalContent);
  }

  // 修正ポイント3: 最後に開いていたタブを復元
  const lastMode = localStorage.getItem("autosave_mode");
  if (lastMode === "spreadsheet") {
    switchTab("spreadsheet");
  } else {
    switchTab("normal");
  }
}

// --- ファイル保存・読込機能 ---

/**
 * 現在の日時文字列を取得 (YYYYMMDD_HHmmss)
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

/**
 * テキストファイルをBOM付きUTF-8で保存します。
 */
function downloadFile(content, baseFilename, mimeType) {
  // UTF-8 BOM (\uFEFF) を付加
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  // タイムスタンプ付与
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

/**
 * ファイル読込共通処理
 */
function handleFileUpload(inputElement, callback) {
  const file = inputElement.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    callback(e.target.result);
    // 同じファイルを再選択できるようにvalueをリセット
    inputElement.value = "";
  };
  reader.readAsText(file);
}

// 1. プロンプトエディタ用
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

// 2. スプレッドシート用
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
  // TSV形式に変換
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
      if (rowStr === "" && newData.length > 0) return; // 末尾の空行などは無視
      newData.push(rowStr.split("\t"));
    });

    if (newData.length > 0) {
      // ヘッダーやデータ構造の整合性を整える
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

// --- スプレッドシート機能 (既存ロジック + 自動保存フック) ---

/**
 * データ配列をもとにHTMLテーブルを描画します。
 */
function renderSpreadsheet() {
  const container = document.getElementById("spreadsheetContainer");
  const table = document.createElement("table");
  table.className = "spreadsheet-table";

  spreadsheetData.forEach((rowData, rIndex) => {
    const tr = document.createElement("tr");

    if (rIndex === 0) {
      tr.className = "spreadsheet-header-row";
    }

    rowData.forEach((cellData, cIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = cellData;
      input.dataset.row = rIndex;
      input.dataset.col = cIndex;

      // 1行目は編集不可にする
      if (rIndex === 0) {
        input.readOnly = true;
        input.classList.add("header-cell");
        input.tabIndex = -1;
      }

      input.onchange = (e) => {
        updateCell(rIndex, cIndex, e.target.value);
      };

      input.onpaste = (e) => {
        handlePaste(e, rIndex, cIndex);
      };

      // 矢印キー移動
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
    saveToLocalStorage(); // 自動保存
  }
}

function addRow() {
  const cols = spreadsheetData[0] ? spreadsheetData[0].length : 5;
  spreadsheetData.push(new Array(cols).fill(""));
  renderSpreadsheet();
  saveToLocalStorage(); // 自動保存
}

function addCol() {
  spreadsheetData.forEach((row, rIndex) => {
    if (rIndex === 0) {
      const newColName = "Tag " + row.length;
      row.push(newColName);
    } else {
      row.push("");
    }
  });
  renderSpreadsheet();
  saveToLocalStorage(); // 自動保存
}

function clearSpreadsheet() {
  if (!confirm("データをクリアし、初期状態に戻しますか？")) return;

  // ヘッダーとデータを完全に初期化して復旧する
  const defaultHeader = [
    "Category",
    "Tag 1",
    "Tag 2",
    "Tag 3",
    "Tag 4",
    "Tag 5",
  ];
  const defaultRows = 5; // 初期行数
  const cols = defaultHeader.length;

  spreadsheetData = [
    [...defaultHeader],
    ...Array.from({ length: defaultRows }, () => new Array(cols).fill("")),
  ];

  renderSpreadsheet();
  saveToLocalStorage(); // 自動保存
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
      const currentCols = spreadsheetData[0].length;
      spreadsheetData.push(new Array(currentCols).fill(""));
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
  saveToLocalStorage(); // 自動保存
}

// --- テーマ・言語設定 ---

function initTheme() {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    document.getElementById("darkModeToggle").checked = true;
  }
}

function toggleDarkMode() {
  const isDark = document.getElementById("darkModeToggle").checked;
  document.body.classList.toggle("dark-mode", isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

function toggleLanguage() {
  currentLang = currentLang === "ja" ? "en" : "ja";
  localStorage.setItem("lang", currentLang);
  applyLanguage();
  renderLegend();
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (i18n[currentLang][key]) {
      el.innerHTML = i18n[currentLang][key];
    }
  });

  document.getElementById("tagSearch").placeholder =
    i18n[currentLang].searchPlaceholder;

  if (!editorNormal.getValue())
    editorNormal.setValue(i18n[currentLang].placeholderNormal);

  const btn = document.getElementById("statusBtn");
  if (btn.classList.contains("status-success") && tagDatabase.length > 0) {
    btn.innerText =
      i18n[currentLang].loaded +
      tagDatabase.length.toLocaleString() +
      (currentLang === "ja" ? "件" : " tags");
  } else if (btn.classList.contains("status-loading")) {
    btn.innerText = i18n[currentLang].loading;
  } else {
    btn.innerText = i18n[currentLang].loadFail;
  }
}

// --- UI操作・ロジック ---

function switchTab(mode) {
  currentMode = mode;
  document
    .getElementById("tabSpreadsheet")
    .classList.toggle("active", mode === "spreadsheet");
  document
    .getElementById("tabNormal")
    .classList.toggle("active", mode === "normal");
  document.getElementById("areaSpreadsheet").style.display =
    mode === "spreadsheet" ? "block" : "none";
  document.getElementById("areaNormal").style.display =
    mode === "normal" ? "block" : "none";
  document.getElementById("stripOption").style.display =
    mode === "spreadsheet" ? "block" : "none";
  document.getElementById("breakOption").style.display =
    mode === "normal" ? "block" : "none";

  document.getElementById("btnUpNormal").style.display =
    mode === "normal" ? "block" : "none";
  document.getElementById("btnUpSpreadsheet").style.display =
    mode === "spreadsheet" ? "block" : "none";

  setTimeout(() => {
    if (mode === "normal" && editorNormal) editorNormal.refresh();
    if (mode === "spreadsheet") renderSpreadsheet();
  }, 10);

  saveToLocalStorage(); // タブ切り替え時も保存（モードを保存するため）
}

async function fetchFromDB() {
  const btn = document.getElementById("statusBtn");
  try {
    const response = await fetch("danboru_dictionary.json");
    if (!response.ok) throw new Error("データの読み込みに失敗しました");
    const data = await response.json();
    tagDatabase = data.tags;

    // IDが含まれていない場合でも動作するように考慮
    tagMap = new Map(
      tagDatabase.map((i) => [
        i.t.trim().toLowerCase().replace(/_/g, " "),
        i.c,
      ]),
    );

    // thresholds.json または埋め込みデータを使用
    if (data.thresholds) {
      allThresholds = data.thresholds;
      currentThresholds = allThresholds;
    } else {
      // フォールバック
      currentThresholds = [
        { minCount: 10000, colorCode: "#3498db", label: "Very Common" },
        { minCount: 1000, colorCode: "#2ecc71", label: "Common" },
        { minCount: 0, colorCode: "#e74c3c", label: "Rare" },
      ];
    }

    renderLegend();

    btn.innerText =
      i18n[currentLang].loaded +
      tagDatabase.length.toLocaleString() +
      (currentLang === "ja" ? "件" : " tags");
    btn.className = "refresh-btn status-success";
    document.getElementById("tagSearch").disabled = false;
  } catch (err) {
    console.error(err);
    btn.innerText = i18n[currentLang].loadFail;
    btn.style.backgroundColor = "#e74c3c";
  }
}

function renderLegend() {
  if (!currentThresholds || currentThresholds.length === 0) return;
  document.getElementById("legendArea").innerHTML = currentThresholds
    .map((t) => {
      const labelText =
        currentLang === "en" && t.label_en
          ? t.label_en
          : t.label_ja || t.label || "";
      const cleanText = labelText.split("(")[0].trim();
      const titleText =
        currentLang === "en"
          ? `${t.minCount.toLocaleString()}+`
          : `${t.minCount.toLocaleString()} ～`;
      return `<div class="legend-item" title="${titleText}"><span class="color-dot" style="background-color: ${t.colorCode}"></span><span>${cleanText}</span></div>`;
    })
    .join("");
}

function createTagElement(rawTag) {
  const tagSpan = document.createElement("span");
  tagSpan.className = "prompt-tag";
  tagSpan.draggable = true;
  tagSpan.dataset.raw = rawTag;

  tagSpan.addEventListener("click", function () {
    copyTag(this.dataset.raw, this);
  });

  if (rawTag.startsWith("#")) {
    tagSpan.style.borderColor = "#27ae60";
    tagSpan.style.color = "#27ae60";
    tagSpan.style.borderRadius = "4px";
    tagSpan.textContent = rawTag;
    return tagSpan;
  }

  const type = window.detectTagType ? window.detectTagType(rawTag) : "normal";

  const applyGrayStyle = () => {
    tagSpan.style.borderColor = "#6c757d";
    tagSpan.style.color = "#aaa";
    tagSpan.style.borderRadius = "20px";
  };

  switch (type) {
    case "lora":
      tagSpan.style.borderColor = "#e84393";
      tagSpan.style.color = "#e84393";
      tagSpan.style.borderRadius = "4px";
      tagSpan.textContent = rawTag;
      return tagSpan;

    case "wildcard":
      applyGrayStyle();
      tagSpan.textContent = rawTag;
      return tagSpan;

    case "scheduling":
      applyGrayStyle();
      const contentSch = rawTag.slice(1, -1);
      const htmlSch = window.evaluateSequence
        ? window.evaluateSequence(contentSch, ":")
        : contentSch;
      tagSpan.innerHTML = `[${htmlSch}]`;
      return tagSpan;

    case "alternating":
      applyGrayStyle();
      const contentAlt = rawTag.slice(1, -1);
      const htmlAlt = window.evaluateSequence
        ? window.evaluateSequence(contentAlt, "|")
        : contentAlt;
      tagSpan.innerHTML = `[${htmlAlt}]`;
      return tagSpan;

    case "control":
      tagSpan.style.borderColor = "#e84393";
      tagSpan.style.color = "#e84393";
      tagSpan.style.borderRadius = "4px";
      tagSpan.textContent = rawTag;
      return tagSpan;

    case "normal":
    default:
      const match = rawTag.match(/^([({\[]*)(.+?)([:\d.]*[)}\]]*)$/);
      let prefix = match ? match[1] : "";
      let coreTag = match ? match[2] : rawTag;
      let suffix = match ? match[3] : "";

      const fixBrackets = (openCh, closeCh) => {
        let oCount = coreTag.split(openCh).length - 1;
        let cCount = coreTag.split(closeCh).length - 1;
        while (oCount > cCount && suffix.startsWith(closeCh)) {
          coreTag += closeCh;
          suffix = suffix.substring(1);
          cCount++;
        }
      };
      fixBrackets("(", ")");
      fixBrackets("[", "]");
      fixBrackets("{", "}");

      const cleanCore = coreTag.trim().toLowerCase().replace(/_/g, " ");

      if (tagMap.has(cleanCore)) {
        const exactCount = tagMap.get(cleanCore);
        const evalColor = getColorByCount(exactCount);
        tagSpan.style.borderColor = evalColor;
        tagSpan.style.color = evalColor;
        tagSpan.textContent = rawTag;
      } else {
        const words = cleanCore.split(/\s+/).filter((w) => w.length > 0);

        if (words.length > 1 || coreTag.includes(",")) {
          applyGrayStyle();
          const prefixHtml = escapeHTML(prefix).replace(/ /g, "&nbsp;");
          const coreHtml = window.evaluateInternalParts
            ? evaluateInternalParts(coreTag)
            : escapeHTML(coreTag);
          const suffixHtml = escapeHTML(suffix).replace(/ /g, "&nbsp;");
          tagSpan.innerHTML = prefixHtml + coreHtml + suffixHtml;
        } else {
          const evalColor = getColorByCount(0);
          tagSpan.style.borderColor = evalColor;
          tagSpan.style.color = evalColor;
          tagSpan.textContent = rawTag;
        }
      }
      return tagSpan;
  }
}

function buildVisualPreview(containerId, textLines) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  textLines.forEach((lineText) => {
    if (!lineText.trim()) return;
    const rowDiv = document.createElement("div");
    rowDiv.className = "prompt-row";
    rowDiv.draggable = true;

    const handle = document.createElement("div");
    handle.className = "row-handle";
    handle.innerHTML = "≡";
    rowDiv.appendChild(handle);

    const tags = splitTagsSmart(lineText);
    tags.forEach((tag) => {
      rowDiv.appendChild(createTagElement(tag));
    });

    container.appendChild(rowDiv);
  });
}

function convert() {
  let posLines = [];
  const doAppendBreak = document.getElementById("appendBreak")
    ? document.getElementById("appendBreak").checked
    : false;

  if (currentMode === "spreadsheet") {
    // 1行目(slice(1))をスキップ
    spreadsheetData.slice(1).forEach((row) => {
      if (row.every((cell) => !cell.trim())) return;

      const cat = row[0].trim();
      const tags = row.slice(1).filter((t) => t.trim() !== "");

      if (cat === "" && tags.length === 0) return;

      if (cat) {
        posLines.push("# " + cat);
      }

      if (tags.length > 0) {
        posLines.push(tags.join(", "));
      }
    });
  } else {
    // Normalモード
    const input = editorNormal.getValue();
    input.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      let tags = splitTagsSmart(line);
      if (tags.length === 0) return;

      if (doAppendBreak) {
        let commentTag = null;
        if (tags.length > 0 && tags[tags.length - 1].startsWith("#")) {
          commentTag = tags.pop();
        }
        if (tags.length > 0) {
          const lastRealTag = tags[tags.length - 1].toLowerCase();
          if (
            ![
              "break",
              "and",
              "addrow",
              "addcomm",
              "addcol",
              "addbase",
            ].includes(lastRealTag)
          ) {
            tags.push("BREAK");
          }
        }
        if (commentTag) tags.push(commentTag);
      }
      posLines.push(tags.join(", "));
    });
  }

  buildVisualPreview("outputPreview", posLines);
  toggleComments();
}

function toggleComments() {
  const isChecked = document.getElementById("stripHeaders").checked;
  const container = document.getElementById("outputPreview");
  const rows = container.querySelectorAll(".prompt-row");

  rows.forEach((row) => {
    const tags = Array.from(row.querySelectorAll(".prompt-tag"));
    let hasVisibleTag = false;

    tags.forEach((tag) => {
      if (tag.dataset.raw.startsWith("#")) {
        tag.style.display = isChecked ? "none" : "";
      }
      if (tag.style.display !== "none") {
        hasVisibleTag = true;
      }
    });

    row.style.display = isChecked && !hasVisibleTag ? "none" : "flex";
  });

  syncPreviewToData();
}

function reflectToNormal() {
  syncPreviewToData();
  editorNormal.setValue(document.getElementById("outputRaw").value);
  saveToLocalStorage(); // 保存
}

function reflectToSpreadsheet() {
  const container = document.getElementById("outputPreview");
  const strip = document.getElementById("stripHeaders").checked;

  let newData = [];
  let pendingCategory = "";

  container.querySelectorAll(".prompt-row").forEach((row) => {
    if (row.style.display === "none") return;

    let rowTags = Array.from(row.querySelectorAll(".prompt-tag"))
      .filter((t) => t.style.display !== "none")
      .map((t) => t.dataset.raw);

    if (rowTags.length === 0) return;

    let commentIndex = rowTags.findIndex((t) => t.startsWith("#"));

    if (!strip) {
      if (commentIndex !== -1) {
        const catText = rowTags[commentIndex].substring(1).trim();
        rowTags.splice(commentIndex, 1);

        if (rowTags.length === 0) {
          pendingCategory = catText;
          return;
        } else {
          pendingCategory = catText;
        }
      }

      if (rowTags.length > 0) {
        let newRow = [pendingCategory, ...rowTags];
        newData.push(newRow);
        pendingCategory = "";
      }
    } else {
      if (commentIndex !== -1) rowTags.splice(commentIndex, 1);
      if (rowTags.length > 0) {
        newData.push(["", ...rowTags]);
      }
    }
  });

  const currentHeader = spreadsheetData[0] || [
    "Category",
    "Tag 1",
    "Tag 2",
    "Tag 3",
    "Tag 4",
    "Tag 5",
  ];

  if (newData.length > 0) {
    const maxCols = Math.max(
      currentHeader.length,
      newData.reduce((max, row) => Math.max(max, row.length), 0),
    );

    while (currentHeader.length < maxCols) {
      currentHeader.push("Tag " + currentHeader.length);
    }

    newData.forEach((row) => {
      while (row.length < maxCols) row.push("");
    });

    spreadsheetData = [currentHeader, ...newData];
  } else {
    const cols = currentHeader.length;
    spreadsheetData = [currentHeader, new Array(cols).fill("")];
  }

  renderSpreadsheet();
  saveToLocalStorage(); // 保存
}

function toggleBreaks() {
  const isChecked = document.getElementById("appendBreak").checked;
  const container = document.getElementById("outputPreview");
  const rows = container.querySelectorAll(".prompt-row");
  const controlTags = [
    "break",
    "and",
    "addrow",
    "addcomm",
    "addcol",
    "addbase",
  ];

  rows.forEach((row) => {
    const tags = Array.from(row.querySelectorAll(".prompt-tag"));
    if (tags.length === 0) return;

    let targetIndex = tags.length - 1;
    let commentTag = null;

    if (tags[targetIndex].dataset.raw.startsWith("#")) {
      commentTag = tags[targetIndex];
      targetIndex--;
    }

    if (targetIndex < 0) return;

    const targetTagElement = tags[targetIndex];
    const targetTagRaw = targetTagElement.dataset.raw.toLowerCase();

    if (isChecked) {
      if (!controlTags.includes(targetTagRaw)) {
        const breakTag = createTagElement("BREAK");
        if (commentTag) {
          row.insertBefore(breakTag, commentTag);
        } else {
          row.appendChild(breakTag);
        }
      }
    } else {
      if (targetTagRaw === "break") targetTagElement.remove();
    }
  });

  toggleComments();
}

// --- ドラッグ＆ドロップ関連 ---

let draggedElement = null;
let dragSource = null;
let dragTagText = "";
let isDroppedInValidZone = false;

function initDragAndDrop() {
  document.addEventListener("dragstart", (e) => {
    isDroppedInValidZone = false;

    if (
      e.target.classList.contains("prompt-tag") ||
      e.target.classList.contains("prompt-row")
    ) {
      draggedElement = e.target;
      dragSource = "internal";
      setTimeout(() => e.target.classList.add("dragging"), 0);
    } else if (
      e.target.classList.contains("tag-item") ||
      e.target.closest(".tag-item")
    ) {
      dragSource = "search";
      const item = e.target.closest(".tag-item");
      dragTagText = item.dataset.tag;
      e.dataTransfer.setData("text/plain", dragTagText);
    }
  });

  document.addEventListener("dragend", (e) => {
    if (dragSource === "internal" && draggedElement) {
      draggedElement.classList.remove("dragging");
      if (!isDroppedInValidZone) draggedElement.remove();
      draggedElement = null;
      toggleComments();
    }
    dragSource = null;
    dragTagText = "";
  });

  document.querySelectorAll(".preview-area").forEach((area) => {
    area.addEventListener("dragenter", (e) => {
      e.preventDefault();
    });

    area.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = dragSource === "search" ? "copy" : "move";

      if (dragSource === "internal" && draggedElement) {
        if (draggedElement.classList.contains("prompt-row")) {
          const afterElement = getDragAfterElement(area, e.clientY, true);
          if (afterElement == null) {
            area.appendChild(draggedElement);
          } else {
            area.insertBefore(draggedElement, afterElement);
          }
        } else if (draggedElement.classList.contains("prompt-tag")) {
          const dropzoneRow = e.target.closest(".prompt-row");
          if (dropzoneRow) {
            const afterElement = getDragAfterElement(
              dropzoneRow,
              e.clientX,
              false,
            );
            if (afterElement == null) {
              dropzoneRow.appendChild(draggedElement);
            } else {
              dropzoneRow.insertBefore(draggedElement, afterElement);
            }
          }
        }
      }
    });

    area.addEventListener("drop", (e) => {
      e.preventDefault();
      isDroppedInValidZone = true;

      if (dragSource === "search" && dragTagText) {
        const newTag = createTagElement(dragTagText);
        const dropzoneRow = e.target.closest(".prompt-row");

        if (dropzoneRow) {
          const afterElement = getDragAfterElement(
            dropzoneRow,
            e.clientX,
            false,
          );
          if (afterElement == null) {
            dropzoneRow.appendChild(newTag);
          } else {
            dropzoneRow.insertBefore(newTag, afterElement);
          }
        } else {
          const newRow = document.createElement("div");
          newRow.className = "prompt-row";
          newRow.draggable = true;

          const handle = document.createElement("div");
          handle.className = "row-handle";
          handle.innerHTML = "≡";
          newRow.appendChild(handle);
          newRow.appendChild(newTag);

          const afterRow = getDragAfterElement(area, e.clientY, true);
          if (afterRow == null) {
            area.appendChild(newRow);
          } else {
            area.insertBefore(newRow, afterRow);
          }
        }
        toggleComments();
      }
    });
  });
}

function getDragAfterElement(container, position, isRow) {
  const draggableElements = [
    ...container.querySelectorAll(
      isRow ? ".prompt-row:not(.dragging)" : ".prompt-tag:not(.dragging)",
    ),
  ];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = isRow
        ? position - box.top - box.height / 2
        : position - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

// --- データ同期・コピー関連 ---

function syncPreviewToData() {
  const spaceBeforeTags = ["and", "addrow", "addcomm", "addcol", "addbase"];
  const spaceAfterTags = [
    "break",
    "and",
    "addrow",
    "addcomm",
    "addcol",
    "addbase",
  ];

  function reconstructText(containerId) {
    const container = document.getElementById(containerId);
    let newLines = [];

    container.querySelectorAll(".prompt-row").forEach((row) => {
      const allTags = row.querySelectorAll(".prompt-tag");
      if (allTags.length === 0) {
        row.remove();
        return;
      }
      if (row.style.display === "none") return;

      let rowTags = [];
      allTags.forEach((tag) => {
        if (tag.style.display !== "none") rowTags.push(tag.dataset.raw);
      });

      if (rowTags.length > 0) {
        let lineStr = "";
        for (let i = 0; i < rowTags.length; i++) {
          let currentTag = rowTags[i];
          let currentLower = currentTag.toLowerCase();
          let currentIsLora =
            currentTag.startsWith("<") && currentTag.endsWith(">");

          if (i === 0) {
            lineStr += currentTag;
          } else {
            let prevLower = rowTags[i - 1].toLowerCase();
            let prevIsLora =
              rowTags[i - 1].startsWith("<") && rowTags[i - 1].endsWith(">");

            if (
              spaceAfterTags.includes(prevLower) ||
              spaceBeforeTags.includes(currentLower) ||
              prevIsLora ||
              currentIsLora
            ) {
              lineStr += " " + currentTag;
            } else {
              lineStr += ", " + currentTag;
            }
          }
        }

        let lastTag = rowTags[rowTags.length - 1];
        let lastTagLower = lastTag.toLowerCase();
        let lastIsLora = lastTag.startsWith("<") && lastTag.endsWith(">");
        let isLastComment = lastTag.startsWith("#");

        if (
          !spaceAfterTags.includes(lastTagLower) &&
          !lastIsLora &&
          !isLastComment
        ) {
          lineStr += ",";
        }
        newLines.push(lineStr);
      }
    });
    return newLines.join("\n");
  }

  const posText = reconstructText("outputPreview");
  document.getElementById("outputRaw").value = posText;
}

function universalCopy(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy") ? resolve() : reject();
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(textArea);
      }
    });
  }
}

function copyResult(id, btn) {
  let text = "";
  if (id === "inputNormal") {
    text = editorNormal.getValue();
  } else if (id === "inputSpreadsheet") {
    text = spreadsheetData.map((row) => row.join("\t")).join("\n");
  } else {
    text = document.getElementById(id).value;
  }

  const originalText = btn.innerText;
  universalCopy(text)
    .then(() => {
      btn.style.backgroundColor = getComputedStyle(
        document.body,
      ).getPropertyValue("--copy-success-bg");
      btn.innerHTML = i18n[currentLang].copySuccess;
      setTimeout(() => {
        btn.style.backgroundColor = "";
        btn.innerHTML = originalText;
      }, 800);
    })
    .catch((err) => {
      console.error(err);
      btn.innerHTML = i18n[currentLang].copyFail;
      btn.style.backgroundColor = "#c0392b";
      setTimeout(() => {
        btn.style.backgroundColor = "";
        btn.innerHTML = originalText;
      }, 1000);
    });
}

function copyTag(tag, element) {
  universalCopy(tag).then(() => {
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
    element.style.transition = "background-color 0.2s";
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
      setTimeout(() => (element.style.transition = ""), 200);
    }, 300);
  });
}

// --- 検索機能 & ツールチップ ---

let currentSearchResults = [];
let currentSearchIndex = 0;
const SEARCH_BATCH_SIZE = 50;

function searchTags() {
  const query = document
    .getElementById("tagSearch")
    .value.toLowerCase()
    .replace(/_/g, " ");
  const resultDiv = document.getElementById("searchResult");

  if (!query) {
    resultDiv.innerHTML = "";
    currentSearchResults = [];
    return;
  }

  currentSearchResults = tagDatabase
    .filter(
      (i) =>
        i.t.toLowerCase().replace(/_/g, " ").includes(query) ||
        (i.tr && i.tr.toLowerCase().includes(query)) ||
        (i.j && i.j.includes(query)),
    )
    .sort((a, b) => b.c - a.c);

  currentSearchIndex = 0;
  resultDiv.innerHTML = "";
  renderNextSearchBatch();
}

function renderNextSearchBatch() {
  if (currentSearchIndex >= currentSearchResults.length) return;
  const resultDiv = document.getElementById("searchResult");
  const nextBatch = currentSearchResults.slice(
    currentSearchIndex,
    currentSearchIndex + SEARCH_BATCH_SIZE,
  );

  const html = nextBatch
    .map((i) => {
      const subText = i.j || i.tr || "";
      const dataJson = JSON.stringify(i).replace(/"/g, "&quot;");

      return `<div class="tag-item" draggable="true" 
                  data-tag="${i.t}" 
                  data-detail="${dataJson}"
                  onclick="copyTag('${i.t}', this)"
                  onmouseenter="showTooltip(event, this)"
                  onmouseleave="hideTooltip()"
                  onmousemove="moveTooltip(event)"
                  >
            <span style="font-weight:bold; color:var(--text-color);">${i.t}</span> 
            <span style="background-color: var(--tag-bg); padding: 2px 8px; border-radius: 12px; color:${getColorByCount(i.c)}; float:right; font-weight:bold; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${i.c.toLocaleString()}</span>
            <div class="tag-subtext">${subText}</div>
          </div>`;
    })
    .join("");

  resultDiv.insertAdjacentHTML("beforeend", html);
  currentSearchIndex += SEARCH_BATCH_SIZE;
}

function handleSearchScroll() {
  const resultDiv = document.getElementById("searchResult");
  if (
    resultDiv.scrollTop + resultDiv.clientHeight >=
    resultDiv.scrollHeight - 50
  ) {
    renderNextSearchBatch();
  }
}

// --- ツールチップ (Toast) 機能 ---

const tooltipEl = document.createElement("div");
tooltipEl.id = "customTooltip";
// 巨大なツールチップ対策: スクロール対応スタイルを追加
tooltipEl.style.maxHeight = "80vh";
tooltipEl.style.overflowY = "auto";
document.body.appendChild(tooltipEl);

function showTooltip(e, element) {
  const t = document.getElementById("customTooltip");
  if (!t) return;

  let data;
  try {
    data = JSON.parse(element.dataset.detail);
  } catch (err) {
    console.error("Tooltip parse error", err);
    return;
  }

  // 変更点1: ID列を削除
  t.innerHTML = `
    <div class="tooltip-row"><span class="tooltip-label">TAG</span><span class="tooltip-value val-tag">${escapeHTML(data.t)}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">TRANS</span><span class="tooltip-value val-trans">${escapeHTML(data.tr || "-")}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">JP</span><span class="tooltip-value">${escapeHTML(data.j || "-")}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">COUNT</span><span class="tooltip-value val-count">${(data.c || 0).toLocaleString()}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">GROUP</span><span class="tooltip-value">${escapeHTML(data.g || "-")}</span></div>
  `;

  t.style.display = "block";
  moveTooltip(e);
}

function hideTooltip() {
  const t = document.getElementById("customTooltip");
  if (t) t.style.display = "none";
}

// 変更点2: 左下表示 + 画面内クランプ処理
function moveTooltip(e) {
  const t = document.getElementById("customTooltip");
  if (!t || t.style.display === "none") return;

  const offsetX = 20;
  const offsetY = 20;

  let left = e.clientX - t.offsetWidth - offsetX;
  let top = e.clientY + offsetY; // 基本は「下」

  // 左にはみ出る場合はカーソルの右側へ
  if (left < 10) left = e.clientX + offsetX;

  // 下にはみ出る場合
  if (top + t.offsetHeight > window.innerHeight) {
    // 上にはみ出ない範囲で、できるだけ上にずらす（画面内に押し込む）
    let newTop = window.innerHeight - t.offsetHeight - 10;

    // それでも上にはみ出る（ツールチップが巨大すぎる）場合
    if (newTop < 10) {
      newTop = 10; // 上端に固定（max-heightとoverflow-yでスクロールさせる）
    }
    top = newTop;
  }

  t.style.left = left + "px";
  t.style.top = top + "px";
}
