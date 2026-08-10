# Daily starter VJ sites

Blenderを除いた主軸6系列を、既存の日次システムと同じ「Macのlaunchdで生成とpushを実行し、GitHub Pagesが反映する」形で運用する。

## 対象

- GLSL VJ Site: https://nao-matsunami.github.io/xr-glsl-vj-pages/
- Canvas 2D VJ Site: https://nao-matsunami.github.io/canvas-2d-vj-pages/
- Three.js VJ Site: https://nao-matsunami.github.io/three-js-vj-pages/
- SVG CSS VJ Site: https://nao-matsunami.github.io/svg-css-vj-pages/
- Python VJ Site: https://nao-matsunami.github.io/python-vj-pages/
- p5.js VJ Site: https://nao-matsunami.github.io/p5-js-vj-pages/

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
