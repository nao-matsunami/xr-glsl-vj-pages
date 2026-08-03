# Daily XR GLSL VJ Loops

XR/GLSLプロジェクト形式で、毎日ループするVJ素材を公開する静的サイトです。

## Run

```sh
python3 -m http.server 4184
```

Open `http://localhost:4184/`.

## Daily Update

`app.js` の `plannedDrops` に日付ごとの素材を追加します。

- `date`: `YYYY-MM-DD`
- `title`: 作品名
- `loopSeconds`: ループ尺。シェーダーはこの秒数で循環します。
- `palette`: `u_a` と `u_b` に渡すRGB値を6つ並べます。
- `copy`: 素材説明
- `why`: 検索メモと採用理由

未登録の日付は、日付シードから自動生成されます。

## Export

- `PNG`: 現在のフレームを書き出します。
- `GLSL`: フラグメントシェーダーをクリップボードにコピーします。
- `XR`: シェーダー、uniform、検索ソースを含む `.xr-glsl.json` を保存します。
