# SD Visual Prompt Editor (SD Tag Converter Pro)

Stable Diffusion のプロンプト構築を直感的な操作で行うためのビジュアルエディタです。
プロンプトのテキスト表現と視覚的なブロック（ピル）表現を双方向に変換し、Danbooru のタグ統計データに基づく色分け表示や、スプレッドシートとの連携機能を備えています。

## ✨ Features (主な特徴)

- **ドラッグ＆ドロップによる直感的なプロンプト構築**
  - テキストで入力したプロンプトを即座にブロック化し、ドラッグ＆ドロップで並び替えや削除が可能です。

- **タグの統計データに基づく視覚化**
  - Danbooru の出現頻度データに基づき、タグの重要度や種類に応じて自動的に色分け表示を行います。

- **SD 構文の保護 (Smart Split)**
  - 強調構文 `(red hair, blue eyes:1.2)` 内のカンマや、LoRA `<lora:name:1.0>` などを正確に解析し、意図しないタグの分割を防ぎます。

- **スプレッドシート (TSV) 連携**
  - Excel などで管理している「カテゴリ ＋ タグ」のリストをそのまま貼り付けて一括編集し、再び TSV として書き戻すことが可能です。

- **クリップボード連携 (コピー機能)**
  - 入力エリア（プロンプトエディタ、スプレッドシートデータ）の右上に配置されたコピーボタンから、テキストをワンクリックで即座にクリップボードへ保存できます。

- **外部ライブラリ非依存の軽量フロントエンド**
  - React や Vue などのフレームワークに依存せず、HTML / CSS / Vanilla JavaScript のみで構成された高速でポータブルな SPA (Single Page Application) です。

## 🛠 Technologies (技術スタック)

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Data Processing**: Python (JSON生成スクリプト)
- **Backend (Static)**: Python (`http.server`)

## 📁 Directory Structure (ディレクトリ構成)

プロジェクトの主要なファイル構成と役割は以下の通りです。

- `index.html` : アプリケーションのメインUIおよびフロントエンドロジック
- `update_data.py` : `data.tsv` と `thresholds.json` から `danboru_dictionary.json` を生成するデータビルド用スクリプト
- `data.tsv` : Danbooru タグの統計情報や翻訳を含む元データ (TSV形式)
- `thresholds.json` : タグの色分けルール (しきい値) の設定ファイル
- `danboru_dictionary.json` : フロントエンドが直接読み込むマスターデータ (自動生成)
- `start_server.bat` : 簡易ローカルサーバー(http.server)の起動スクリプト
- `server.py` : (※オプション) SQL Server連携用のFlask APIサーバー
- `readme.html` : ユーザー向け操作マニュアル(エンドユーザー用)
- `sd_syntax_guide.html` : Stable Diffusion 構文および特殊タグの解説書

## ⚙️ Architecture (システム構成)

本システムは、ローカル環境で完結する**静的ファイルモード**で動作します。

- `danboru_dictionary.json` を `index.html` が直接 `fetch` して動作します。
- データベースや複雑なサーバー構築が不要で、ポータビリティに優れています。

### マスターデータの更新フロー

タグの追加や出現頻度の更新を行う場合は、以下の手順で JSON を再生成します。

1. `data.tsv` または `thresholds.json` を編集して保存します。
2. `update_data.py` を実行し、最新の `danboru_dictionary.json` を生成します。

### パースロジックの仕様について

テキストからビジュアルブロックへの変換は、`index.html` 内の `splitTagsSmart` 関数が担っています。
括弧 `()`, `[]`, `{}` や `<>` のネスト深度（depth / angle）を計算しながら文字列を走査することで、最上位レベルのカンマのみを区切り文字として判定する安全な設計となっています。

## 🚀 Setup & Usage (導入方法と使い方)

### ローカルでの起動方法 (簡易ホスティング)

CORS エラーを回避するため、ローカルサーバーを立ち上げてアクセスする必要があります。

**Windows環境の場合:**
同封されているバッチファイルを実行するだけで起動します。

1. `start_server.bat` をダブルクリックして実行します。
2. ブラウザが自動的に開かない場合は、コマンドプロンプトに表示されたURL (例: `http://localhost:8000/index.html`) にアクセスしてください。

**手動で起動する場合 (Pythonがインストールされている環境):**

```bash
# プロジェクトのディレクトリに移動
cd sd-visual-prompt-editor

# HTTPサーバーを起動
python -m http.server 8000

その後、ブラウザで http://localhost:8000/index.html にアクセスします。

📝 License
This project is licensed under the MIT License.
```
