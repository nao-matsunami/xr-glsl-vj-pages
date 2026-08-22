# GLSL VJ Site

GLSL形式で、毎日ループするVJ素材を公開する静的サイトです。XR表示や販売用映像素材への展開を想定したサンプルサイトです。

## Run

```sh
python3 -m http.server 4184
```

Open `http://localhost:4184/`.

## Daily Publish

旧方式では、今日の素材を `data/drops.json` に追加して、そのままGitHub Pagesへ公開します。

```sh
npm run daily:publish
```

日付を指定して追加する場合:

```sh
npm run daily:update -- --date=2026-08-06
npm run publish:pages
```

既に同じ日付の素材がある場合、`daily:update` は何も変更しません。

## Report Style Daily Publish

現在の標準運用は、既存の `webgl-xr-daily-report-pages` / `xr-ar-vr-showcase-pages` と同じ形式です。

- `reports/YYYY-MM-DD.json`: その日の調査レポート
- `outputs/YYYY-MM-DD_*.html`: その日の自作サンプル
- `days/YYYY-MM-DD.html`: 日別ページ。`build:gallery` で生成
- `pages/2.html` 以降: 一覧ページ。`build:gallery` で生成
- `live.html`: 旧トップページのライブプレビュー

日次レポートJSONを追加して、一覧再生成と公開まで行う場合:

```sh
npm run upsert:report -- --file reports/2026-08-24.json --publish
```

JSONを標準入力で渡す場合:

```sh
cat /tmp/report.json | npm run upsert:report -- --stdin --publish
```

VJ系サイトはすべてこの構成へ移行済みです。新しい日次更新では、単なる `data/drops.json` 追加ではなく、調査済みの `reports/YYYY-MM-DD.json` と自作サンプル `outputs/YYYY-MM-DD_*.html` を残す方針にします。

### Two-sample daily rule

今後の日次更新では、各対象プロジェクトで従来の本命素材を1本作ったうえで、調査中に出たアイデア、またはレポート内の「次に足すなら」に相当する発展案から、短時間で確認できる2本目の派生素材も作成します。

- 1本目: その日の主題を最もよく表す本命VJ素材。
- 2本目: アイデア検証用の派生素材。別HTML、別GLSL/ISF、別variant、別preview、または最小デモとして残す。
- レポートには2本とも、ファイルパス、何が動くか、次に何を足すと発展するかを書く。
- GLSL / Python / Canvas 2D / Three.js / SVG CSS / p5.js の starter 6系列でも同じ方針にする。

### Geometry quality rule

VJ素材では、通常状態の基本図形を不用意に歪ませないでください。

- 円、正三角形、正方形などは、画面アスペクト比を補正した座標で描く。
- 通常状態で円が楕円に見える、正方形が意味なく横長/縦長になる、意図のない帯状矩形が出る状態は避ける。
- 楕円、長方形、伸縮、圧縮は、音、BPM、遷移、深度、カメラ、エラー状態など意味のある演出として使う場合だけにする。
- 変形する場合は、変形して戻る、入力で変わる、診断値やリズムを示すなど、歪みの理由が分かるようにする。
- GLSL系では `min(resolution.x, resolution.y)` 基準の座標正規化、Python/Canvas系では短辺基準の座標系を使い、画面サイズ由来の偶然の歪みを避ける。

最初の6サイトをまとめて日次更新する場合:

```sh
npm run daily:starter -- --date=2026-08-24 --notes-file=research/daily-notes.example.json
```

公開まで一括で行う場合:

```sh
npm run daily:starter:publish -- --date=2026-08-24 --notes-file=research/daily-notes.example.json
```

## Daily Research Workflow

複数プロジェクトへ、その日の調査メモを同じ形式で入れられます。

```sh
npm run daily:research -- --date=2026-08-24 --project=starter --notes-file=research/daily-notes.example.json
```

`--project=starter` は最初に毎日更新する対象として、`glsl`, `canvas2d`, `threejs`, `svgcss`, `python`, `p5js` を扱います。`--project=core` はそれに `godot`, `unity` を加えます。全プロジェクトを対象にする場合は `--project=all` を使います。

調査メモを入れて公開まで一括で行う場合:

```sh
npm run daily:publish:all -- --date=2026-08-24 --project=starter --notes-file=research/daily-notes.example.json
```

`research/daily-notes.example.json` を雛形にして、私がその日の検索結果・要約・出典を入れる運用です。GitHub Actionsだけで自動Web検索するには検索APIキーが必要なので、現状はCodex作業時に検索して反映する方式にしています。

## Publish Only

```sh
npm run publish:pages
```

この作業ディレクトリ直下には `.git` を作らず、`pages-work/` にGitHub Pages用リポジトリを置いて同期します。Codexのサンドボックスで直下 `.git` 作成が拒否される場合でも、既存の `*-pages` プロジェクトと同じように公開できます。

## Project Data

日付ごとの素材は `data/drops.json` に保存します。

- `date`: `YYYY-MM-DD`
- `title`: 作品名
- `loopSeconds`: ループ尺。シェーダーはこの秒数で循環します。
- `palette`: `u_a` と `u_b` に渡すRGB値を6つ並べます。
- `copy`: 素材説明
- `why`: 検索メモと採用理由

未登録の日付は、表示時には日付シードから自動生成されます。公開アーカイブとして残したい日は `npm run daily:update` で `data/drops.json` に固定します。

## Sales Links

映像データの購入先が決まったら、`data/purchase.json` を更新します。

```json
{
  "enabled": true,
  "label": "Buy Full Pack",
  "url": "https://example.com/your-pack",
  "note": "MP4 / alpha MOV pack available now."
}
```

日付ごとに別URLへ出したい場合は、`data/drops.json` の各項目に `purchaseUrl`、`purchaseLabel`、`purchaseNote` を追加します。

## Export

- `PNG`: 現在のフレームを書き出します。
- `MP4`: ループ尺ぶんの動画を書き出します。ブラウザがMP4録画に未対応の場合はWebMで保存します。
- `ALPHA`: 黒い部分を透明化したアルファ付きWebMを書き出します。
- `GLSL`: フラグメントシェーダーをクリップボードにコピーします。
- `XR`: シェーダー、uniform、検索ソースを含む `.xr-glsl.json` を保存します。

シェーダーは `u_loop` 秒で同じ状態に戻るように作っています。ブラウザ録画は実時間ベースのため、販売用の完全なフレーム精度が必要な場合はMac mini上で固定FPSレンダリングしてエンコードする運用にしてください。

アルファ付きMOVが必要な場合は、`ALPHA` で保存したWebMをProRes 4444へ変換します。

```sh
ffmpeg -i input-alpha.webm -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le output-alpha.mov
```
