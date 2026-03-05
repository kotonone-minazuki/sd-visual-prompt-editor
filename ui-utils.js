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

  // ▼ 追加: モバイル警告モーダルの多言語対応
  const noticeTitle = document.getElementById("mobileNoticeTitle");
  if (noticeTitle) noticeTitle.innerText = i18n[currentLang].mobileNoticeTitle;

  const noticeText = document.getElementById("mobileNoticeText");
  if (noticeText) noticeText.innerText = i18n[currentLang].mobileNoticeText;

  const noticeCheck = document.getElementById("mobileNoticeCheckboxLabel");
  if (noticeCheck) noticeCheck.innerText = i18n[currentLang].dontShowAgain;

  const noticeBtn = document.getElementById("mobileNoticeBtn");
  if (noticeBtn) noticeBtn.innerText = i18n[currentLang].close;
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

function copyResult(id, btn, excludeHeader = false) {
  let text = "";
  if (id === "inputNormal") {
    text = editorNormal.getValue();
  } else if (id === "inputSpreadsheet") {
    // excludeHeader が true なら 1行目以降を使用、false なら全体を使用
    const rows = excludeHeader ? spreadsheetData.slice(1) : spreadsheetData;
    text = rows.map((row) => row.join("\t")).join("\n");
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

// ▼ 追加: モバイル判定と警告モーダル制御
function isMobileDevice() {
  // 1. User-Agentによる従来型の判定（iPhone, Androidスマホなど）
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  // 2. 画面幅による判定（スマホ想定）
  const isSmallScreen = window.innerWidth <= 800;

  // 3. iPadOS 13以降のSafari対応（User-AgentがMacintoshになるが、タッチ対応している端末）
  const isIPadOS =
    (navigator.platform === "MacIntel" ||
      navigator.userAgent.includes("Mac")) &&
    navigator.maxTouchPoints !== undefined &&
    navigator.maxTouchPoints > 1;

  // いずれかの条件を満たせばモバイル（タッチ端末）と判定
  return isMobileUA || isSmallScreen || isIPadOS;
}

function checkMobileNotice() {
  // モバイル端末であり、かつ「次回から表示しない」が設定されていない場合のみ表示
  if (isMobileDevice() && localStorage.getItem("hideMobileNotice") !== "true") {
    const overlay = document.getElementById("mobileNoticeOverlay");
    if (overlay) {
      overlay.classList.add("show");
    }
  }
}

function closeMobileNotice() {
  // チェックボックスの状態を確認してlocalStorageに保存
  const checkbox = document.getElementById("mobileNoticeCheckbox");
  if (checkbox && checkbox.checked) {
    localStorage.setItem("hideMobileNotice", "true");
  }

  // モーダルを閉じる
  const overlay = document.getElementById("mobileNoticeOverlay");
  if (overlay) {
    overlay.classList.remove("show");
  }
}
