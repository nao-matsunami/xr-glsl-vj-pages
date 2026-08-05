# Canvas 2D VJ Site

Canvas 2Dで、毎日ループするVJ素材を公開する静的サイトです。

## Run

```sh
python3 -m http.server 4194
```

Open `http://localhost:4194/`.

## Daily Publish

```sh
npm run daily:publish
```

日付指定:

```sh
npm run daily:update -- --date=2026-08-07
npm run publish:pages
```

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
