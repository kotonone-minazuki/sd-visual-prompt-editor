import {
  env,
  AutoTokenizer,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js";

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
      // 【重要】ここで設定を強制適用
      env.allowLocalModels = false;
      env.useBrowserCache = false;

      // 【重要】オプションでもローカル探索を禁止 (local_files_only: false)
      this.tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_MODEL, {
        quantized: false,
        local_files_only: false,
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

    let allTags = [];
    rows.forEach((row) => {
      const tags = Array.from(row.querySelectorAll(".prompt-tag"));
      tags.forEach((tag) => {
        const rawText = tag.dataset.raw || "";
        if (tag.style.display !== "none" && !rawText.startsWith("#")) {
          allTags.push({ element: tag, row: row, text: rawText });
        }
      });
    });

    if (allTags.length === 0) return;

    let absoluteCount = 0;

    for (let i = 0; i < allTags.length; i++) {
      const tagObj = allTags[i];
      const isBreak = tagObj.text.toUpperCase() === "BREAK";

      if (i > 0 && allTags[i - 1].text.toUpperCase() !== "BREAK") {
        const commaStart = absoluteCount;
        absoluteCount += 1;
        this.checkAndDrawBoundaries(
          commaStart,
          absoluteCount,
          tagObj.element,
          true,
        );
      }

      if (isBreak) {
        const currentChunk = Math.floor(absoluteCount / CHUNK_LIMIT);
        const nextChunkStart = (currentChunk + 1) * CHUNK_LIMIT;
        this.checkAndDrawBoundaries(
          absoluteCount,
          nextChunkStart,
          tagObj.element,
          false,
        );
        absoluteCount = nextChunkStart;
        continue;
      }

      const tagStart = absoluteCount;
      const tokenCount = await this.countInternalTokens(tagObj.text);
      absoluteCount += tokenCount;
      const tagEnd = absoluteCount;

      this.checkAndDrawBoundaries(tagStart, tagEnd, tagObj.element, false);
    }
  }

  checkAndDrawBoundaries(start, end, element, isComma) {
    const startChunkIdx = Math.floor((start > 0 ? start - 1 : 0) / CHUNK_LIMIT);
    const endChunkIdx = Math.floor((end > 0 ? end - 1 : 0) / CHUNK_LIMIT);

    if (endChunkIdx > startChunkIdx) {
      for (let b = startChunkIdx + 1; b <= endChunkIdx; b++) {
        const boundaryValue = b * CHUNK_LIMIT;
        const isSplitInMiddle = boundaryValue > start;
        this.insertSeparator(element, isSplitInMiddle, false);
      }
    }
  }

  async countInternalTokens(text) {
    const parts = text
      .split(/([,():<>])|(\s+)/)
      .filter((p) => p && p.trim().length > 0);
    let total = 0;
    for (const part of parts) {
      const enc = await this.tokenizer(part);
      if (enc.input_ids && enc.input_ids.data) {
        total += Math.max(0, enc.input_ids.data.length - 2);
      }
    }
    return total;
  }

  insertSeparator(referenceElement, isWarning, isAfter) {
    const prev = referenceElement.previousSibling;
    if (prev && prev.classList && prev.classList.contains("chunk-separator")) {
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
