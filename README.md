# Daily XR GLSL VJ Loops

XR/GLSLプロジェクト形式で、毎日ループするVJ素材を公開する静的サイトです。

## Run

```sh
python3 -m http.server 4184
```

Open `http://localhost:4184/`.

## Publish

```sh
npm run publish:pages
```

この作業ディレクトリ直下には `.git` を作らず、`pages-work/` にGitHub Pages用リポジトリを置いて同期します。Codexのサンドボックスで直下 `.git` 作成が拒否される場合でも、既存の `*-pages` プロジェクトと同じように公開できます。

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
