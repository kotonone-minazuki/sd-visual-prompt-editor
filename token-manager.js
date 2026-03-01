/**
 * token-manager.js
 * Automatic1111 (Stable Diffusion WebUI) のトークン計算ロジックを再現
 * - コメントタグ(#)の除外
 * - 記号の分離カウント
 * - BREAKによるパディング処理
 * - 複数チャンク境界の描画
 */

import { AutoTokenizer } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js";

const TOKENIZER_MODEL = "Xenova/clip-vit-large-patch14";
const CHUNK_LIMIT = 75;

class TokenManager {
  constructor() {
    this.tokenizer = null;
    this.isLoading = false;
    this.isEnabled = false;
  }

  async init() {
    if (this.tokenizer || this.isLoading) return;
    this.isLoading = true;
    this.updateStatus("⏳ Tokenizer Loading...");

    try {
      this.tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_MODEL, {
        quantized: false,
      });
      console.log("[TokenManager] Tokenizer loaded.");
      this.updateStatus(null);
      if (this.isEnabled) this.update();
    } catch (error) {
      console.error("[TokenManager] Load failed:", error);
      this.updateStatus("❌ Error");
      this.isLoading = false;
    }
  }

  toggle(enabled) {
    this.isEnabled = enabled;
    if (this.isEnabled) {
      if (!this.tokenizer) this.init();
      else this.update();
    } else {
      this.clearVisuals();
    }
  }

  async update() {
    if (!this.isEnabled || !this.tokenizer) return;

    this.clearVisuals();
    const container = document.getElementById("outputPreview");
    if (!container) return;

    const rows = Array.from(container.querySelectorAll(".prompt-row"));
    if (rows.length === 0) return;

    // 1. タグの収集（コメント除外フィルター）
    let allTags = [];
    rows.forEach((row) => {
      const tags = Array.from(row.querySelectorAll(".prompt-tag"));
      tags.forEach((tag) => {
        const rawText = tag.dataset.raw || "";
        // 非表示 または #で始まるタグ は無視
        if (tag.style.display !== "none" && !rawText.startsWith("#")) {
          allTags.push({ element: tag, row: row, text: rawText });
        }
      });
    });

    if (allTags.length === 0) return;

    let absoluteCount = 0; // A1111のユーザー枠(75)基準のため0スタート

    // 2. 順次計算
    for (let i = 0; i < allTags.length; i++) {
      const tagObj = allTags[i];
      const isBreak = tagObj.text.toUpperCase() === "BREAK";

      // --- A. 直前のカンマ（区切り文字）の処理 ---
      // 先頭ではなく、かつ直前がBREAKでなければカンマが入る
      if (i > 0 && allTags[i - 1].text.toUpperCase() !== "BREAK") {
        const commaStart = absoluteCount;
        absoluteCount += 1; // カンマは常に1トークン
        this.checkAndDrawBoundaries(
          commaStart,
          absoluteCount,
          tagObj.element,
          true,
        );
      }

      // --- B. BREAKタグの処理（パディング） ---
      if (isBreak) {
        // 現在のカウントを次の75の倍数まで飛ばす
        const currentChunk = Math.floor(absoluteCount / CHUNK_LIMIT);
        const nextChunkStart = (currentChunk + 1) * CHUNK_LIMIT;

        // 境界線を確実に描画するために、現在位置から次チャンク先頭までの区間を処理
        this.checkAndDrawBoundaries(
          absoluteCount,
          nextChunkStart,
          tagObj.element,
          false,
        );

        absoluteCount = nextChunkStart;
        continue; // BREAK自体は文字としてカウントせず、パディング処理のみ
      }

      // --- C. 通常タグの処理 ---
      const tagStart = absoluteCount;
      const tokenCount = await this.countInternalTokens(tagObj.text);
      absoluteCount += tokenCount;
      const tagEnd = absoluteCount;

      this.checkAndDrawBoundaries(tagStart, tagEnd, tagObj.element, false);
    }
  }

  /**
   * StartからEndの間に75の倍数（境界）があれば線を描画する
   * isComma: カンマ処理中の呼び出しかどうか（カンマはタグの「前」にあるため挿入位置が変わる）
   */
  checkAndDrawBoundaries(start, end, element, isComma) {
    // 0オリジンでのチャンクインデックス
    const startChunkIdx = Math.floor((start > 0 ? start - 1 : 0) / CHUNK_LIMIT);
    const endChunkIdx = Math.floor((end > 0 ? end - 1 : 0) / CHUNK_LIMIT);

    if (endChunkIdx > startChunkIdx) {
      // 跨いだ境界の数だけループ（例: 一気に2チャンク分進んだ場合などに対応）
      for (let b = startChunkIdx + 1; b <= endChunkIdx; b++) {
        const boundaryValue = b * CHUNK_LIMIT;

        // 境界値が start より大きい = タグの途中で区切れた (警告対象)
        // ただし、startがちょうど境界値(75など)の場合は、タグの直前で綺麗に切れているので警告なし
        const isSplitInMiddle = boundaryValue > start;

        // カンマ処理中の場合、線はタグの直前(insertBefore)に入れる
        // タグ処理中の場合も、基本は直前だが、SplitInMiddleの時は警告付きで入れる
        this.insertSeparator(element, isSplitInMiddle, false);
      }
    }
  }

  /**
   * ライブラリの合体を防ぐため、記号で分割してからカウント
   */
  async countInternalTokens(text) {
    // 記号と空白で分割（A1111のTokenizer挙動に寄せる）
    const parts = text
      .split(/([,():<>])|(\s+)/)
      .filter((p) => p && p.trim().length > 0);
    let total = 0;
    for (const part of parts) {
      const enc = await this.tokenizer(part);
      if (enc.input_ids && enc.input_ids.data) {
        // Start/Endトークンを除去
        total += Math.max(0, enc.input_ids.data.length - 2);
      }
    }
    return total;
  }

  insertSeparator(referenceElement, isWarning, isAfter) {
    // 重複防止（同じ場所に既に線があるなら何もしない）
    const prev = referenceElement.previousSibling;
    if (prev && prev.classList && prev.classList.contains("chunk-separator")) {
      // 既に線がある場合、警告へのアップグレードが必要なら行う
      if (isWarning && !prev.classList.contains("chunk-warning-line")) {
        prev.classList.add("chunk-warning-line");
        prev.innerHTML = '<span class="separator-warning-icon">⚠️</span>';
        prev.title = "⚠️ 警告: タグの途中でチャンクが分断されました";
      }
      return;
    }

    const separator = document.createElement("div");
    separator.className = "chunk-separator";

    if (isWarning) {
      separator.classList.add("chunk-warning-line");
      separator.innerHTML = '<span class="separator-warning-icon">⚠️</span>';
      separator.title = "⚠️ 警告: タグの途中でチャンクが分断されました";
    } else {
      separator.title = "75トークンの区切り";
    }

    const parent = referenceElement.parentNode;
    if (isAfter) {
      parent.insertBefore(separator, referenceElement.nextSibling);
    } else {
      parent.insertBefore(separator, referenceElement);
    }
  }

  clearVisuals() {
    const container = document.getElementById("outputPreview");
    if (!container) return;
    container.querySelectorAll(".chunk-separator").forEach((el) => el.remove());
  }

  updateStatus(msg) {
    const btn = document.getElementById("statusBtn");
    if (btn) btn.innerText = msg || "🔄 Ready";
  }
}

window.tokenManager = new TokenManager();
