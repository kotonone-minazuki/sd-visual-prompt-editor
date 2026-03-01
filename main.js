/**
 * main.js - 初期化
 */
if (typeof CodeMirror !== "undefined") {
  CodeMirror.defineMode("sd-prompt-mode", function () {
    return {
      token: function (stream) {
        if (stream.sol() && stream.match("#")) {
          stream.skipToEnd();
          return "comment";
        }
        stream.next();
        return null;
      },
    };
  });
}

window.onload = () => {
  if (typeof MobileDragDrop !== "undefined") {
    MobileDragDrop.polyfill({ holdToDrag: 250 });
    window.addEventListener("touchmove", function () {}, { passive: false });
  }

  initTheme();

  editorNormal = CodeMirror.fromTextArea(
    document.getElementById("inputNormal"),
    {
      lineNumbers: true,
      lineWrapping: true,
      mode: "sd-prompt-mode",
      tabSize: 4,
    },
  );

  editorNormal.on("change", () => saveToLocalStorage());

  restoreFromLocalStorage();
  applyLanguage();
  fetchFromDB();
  initDragAndDrop();
  renderSpreadsheet();

  setTimeout(() => {
    if (editorNormal) editorNormal.refresh();
  }, 100);
};

// ▼ 追加: フッターのバージョン表示処理
document.addEventListener("DOMContentLoaded", () => {
  const verEl = document.getElementById("version-display");
  if (verEl && typeof APP_VERSION !== "undefined") {
    // 置換されていない場合（ローカル開発時など）の表示制御
    const displayVer =
      APP_VERSION === "__VERSION_STRING__" ? "Dev_Mode" : APP_VERSION;
    verEl.textContent = displayVer;
  }
});
