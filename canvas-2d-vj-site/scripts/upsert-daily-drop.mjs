import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const dropsPath = path.join(rootDir, "data", "drops.json");
const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
const targetDate = dateArg ? dateArg.slice("--date=".length) : localIsoDate(new Date());

const titles = [
  "Radial Type Pulse",
  "Orbit Mesh Drawing",
  "Signal Glyph Sweep",
  "Luma Thread Field",
  "Scanline Particle Well",
];

const copyLines = [
  "Canvas 2Dだけで描く、発光リングと軌道粒子の無音VJループ。",
  "軽量なWebプレビューから販売用レンダーへ展開するためのCanvas 2D生成素材。",
  "GLSLを使わず、描画コマンドと日付シードだけで構成する抽象ループ。",
];

const whyLines = [
  "Canvas 2Dは線、粒子、タイポグラフィ、走査線のようなVJ素材を素早く作れる。今日のサンプルは整数周期のsin/cosだけで構成し、ループ終端で同じ状態に戻る設計にした。",
  "非シェーダーサイトとしてCanvas 2Dを選んだ。依存が軽く、ブラウザ上のサンプル表示とMac miniでの固定FPS書き出しの両方へ展開しやすい。",
  "描画コマンドベースの軽量な映像生成を試す。販売用マスターは後でMac mini上の固定FPSレンダリングへ接続する前提にしている。",
];

const data = JSON.parse(await fs.readFile(dropsPath, "utf8"));
const existing = data.drops.find((drop) => drop.date === targetDate);

if (existing) {
  console.log(`Daily drop already exists: ${targetDate} / ${existing.title}`);
  process.exit(0);
}

const seed = hash(targetDate);
const hueA = fract(seed * 0.0183);
const hueB = fract(hueA + 0.38);
const drop = {
  date: targetDate,
  title: titles[seed % titles.length],
  loopSeconds: [8, 12, 16, 20][seed % 4],
  palette: [...hsv(hueA, 0.72, 0.92), ...hsv(hueB, 0.68, 0.8)],
  copy: copyLines[seed % copyLines.length],
  why: whyLines[seed % whyLines.length],
};

data.drops.unshift(drop);
data.drops.sort((a, b) => b.date.localeCompare(a.date));
await fs.writeFile(dropsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Added daily drop: ${targetDate} / ${drop.title}`);

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hash(value) {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return Math.abs(out);
}

function fract(value) {
  return value - Math.floor(value);
}

function hsv(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const table = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  return table[i % 6].map((n) => Number(n.toFixed(3)));
}
