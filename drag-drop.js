/**
 * drag-drop.js - Drag & Drop 操作
 */
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
        const newTag = createTagElement(dragTagText),
          row = e.target.closest(".prompt-row");
        if (row) {
          const after = getDragAfterElement(row, e.clientX, false);
          if (after == null) row.appendChild(newTag);
          else row.insertBefore(newTag, after);
        } else {
          const newRow = document.createElement("div");
          newRow.className = "prompt-row";
          newRow.draggable = true;
          newRow.innerHTML = '<div class="row-handle">≡</div>';
          newRow.appendChild(newTag);
          const afterRow = getDragAfterElement(area, e.clientY, true);
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
