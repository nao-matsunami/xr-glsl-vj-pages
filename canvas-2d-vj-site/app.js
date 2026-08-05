const canvas = document.querySelector("#vj-canvas");
const context = canvas.getContext("2d", { alpha: false });
const todayIso = localIsoDate(new Date());

let sources = [];
let drops = [];
let purchaseConfig = {
  enabled: false,
  label: "Full Pack",
  url: "",
  note: "映像データの購入先は準備中です。",
};

let activePiece;
let animationId = 0;
let startTime = performance.now();
let pausedAt = 0;
let isPaused = false;
let calmMotion = false;
let videoRecorder = null;
let recordingStartedAt = 0;
let recordingProgressId = 0;
let alphaFrameId = 0;

initialize();

async function initialize() {
  await loadData();
  activePiece = pickPiece(todayIso);
  renderContent();
  requestAnimationFrame(draw);
}

async function loadData() {
  try {
    const [dropsResponse, purchaseResponse] = await Promise.all([
      fetch("./data/drops.json", { cache: "no-store" }),
      fetch("./data/purchase.json", { cache: "no-store" }),
    ]);

    if (dropsResponse.ok) {
      const data = await dropsResponse.json();
      if (Array.isArray(data.sources)) sources = data.sources;
      if (Array.isArray(data.drops)) drops = data.drops.sort((a, b) => b.date.localeCompare(a.date));
    }

    if (purchaseResponse.ok) {
      purchaseConfig = { ...purchaseConfig, ...(await purchaseResponse.json()) };
    }
  } catch {
    drops = [];
  }
}

