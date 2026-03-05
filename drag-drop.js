/**
 * drag-drop.js - Drag & Drop 操作
 */
let draggedElement = null;
let dragSource = null;
let dragTagText = "";
let isDroppedInValidZone = false;

// --- Visual Editor Undo機能 ---
let visualUndoStack = [];
const MAX_VISUAL_UNDO_STACK = 20;

/**
 * 現在のビジュアルエディタのDOM状態を履歴に保存する
 */
function saveVisualState() {
  const previewArea = document.getElementById("outputPreview");
  if (!previewArea) return;

  // 現在のHTML構造（innerHTML）を丸ごと保存
  visualUndoStack.push(previewArea.innerHTML);
  if (visualUndoStack.length > MAX_VISUAL_UNDO_STACK) {
    visualUndoStack.shift();
  }
  updateVisualUndoButtonState();
}

/**
 * ビジュアルエディタの状態を1つ前に戻す
 */
function undoVisual() {
  if (visualUndoStack.length === 0) return;

  const previousHTML = visualUndoStack.pop();
  const previewArea = document.getElementById("outputPreview");
  if (previewArea) {
    previewArea.innerHTML = previousHTML;

    // 状態をローカルストレージに保存し、トークン数等も再計算させる
    if (typeof saveToLocalStorage === "function") {
      saveToLocalStorage();
    }
    updateVisualUndoButtonState();
  }
}

/**
 * 戻るボタンの有効・無効状態を更新する
 */
function updateVisualUndoButtonState() {
  const btn = document.getElementById("btnUndoVisual");
  if (btn) {
    btn.disabled = visualUndoStack.length === 0;
    btn.style.opacity = btn.disabled ? "0.5" : "1";
    btn.style.cursor = btn.disabled ? "not-allowed" : "pointer";
  }
}

// Ctrl+Z 押下時にビジュアルエディタのUndoを発火させるイベントリスナー
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    const active = document.activeElement;

    // テキスト入力欄（CodeMirror含む）にフォーカスがある場合は、ブラウザ標準のUndoを優先する
    const isInput =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.closest(".CodeMirror") ||
        active.tagName === "SELECT");

    if (!isInput) {
      // スプレッドシートモードの時はスプレッドシート専用のUndoが働くため、
      // プロンプトエディタ（normal）モードの時のみビジュアルエディタのUndoを発動させる
      if (typeof currentMode !== "undefined" && currentMode === "normal") {
        e.preventDefault();
        undoVisual();
      }
    }
  }
});

function initDragAndDrop() {
  document.addEventListener("dragstart", (e) => {
    isDroppedInValidZone = false;
    if (
      e.target.classList.contains("prompt-tag") ||
      e.target.classList.contains("prompt-row")
    ) {
      saveVisualState(); // ★ 内部ドラッグ（移動・削除）の開始直前に状態を保存
      draggedElement = e.target;
      dragSource = "internal";
      setTimeout(() => e.target.classList.add("dragging"), 0);
    } else if (
      e.target.classList.contains("tag-item") ||
      e.target.closest(".tag-item")
    ) {
      dragSource = "search";
      dragTagText = e.target.closest(".tag-item").dataset.tag;
      e.dataTransfer.setData("text/plain", dragTagText);
    }
  });

  document.addEventListener("dragend", (e) => {
    if (dragSource === "internal" && draggedElement) {
      draggedElement.classList.remove("dragging");
      if (!isDroppedInValidZone) draggedElement.remove();
      draggedElement = null;
      toggleComments();
      if (window.tokenManager) window.tokenManager.update();
    }
    dragSource = null;
    dragTagText = "";
  });

  document.querySelectorAll(".preview-area").forEach((area) => {
    area.addEventListener("dragenter", (e) => e.preventDefault());
    area.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = dragSource === "search" ? "copy" : "move";
      if (dragSource === "internal" && draggedElement) {
        if (draggedElement.classList.contains("prompt-row")) {
          const after = getDragAfterElement(area, e.clientY, true);
          if (after == null) area.appendChild(draggedElement);
          else area.insertBefore(draggedElement, after);
        } else if (draggedElement.classList.contains("prompt-tag")) {
          const row = e.target.closest(".prompt-row");
          if (row) {
            const after = getDragAfterElement(row, e.clientX, false);
            if (after == null) row.appendChild(draggedElement);
            else row.insertBefore(draggedElement, after);
          }
        }
      }
    });

    area.addEventListener("drop", (e) => {
      e.preventDefault();
      isDroppedInValidZone = true;
      if (dragSource === "search" && dragTagText) {
        // ★ ここは元のコードのまま、createTagElement を使用します
        const newTag = createTagElement(dragTagText),
          row = e.target.closest(".prompt-row");
        if (row) {
          const after = getDragAfterElement(row, e.clientX, false);
          saveVisualState(); // ★ 検索からの新規追加直前に状態を保存
          if (after == null) row.appendChild(newTag);
          else row.insertBefore(newTag, after);
        } else {
          const newRow = document.createElement("div");
          newRow.className = "prompt-row";
          newRow.draggable = true;
          newRow.innerHTML = '<div class="row-handle">≡</div>';
          newRow.appendChild(newTag);
          const afterRow = getDragAfterElement(area, e.clientY, true);
          saveVisualState(); // ★ 検索からの新規行追加直前に状態を保存
          if (afterRow == null) area.appendChild(newRow);
          else area.insertBefore(newRow, afterRow);
        }
        toggleComments();
        if (window.tokenManager) window.tokenManager.update();
      } else if (dragSource === "internal") {
        if (window.tokenManager) window.tokenManager.update();
      }
    });
  });
}

function getDragAfterElement(container, position, isRow) {
  const draggables = [
    ...container.querySelectorAll(
      isRow ? ".prompt-row:not(.dragging)" : ".prompt-tag:not(.dragging)",
    ),
  ];
  return draggables.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = isRow
        ? position - box.top - box.height / 2
        : position - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset)
        return { offset: offset, element: child };
      else return closest;
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}
