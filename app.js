const canvas = document.querySelector("#vj-canvas");
const canvas2d = document.querySelector("#vj-canvas-2d");
const context2d = canvas2d.getContext("2d", { alpha: false });
const gl = canvas.getContext("webgl", {
  antialias: false,
  preserveDrawingBuffer: true,
});

const todayIso = localIsoDate(new Date());

let researchSources = [
  {
    label: "MDN WebXR Device API",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API",
    note: "WebXRはVR/AR向けに3Dシーンを適切なフレームレートで描画し、2Dミラー表示も扱える。ただしHTTPS前提かつ対応状況に注意が必要。",
  },
  {
    label: "Khronos OpenGL Registry",
    url: "https://registry.khronos.org/OpenGL/index_gl.php",
    note: "GLSL 4.60仕様とOpenGLの公式リファレンスがまとまっているため、関数名や言語仕様確認の起点にした。",
  },
  {
    label: "Khronos OpenGL ES / GLSL Reference Pages",
    url: "https://registry.khronos.org/OpenGL-Refpages/index.php",
    note: "WebGLとの親和性が高いOpenGL ES系の参照に使いやすく、毎日の小さなシェーダー制作に向く。",
  },
];

let purchaseConfig = {
  enabled: false,
  label: "Full Pack",
  url: "",
  note: "映像データの購入先は準備中です。",
};

let plannedDrops = [
  {
    date: todayIso,
    title: "Orbiting Scan Bloom",
    loopSeconds: 16,
    palette: [0.31, 0.82, 0.63, 1.0, 0.8, 0.35],
    copy: "細い走査線、円軌道、低速の色相変化を重ねたクラブ投影向けの無音ループ。XRのミラー表示でも視線誘導が強すぎないよう、中心密度と周辺の余白を分けている。",
    why: "今日の軸は「WebXRでも通常スクリーンでも破綻しないGLSL素材」。MDNのWebXR資料ではXR表示と2Dミラーの両方が重要になるため、画面端まで細部を置きすぎず、中央の周期運動を主役にした。GLSLはKhronosの仕様・参照ページを基準に、WebGLで扱いやすい基本関数だけで構成した。",
  },
  {
    date: offsetDate(1),
    title: "Phase Lattice",
    loopSeconds: 12,
    palette: [1.0, 0.35, 0.4, 0.22, 0.7, 0.95],
    copy: "格子の位相をずらしながら、12秒で完全に戻るパターン。BPMに同期させやすい短い尺を想定。",
    why: "翌日の素材は、リズムに合わせて切り替えやすい短尺ループを優先した。sin/cosの整数周期だけで動きを閉じ、VJソフトに取り込んでも始点と終点の違和感が出にくい構成にした。",
  },
  {
    date: offsetDate(2),
    title: "Soft Depth Gate",
    loopSeconds: 20,
    palette: [0.95, 0.75, 0.22, 0.18, 0.58, 0.5],
    copy: "奥行きゲートのように前後するリングを20秒で循環。背景映像に重ねても情報量が増えすぎない。",
    why: "XR素材では立体感の示唆が有効だが、実際のヘッドセット表示では過密な高周波パターンが疲れやすい。そこで低周波のリングと暗い余白を主体にした。",
  },
];

const baseFragmentShader = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop;
uniform vec3 u_a;
uniform vec3 u_b;

#define PI 3.141592653589793

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float ring(vec2 p, float radius, float width) {
  return smoothstep(width, 0.0, abs(length(p) - radius));
}

