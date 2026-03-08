/**
 * SD Visual Prompt Editor - Manual Common Script
 * ナビゲーションの共通化と言語切り替えを制御します。
 */

/**
 * 言語を設定・保存する関数
 * @param {string} lang - 'ja' または 'en'
 */
function setLanguage(lang) {
  const body = document.body;
  body.classList.remove("lang-ja", "lang-en");
  body.classList.add("lang-" + lang);

  // 選択状態を保存
  localStorage.setItem("sd-manual-lang", lang);

  // ボタンの見た目を更新
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const activeBtn = document.getElementById("btn-" + lang);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  // タブのタイトルを更新
  updateBrowserTitle(lang);
}

/**
 * ページ名に基づいてブラウザのタブ文字を更新する
 */
function updateBrowserTitle(lang) {
  const currentPath = window.location.pathname;
  const fileName = currentPath.split("/").pop() || "guide_index.html";

  // 各ページのタイトル定義
  const titles = {
    "guide_index.html": { ja: "イントロダクション", en: "Introduction" },
    "guide_basic.html": {
      ja: "1. 基本表示・モード切替",
      en: "1. Basic Display / Modes",
    },
    "guide_visual.html": {
      ja: "2. ビジュアルエディタ操作",
      en: "2. Visual Editor Usage",
    },
    "guide_search.html": { ja: "3. タグ検索・追加", en: "3. Tag Search / Add" },
    "guide_text.html": {
      ja: "4. プロンプトエディタ詳細",
      en: "4. Prompt Editor Details",
    },
    "guide_table.html": {
      ja: "5. スプレッドシート詳細",
      en: "5. Spreadsheet Details",
    },
    "guide_options.html": {
      ja: "6. 生成オプション",
      en: "6. Generation Options",
    },
    "guide_system.html": {
      ja: "7. データ保存・安全性",
      en: "7. Data Storage & Safety",
    },
    "guide_contact.html": {
      ja: "8. フィードバック・開発者情報",
      en: "8. Feedback / Contact",
    },
  };

  const pageTitle = titles[fileName] ? titles[fileName][lang] : "User Manual";
  document.title = pageTitle + " - SD Visual Prompt Editor";
}

/**
 * マニュアルの初期化処理
 */
async function initManual() {
  const navContainer = document.querySelector(".manual-nav");
  if (!navContainer) return;

  try {
    const response = await fetch("manual_nav.html");
    if (!response.ok) throw new Error("Navigation file not found");
    const navHtml = await response.text();
    navContainer.innerHTML = navHtml;

    const currentPath = window.location.pathname;
    const fileName = currentPath.split("/").pop() || "guide_index.html";
    const navLinks = navContainer.querySelectorAll(".nav-link");

    navLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (href === fileName) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    const savedLang = localStorage.getItem("sd-manual-lang") || "ja";
    setLanguage(savedLang);

    navContainer.classList.add("loaded");
  } catch (error) {
    console.error("Manual initialization failed:", error);
  }
}

document.addEventListener("DOMContentLoaded", initManual);
