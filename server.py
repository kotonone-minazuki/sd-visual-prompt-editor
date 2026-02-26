# pip install flask pyodbc flask-cors
from flask import Flask, jsonify, send_file
from flask_cors import CORS
import pyodbc
import sys
import os
import json

app = Flask(__name__)
CORS(app)

# ==========================================
# 設定ファイル (config.json) の読み込み
# ==========================================
CONFIG_FILE = 'config.json'

def load_config():
    if not os.path.exists(CONFIG_FILE):
        print(f"エラー: {CONFIG_FILE} が見つかりません。server.py と同じフォルダに作成してください。")
        sys.exit(1)
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"エラー: {CONFIG_FILE} の読み込みに失敗しました。({e})")
        sys.exit(1)

# 起動時に一度だけ設定を読み込む
db_config = load_config()

def get_db_connection():
    # 読み込んだ設定値を使用して接続文字列を構築
    conn_str = f"DRIVER={{SQL Server}};SERVER={db_config['SERVER']};DATABASE={db_config['DATABASE']};UID={db_config['USERNAME']};PWD={db_config['PASSWORD']}"
    return pyodbc.connect(conn_str)

# ルートURL ( http://127.0.0.1:5000/ ) にアクセスしたときに converter.html を表示する
@app.route('/')
def index():
    if os.path.exists('converter.html'):
        return send_file('converter.html')
    return "converter.html が見つかりません。server.py と同じフォルダに配置してください。", 404

# ファイル名を直接指定 ( http://127.0.0.1:5000/converter.html ) した場合も表示する
@app.route('/<path:filename>')
def serve_file(filename):
    if filename == 'converter.html' and os.path.exists(filename):
        return send_file(filename)
    return "Not Found", 404

@app.route('/api/get_data', methods=['GET'])
def get_data():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # タグデータ取得
        cursor.execute("SELECT tag AS t, trans AS tr, jpTag AS j, [count] AS c FROM DanboruTags")
        tags = [dict(zip([col[0] for col in cursor.description], row)) for row in cursor.fetchall()]
        
        # しきい値マスタ取得（categoryを含める）
        cursor.execute("SELECT minCount, maxCount, colorCode, label, category FROM TagThresholds ORDER BY minCount DESC")
        thresholds = [dict(zip([col[0] for col in cursor.description], row)) for row in cursor.fetchall()]
        
        conn.close()
        return jsonify({"tags": tags, "thresholds": thresholds})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if '-listen' in sys.argv or '--listen' in sys.argv:
        host_ip = '0.0.0.0'
        print("起動モード: 外部アクセス許可 (-listen)")
    else:
        host_ip = '127.0.0.1'
        print("起動モード: ローカル専用")

    print(f"APIサーバー起動中: http://{host_ip}:5000")
    app.run(host=host_ip, port=5000)