float bands(vec2 p, float phase) {
  float v = sin(p.x * 18.0 + phase) + sin(p.y * 13.0 - phase * 0.7);
  return smoothstep(0.48, 1.0, abs(v) * 0.5);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float cycle = mod(u_time, u_loop) / u_loop;
  float phase = cycle * PI * 2.0;

  vec2 p = uv * rot(phase);
  float pulse = 0.5 + 0.5 * sin(phase);
  float radial = ring(p, 0.28 + pulse * 0.24, 0.045);
  radial += ring(p * rot(-phase * 0.6), 0.72, 0.025) * 0.7;

  vec2 q = p;
  q.x += sin(q.y * 3.0 + phase) * 0.12;
  q.y += cos(q.x * 2.2 - phase) * 0.10;
  float lattice = bands(q, phase);

  float scan = smoothstep(0.025, 0.0, abs(fract((uv.y + cycle) * 22.0) - 0.5));
  float vignette = smoothstep(1.35, 0.25, length(uv));
  float field = (radial + lattice * 0.55 + scan * 0.28) * vignette;

  vec3 color = mix(u_a, u_b, 0.5 + 0.5 * sin(phase + length(uv) * 3.0));
  color *= field;
  color += pow(max(field, 0.0), 2.0) * 0.35;

  gl_FragColor = vec4(color, 1.0);
}
`.trim();

const vertexShader = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`.trim();

let activePiece;
let program;
let animationId = 0;
let startTime = performance.now();
let pausedAt = 0;
let isPaused = false;
let calmMotion = false;
let videoRecorder = null;
let recordingStartedAt = 0;
let recordingProgressId = 0;
let alphaFrameId = 0;
let uniforms;
let activeCanvas = canvas;
let activePipeline = "glsl";

initialize();

async function initialize() {
  await loadProjectData();
  activePiece = pickPiece(todayIso);

  if (!gl && getPipeline(activePiece) === "glsl") {
    document.querySelector(".stage").innerHTML = "<p>WebGLを有効にしてください。</p>";
    return;
  }

  if (gl) setupGl();
  renderContent();
  requestAnimationFrame(draw);
}

async function loadProjectData() {
  try {
    const [dropsResponse, purchaseResponse] = await Promise.all([
      fetch("./data/drops.json", { cache: "no-store" }),
      fetch("./data/purchase.json", { cache: "no-store" }),
    ]);

    if (dropsResponse.ok) {
      const data = await dropsResponse.json();
      if (Array.isArray(data.sources)) researchSources = data.sources;
      if (Array.isArray(data.drops) && data.drops.length > 0) {
        plannedDrops = data.drops.sort((a, b) => b.date.localeCompare(a.date));
      }
    }

    if (purchaseResponse.ok) {
      purchaseConfig = { ...purchaseConfig, ...(await purchaseResponse.json()) };
    }
  } catch {
    // File previews and partial deployments fall back to the embedded starter data.
  }
}

function setupGl() {
  program = createProgram(vertexShader, baseFragmentShader);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  uniforms = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    time: gl.getUniformLocation(program, "u_time"),
    loop: gl.getUniformLocation(program, "u_loop"),
    a: gl.getUniformLocation(program, "u_a"),
    b: gl.getUniformLocation(program, "u_b"),
  };

  window.addEventListener("resize", resize);
  resize();
}

function draw(now) {
  activePipeline = getPipeline(activePiece);
  if (activePipeline === "canvas2d") {
    drawCanvas2d(now);
    animationId = requestAnimationFrame(draw);
    return;
  }

  resize();
  const elapsed = isPaused ? pausedAt : (now - startTime) / 1000;
  const speed = calmMotion ? 0.38 : 1;

  gl.useProgram(program);
  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.time, elapsed * speed);
  gl.uniform1f(uniforms.loop, activePiece.loopSeconds);
  gl.uniform3f(uniforms.a, activePiece.palette[0], activePiece.palette[1], activePiece.palette[2]);
  gl.uniform3f(uniforms.b, activePiece.palette[3], activePiece.palette[4], activePiece.palette[5]);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  animationId = requestAnimationFrame(draw);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function resizeCanvas2d() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas2d.clientWidth * dpr);
  const height = Math.floor(canvas2d.clientHeight * dpr);
  if (canvas2d.width !== width || canvas2d.height !== height) {
    canvas2d.width = width;
    canvas2d.height = height;
  }
}

