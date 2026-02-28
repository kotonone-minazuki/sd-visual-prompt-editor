/**
 * ui-utils.js - 共通UI・ユーティリティ
 */
function initTheme() {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    document.getElementById("darkModeToggle").checked = true;
  }
}

function toggleDarkMode() {
  const isDark = document.getElementById("darkModeToggle").checked;
  document.body.classList.toggle("dark-mode", isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

function toggleLanguage() {
  currentLang = currentLang === "ja" ? "en" : "ja";
  localStorage.setItem("lang", currentLang);
  applyLanguage();
  renderLegend();
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (i18n[currentLang][key]) {
      el.innerHTML = i18n[currentLang][key];
    }
  });

  document.getElementById("tagSearch").placeholder =
    i18n[currentLang].searchPlaceholder;

  if (editorNormal && !editorNormal.getValue()) {
    editorNormal.setValue(i18n[currentLang].placeholderNormal);
  }

  const btn = document.getElementById("statusBtn");
  if (btn.classList.contains("status-success") && tagDatabase.length > 0) {
    btn.innerText =
      i18n[currentLang].loaded +
      tagDatabase.length.toLocaleString() +
      (currentLang === "ja" ? "件" : " tags");
  } else if (btn.classList.contains("status-loading")) {
    btn.innerText = i18n[currentLang].loading;
  } else {
    btn.innerText = i18n[currentLang].loadFail;
  }
}

function switchTab(mode) {
  currentMode = mode;
  document
    .getElementById("tabSpreadsheet")
    .classList.toggle("active", mode === "spreadsheet");
  document
    .getElementById("tabNormal")
    .classList.toggle("active", mode === "normal");
  document.getElementById("areaSpreadsheet").style.display =
    mode === "spreadsheet" ? "block" : "none";
  document.getElementById("areaNormal").style.display =
    mode === "normal" ? "block" : "none";

  document.getElementById("btnUpNormal").style.display =
    mode === "normal" ? "block" : "none";
  document.getElementById("btnUpSpreadsheet").style.display =
    mode === "spreadsheet" ? "block" : "none";

  setTimeout(() => {
    if (mode === "normal" && editorNormal) editorNormal.refresh();
    if (mode === "spreadsheet") renderSpreadsheet();
  }, 10);
  saveToLocalStorage();
}

function universalCopy(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy") ? resolve() : reject();
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(textArea);
      }
    });
  }
}

function copyResult(id, btn) {
  let text = "";
  if (id === "inputNormal") {
    text = editorNormal.getValue();
  } else if (id === "inputSpreadsheet") {
    text = spreadsheetData.map((row) => row.join("\t")).join("\n");
  } else {
    text = document.getElementById(id).value;
  }

  const originalText = btn.innerText;
  universalCopy(text)
    .then(() => {
      btn.style.backgroundColor = getComputedStyle(
        document.body,
      ).getPropertyValue("--copy-success-bg");
      btn.innerHTML = i18n[currentLang].copySuccess;
      setTimeout(() => {
        btn.style.backgroundColor = "";
        btn.innerHTML = originalText;
      }, 800);
    })
    .catch((err) => {
      console.error(err);
      btn.innerHTML = i18n[currentLang].copyFail;
      btn.style.backgroundColor = "#c0392b";
      setTimeout(() => {
        btn.style.backgroundColor = "";
        btn.innerHTML = originalText;
      }, 1000);
    });
}

function copyTag(tag, element) {
  universalCopy(tag).then(() => {
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
    element.style.transition = "background-color 0.2s";
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
      setTimeout(() => (element.style.transition = ""), 200);
    }, 300);
  });
}
