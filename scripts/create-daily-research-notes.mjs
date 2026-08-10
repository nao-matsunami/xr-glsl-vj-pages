import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectProjects } from "./project-registry.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || tokyoIsoDate(new Date());
const selected = selectProjects(args.project || "starter");
const outFile = args.out || path.join("logs", "daily-starter-sites", `${targetDate}-research-notes.json`);

const researchQueues = {
  glsl: [
    {
      summary: "今日はGLSLの周期関数とWebGL互換性を優先した。VJ素材としては、派手なノイズよりもsin/cosで閉じる位相設計の方が録画時に継ぎ目を管理しやすいため、短尺ループに向く。",
      sources: [
        source("Khronos OpenGL Shading Language", "https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf", "GLSLの言語仕様確認に使う基準。"),
        source("MDN WebGL API", "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API", "ブラウザ実装側の制約確認に使う。"),
      ],
    },
    {
      summary: "今日はWebXRや通常スクリーン投影の両方で破綻しにくいGLSL表現を優先した。中心運動と暗い余白を分けると、背景合成やアルファ化の素材として扱いやすい。",
      sources: [
        source("MDN WebXR Device API", "https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API", "XR表示とブラウザ要件の確認に使う。"),
        source("Khronos OpenGL ES Reference Pages", "https://registry.khronos.org/OpenGL-Refpages/es3/", "WebGL寄りの関数確認に使う。"),
      ],
    },
  ],
  canvas2d: [
    {
      summary: "今日はCanvas 2Dの合成、線、グラデーションを中心に見た。シェーダーより構造が読みやすく、線や粒子のVJ素材を日次で量産するパイプラインに向く。",
      sources: [
        source("MDN Canvas API", "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API", "Canvas 2D制作の起点。"),
        source("MDN CanvasRenderingContext2D", "https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D", "描画状態、パス、合成の確認に使う。"),
      ],
    },
    {
      summary: "今日はCanvasの録画前提で、固定秒数のループ設計を優先した。整数周期の三角関数で状態を閉じると、RECボタンやMac mini側の固定FPS書き出しへつなげやすい。",
      sources: [
        source("MDN requestAnimationFrame", "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame", "ブラウザアニメーションの基本タイミング確認。"),
        source("MDN MediaStream Recording API", "https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API", "ブラウザ録画導線の確認に使う。"),
      ],
    },
  ],
  threejs: [
    {
      summary: "今日はThree.jsの強みであるカメラ運動、メッシュ、ライトを主軸にした。現場映えする素材にするには、2D模様よりも奥行きと視点移動をループさせる方が印象を作りやすい。",
      sources: [
        source("Three.js Manual", "https://threejs.org/manual/", "Three.jsの制作手順確認に使う。"),
        source("Three.js Documentation", "https://threejs.org/docs/", "API確認の基準。"),
      ],
    },
    {
      summary: "今日はWebGLRendererとAnimationLoopの運用を重視した。XRや展示用途へ広げるなら、レンダーサイズ、カメラ、時間の扱いを最初から分離しておく価値がある。",
      sources: [
        source("Three.js WebGLRenderer", "https://threejs.org/docs/#api/en/renderers/WebGLRenderer", "レンダラー設定の確認に使う。"),
        source("Three.js Creating a Scene", "https://threejs.org/docs/#manual/en/introduction/Creating-a-scene", "シーン構造の基本確認。"),
      ],
    },
  ],
  svgcss: [
    {
      summary: "今日はSVG/CSSのベクター性を優先した。ロゴモーション、線形グリフ、軽量Webサンプルには、Canvasよりも図形単位で再編集しやすいSVGが向く。",
      sources: [
        source("MDN SVG", "https://developer.mozilla.org/en-US/docs/Web/SVG", "SVG図形と属性確認の起点。"),
        source("MDN CSS Animations", "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations", "CSSループアニメーション確認。"),
      ],
    },
    {
      summary: "今日はSVGのmask/filter方向を見た。販売素材としては、黒背景の発光素材だけでなく、ベクターのロゴ風モーションやUIパターンも別ラインにできる。",
      sources: [
        source("MDN SVG filter", "https://developer.mozilla.org/en-US/docs/Web/SVG/Element/filter", "SVGフィルタ表現の確認。"),
        source("MDN SVG mask", "https://developer.mozilla.org/en-US/docs/Web/SVG/Element/mask", "マスク表現の確認。"),
      ],
    },
  ],
  python: [
    {
      summary: "今日はPythonをオフライン生成の軸として見た。PillowやOpenCVで連番、マスク、アルファ素材を作れるため、ブラウザRECよりも販売用マスターの再現性を管理しやすい。",
      sources: [
        source("Pillow Documentation", "https://pillow.readthedocs.io/", "Python画像生成の基準。"),
        source("OpenCV Python Tutorials", "https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html", "画像処理と動画処理の確認に使う。"),
      ],
    },
    {
      summary: "今日はPython側の動画書き出し前提を重視した。ブラウザプレビューは軽く見せ、Mac miniでは固定FPS連番からMP4/MOVへ変換する構成が現実的。",
      sources: [
        source("imageio documentation", "https://imageio.readthedocs.io/", "Pythonから画像・動画を書き出す候補。"),
        source("FFmpeg Documentation", "https://ffmpeg.org/documentation.html", "MP4/MOV変換の基準。"),
      ],
    },
  ],
  p5js: [
    {
      summary: "今日はp5.jsをスケッチ公開の軸として見た。コードの読みやすさと教育的な文脈が強く、制作メモと一緒に日次公開するシリーズに向いている。",
      sources: [
        source("p5.js Reference", "https://p5js.org/reference/", "p5.js API確認の基準。"),
        source("p5.js Tutorials", "https://p5js.org/tutorials/", "スケッチ制作の参照に使う。"),
      ],
    },
    {
      summary: "今日はp5.jsのdrawループと時間設計を優先した。小さな生成ルールを毎日追加しやすく、Canvas 2Dよりも作品ノートとして見せやすい。",
      sources: [
        source("p5.js createCanvas", "https://p5js.org/reference/p5/createCanvas/", "キャンバス初期化の確認。"),
        source("p5.js frameRate", "https://p5js.org/reference/p5/frameRate/", "フレーム制御の確認。"),
      ],
    },
  ],
  default: [
    {
      summary: "今日は公式ドキュメントを基準に、軽量プレビューと販売用マスターの分離を確認した。GitHub Pagesでは見本を見せ、重い動画データは外部販売先へ置く方針を継続する。",
      sources: [
        source("GitHub Pages", "https://docs.github.com/en/pages", "公開基盤の確認。"),
      ],
    },
  ],
};

const notes = {
  date: targetDate,
  generatedAt: new Date().toISOString(),
  basis: "Official documentation and maintained reference queues. Replace with a live search note file when a specific current topic is needed.",
  projects: Object.fromEntries(selected.map((project) => [project.slug, noteFor(project.slug, targetDate)])),
};

const absoluteOut = path.isAbsolute(outFile) ? outFile : path.join(rootDir, outFile);
await fs.mkdir(path.dirname(absoluteOut), { recursive: true });
await fs.writeFile(absoluteOut, `${JSON.stringify(notes, null, 2)}\n`);
console.log(`Wrote daily research notes: ${path.relative(rootDir, absoluteOut)}`);

function noteFor(slug, date) {
  const items = researchQueues[slug] || researchQueues.default;
  const item = items[hash(`${date}:${slug}`) % items.length];
  return {
    summary: item.summary,
    sources: item.sources,
  };
}

function source(label, url, note) {
  return { label, url, note };
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const index = arg.indexOf("=");
    out[index === -1 ? arg.slice(2) : arg.slice(2, index)] = index === -1 ? "true" : arg.slice(index + 1);
  }
  return out;
}

function tokyoIsoDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function hash(value) {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    out ^= value.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return Math.abs(out);
}
