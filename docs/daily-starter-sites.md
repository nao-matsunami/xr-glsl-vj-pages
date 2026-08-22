# Daily starter VJ sites

Blenderを除いた主軸6系列を、既存の日次システムと同じ「Macのlaunchdで生成とpushを実行し、GitHub Pagesが反映する」形で運用する。

## 対象

- GLSL VJ Site: https://nao-matsunami.github.io/xr-glsl-vj-pages/
- Canvas 2D VJ Site: https://nao-matsunami.github.io/canvas-2d-vj-pages/
- Three.js VJ Site: https://nao-matsunami.github.io/three-js-vj-pages/
- SVG CSS VJ Site: https://nao-matsunami.github.io/svg-css-vj-pages/
- Python VJ Site: https://nao-matsunami.github.io/python-vj-pages/
- p5.js VJ Site: https://nao-matsunami.github.io/p5-js-vj-pages/

## 日次素材の本数

各系列の日次更新では、従来の本命素材を1本作るだけで終わらせず、調査中に出たアイデア、または「次に足すなら」に相当する発展案から、短時間で確認できる2本目の派生素材も作る。

- 1本目は、その日のテーマを代表する本命素材。
- 2本目は、アイデア検証用の派生素材。別HTML、別GLSL/ISF、別variant、別preview、または最小デモとして残す。
- `reports/YYYY-MM-DD.json` には、2本分のファイルパス、動く内容、次に足すと発展する要素を必ず書く。
- GLSL VJ と Python VJ もこの方針の対象に含める。

## 図形の品質ルール

通常状態の基本図形は、画面サイズの影響で歪ませない。

- 円、正三角形、正方形は、短辺基準またはアスペクト補正済み座標で描く。
- 円が楕円になる、正方形が意味なく横長/縦長になる、理由のない細長い矩形が出る状態は避ける。
- 楕円や長方形は、BPM、音量、遷移、深度、カメラ、診断値などに反応して変形する場合だけ使う。
- 変形を使う場合は、変形して戻る、入力で変わる、何かの状態を示すなど、歪みの意味が伝わるようにする。

## 手動実行

```sh
cd /Users/nao/Documents/Codex/2026-08-03-xr-glsl-vj
npm run daily:starter:publish
```

日付を指定してテストする場合:

```sh
npm run daily:starter:auto -- --date=2026-08-11
```

## launchd設定

設定ファイル:

```sh
automation/launchd/com.nao.vj-starter-daily.plist
```

インストール:

```sh
mkdir -p ~/Library/LaunchAgents
cp automation/launchd/com.nao.vj-starter-daily.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.nao.vj-starter-daily.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.nao.vj-starter-daily.plist
launchctl list | grep com.nao.vj-starter-daily
```

毎日 06:45 に `npm run daily:starter:auto` を実行する。ログは `logs/daily-starter-sites/launchd.out.log` と `logs/daily-starter-sites/launchd.err.log` に出る。

## 調査メモ

`npm run daily:starter:auto` は、公開前に `scripts/create-daily-research-notes.mjs` を実行し、各系列ごとの日替わり調査メモを `logs/daily-starter-sites/YYYY-MM-DD-research-notes.json` に作る。

通常は公式ドキュメント中心の安定した調査キューを使う。特定の日に検索結果や外部記事を反映したい場合は、手動でnotesファイルを作って渡す。

```sh
npm run daily:starter:auto -- --date=2026-08-11 --notes-file=notes/2026-08-11.json
```
