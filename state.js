/**
 * state.js - 状態管理
 */
let tagDatabase = [];
let tagMap = new Map();
let allThresholds = [];
let currentThresholds = [];
let currentMode = "normal";
let editorNormal;
let currentLang = localStorage.getItem("lang") || "ja";

let spreadsheetData = [
  ["Comment", "Tag 1", "Tag 2", "Tag 3", "Tag 4", "Tag 5"],
  ["", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["", "", "", "", "", ""],
];

function saveToLocalStorage() {
  const normalContent = editorNormal ? editorNormal.getValue() : "";
  localStorage.setItem("autosave_normal", normalContent);
  localStorage.setItem("autosave_spreadsheet", JSON.stringify(spreadsheetData));
  localStorage.setItem("autosave_mode", currentMode);

  const breakActive = document
    .getElementById("btnAppendBreak")
    .classList.contains("active");
  const stripActive = document
    .getElementById("btnStripHeaders")
    .classList.contains("active");
  localStorage.setItem("autosave_opt_break", breakActive);
  localStorage.setItem("autosave_opt_strip", stripActive);
}

function restoreFromLocalStorage() {
  const breakActive = localStorage.getItem("autosave_opt_break") === "true";
  const stripActive = localStorage.getItem("autosave_opt_strip") === "true";

  if (breakActive)
    document.getElementById("btnAppendBreak").classList.add("active");
  if (stripActive)
    document.getElementById("btnStripHeaders").classList.add("active");

  const spreadContent = localStorage.getItem("autosave_spreadsheet");
  if (spreadContent !== null) {
    try {
      const parsed = JSON.parse(spreadContent);
      if (Array.isArray(parsed) && parsed.length > 0) {
        spreadsheetData = parsed;
      }
    } catch (e) {
      console.error("Auto-save restore failed", e);
    }
  }

  const normalContent = localStorage.getItem("autosave_normal");
  if (normalContent !== null && editorNormal) {
    editorNormal.setValue(normalContent);
  }

  const lastMode = localStorage.getItem("autosave_mode");
  if (lastMode === "spreadsheet") {
    switchTab("spreadsheet");
  } else {
    switchTab("normal");
  }
}