function drawCanvas2d(now) {
  resizeCanvas2d();
  const width = canvas2d.width;
  const height = canvas2d.height;
  const elapsed = isPaused ? pausedAt : (now - startTime) / 1000;
  const speed = calmMotion ? 0.38 : 1;
  const cycle = ((elapsed * speed) % activePiece.loopSeconds) / activePiece.loopSeconds;
  const phase = cycle * Math.PI * 2;
  const minSide = Math.min(width, height);
  const seed = hash(`${activePiece.date}:${activePiece.title}`);
  const paletteA = rgb(activePiece.palette.slice(0, 3));
  const paletteB = rgb(activePiece.palette.slice(3, 6));

  context2d.clearRect(0, 0, width, height);
  context2d.fillStyle = "#020303";
  context2d.fillRect(0, 0, width, height);
  context2d.save();
  context2d.translate(width / 2, height / 2);
  context2d.globalCompositeOperation = "lighter";

  const rings = 7 + (seed % 5);
  for (let i = 0; i < rings; i += 1) {
    const t = i / rings;
    const radius = minSide * (0.12 + t * 0.39 + Math.sin(phase + i) * 0.012);
    const wobble = Math.sin(phase * (i + 1) + seed * 0.01) * 0.18;
    context2d.save();
    context2d.rotate(phase * (i % 2 === 0 ? 1 : -1) + wobble);
    context2d.strokeStyle = i % 2 === 0 ? paletteA : paletteB;
    context2d.globalAlpha = 0.16 + (1 - t) * 0.22;
    context2d.lineWidth = Math.max(1, minSide * (0.002 + t * 0.004));
    context2d.setLineDash([minSide * (0.012 + t * 0.01), minSide * 0.018]);
    context2d.beginPath();
    context2d.ellipse(0, 0, radius, radius * (0.58 + t * 0.28), 0, 0, Math.PI * 2);
    context2d.stroke();
    context2d.restore();
  }

  const count = 48;
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const orbit = phase + t * Math.PI * 2;
    const lane = 0.18 + ((i * 17 + seed) % 100) / 100 * 0.42;
    const x = Math.cos(orbit * (1 + (i % 3) * 0.2)) * minSide * lane;
    const y = Math.sin(orbit * (1 - (i % 4) * 0.08)) * minSide * lane * 0.68;
    const size = minSide * (0.004 + (((i + seed) % 9) / 9) * 0.012);
    const gradient = context2d.createRadialGradient(x, y, 0, x, y, size * 4);
    gradient.addColorStop(0, i % 2 === 0 ? paletteA : paletteB);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context2d.globalAlpha = 0.34;
    context2d.fillStyle = gradient;
    context2d.beginPath();
    context2d.arc(x, y, size * 4, 0, Math.PI * 2);
    context2d.fill();
  }

  context2d.globalCompositeOperation = "source-over";
  context2d.globalAlpha = 0.24;
  context2d.strokeStyle = "rgba(244,243,237,0.42)";
  context2d.lineWidth = Math.max(1, minSide * 0.0015);
  for (let y = -height / 2; y < height / 2; y += minSide * 0.045) {
    const offset = Math.sin(phase + y * 0.01) * minSide * 0.018;
    context2d.beginPath();
    context2d.moveTo(-width / 2, y + offset);
    context2d.lineTo(width / 2, y - offset);
    context2d.stroke();
  }
  context2d.restore();
}

