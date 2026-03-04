// ▼ 追加: バージョン情報のプレースホルダー
// ローカルで開発中は "Dev_Mode" と表示され、サーバーに上がると自動で書き換わります
const APP_VERSION = "__VERSION_STRING__";

/**
 * config.js - 定数・設定
 */
const i18n = {
  ja: {
    title: "SD Visual Prompt Editor",
    help: "📘 使い方",
    kofi: "☕ 支援 (Ko-fi)",
    syntax: "📜 SD構文",
    darkMode: "🌙 ダークモード",
    loading: "🔄 データ取得中...",
    loaded: "✅ 取得完了: ",
    loadFail: "❌ 取得失敗",
    tabNormal: "プロンプトエディタ",
    tabSpread: "スプレッドシートエディタ",
    labelNormal: "テキストのCopy & Paste 可能",
    labelSpread: "Excel / Sheets などから Copy & Paste 可能",
    copy: "コピー",
    copyHeader: "コピー(Header)",
    copySuccess: "✅ コピー完了！",
    copyFail: "❌ 失敗",
    btnConvert:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬇️</span> ビジュアルエディタに反映",
    btnReflectN:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> プロンプトエディタに反映",
    btnReflectS:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> スプレッドシートに反映",
    stripLabels: "コメントアウトを除去",
    breakLabels: "行末にBREAKを付加",
    labelVisual:
      "ビジュアルエディタ (ドラッグ＆ドロップで追加・移動・枠外へ削除)",
    copyPrompt: "プロンプトとしてコピー",
    searchPalette: "タグ検索パレット",
    searchPlaceholder: "キーワードを入力...",
    placeholderNormal:
      "1girl, solo, (looking at viewer:1.2), <lora:my_lora:1.0>...",
    dataSource: "※データソース: Danbooruタグデータセット",
    saveTxt: "Save .txt",
    loadTxt: "Load .txt",
    saveJson: "Save JSON",
    loadJson: "Load JSON",
    saveTsv: "Save TSV",
    loadTsv: "Load TSV",
    addRow: "+ 行追加",
    addCol: "+ 列追加",
    clear: "クリア",
  },
  en: {
    title: "SD Visual Prompt Editor",
    help: "📘 Guide",
    kofi: "☕ Support (Ko-fi)",
    syntax: "📜 SD Syntax",
    darkMode: "🌙 Dark Mode",
    loading: "🔄 Loading...",
    loaded: "✅ Loaded: ",
    loadFail: "❌ Failed",
    tabNormal: "Prompt Editor",
    tabSpread: "Spreadsheet Editor",
    labelNormal: "Text Copy & Paste Available",
    labelSpread: "Copy & Paste from Excel / Sheets Available",
    copy: "Copy",
    copyHeader: "Copy (Header)",
    copySuccess: "✅ Copied!",
    copyFail: "❌ Failed",
    btnConvert:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬇️</span> Reflect to Visual Editor",
    btnReflectN:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> Reflect to Prompt Editor",
    btnReflectS:
      "<span style='font-size: 1.5em; line-height: 1; vertical-align: middle;'>⬆️</span> Reflect to Spreadsheet",
    stripLabels: "Hide Comments/Headers",
    breakLabels: "Append BREAK to line ends",
    labelVisual:
      "Visual Editor (Drag & Drop to add/move, drop outside to delete)",
    copyPrompt: "Copy as Prompt",
    searchPalette: "Tag Search Palette",
    searchPlaceholder: "Enter keyword...",
    placeholderNormal:
      "1girl, solo, (looking at viewer:1.2), <lora:my_lora:1.0>...",
    dataSource: "*Data source: Danbooru tag dataset",
    saveTxt: "Save .txt",
    loadTxt: "Load .txt",
    saveJson: "Save JSON",
    loadJson: "Load JSON",
    saveTsv: "Save TSV",
    loadTsv: "Load TSV",
    addRow: "+ Add Row",
    addCol: "+ Add Col",
    clear: "Clear",
  },
};
