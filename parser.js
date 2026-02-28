/**
 * @fileoverview Stable Diffusionプロンプトの解析・変換ロジックを提供するコアモジュール。
 * タグの分割、色分けのためのHTML生成、プロンプト編集構文（Alternating Words等）の
 * 解析を行います。
 */

/**
 * 全角英数字・記号を半角に正規化します。
 * 日本語（ひらがな・カタカナ・漢字）は維持します。
 * また、カンマの後ろにスペースがない場合は自動的に補完します。
 *
 * @param {string} str - 正規化対象の文字列
 * @returns {string} 正規化された文字列
 */
function normalizeText(str) {
  if (!str) return "";

  // 1. 全角英数字・記号 (Unicode: FF01-FF5E) を半角に変換
  //    対応範囲: ！"＃＄％&'（）＊＋，－．／０-９：；＜＝＞？＠Ａ-Ｚ［＼］＾＿｀ａ-ｚ｛｜｝～
  let normalized = str.replace(/[\uFF01-\uFF5E]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
  });

  // 2. 全角スペース(U+3000) -> 半角スペース
  normalized = normalized.replace(/\u3000/g, " ");

  // 3. 読点(、) -> カンマ(,) ※タグ区切り対策
  normalized = normalized.replace(/、/g, ",");

  // 4. 【追加】カンマの後に空白がない場合、半角スペースを挿入する
  //    (例: "tag1,tag2" -> "tag1, tag2")
  normalized = normalized.replace(/,([^ \t\r\n])/g, ", $1");

  return normalized;
}

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
  // (コメントは正規化の影響を受けないよう、先に退避します)
  let commentPart = "";
  const hashIndex = line.indexOf("#");
  if (hashIndex !== -1) {
    commentPart = line.substring(hashIndex).trim();
    line = line.substring(0, hashIndex);
  }

  // プロンプト本体の正規化 (全角→半角など)
  line = normalizeText(line);

  // 特殊タグ（区切り文字として扱うキーワード）
  const keywords = ["BREAK", "AND", "ADDROW", "ADDCOMM", "ADDCOL", "ADDBASE"];

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    // --- 1. <...> (Lora/Embedding) の開始検出 ---
    // 現在の深さが0で、'<' が来た場合、これまでの蓄積があれば分割する
    if (char === "<" && depth === 0 && angle === 0) {
      if (current.trim()) {
        result.push(current.trim());
        current = "";
      }
    }

    // --- 2. 深さ(Depth/Angle)の更新 ---
    if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}")
      depth = Math.max(0, depth - 1);
    else if (char === "<") angle++;
    else if (char === ">") angle = Math.max(0, angle - 1);

    // --- 3. <...> (Lora/Embedding) の終了検出 ---
    // angleが0に戻った瞬間の '>' は、タグの終わりとみなす
    if (char === ">" && depth === 0 && angle === 0) {
      current += char;
      if (current.trim()) {
        result.push(current.trim());
        current = "";
      }
      continue;
    }

    // --- 4. 通常のカンマ分割 ---
    if (char === "," && depth === 0 && angle === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
      continue;
    }

    // --- 5. キーワード(AND, BREAK等)による分割判定 ---
    // 深さが0の場合のみチェックを行う
    if (depth === 0 && angle === 0) {
      let matchedKw = null;

      // 現在位置からキーワードが始まっているかチェック
      for (const kw of keywords) {
        // 大文字小文字を無視して比較するために substr を取得
        if (
          i + kw.length <= line.length &&
          line.substr(i, kw.length).toUpperCase() === kw
        ) {
          // 単語の境界チェック (前後が英数字でないこと)
          const prevChar = i > 0 ? line[i - 1] : " ";
          const nextChar =
            i + kw.length < line.length ? line[i + kw.length] : " ";
          const isWordChar = (c) => /[a-zA-Z0-9_]/.test(c);

          if (!isWordChar(prevChar) && !isWordChar(nextChar)) {
            matchedKw = kw;
            break;
          }
        }
      }

      if (matchedKw) {
        // 現在蓄積中の文字があれば、それを一つのタグとして確定
        if (current.trim()) {
          result.push(current.trim());
        }
        // キーワード自体もタグとして登録 (元の文字ケースを維持)
        result.push(line.substr(i, matchedKw.length));

        // カウンタを進めて、バッファをリセット
        current = "";
        i += matchedKw.length - 1; // loopで i++ されるので -1
        continue;
      }
    }

    current += char;
  }

  // 残りのバッファを追加
  if (current.trim()) result.push(current.trim());

  // コメントを最後に追加
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
 * また、未知のタグ（DB未登録）の場合はスペースで分割し、部分的なマッチングを試みます。
 *
 * @param {string} tag - タグ文字列 (例: "flat chest, slender body" や "blue breasts")
 * @returns {string} 装飾されたHTML文字列
 */
function evaluateInternalParts(tag) {
  // 変更: カンマに加え、空白文字でも分割する（区切り文字自体も結果に含める）
  // これにより "blue breasts" のようなスペース区切りの単語も個別に評価される
  const parts = tag.split(/([,\s]+)/);

  return parts
    .map((part) => {
      // 空白やカンマのみのパーツはそのまま返す
      if (!part.trim() || /^[,\s]+$/.test(part)) {
        // 修正: Flexbox内でスペースが潰れないよう、半角スペースを &nbsp; に置換
        return escapeHTML(part).replace(/ /g, "&nbsp;");
      }

      const match = part.match(/^(\s*)(.*?)(\s*)$/);
      if (!match) return escapeHTML(part);

      // 前後の空白も念のため &nbsp; 化
      const preSpace = match[1].replace(/ /g, "&nbsp;");
      const content = match[2];
      const postSpace = match[3].replace(/ /g, "&nbsp;");

      return preSpace + colorizeFragment(content) + postSpace;
    })
    .join("");
}
