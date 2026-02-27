/**
 * @fileoverview SD Visual Prompt Editor のメインアプリケーションロジック。
 * UIイベントのハンドリング、タブ切り替え、データの同期、クリップボード操作などを担当します。
 */

// --- グローバル変数 ---

/**
 * 読み込まれたタグデータの配列。
 * @type {Array<{t: string, c: number, tr?: string}>}
 */
let tagDatabase = [];

/**
 * タグ名をキーとして検索を高速化するためのMap。
 * @type {Map<string, number>} key: タグ名(小文字), value: 出現回数
 */
let tagMap = new Map();

/** * 現在適用されている閾値（色分けルール）の設定。
 * @type {Array<Object>}
 */
let allThresholds = [];
let currentThresholds = [];

/**
 * 現在のアクティブなモード。
 * @type {'normal' | 'spreadsheet'}
 */
let currentMode = "normal";

// CodeMirror インスタンス
let editorNormal, editorSpreadsheet;

// --- i18n Dictionary ---
/**
 * 言語リソース辞書。
 * @const {Object}
 */
const i18n = {
  // ... (省略: データ内容は変更なし) ...
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
    labelSpread: "1. スプレッドシート/TSVデータ貼り付け",
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
    placeholderSpread: "カテゴリ名\tタグ1\tタグ2...",
    dataSource: "※データソース: Danbooruタグデータセット",
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
    labelSpread: "1. Paste Spreadsheet/TSV Data",
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
    placeholderSpread: "Category\tTag1\tTag2...",
    dataSource: "*Data source: Danbooru tag dataset",
  },
};

let currentLang = localStorage.getItem("lang") || "ja";

// --- 初期化処理 ---

/**
 * 超軽量CodeMirrorモード "sd-prompt-mode" の定義。
 * 行頭が '#' で始まる場合のみ、行全体を "comment" スタイル(緑色)にする。
 */
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

/**
 * ウィンドウロード時の初期化処理。
 * ライブラリのポリフィル適用、CodeMirrorの生成、データフェッチ、イベントリスナーの登録を行います。
 */
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

  editorSpreadsheet = CodeMirror.fromTextArea(
    document.getElementById("inputSpreadsheet"),
    {
      lineNumbers: true,
      lineWrapping: false,
      mode: "sd-prompt-mode",
      tabSize: 4,
    },
  );

  applyLanguage();
  fetchFromDB();
  initDragAndDrop();

  setTimeout(() => {
    if (editorNormal) editorNormal.refresh();
  }, 100);
};

// --- テーマ・言語設定 ---

/**
 * ローカルストレージからテーマ設定を読み込み、適用します。
 */
function initTheme() {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    document.getElementById("darkModeToggle").checked = true;
  }
}

/**
 * ダークモードのON/OFFを切り替えます。
 */
function toggleDarkMode() {
  const isDark = document.getElementById("darkModeToggle").checked;
  document.body.classList.toggle("dark-mode", isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

/**
 * 言語設定(日本語/英語)を切り替えます。
 */
function toggleLanguage() {
  currentLang = currentLang === "ja" ? "en" : "ja";
  localStorage.setItem("lang", currentLang);
  applyLanguage();
  renderLegend();
}

/**
 * 現在の言語設定に基づいて、UIのテキストを更新します。
 */
function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (i18n[currentLang][key]) {
      el.innerHTML = i18n[currentLang][key];
    }
  });

  document.getElementById("tagSearch").placeholder =
    i18n[currentLang].searchPlaceholder;

  if (!editorSpreadsheet.getValue())
    editorSpreadsheet.setValue(i18n[currentLang].placeholderSpread);
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

/**
 * タブを切り替え、各モードに対応したUIの表示/非表示を制御します。
 * @param {'normal'|'spreadsheet'} mode - 切り替え先のモード
 */
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
    if (mode === "spreadsheet" && editorSpreadsheet)
      editorSpreadsheet.refresh();
  }, 10);
}

/**
 * `danboru_dictionary.json` からタグデータと閾値情報を非同期で取得します。
 */