function renderContent() {
  setActivePipeline(activePiece);
  document.querySelector("#piece-title").textContent = activePiece.title;
  document.querySelector("#piece-date").textContent = activePiece.date;
  document.querySelector("#detail-title").textContent = activePiece.title;
  document.querySelector("#detail-copy").textContent = activePiece.copy;
  document.querySelector("#loop-length").textContent = `${activePiece.loopSeconds}s`;
  document.querySelector("#why-copy").textContent = activePiece.why;
  document.querySelector("#shader-code").textContent = makePortableCode(activePiece);
  document.querySelector("#copy-shader").textContent = activePipeline === "canvas2d" ? "CODE" : "GLSL";
  renderPurchaseLink(activePiece);

  const sourceList = document.querySelector("#source-list");
  sourceList.innerHTML = "";
  researchSources.forEach((source) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.label;
    const note = document.createElement("p");
    note.textContent = source.note;
    li.append(link, note);
    sourceList.append(li);
  });

  const archive = document.querySelector("#archive-list");
  archive.innerHTML = "";
  plannedDrops.forEach((piece) => {
    const item = document.createElement("article");
    item.className = "archive-item";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = piece.title;
    button.addEventListener("click", () => {
      activePiece = piece;
      startTime = performance.now();
      pausedAt = 0;
      renderContent();
    });
    const small = document.createElement("small");
    small.textContent = `${piece.date} / ${piece.loopSeconds}s loop`;
    item.append(button, small);
    archive.append(item);
  });
}

function setActivePipeline(piece) {
  activePipeline = getPipeline(piece);
  activeCanvas = activePipeline === "canvas2d" ? canvas2d : canvas;
  canvas.hidden = activePipeline !== "glsl";
  canvas2d.hidden = activePipeline !== "canvas2d";

  document.querySelector("#pipeline-label").textContent =
    activePipeline === "canvas2d" ? "Canvas 2D ready" : "WebGL ready";
  document.querySelector("#pipeline-note").textContent =
    activePipeline === "canvas2d" ? "browser-native generative loop" : "mirrors cleanly in headset views";
  document.querySelector("#format-label").textContent =
    activePipeline === "canvas2d" ? "Canvas recipe" : "Fragment shader";
  document.querySelector("#format-note").textContent =
    activePipeline === "canvas2d" ? "date-seeded drawing commands" : "date-seeded uniforms";
  document.querySelector("#code-heading").textContent =
    activePipeline === "canvas2d" ? "今日のCanvas 2D" : "今日のGLSL";
}

function renderPurchaseLink(piece) {
  const link = document.querySelector("#purchase-link");
  const note = document.querySelector("#purchase-note");
  const itemUrl = piece.purchaseUrl || purchaseConfig.url;
  const enabled = Boolean(itemUrl && purchaseConfig.enabled);

  link.textContent = piece.purchaseLabel || purchaseConfig.label;
  link.href = enabled ? itemUrl : "#";
  link.target = enabled ? "_blank" : "";
  link.rel = enabled ? "noreferrer" : "";
  link.setAttribute("aria-disabled", String(!enabled));
  note.textContent = piece.purchaseNote || purchaseConfig.note;
}

document.querySelector("#toggle-play").addEventListener("click", () => {
  isPaused = !isPaused;
  const icon = document.querySelector("#play-icon");
  if (isPaused) {
    pausedAt = (performance.now() - startTime) / 1000;
    icon.textContent = ">";
  } else {
    startTime = performance.now() - pausedAt * 1000;
    icon.textContent = "II";
  }
});

document.querySelector("#toggle-motion").addEventListener("click", () => {
  calmMotion = !calmMotion;
  document.querySelector("#toggle-motion").style.color = calmMotion ? "var(--accent-2)" : "";
});

document.querySelector("#save-frame").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `${activePiece.date}-${slugify(activePiece.title)}.png`;
  link.href = activeCanvas.toDataURL("image/png");
  link.click();
});

document.querySelector("#save-video").addEventListener("click", () => {
  recordLoopVideo().catch((error) => {
    const button = document.querySelector("#save-video");
    button.textContent = "NO VIDEO";
    button.disabled = false;
    window.setTimeout(() => {
      button.textContent = "MP4";
    }, 1600);
    throw error;
  });
});

document.querySelector("#save-alpha").addEventListener("click", () => {
  recordAlphaVideo().catch((error) => {
    const button = document.querySelector("#save-alpha");
    button.textContent = "NO ALPHA";
    button.disabled = false;
    window.setTimeout(() => {
      button.textContent = "ALPHA";
    }, 1600);
    throw error;
  });
});

