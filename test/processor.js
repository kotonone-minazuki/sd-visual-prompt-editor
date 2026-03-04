document.getElementById("startBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("modelFile");
  const statusArea = document.getElementById("statusArea");
  const progress = document.getElementById("progress");
  const detail = document.getElementById("detail");

  if (!fileInput.files.length) {
    alert("ファイルを選択してください。");
    return;
  }

  const file = fileInput.files[0];
  statusArea.style.display = "block";
  progress.innerText = "解析開始...";

  try {
    // 1. ヘッダーの長さを取得 (先頭8バイト)
    const headerLengthBuffer = await file.slice(0, 8).arrayBuffer();
    const headerLength = new BigUint64Array(headerLengthBuffer)[0];

    // 2. ヘッダー(JSON)を読み込み
    const headerBuffer = await file
      .slice(8, 8 + Number(headerLength))
      .arrayBuffer();
    const headerText = new TextDecoder().decode(headerBuffer);
    const header = JSON.parse(headerText);

    // 3. CLIPの重みを探す (代表的なキー名を検索)
    const targetKeys = [
      "cond_stage_model.transformer.text_model.embeddings.token_embedding.weight",
      "conditioner.embedders.0.transformer.text_model.embeddings.token_embedding.weight",
      "text_model.embeddings.token_embedding.weight",
    ];

    let weightInfo = null;
    for (const key of targetKeys) {
      if (header[key]) {
        weightInfo = header[key];
        detail.innerText = `Found key: ${key}`;
        break;
      }
    }

    if (!weightInfo)
      throw new Error("CLIPの重み(token_embedding)が見つかりませんでした。");

    const [numTokens, dim] = weightInfo.shape;
    const [start, end] = weightInfo.data_offsets;
    const dtype = weightInfo.dtype; // "F16", "F32", "BF16"
    const offset = 8 + Number(headerLength) + start;
    const byteSize = end - start;

    progress.innerText = `重みデータを読み込み中 (${dtype})...`;
    const weightDataBuffer = await file
      .slice(offset, offset + byteSize)
      .arrayBuffer();

    // 4. データ型に応じて配列を作成
    let floatArray;
    if (dtype === "F32") {
      floatArray = new Float32Array(weightDataBuffer);
    } else if (dtype === "F16" || dtype === "BF16") {
      // JS標準にFloat16がない場合を考慮し、手動で変換 (簡易版)
      floatArray = decodeFloat16(
        new Uint16Array(weightDataBuffer),
        dtype === "BF16",
      );
    } else {
      throw new Error(`未対応のデータ型です: ${dtype}`);
    }

    // 5. 各トークンのL2ノルムを計算
    progress.innerText = "ベクトル強度を計算中...";
    let tsvContent = "token_id\tmagnitude\n";

    for (let i = 0; i < numTokens; i++) {
      let sumSq = 0;
      for (let j = 0; j < dim; j++) {
        const val = floatArray[i * dim + j];
        sumSq += val * val;
      }
      const magnitude = Math.sqrt(sumSq);
      tsvContent += `${i}\t${magnitude.toFixed(6)}\n`;

      if (i % 5000 === 0) {
        detail.innerText = `進捗: ${i} / ${numTokens} トークン完了`;
        await new Promise((r) => setTimeout(r, 0)); // UI更新用
      }
    }

    // 6. TSVとして保存
    progress.innerText = "完了！保存します。";
    const blob = new Blob([tsvContent], { type: "text/tab-separated-values" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name}_magnitudes.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    progress.innerText = "エラー発生";
    detail.innerText = err.message;
  }
});

/**
 * 16bit浮動小数点を32bitに変換するヘルパー
 */
function decodeFloat16(uint16Array, isBF16) {
  const float32 = new Float32Array(uint16Array.length);
  for (let i = 0; i < uint16Array.length; i++) {
    const u16 = uint16Array[i];
    if (isBF16) {
      // bfloat16: 指数部8bit, 仮数部7bit (上位16bitをコピー)
      const view = new DataView(new ArrayBuffer(4));
      view.setUint16(0, u16, false); // Big endian
      float32[i] = view.getFloat32(0, false);
    } else {
      // float16 (IEEE 754)
      const s = (u16 >> 15) & 0x1;
      const e = (u16 >> 10) & 0x1f;
      const f = u16 & 0x3ff;
      if (e === 0) float32[i] = (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
      else if (e === 31) float32[i] = f ? NaN : s ? -Infinity : Infinity;
      else float32[i] = (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
    }
  }
  return float32;
}
