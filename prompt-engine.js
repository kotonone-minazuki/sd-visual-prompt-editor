/**
 * prompt-engine.js - 変換・解析ロジック
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
      tagSpan.innerHTML = `[${window.evaluateSequence ? window.evaluateSequence(contentSch, ":") : contentSch}]`;
      return tagSpan;
    case "alternating":
      applyGrayStyle();
      const contentAlt = rawTag.slice(1, -1);
      tagSpan.innerHTML = `[${window.evaluateSequence ? window.evaluateSequence(contentAlt, "|") : contentAlt}]`;
      return tagSpan;
    case "control":
      tagSpan.style.borderColor = "#e84393";
      tagSpan.style.color = "#e84393";
      tagSpan.style.borderRadius = "4px";
      tagSpan.textContent = rawTag;
      return tagSpan;
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
        const evalColor = getColorByCount(tagMap.get(cleanCore));
        tagSpan.style.borderColor = evalColor;
        tagSpan.style.color = evalColor;
        tagSpan.textContent = rawTag;
      } else {
        const words = cleanCore.split(/\s+/).filter((w) => w.length > 0);
        if (words.length > 1 || coreTag.includes(",")) {
          applyGrayStyle();
          tagSpan.innerHTML =
            escapeHTML(prefix).replace(/ /g, "&nbsp;") +
            (window.evaluateInternalParts
              ? evaluateInternalParts(coreTag)
              : escapeHTML(coreTag)) +
            escapeHTML(suffix).replace(/ /g, "&nbsp;");
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
    tags.forEach((tag) => rowDiv.appendChild(createTagElement(tag)));
    container.appendChild(rowDiv);
  });
}

function toggleBreakState(btn) {
  btn.classList.toggle("active");
  toggleBreaks();
  saveToLocalStorage();
}
function toggleStripState(btn) {
  btn.classList.toggle("active");
  toggleComments();
  saveToLocalStorage();
}

function convert() {
  let posLines = [];
  const doAppendBreak = document
    .getElementById("btnAppendBreak")
    .classList.contains("active");
  const controlTags = [
    "break",
    "and",
    "addrow",
    "addcomm",
    "addcol",
    "addbase",
  ];

  if (currentMode === "spreadsheet") {
    spreadsheetData.slice(1).forEach((row) => {
      if (row.every((cell) => !cell.trim())) return;
      const cat = row[0].trim();
      const tags = row.slice(1).filter((t) => t.trim() !== "");
      if (cat) posLines.push("# " + cat);
      if (tags.length > 0) {
        if (
          doAppendBreak &&
          !controlTags.includes(tags[tags.length - 1].toLowerCase())
        )
          tags.push("BREAK");
        posLines.push(tags.join(", "));
      }
    });
  } else {
    editorNormal
      .getValue()
      .split(/\r?\n/)
      .forEach((line) => {
        if (!line.trim()) return;
        let tags = splitTagsSmart(line);
        if (doAppendBreak) {
          let commentTag =
            tags.length > 0 && tags[tags.length - 1].startsWith("#")
              ? tags.pop()
              : null;
          if (
            tags.length > 0 &&
            !controlTags.includes(tags[tags.length - 1].toLowerCase())
          )
            tags.push("BREAK");
          if (commentTag) tags.push(commentTag);
        }
        posLines.push(tags.join(", "));
      });
  }
  buildVisualPreview("outputPreview", posLines);
  toggleComments();
}

function toggleComments() {
  const isChecked = document
    .getElementById("btnStripHeaders")
    .classList.contains("active");
  const container = document.getElementById("outputPreview");
  container.querySelectorAll(".prompt-row").forEach((row) => {
    let hasVisibleTag = false;
    row.querySelectorAll(".prompt-tag").forEach((tag) => {
      if (tag.dataset.raw.startsWith("#"))
        tag.style.display = isChecked ? "none" : "";
      if (tag.style.display !== "none") hasVisibleTag = true;
    });
    row.style.display = isChecked && !hasVisibleTag ? "none" : "flex";
  });
  syncPreviewToData();
}

function reflectToNormal() {
  syncPreviewToData();
  editorNormal.setValue(document.getElementById("outputRaw").value);
  saveToLocalStorage();
}

function reflectToSpreadsheet() {
  const container = document.getElementById("outputPreview");
  const strip = document
    .getElementById("btnStripHeaders")
    .classList.contains("active");
  let newData = [];
  let pendingCategory = "";

  container.querySelectorAll(".prompt-row").forEach((row) => {
    if (row.style.display === "none") return;
    let rowTags = Array.from(row.querySelectorAll(".prompt-tag"))
      .filter((t) => t.style.display !== "none")
      .map((t) => t.dataset.raw);
    if (rowTags.length === 0) return;
    let commentIndex = rowTags.findIndex((t) => t.startsWith("#"));

    if (!strip) {
      if (commentIndex !== -1) {
        pendingCategory = rowTags[commentIndex].substring(1).trim();
        rowTags.splice(commentIndex, 1);
        if (rowTags.length === 0) return;
      }
      newData.push([pendingCategory, ...rowTags]);
      pendingCategory = "";
    } else {
      if (commentIndex !== -1) rowTags.splice(commentIndex, 1);
      if (rowTags.length > 0) newData.push(["", ...rowTags]);
    }
  });

  const currentHeader = spreadsheetData[0] || [
    "Comment",
    "Tag 1",
    "Tag 2",
    "Tag 3",
    "Tag 4",
    "Tag 5",
  ];
  if (newData.length > 0) {
    const maxCols = Math.max(
      currentHeader.length,
      newData.reduce((max, r) => Math.max(max, r.length), 0),
    );
    while (currentHeader.length < maxCols)
      currentHeader.push("Tag " + currentHeader.length);
    newData.forEach((r) => {
      while (r.length < maxCols) r.push("");
    });
    spreadsheetData = [currentHeader, ...newData];
  } else {
    spreadsheetData = [currentHeader, new Array(currentHeader.length).fill("")];
  }
  renderSpreadsheet();
  saveToLocalStorage();
}

function toggleBreaks() {
  const isChecked = document
    .getElementById("btnAppendBreak")
    .classList.contains("active");
  const container = document.getElementById("outputPreview");
  const controlTags = [
    "break",
    "and",
    "addrow",
    "addcomm",
    "addcol",
    "addbase",
  ];

  container.querySelectorAll(".prompt-row").forEach((row) => {
    const tags = Array.from(row.querySelectorAll(".prompt-tag"));
    if (tags.length === 0) return;
    let targetIndex = tags.length - 1;
    let commentTag = tags[targetIndex].dataset.raw.startsWith("#")
      ? tags[targetIndex]
      : null;
    if (commentTag) targetIndex--;
    if (targetIndex < 0) return;

    const targetTagRaw = tags[targetIndex].dataset.raw.toLowerCase();
    if (isChecked) {
      if (!controlTags.includes(targetTagRaw)) {
        const breakTag = createTagElement("BREAK");
        if (commentTag) row.insertBefore(breakTag, commentTag);
        else row.appendChild(breakTag);
      }
    } else if (targetTagRaw === "break") tags[targetIndex].remove();
  });
  toggleComments();
}

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

  const container = document.getElementById("outputPreview");
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
        let tag = rowTags[i],
          lower = tag.toLowerCase(),
          isLora = tag.startsWith("<") && tag.endsWith(">");
        if (i === 0) {
          lineStr += tag;
        } else {
          let prevLower = rowTags[i - 1].toLowerCase(),
            prevIsLora =
              rowTags[i - 1].startsWith("<") && rowTags[i - 1].endsWith(">");
          lineStr +=
            spaceAfterTags.includes(prevLower) ||
            spaceBeforeTags.includes(lower) ||
            prevIsLora ||
            isLora
              ? " " + tag
              : ", " + tag;
        }
      }
      let last = rowTags[rowTags.length - 1];
      if (
        !spaceAfterTags.includes(last.toLowerCase()) &&
        !(last.startsWith("<") && last.endsWith(">")) &&
        !last.startsWith("#")
      )
        lineStr += ",";
      newLines.push(lineStr);
    }
  });
  document.getElementById("outputRaw").value = newLines.join("\n");
}
