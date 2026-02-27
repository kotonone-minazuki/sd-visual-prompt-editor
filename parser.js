/**
 * @fileoverview Stable Diffusionプロンプトの解析・変換ロジックを提供するコアモジュール。
 * * タグの分割、色分けのためのHTML生成、プロンプト編集構文（Alternating Words等）の
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
 * * @example
 * splitTagsSmart("1girl, (cat_ears:1.2), white shirt");
 * // returns ["1girl", "(cat_ears:1.2)", "white shirt"]
 */
function splitTagsSmart(line) {
  // ... (中略: ロジックは変更なし) ...
  let result = [];
  let current = "";
  let depth = 0;
  let angle = 0;
  // ... (実装詳細) ...
  // ※実装コードは元のまま使用

  let commentPart = "";
  const hashIndex = line.indexOf("#");
  if (hashIndex !== -1) {
    commentPart = line.substring(hashIndex).trim();
    line = line.substring(0, hashIndex);
  }

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
  // ... (実装詳細) ...
  const lower = rawTag.toLowerCase();

  if (rawTag.startsWith("<") && rawTag.endsWith(">")) return "lora";
  if (rawTag.startsWith("__") && rawTag.endsWith("__")) return "wildcard";

  const controls = ["break", "and", "addrow", "addcomm", "addcol", "addbase"];
  if (controls.includes(lower)) return "control";

  if (rawTag.startsWith("[") && rawTag.endsWith("]") && rawTag.includes(":")) {
    return "scheduling";
  }

  if (rawTag.startsWith("[") && rawTag.endsWith("]") && rawTag.includes("|")) {
    return "alternating";
  }

  return "normal";
}
// ... (以下略) ...
