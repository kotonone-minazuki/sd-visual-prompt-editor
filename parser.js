/**
 * @fileoverview Stable Diffusionプロンプトの解析・変換ロジックを提供するモジュール。
 * MkDocs + mkdocstrings によるドキュメント生成に対応しています。
 */

/**
 * 統計データに基づき、タグの出現頻度に応じた色コードを返します。
 * この関数はグローバル変数 `currentThresholds` に依存しています。
 *
 * @global
 * @param {number} count - Danbooruタグの出現回数
 * @returns {string} CSS色コード (例: "#ff0000")
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
 * HTML特殊文字をエスケープします。
 * XSS対策として、ユーザー入力をHTMLに埋め込む前に使用してください。
 *
 * @param {string} str - エスケープ対象の文字列
 * @returns {string} エスケープ済みの文字列 (null/undefinedの場合は空文字)
 *
 * @example
 * escapeHTML('<lora:test>'); // "&lt;lora:test&gt;"
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
 * プロンプト文字列をタグ単位に分割します。
 * 括弧 `()` `[]` `{}` や山括弧 `<>` のネスト深度を考慮し、
 * 最上位レベルのカンマのみを区切り文字として判定します。
 *
 * @param {string} line - 分割対象のプロンプト行
 * @returns {string[]} 分割されたタグの配列
 *
 * @example
 * splitTagsSmart("1girl, (blue eyes, short hair:1.2)");
 * // Returns: ["1girl", "(blue eyes, short hair:1.2)"]
 */
function splitTagsSmart(line) {
  let result = [];
  let current = "";
  let depth = 0;
  let angle = 0;

  let commentPart = "";
  const hashIndex = line.indexOf("#");
  if (hashIndex !== -1) {
    commentPart = line.substring(hashIndex).trim();
    line = line.substring(0, hashIndex);
  }

  // 制御構文の正規化
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
 * 複合タグ（複数の単語を含むタグや重み付きタグ）の内部構造を解析し、
 * 単語ごとに色分けされたHTML文字列を生成します。
 *
 * @global 依存: `tagMap` (グローバルMapオブジェクト)
 * @param {string} coreTag - 解析対象のタグ文字列（括弧などを除いたコア部分）
 * @returns {string} 色分けされたHTML文字列
 */
function evaluateInternalParts(coreTag) {
  const commaParts = coreTag.split(/([^,]+)/);
  let resultHtml = "";

  for (let p of commaParts) {
    if (!p) continue;
    if (p.includes(",")) {
      resultHtml += escapeHTML(p).replace(/ /g, "&nbsp;");
    } else {
      const match = p.match(/^(\s*)(.*?)(\s*)$/);
      const prefixSpace = match[1] || "";
      const actualTag = match[2] || "";
      const suffixSpace = match[3] || "";

      let tagHtml = "";
      if (actualTag) {
        const subMatch = actualTag.match(/^(.*?)(:[\d.]+)?$/);
        const pureTag = subMatch[1];
        const weightStr = subMatch[2] || "";

        const cleanSub = pureTag.trim().toLowerCase().replace(/_/g, " ");

        // 完全一致する場合
        if (typeof tagMap !== "undefined" && tagMap.has(cleanSub)) {
          const count = tagMap.get(cleanSub);
          const color = getColorByCount(count);
          tagHtml = `<span style="color: ${color}">${escapeHTML(pureTag).replace(/ /g, "&nbsp;")}</span>`;
          if (weightStr)
            tagHtml += `<span style="color: #aaa">${weightStr}</span>`;
        } else {
          // 部分一致検索ロジック
          const parts = pureTag.split(/([\s_]+)/);
          let words = [];
          let wordIndices = [];

          for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0 && parts[i].length > 0) {
              words.push(parts[i]);
              wordIndices.push(i);
            }
          }

          let i = 0;
          let resultParts = [...parts];

          while (i < words.length) {
            let found = false;
            // 最長一致検索
            for (let len = words.length - i; len > 0; len--) {
              let phrase = words
                .slice(i, i + len)
                .join(" ")
                .toLowerCase();

              let count = undefined;
              if (typeof tagMap !== "undefined") {
                count = tagMap.get(phrase);
              }

              if (count !== undefined) {
                let startIndex = wordIndices[i];
                let endIndex = wordIndices[i + len - 1];
                let originalStr = "";
                for (let j = startIndex; j <= endIndex; j++) {
                  originalStr += parts[j];
                }
                let color = getColorByCount(count);
                resultParts[startIndex] =
                  `<span style="color: ${color}">${escapeHTML(originalStr).replace(/ /g, "&nbsp;")}</span>`;
                for (let j = startIndex + 1; j <= endIndex; j++)
                  resultParts[j] = "";
                i += len;
                found = true;
                break;
              }
            }
            if (!found) {
              let startIndex = wordIndices[i];
              let color = getColorByCount(0);
              resultParts[startIndex] =
                `<span style="color: ${color}">${escapeHTML(parts[startIndex]).replace(/ /g, "&nbsp;")}</span>`;
              i++;
            }
          }

          tagHtml = resultParts
            .map((rp) => {
              if (rp.startsWith("<span")) return rp;
              return escapeHTML(rp).replace(/ /g, "&nbsp;");
            })
            .join("");

          if (weightStr)
            tagHtml += `<span style="color: #aaa">${weightStr}</span>`;
        }
      }
      resultHtml +=
        escapeHTML(prefixSpace).replace(/ /g, "&nbsp;") +
        tagHtml +
        escapeHTML(suffixSpace).replace(/ /g, "&nbsp;");
    }
  }
  return resultHtml;
}