document.querySelector("#copy-shader").addEventListener("click", async () => {
  await navigator.clipboard.writeText(makePortableCode(activePiece));
  const button = document.querySelector("#copy-shader");
  button.textContent = "COPIED";
  window.setTimeout(() => {
    button.textContent = activePipeline === "canvas2d" ? "CODE" : "GLSL";
  }, 1200);
});

document.querySelector("#save-project").addEventListener("click", () => {
  const project = {
    project: "daily-xr-glsl-vj-loop",
    version: 1,
    date: activePiece.date,
    title: activePiece.title,
    loopSeconds: activePiece.loopSeconds,
    uniforms: {
      u_resolution: "vec2 render target size",
      u_time: "float seconds",
      u_loop: activePiece.loopSeconds,
      u_a: activePiece.palette.slice(0, 3),
      u_b: activePiece.palette.slice(3, 6),
    },
    researchSources,
    pipeline: activePipeline,
    code: makePortableCode(activePiece),
  };
  downloadText(
    `${activePiece.date}-${slugify(activePiece.title)}.xr-glsl.json`,
    JSON.stringify(project, null, 2),
    "application/json",
  );
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`#tab-${tab.dataset.tab}`).classList.add("is-active");
  });
});

function createProgram(vertexSource, fragmentSource) {
  const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const nextProgram = gl.createProgram();
  gl.attachShader(nextProgram, vertex);
  gl.attachShader(nextProgram, fragment);
  gl.linkProgram(nextProgram);
  if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(nextProgram));
  }
  return nextProgram;
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function makePortableCode(piece) {
  if (getPipeline(piece) === "canvas2d") return makeCanvas2dRecipe(piece);
  return makePortableShader(piece);
}

function makePortableShader(piece) {
  return `${baseFragmentShader}

// Daily XR/GLSL VJ Loop
// Date: ${piece.date}
// Title: ${piece.title}
// Loop seconds: ${piece.loopSeconds}
// Uniforms expected: u_resolution, u_time, u_loop, u_a, u_b
// Palette A: vec3(${piece.palette.slice(0, 3).join(", ")})
// Palette B: vec3(${piece.palette.slice(3, 6).join(", ")})`;
}

function makeCanvas2dRecipe(piece) {
  return `// Daily XR/Canvas 2D VJ Loop
// Date: ${piece.date}
// Title: ${piece.title}
// Loop seconds: ${piece.loopSeconds}
// Palette A: rgb(${rgb(piece.palette.slice(0, 3))})
// Palette B: rgb(${rgb(piece.palette.slice(3, 6))})
// Renderer: rings, orbiting glow particles, scanline mesh
// The site renderer is deterministic from date + title.`;
}

async function recordLoopVideo() {
  if (videoRecorder?.state === "recording") return;
  if (!canvas.captureStream || !window.MediaRecorder) {
    throw new Error("Canvas video recording is not supported in this browser.");
  }

  const format = pickVideoFormat();
  if (!format) {
    throw new Error("No supported MediaRecorder video format was found.");
  }

  const button = document.querySelector("#save-video");
  const chunks = [];
  const stream = activeCanvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  videoRecorder = recorder;
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const finished = new Promise((resolve) => {
    recorder.addEventListener("stop", resolve, { once: true });
  });

  button.disabled = true;
  button.classList.add("is-recording");
  startTime = performance.now();
  pausedAt = 0;
  isPaused = false;
  document.querySelector("#play-icon").textContent = "II";

  recordingStartedAt = performance.now();
  updateRecordingProgress(button);
  recorder.start(250);

  window.setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, activePiece.loopSeconds * 1000);

  await finished;
  cancelAnimationFrame(recordingProgressId);
  stream.getTracks().forEach((track) => track.stop());

  const blob = new Blob(chunks, { type: format.mimeType });
  downloadBlob(`${activePiece.date}-${slugify(activePiece.title)}.${format.extension}`, blob);

  button.classList.remove("is-recording");
  button.textContent = format.extension.toUpperCase();
  window.setTimeout(() => {
    button.textContent = "MP4";
    button.disabled = false;
    videoRecorder = null;
  }, 1400);
}

