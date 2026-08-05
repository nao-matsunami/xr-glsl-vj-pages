import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const dropsPath = path.join(rootDir, "data", "drops.json");
const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
const targetDate = dateArg ? dateArg.slice("--date=".length) : localIsoDate(new Date());

const titles = [
  "Chromatic Return Field",
  "Signal Bloom Gate",
  "Phase Tunnel Sweep",
  "Luma Orbit Mesh",
  "Scanline Depth Halo",
  "Vector Drift Bloom",
  "Soft Feedback Lattice",
  "Pulse Mirror Well",
];

const copyLines = [
  "クラブ投影や配信背景に使いやすい、中心運動と余白を分けた無音VJループ。",
  "細い走査線とリングの周期をそろえ、短い尺でも切れ目が目立ちにくい素材。",
  "XRのミラー表示でも端がうるさくなりすぎないよう、明滅の密度を中央寄りにしたループ。",
  "黒背景に重ねやすい発光系のサンプル。販売用のMP4/MOVパックへのプレビューとして扱う。",
];

const whyLines = [
  "今日の判断は、WebXRでの2Dミラー表示と通常スクリーン投影の両方で破綻しないことを優先した。GLSLはWebGLで扱いやすい基本関数だけに絞り、`u_loop` 秒で同じ状態へ戻る周期設計にしている。",
  "VJ素材としての扱いやすさを優先し、BPM同期しやすい整数秒ループにした。高密度なパターンは疲れやすいため、中心の動きと周辺の余白を分けている。",
  "サンプルページでは軽量なプレビューを見せ、実データは販売リンクへ誘導する前提にした。黒背景をアルファ化しやすいよう、発光部分と背景の輝度差を保っている。",
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
