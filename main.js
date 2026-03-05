/**
 * main.js - 初期化
 */
if (typeof CodeMirror !== "undefined") {
  CodeMirror.defineMode("sd-prompt-mode", function () {
    return {
      token: function (stream) {
        // 修正: 行頭だけでなく、行の途中の "#" もコメントとして認識する
        if (stream.match("#")) {
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

  // 変更時に保存し、かつ「戻る」ボタンの状態を更新する
  editorNormal.on("change", () => {
    saveToLocalStorage();
    updateNormalUndoButtonState();
  });

  restoreFromLocalStorage();
  applyLanguage();
  fetchFromDB();
  initDragAndDrop();
  renderSpreadsheet();

  setTimeout(() => {
    if (editorNormal) {
      editorNormal.refresh();
      updateNormalUndoButtonState(); // 初回状態反映
    }
  }, 100);
};

// ▼ 追加: プロンプトエディタのUndo実行
function undoNormal() {
  if (editorNormal) {
    editorNormal.undo();
    updateNormalUndoButtonState();
  }
}

// ▼ 追加: プロンプトエディタの「戻る」ボタンの有効/無効を更新
function updateNormalUndoButtonState() {
  const btn = document.getElementById("btnUndoNormal");
  if (btn && editorNormal) {
    const history = editorNormal.historySize();
    btn.disabled = history.undo === 0;
    // 見た目のフィードバック
    btn.style.opacity = btn.disabled ? "0.5" : "1";
    btn.style.cursor = btn.disabled ? "not-allowed" : "pointer";
  }
}

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