async function recordAlphaVideo() {
  if (videoRecorder?.state === "recording") return;
  if (!window.MediaRecorder) {
    throw new Error("Video recording is not supported in this browser.");
  }

  const format = pickAlphaVideoFormat();
  if (!format) {
    throw new Error("No supported alpha-capable video format was found.");
  }

  const button = document.querySelector("#save-alpha");
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportContext = exportCanvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });

  const chunks = [];
  const stream = exportCanvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 10_000_000,
  });

  videoRecorder = recorder;
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const finished = new Promise((resolve) => {
    recorder.addEventListener("stop", resolve, { once: true });
  });

  button.disabled = true;
  button.classList.add("is-recording");
  startTime = performance.now();
  pausedAt = 0;
  isPaused = false;
  document.querySelector("#play-icon").textContent = "II";

  const renderAlphaFrame = () => {
    exportContext.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportContext.drawImage(activeCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    const frame = exportContext.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    const pixels = frame.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
      const alpha = smoothstep(4, 52, luminance) * 255;
      pixels[i + 3] = alpha;
    }
    exportContext.putImageData(frame, 0, 0);
    alphaFrameId = requestAnimationFrame(renderAlphaFrame);
  };

  recordingStartedAt = performance.now();
  renderAlphaFrame();
  updateRecordingProgress(button);
  recorder.start(250);

  window.setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, activePiece.loopSeconds * 1000);

  await finished;
  cancelAnimationFrame(alphaFrameId);
  cancelAnimationFrame(recordingProgressId);
  stream.getTracks().forEach((track) => track.stop());

  const blob = new Blob(chunks, { type: format.mimeType });
  downloadBlob(`${activePiece.date}-${slugify(activePiece.title)}-alpha.${format.extension}`, blob);

  button.classList.remove("is-recording");
  button.textContent = "WEBM";
  window.setTimeout(() => {
    button.textContent = "ALPHA";
    button.disabled = false;
    videoRecorder = null;
  }, 1400);
}

function updateRecordingProgress(button) {
  const elapsed = (performance.now() - recordingStartedAt) / 1000;
  const progress = Math.min(99, Math.floor((elapsed / activePiece.loopSeconds) * 100));
  button.textContent = `REC ${progress}%`;
  recordingProgressId = requestAnimationFrame(() => updateRecordingProgress(button));
}

function pickVideoFormat() {
  const candidates = [
    { mimeType: "video/mp4;codecs=h264", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType));
}

function pickAlphaVideoFormat() {
  const candidates = [
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType));
}

function pickPiece(date) {
  const direct = plannedDrops.find((piece) => piece.date === date);
  if (direct) return direct;

  const seed = hash(date);
  const hueA = fract(seed * 0.0183);
  const hueB = fract(hueA + 0.38);
  return {
    date,
    title: `Generated Loop ${date.replaceAll("-", ".")}`,
    pipeline: "glsl",
    loopSeconds: [8, 12, 16, 20][seed % 4],
    palette: [...hsv(hueA, 0.72, 0.92), ...hsv(hueB, 0.68, 0.8)],
    copy: "日付シードから生成される公開用VJループ。常に整数秒の周期で戻るため、素材として扱いやすい。",
    why: "手動更新が止まった日も公開が途切れないよう、日付からGLSLの色と尺を決定する。後から検索メモを足せば、その日のアーカイブとして固定できる。",
  };
}

function getPipeline(piece) {
  return piece.pipeline || "glsl";
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

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

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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

function rgb(values) {
  return values.map((value) => Math.round(value * 255)).join(", ");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

window.addEventListener("beforeunload", () => cancelAnimationFrame(animationId));
