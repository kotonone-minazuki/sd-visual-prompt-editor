SD Visual Prompt Editor (SD Tag Converter Pro)

Stable Diffusion のプロンプト構築を直感的な操作で行うためのビジュアルエディタです。
プロンプトのテキスト表現と視覚的なブロック（ピル）表現を双方向に変換し、Danbooru のタグ統計データに基づく色分け表示や、スプレッドシートとの連携機能を備えています。

✨ Features (主な特徴)

ドラッグ＆ドロップによる直感的なプロンプト構築

テキストで入力したプロンプトを即座にブロック化し、ドラッグ＆ドロップで並び替えや削除が可能です。

タグの統計データに基づく視覚化

Danbooru の出現頻度データに基づき、タグの重要度や種類に応じて自動的に色分け表示を行います。

SD 構文の保護 (Smart Split)

強調構文 (red hair, blue eyes:1.2) 内のカンマや、LoRA <lora:name:1.0> などを正確に解析し、意図しないタグの分割を防ぎます。

スプレッドシート (TSV) 連携

Excel などで管理している「カテゴリ ＋ タグ」のリストをそのまま貼り付けて一括編集し、再び TSV として書き戻すことが可能です。

クリップボード連携 (コピー機能)

入力エリア（プロンプトエディタ、スプレッドシートデータ）の右上に配置されたコピーボタンから、テキストをワンクリックで即座にクリップボードへ保存できます。

外部ライブラリ非依存の軽量フロントエンド

React や Vue などのフレームワークに依存せず、HTML / CSS / Vanilla JavaScript のみで構成された高速でポータブルな SPA (Single Page Application) です。

🛠 Technologies (技術スタック)

Frontend: HTML5, CSS3, Vanilla JavaScript

Backend (API): Python (Flask), pyodbc

Backend (Static): Python (http.server)

Database: SQL Server (タグデータの管理・更新用)

📁 Directory Structure (ディレクトリ構成)

プロジェクトの主要なファイル構成と役割は以下の通りです。

index.html : アプリケーションのメインUIおよびフロントエンドロジック

server.py : SQL Server連携用のFlask APIサーバー

start_server.bat : 簡易ローカルサーバー(http.server)の起動スクリプト

update_data.py : データベースからJSONデータを更新・エクスポートするスクリプト

danboru_dictionary.json : タグの出現頻度や翻訳データを含む辞書(マスターデータ)

thresholds.json : タグの色分けルール(しきい値)設定ファイル

data.tsv : TSV連携用のサンプル/インポートデータ

readme.html : ユーザー向け操作マニュアル(エンドユーザー用)

sd_syntax_guide.html : Stable Diffusion 構文および特殊タグの解説書

⚙️ Architecture (システム構成)

本システムは、用途に応じて2つの動作モードをサポートしています。

静的ファイルモード (推奨 / デフォルト)

danboru_dictionary.json などの静的ファイルを index.html が直接 fetch して動作します。

データベースやサーバー構築が不要で、ポータビリティに優れています。

API連携モード

server.py を経由して SQL Server から最新のタグデータを動的に取得します。

マスターデータを頻繁に更新・管理する開発環境での利用を想定しています。

パースロジックの仕様について

テキストからビジュアルブロックへの変換は、index.html 内の splitTagsSmart 関数が担っています。
括弧 (), [], {} や <> のネスト深度（depth / angle）を計算しながら文字列を走査することで、最上位レベルのカンマのみを区切り文字として判定する安全な設計となっています。

🚀 Setup & Usage (導入方法と使い方)

ローカルでの起動方法 (簡易ホスティング)

CORS エラーを回避するため、ローカルサーバーを立ち上げてアクセスする必要があります。

Windows環境の場合:
同封されているバッチファイルを実行するだけで起動します。

start_server.bat をダブルクリックして実行します。

ブラウザが自動的に開かない場合は、コマンドプロンプトに表示されたURL (例: http://localhost:8000/index.html) にアクセスしてください。

手動で起動する場合 (Pythonがインストールされている環境):

プロジェクトのディレクトリに移動

cd sd-visual-prompt-editor

HTTPサーバーを起動

python -m http.server 8000

その後、ブラウザで http://localhost:8000/index.html にアクセスします。

APIサーバーを利用する場合 (上級者向け)

SQL Server と連携して動作させる場合は、以下の手順でセットアップします。

config.json を作成し、データベースの接続情報を記述します。

必要な Python パッケージをインストールします。
pip install flask pyodbc flask-cors

server.py を実行します。
python server.py

📝 License

This project is licensed under the MIT License.
