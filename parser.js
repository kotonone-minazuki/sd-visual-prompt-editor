/**
 * @fileoverview Stable Diffusionプロンプトの解析・変換ロジックを提供するコアモジュール。
 * タグの分割、色分けのためのHTML生成、プロンプト編集構文（Alternating Words等）の
 * 解析を行います。
 */

/**
 * 統計データに基づき、タグの出現頻度に応じた色コードを返します。
 * この関数はグローバル変数 `currentThresholds` に依存しています。
 *
 * @global
 * @param {number} count - Danbooruタグの出現回数。
 * @returns {string} CSS色コード (例: "#ff0000")。該当なしの場合はデフォルト色(赤)を返します。
 */
function getColorByCount(count) {
  if (typeof currentThresholds === "undefined") return "#e74c3c";
  for (let t of currentThresholds) {
    if (count >= t.minCount && count < t.maxCount) return t.colorCode;
  }
  return (
    currentThresholds.find((t) => t.minCount === 0)?.colorCode || "#e74c3c"
  );
}

/**
 * HTML特殊文字をエスケープし、XSSを防ぎます。
 *
 * @param {string} str - エスケープ対象の文字列。
 * @returns {string} エスケープ済みの安全な文字列。
 */
function escapeHTML(str) {
  if (!str) return "";
  return str
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * プロンプト文字列をタグ単位にインテリジェントに分割します。
 * 括弧 `()` `[]` `{}` や山括弧 `<>` のネストを考慮し、
 * 文法的に意味のある単位でカンマ区切りを判定します。
 *
 * @param {string} line - 分割対象のプロンプト行（1行分）。
 * @returns {string[]} 分割されたタグ文字列の配列。コメント部分は配列の最後に含まれます。
 */
function splitTagsSmart(line) {
  let result = [];
  let current = "";
  let depth = 0;
  let angle = 0;

  // コメント部分の抽出
  let commentPart = "";
  const hashIndex = line.indexOf("#");
  if (hashIndex !== -1) {
    commentPart = line.substring(hashIndex).trim();
    line = line.substring(0, hashIndex);
  }

  // 特殊タグをカンマで囲んで分割しやすくする処理
  let pLine = line
    .replace(/\b(BREAK|AND|ADDROW|ADDCOMM|ADDCOL|ADDBASE)\b/gi, " , $1 , ")
    .replace(/(<[^>]+>)/g, " , $1 , ");

  for (let i = 0; i < pLine.length; i++) {
    let char = pLine[i];
    if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}")
      depth = Math.max(0, depth - 1);
    else if (char === "<") angle++;
    else if (char === ">") angle = Math.max(0, angle - 1);

    if (char === "," && depth === 0 && angle === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());

  if (commentPart !== "") result.push(commentPart);
  return result.filter((t) => t !== "");
}

/**
 * タグの種類を文字列パターンから判定します。
 *
 * @param {string} rawTag - 解析対象のタグ文字列。
 * @returns {('lora'|'wildcard'|'control'|'scheduling'|'alternating'|'normal')} 判定されたタグの種類。
 */
function detectTagType(rawTag) {
  const lower = rawTag.toLowerCase();

  if (rawTag.startsWith("<") && rawTag.endsWith(">")) return "lora";
  if (rawTag.startsWith("__") && rawTag.endsWith("__")) return "wildcard";

  const controls = ["break", "and", "addrow", "addcomm", "addcol", "addbase"];
  if (controls.includes(lower)) return "control";

  // Scheduling: [from:to:when] or [from::when]
  if (rawTag.startsWith("[") && rawTag.endsWith("]") && rawTag.includes(":")) {
    return "scheduling";
  }

  // Alternating: [word1|word2]
  if (rawTag.startsWith("[") && rawTag.endsWith("]") && rawTag.includes("|")) {
    return "alternating";
  }

  return "normal";
}

/**
 * タグ文字列（断片）を受け取り、括弧や重みを除去してDB照合を行い、
 * 色付けされたHTMLを返します。
 *
 * @param {string} fragment - 解析対象の文字列 (例: "(cat ears:1.2)")
 * @returns {string} 色付けされたHTML
 */
function colorizeFragment(fragment) {
  if (!fragment.trim()) return escapeHTML(fragment);

  // 変更点: 正規表現を厳格化
  // Prefix: 先頭の括弧類
  // Core:   真ん中のタグ名 (非貪欲マッチ)
  // Suffix: 末尾の「:数値」または「閉じ括弧類」
  //         (?::[\d.]+)? -> コロンで始まる数値（重み）がある場合のみマッチ
  //         [\)\]}]* -> その後の閉じ括弧
  const match = fragment.match(/^([({\[]*)(.*?)((?::[\d.]+)?[\)\]}]*)$/);

  if (!match) {
    return escapeHTML(fragment);
  }

  const prefix = match[1];
  const core = match[2];
  const suffix = match[3];

  // Loraや特殊タグが括弧内に入り込んだ場合の簡易ハンドリング
  // (例: (<lora:test:1>) のようなケース)
  if (core.startsWith("<") && core.endsWith(">")) {
    return (
      escapeHTML(prefix) +
      `<span style="border-color:#e84393; color:#e84393;">${escapeHTML(core)}</span>` +
      escapeHTML(suffix)
    );
  }

  // データベース照合
  const key = core.trim().toLowerCase().replace(/_/g, " ");
  let colorStyle = "";

  if (typeof tagMap !== "undefined" && tagMap.has(key)) {
    const count = tagMap.get(key);
    const color = getColorByCount(count);
    colorStyle = `style="color:${color};"`;
  }

  return (
    escapeHTML(prefix) +
    `<span ${colorStyle}>${escapeHTML(core)}</span>` +
    escapeHTML(suffix)
  );
}

/**
 * Scheduling構文やAlternating構文の中身を解析し、HTMLとして装飾します。
 * 区切られた各要素に対しても色判定を行います。
 *
 * @param {string} content - ブラケット[]の中身の文字列
 * @param {string} separator - 区切り文字 (":" または "|")
 * @returns {string} 装飾されたHTML文字列
 */
function evaluateSequence(content, separator) {
  const parts = content.split(separator);
  return parts
    .map((part) => `<span class="seq-part">${colorizeFragment(part)}</span>`)
    .join(`<span class="seq-sep">${separator}</span>`);
}

/**
 * 通常タグの内部構造を解析し、HTMLとして装飾します。
 * 括弧内の複数タグや、重み付け (:1.2) を考慮して色分けを行います。
 *
 * @param {string} tag - タグ文字列 (例: "flat chest, slender body" や "(cat ears:1.2)")
 * @returns {string} 装飾されたHTML文字列
 */
function evaluateInternalParts(tag) {
  const parts = tag.split(/(,)/);

  return parts
    .map((part) => {
      if (part === ",") return ",";
      if (!part.trim()) return escapeHTML(part);

      const match = part.match(/^(\s*)(.*?)(\s*)$/);
      if (!match) return escapeHTML(part);

      const preSpace = match[1];
      const content = match[2];
      const postSpace = match[3];

      return preSpace + colorizeFragment(content) + postSpace;
    })
    .join("");
}
