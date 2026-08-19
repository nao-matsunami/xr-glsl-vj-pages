import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const dropsPath = path.join(rootDir, "data", "drops.json");
const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
const targetDate = dateArg ? dateArg.slice("--date=".length) : localIsoDate(new Date());

const families = [
  {
    slug: "core-loop",
    titles: ["Chromatic Return Field", "Signal Bloom Gate", "Phase Tunnel Sweep", "Luma Orbit Mesh", "Scanline Depth Halo", "Vector Drift Bloom", "Soft Feedback Lattice", "Pulse Mirror Well"],
    copy: "クラブ投影や配信背景に使いやすい、中心運動と余白を分けた無音VJループ。",
    why: "既存系列として、短い周期、中心運動、暗い余白、発光差を維持する。variantで日ごとのパターン差を増やしつつ、シリーズとして見える統一感を残している。",
  },
  {
    slug: "raymarch-objects",
    titles: ["Distance Shell Bloom", "Raymarch Vessel Gate", "Organic SDF Core", "Torus Object Drift", "Box Field Apparition"],
    copy: "距離関数で立体物を作る、オブジェクト感の強いGLSL VJループ。",
    why: "core-loopとは別文脈として、平面パターンではなく3D距離関数の立体感を主役にする。Three.jsやBlenderで反応が良かった有機的オブジェクト方向へつなげやすい。",
  },
  {
    slug: "feedback-fields",
    titles: ["Recursive Feedback Bloom", "Mirror Delay Field", "Afterimage Signal Well", "Folded Echo Lattice", "Residual Light Net"],
    copy: "残像、折り返し、擬似フィードバックを主役にしたGLSLループ。",
    why: "VJ現場で使いやすいフィードバック感を別系列にする。実際のフレームバッファフィードバックではなく、日次公開で安定する擬似残像として実装する。",
  },
  {
    slug: "typographic-signals",
    titles: ["Glyph Scanner Array", "Signal Type Grid", "Barcode Phase Score", "Terminal Light Score", "Vector Text Pulse"],
    copy: "文字、バー、記号、走査線のような情報グラフィック系GLSL素材。",
    why: "抽象発光素材とは違う、UIやタイポグラフィ寄りの文脈を作る。ロゴモーション、イベント名、配信背景に拡張しやすい系列として分ける。",
  },
  {
    slug: "matte-alpha-tools",
    titles: ["Alpha Ring Cutter", "Matte Gate Object", "Luma Key Bloom", "Mask Orbit Plate", "Transparent Signal Shell"],
    copy: "黒背景からアルファ化しやすい、マスクと抜き素材向けのGLSLループ。",
    why: "販売用MP4/MOVへの展開を考え、黒抜きやアルファMOVにしやすい形状を別系列にする。見た目だけでなく素材化しやすさを設計条件に入れる。",
  },
];

const data = JSON.parse(await fs.readFile(dropsPath, "utf8"));
const existing = data.drops.find((drop) => drop.date === targetDate);

if (existing) {
  console.log(`Daily drop already exists: ${targetDate} / ${existing.title}`);
  process.exit(0);
}

const seed = hash(targetDate);
const family = families[seed % families.length];
const hueA = fract(seed * 0.0183);
const hueB = fract(hueA + 0.38);
const drop = {
  date: targetDate,
  title: family.titles[seed % family.titles.length],
  family: family.slug,
  loopSeconds: [8, 12, 16, 20][seed % 4],
  palette: [...hsv(hueA, 0.72, 0.92), ...hsv(hueB, 0.68, 0.8)],
  copy: family.copy,
  why: family.why,
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
