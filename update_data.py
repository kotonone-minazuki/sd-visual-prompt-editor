import csv
import json
import os
import sys

# 一部の巨大なタグ文字列に対応するためフィールドサイズ制限を拡張
csv.field_size_limit(1000000)

# ==========================================
# ファイル設定
# ==========================================
TSV_FILE = 'data.tsv'
THRESHOLDS_FILE = 'thresholds.json'
OUTPUT_FILE = 'danboru_dictionary.json'

def update_data():
    # 1. しきい値設定の読み込み
    if not os.path.exists(THRESHOLDS_FILE):
        print(f"エラー: {THRESHOLDS_FILE} が見つかりません。同じフォルダに作成してください。")
        sys.exit(1)
    
    try:
        with open(THRESHOLDS_FILE, 'r', encoding='utf-8') as f:
            thresholds_data = json.load(f)
    except Exception as e:
        print(f"エラー: しきい値ファイルの読み込みに失敗しました。({e})")
        sys.exit(1)

    # 2. TSVデータの読み込み
    if not os.path.exists(TSV_FILE):
        print(f"エラー: {TSV_FILE} が見つかりません。ダウンロードしたTSVを配置してください。")
        sys.exit(1)

    tags_data = []
    print(f"[{TSV_FILE}] を読み込み中...")
    
    try:
        with open(TSV_FILE, 'r', encoding='utf-8') as f:
            # タブ区切り(TSV)として読み込み
            reader = csv.DictReader(f, delimiter='\t')
            
            for row in reader:
                # count列を安全に数値へ変換
                try:
                    count_val = int(row.get('count', 0))
                except ValueError:
                    count_val = 0
                    
                # プロパティ名を1文字に圧縮して格納
                tags_data.append({
                    't': row.get('tag', '').strip(),
                    'tr': row.get('trans', '').strip(),
                    'j': row.get('jpTag', '').strip(),
                    'c': count_val,
                    'g': row.get('tagGroup', '').strip()
                })
    except Exception as e:
        print(f"エラー: TSVファイルの処理中に問題が発生しました。({e})")
        sys.exit(1)

    # カウント数が多い順にソート（フロント側の検索負荷軽減と表示順最適化のため）
    print("データをカウント数で並び替え中...")
    tags_data.sort(key=lambda x: x['c'], reverse=True)

    # 3. データの結合とJSONファイルへの出力
    output_data = {
        "tags": tags_data,
        "thresholds": thresholds_data
    }

    print(f"JSONファイルを生成中 (タグ: {len(tags_data):,}件, しきい値: {len(thresholds_data)}件)...")
    
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            # separators=(',', ':') を指定して空白や改行を排除し、ファイルサイズを最小化
            json.dump(output_data, f, ensure_ascii=False, separators=(',', ':'))
        print(f"✅ 成功: {OUTPUT_FILE} の更新が完了しました。")
    except Exception as e:
        print(f"エラー: JSONファイルの書き出しに失敗しました。({e})")

if __name__ == "__main__":
    update_data()