function draw(now) {
  resize();
  const width = canvas.width;
  const height = canvas.height;
  const elapsed = isPaused ? pausedAt : (now - startTime) / 1000;
  const speed = calmMotion ? 0.38 : 1;
  const cycle = ((elapsed * speed) % activePiece.loopSeconds) / activePiece.loopSeconds;
  const phase = cycle * Math.PI * 2;
  const minSide = Math.min(width, height);
  const seed = hash(`${activePiece.date}:${activePiece.title}`);
  const paletteA = rgb(activePiece.palette.slice(0, 3));
  const paletteB = rgb(activePiece.palette.slice(3, 6));

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#020303";
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2);
  context.globalCompositeOperation = "lighter";

  const rings = 7 + (seed % 5);
  for (let i = 0; i < rings; i += 1) {
    const t = i / rings;
    const radius = minSide * (0.12 + t * 0.39 + Math.sin(phase + i) * 0.012);
    const wobble = Math.sin(phase * (i + 1) + seed * 0.01) * 0.18;
    context.save();
    context.rotate(phase * (i % 2 === 0 ? 1 : -1) + wobble);
    context.strokeStyle = i % 2 === 0 ? paletteA : paletteB;
    context.globalAlpha = 0.16 + (1 - t) * 0.22;
    context.lineWidth = Math.max(1, minSide * (0.002 + t * 0.004));
    context.setLineDash([minSide * (0.012 + t * 0.01), minSide * 0.018]);
    context.beginPath();
    context.ellipse(0, 0, radius, radius * (0.58 + t * 0.28), 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  for (let i = 0; i < 48; i += 1) {
    const t = i / 48;
    const orbit = phase + t * Math.PI * 2;
    const lane = 0.18 + ((i * 17 + seed) % 100) / 100 * 0.42;
    const x = Math.cos(orbit * (1 + (i % 3) * 0.2)) * minSide * lane;
    const y = Math.sin(orbit * (1 - (i % 4) * 0.08)) * minSide * lane * 0.68;
    const size = minSide * (0.004 + (((i + seed) % 9) / 9) * 0.012);
    const gradient = context.createRadialGradient(x, y, 0, x, y, size * 4);
    gradient.addColorStop(0, i % 2 === 0 ? paletteA : paletteB);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.globalAlpha = 0.34;
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, size * 4, 0, Math.PI * 2);
    context.fill();
  }

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 0.24;
  context.strokeStyle = "rgba(244,243,237,0.42)";
  context.lineWidth = Math.max(1, minSide * 0.0015);
  for (let y = -height / 2; y < height / 2; y += minSide * 0.045) {
    const offset = Math.sin(phase + y * 0.01) * minSide * 0.018;
    context.beginPath();
    context.moveTo(-width / 2, y + offset);
    context.lineTo(width / 2, y - offset);
    context.stroke();
  }
  context.restore();

  animationId = requestAnimationFrame(draw);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function renderContent() {
  document.querySelector("#piece-title").textContent = activePiece.title;
  document.querySelector("#piece-date").textContent = activePiece.date;
  document.querySelector("#detail-title").textContent = activePiece.title;
  document.querySelector("#detail-copy").textContent = activePiece.copy;
  document.querySelector("#loop-length").textContent = `${activePiece.loopSeconds}s`;
  document.querySelector("#why-copy").textContent = activePiece.why;
  document.querySelector("#code-output").textContent = makeRecipe(activePiece);
  renderPurchaseLink(activePiece);
  renderSources();
  renderArchive();
}

function renderSources() {
  const sourceList = document.querySelector("#source-list");
  sourceList.innerHTML = "";
  sources.forEach((source) => {
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
}

function renderArchive() {
  const archive = document.querySelector("#archive-list");
  archive.innerHTML = "";
  drops.forEach((piece) => {
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
    small.textContent = `${piece.date} / ${piece.loopSeconds}s Canvas 2D loop`;
    item.append(button, small);
    archive.append(item);
  });
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
  link.href = canvas.toDataURL("image/png");
  link.click();
});

document.querySelector("#save-video").addEventListener("click", () => {
  recordLoopVideo().catch(() => {
    const button = document.querySelector("#save-video");
    button.textContent = "NO VIDEO";
    button.disabled = false;
    window.setTimeout(() => {
      button.textContent = "MP4";
    }, 1600);
  });
});

document.querySelector("#save-alpha").addEventListener("click", () => {
  recordAlphaVideo().catch(() => {
    const button = document.querySelector("#save-alpha");
    button.textContent = "NO ALPHA";
    button.disabled = false;
    window.setTimeout(() => {
      button.textContent = "ALPHA";
    }, 1600);
  });
});

document.querySelector("#copy-code").addEventListener("click", async () => {
  await navigator.clipboard.writeText(makeRecipe(activePiece));
  const button = document.querySelector("#copy-code");
  button.textContent = "COPIED";
  window.setTimeout(() => {
    button.textContent = "CODE";
  }, 1200);
});

document.querySelector("#save-project").addEventListener("click", () => {
  const project = {
    project: "daily-canvas-2d-vj-loop",
    version: 1,
    date: activePiece.date,
    title: activePiece.title,
    loopSeconds: activePiece.loopSeconds,
    palette: activePiece.palette,
    sources,
    recipe: makeRecipe(activePiece),
  };
  downloadText(
    `${activePiece.date}-${slugify(activePiece.title)}.canvas2d-vj.json`,
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

async function recordLoopVideo() {
  if (videoRecorder?.state === "recording") return;
  if (!canvas.captureStream || !window.MediaRecorder) {
    throw new Error("Canvas video recording is not supported in this browser.");
  }
  const format = pickVideoFormat();
  if (!format) throw new Error("No supported MediaRecorder video format was found.");

  const button = document.querySelector("#save-video");
  const chunks = [];
  const stream = canvas.captureStream(60);
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

  downloadBlob(
    `${activePiece.date}-${slugify(activePiece.title)}.${format.extension}`,
    new Blob(chunks, { type: format.mimeType }),
  );

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
  if (!window.MediaRecorder) throw new Error("Video recording is not supported in this browser.");
  const format = pickAlphaVideoFormat();
  if (!format) throw new Error("No supported alpha-capable video format was found.");

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
    exportContext.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
    const frame = exportContext.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    const pixels = frame.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
      pixels[i + 3] = smoothstep(4, 52, luminance) * 255;
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

  downloadBlob(
    `${activePiece.date}-${slugify(activePiece.title)}-alpha.${format.extension}`,
    new Blob(chunks, { type: format.mimeType }),
  );

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
  const direct = drops.find((piece) => piece.date === date);
  if (direct) return direct;
  const seed = hash(date);
  const hueA = fract(seed * 0.0183);
  const hueB = fract(hueA + 0.38);
  return {
    date,
    title: `Generated Canvas Loop ${date.replaceAll("-", ".")}`,
    loopSeconds: [8, 12, 16, 20][seed % 4],
    palette: [...hsv(hueA, 0.72, 0.92), ...hsv(hueB, 0.68, 0.8)],
    copy: "日付シードから生成されるCanvas 2D VJループ。軽量なサンプル公開と販売用映像生成の橋渡しにする。",
    why: "Canvas 2Dは線、粒子、走査線のようなVJ素材を素早く作れる。今日のサンプルは整数周期のsin/cosだけで構成し、ループ終端で同じ状態に戻る設計にした。",
  };
}

function makeRecipe(piece) {
  return `// Daily Canvas 2D VJ Loop
// Date: ${piece.date}
// Title: ${piece.title}
// Loop seconds: ${piece.loopSeconds}
// Palette A: rgb(${rgb(piece.palette.slice(0, 3))})
// Palette B: rgb(${rgb(piece.palette.slice(3, 6))})
// Renderer: rings, orbiting glow particles, scanline mesh
// Deterministic seed: date + title`;
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
  downloadBlob(filename, new Blob([text], { type }));
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
