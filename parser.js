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
 * Scheduling構文やAlternating構文の中身を解析し、HTMLとして装飾します。
 *
 * @param {string} content - ブラケット[]の中身の文字列
 * @param {string} separator - 区切り文字 (":" または "|")
 * @returns {string} 装飾されたHTML文字列
 */
function evaluateSequence(content, separator) {
  const parts = content.split(separator);
  return parts
    .map((part) => `<span class="seq-part">${escapeHTML(part)}</span>`)
    .join(`<span class="seq-sep">${separator}</span>`);
}

/**
 * 通常タグの内部構造（強調構文など）を解析し、HTMLとして装飾します。
 * 例: (cat:1.2) -> <span class="p">d(</span>cat<span class="w">:1.2</span><span class="p">)</span>
 *
 * @param {string} tag - タグ文字列
 * @returns {string} 装飾されたHTML文字列
 */
function evaluateInternalParts(tag) {
  // 簡易的な実装: そのままエスケープして返す（必要に応じて拡張可能）
  // app.js側で括弧や重みの処理を行っている場合もありますが、
  // ここで最低限エラーにならないよう文字列を返します。

  // 括弧と重みを簡易的に色分けする場合の例:
  // ( ) [ ] { } : などの記号を薄く表示する処理などを入れることができます。

  return escapeHTML(tag);
}