async function fetchFromDB() {
  const btn = document.getElementById("statusBtn");
  try {
    const response = await fetch("danboru_dictionary.json");
    if (!response.ok) throw new Error("データの読み込みに失敗しました");
    const data = await response.json();
    tagDatabase = data.tags;
    tagMap = new Map(
      tagDatabase.map((i) => [
        i.t.trim().toLowerCase().replace(/_/g, " "),
        i.c,
      ]),
    );
    allThresholds = data.thresholds;
    currentThresholds = allThresholds;

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

/**
 * 閾値情報に基づいて凡例（レジェンド）を描画します。
 */
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

/**
 * 生のタグ文字列からDOM要素(span)を作成し、色付けなどの装飾を行います。
 * `parser.js` の `detectTagType` や `evaluateSequence` を利用します。
 * * @param {string} rawTag - タグの文字列
 * @returns {HTMLElement} 生成されたタグ要素 (span.prompt-tag)
 */
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
          const coreHtml = evaluateInternalParts(coreTag);
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

/**
 * 解析済みのタグリストからビジュアルエディタ（プレビューエリア）を構築します。
 * @param {string} containerId - プレビューコンテナのDOM ID
 * @param {string[]} textLines - プロンプトの行ごとの文字列配列
 */
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

/**
 * エディタ（NormalまたはSpreadsheet）の内容をビジュアルエディタに反映させます。
 * ボタン操作「⬇️ ビジュアルエディタに反映」で呼び出されます。
 */
function convert() {
  let posLines = [];
  const doAppendBreak = document.getElementById("appendBreak")
    ? document.getElementById("appendBreak").checked
    : false;

  if (currentMode === "spreadsheet") {
    const input = editorSpreadsheet.getValue().replace(/^[ \t]*[\r\n]+/gm, "");
    input.split(/\r?\n/).forEach((line) => {
      let match = line.match(/^([^\t\n]+)\t+(.+?)[\t ]*$/);
      if (match) {
        let cat = match[1].trim();
        let tagStr = match[2].trim().replace(/\t+/g, ", ");
        let tags = splitTagsSmart(tagStr);
        if (tags.length === 0) return;
        posLines.push("# " + cat);
        posLines.push(tags.join(", "));
      }
    });
  } else {
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

/**
 * コメントタグ（#で始まるタグ）の表示/非表示を切り替えます。
 */
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

/**
 * ビジュアルエディタの内容をプロンプトエディタ(Normal)に反映します。
 * 「⬆️ プロンプトエディタに反映」ボタンに対応。
 */
function reflectToNormal() {
  syncPreviewToData();
  editorNormal.setValue(document.getElementById("outputRaw").value);
}

/**
 * ビジュアルエディタの内容をスプレッドシート形式に変換してエディタに反映します。
 * 「⬆️ スプレッドシートに反映」ボタンに対応。
 */
function reflectToSpreadsheet() {
  const container = document.getElementById("outputPreview");
  const strip = document.getElementById("stripHeaders").checked;
  let tsvLines = [];
  let pendingCategory = "";

  container.querySelectorAll(".prompt-row").forEach((row) => {
    if (row.style.display === "none") return;

    let tagsToOutput = [];
    let rowTags = Array.from(row.querySelectorAll(".prompt-tag"))
      .filter((t) => t.style.display !== "none")
      .map((t) => t.dataset.raw);

    if (rowTags.length === 0) return;
    let commentIndex = rowTags.findIndex((t) => t.startsWith("#"));

    if (!strip) {
      if (commentIndex !== -1) {
        pendingCategory = rowTags[commentIndex].substring(1).trim();
        rowTags.splice(commentIndex, 1);
      }
      if (rowTags.length > 0) {
        tagsToOutput.push(pendingCategory);
        tagsToOutput.push(...rowTags);
        pendingCategory = "";
      } else {
        return;
      }
    } else {
      if (commentIndex !== -1) rowTags.splice(commentIndex, 1);
      if (rowTags.length > 0) {
        tagsToOutput.push(...rowTags);
      } else {
        return;
      }
    }

    tagsToOutput = tagsToOutput.map((t) => t.replace(/,+$/, "").trim());
    if (tagsToOutput.length > 0) {
      tsvLines.push(tagsToOutput.join("\t"));
    }
  });

  editorSpreadsheet.setValue(tsvLines.join("\n"));
}

/**
 * 「行末にBREAKを付加」オプションに応じて、ビジュアルエディタ内のBREAKタグを挿入または削除します。
 */
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

/**
 * ドラッグ＆ドロップイベントの初期化。
 * - 内部タグの並べ替え
 * - 検索パレットからのドロップ
 * - 枠外ドロップによる削除
 * を処理します。
 */
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

/**
 * ドラッグ中の要素が、コンテナ内のどの要素の直後に挿入されるべきかを計算します。
 * @param {HTMLElement} container - ドロップ対象のコンテナ
 * @param {number} position - マウスカーソルの位置 (Y座標またはX座標)
 * @param {boolean} isRow - 行（縦並び）の計算か、タグ（横並び）の計算か
 * @returns {HTMLElement|null} 挿入位置の直後の要素。末尾ならnull。
 */
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

/**
 * ビジュアルエディタのタグ配置を解析し、テキスト形式に再構築して `#outputRaw` に同期します。
 * カンマ区切りの制御ロジックを含みます。
 */
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

/**
 * テキストをクリップボードにコピーします。
 * Secure Context以外でも動作するようにフォールバック処理を含みます。
 * @param {string} text - コピーするテキスト
 * @returns {Promise<void>}
 */
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

/**
 * UI上のボタンクリックでエディタの内容をコピーし、ボタンの表示を一時的に変更してフィードバックします。
 * @param {string} id - 対象要素のID
 * @param {HTMLElement} btn - クリックされたボタン要素
 */
function copyResult(id, btn) {
  let text = "";
  if (id === "inputNormal") {
    text = editorNormal.getValue();
  } else if (id === "inputSpreadsheet") {
    text = editorSpreadsheet.getValue();
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

/**
 * 特定のタグをクリックした際に、そのタグ名だけをコピーします。
 * @param {string} tag - タグ名
 * @param {HTMLElement} element - クリックされたタグ要素
 */
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

// --- 検索機能 ---

let currentSearchResults = [];
let currentSearchIndex = 0;
const SEARCH_BATCH_SIZE = 50;

/**
 * 検索ボックスへの入力に基づいてタグを検索し、結果エリアを更新します。
 */
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
        (i.tr && i.tr.toLowerCase().includes(query)),
    )
    .sort((a, b) => b.c - a.c);

  currentSearchIndex = 0;
  resultDiv.innerHTML = "";
  renderNextSearchBatch();
}

/**
 * 検索結果をバッチサイズごとに分割して描画します（無限スクロール用）。
 */
function renderNextSearchBatch() {
  if (currentSearchIndex >= currentSearchResults.length) return;
  const resultDiv = document.getElementById("searchResult");
  const nextBatch = currentSearchResults.slice(
    currentSearchIndex,
    currentSearchIndex + SEARCH_BATCH_SIZE,
  );

  const html = nextBatch
    .map(
      (
        i,
      ) => `<div class="tag-item" draggable="true" data-tag="${i.t}" onclick="copyTag('${i.t}', this)">
            <span style="font-weight:bold; color:var(--text-color);">${i.t}</span> 
            <span style="background-color: var(--tag-bg); padding: 2px 8px; border-radius: 12px; color:${getColorByCount(i.c)}; float:right; font-weight:bold; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${i.c.toLocaleString()}</span>
            <div style="color:#7f8c8d; font-size:0.85em; margin-top:4px;">${i.tr || ""}</div>
          </div>`,
    )
    .join("");

  resultDiv.insertAdjacentHTML("beforeend", html);
  currentSearchIndex += SEARCH_BATCH_SIZE;
}

/**
 * 検索結果エリアのスクロールイベントを処理し、必要に応じて追加の結果を描画します。
 */
function handleSearchScroll() {
  const resultDiv = document.getElementById("searchResult");
  if (
    resultDiv.scrollTop + resultDiv.clientHeight >=
    resultDiv.scrollHeight - 50
  ) {
    renderNextSearchBatch();
  }
}
