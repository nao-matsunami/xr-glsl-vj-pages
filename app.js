const canvas = document.querySelector("#vj-canvas");
const gl = canvas.getContext("webgl", {
  antialias: false,
  preserveDrawingBuffer: true,
});

const initialIso = new URLSearchParams(window.location.search).get("date") || localIsoDate(new Date());

let researchSources = [];
let purchaseConfig = {
  enabled: false,
  label: "Full Pack",
  url: "",
  note: "映像データの購入先は準備中です。",
};
let plannedDrops = [];

const fallbackSources = [
  {
    label: "MDN WebXR Device API",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API",
    note: "WebXRはVR/AR向けに3Dシーンを適切なフレームレートで描画し、2Dミラー表示も扱える。ただしHTTPS前提かつ対応状況に注意が必要。",
  },
  {
    label: "Khronos OpenGL Registry",
    url: "https://registry.khronos.org/OpenGL/index_gl.php",
    note: "GLSL仕様とOpenGLの公式リファレンス確認の起点にした。",
  },
];

const baseFragmentShader = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop;
uniform float u_variant;
uniform float u_seed;
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

float spoke(vec2 p, float count, float phase) {
  float a = atan(p.y, p.x);
  float r = length(p);
  float v = cos(a * count + phase + sin(r * 8.0 - phase));
  return smoothstep(0.82, 1.0, v) * smoothstep(1.18, 0.12, r);
}

float boxSdf(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float capsule(vec2 p, vec2 a, vec2 b, float radius) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return smoothstep(radius, 0.0, length(pa - ba * h));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float variantField(vec2 uv, float phase) {
  float variant = floor(u_variant + 0.5);
  vec2 p = uv;
  float field = 0.0;

  if (variant < 0.5) {
    p *= rot(phase);
    float pulse = 0.5 + 0.5 * sin(phase);
    field += ring(p, 0.28 + pulse * 0.24, 0.045);
    field += ring(p * rot(-phase * 0.6), 0.72, 0.025) * 0.7;
    p.x += sin(p.y * 3.0 + phase) * 0.12;
    p.y += cos(p.x * 2.2 - phase) * 0.10;
    field += bands(p, phase) * 0.55;
  } else if (variant < 1.5) {
    vec2 q = p;
    q.x = abs(q.x);
    q *= rot(sin(phase) * 0.55);
    field += ring(q, 0.34 + 0.12 * sin(phase * 2.0), 0.035) * 0.9;
    field += ring(q * 1.6, 0.52, 0.018) * 0.8;
    field += spoke(q, 10.0, phase * 2.0) * 0.75;
  } else if (variant < 2.5) {
    vec2 q = p * rot(phase * 0.25);
    float tunnel = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float z = fract(fi / 5.0 + phase / 6.2831853);
      float scale = mix(2.2, 0.42, z);
      vec2 cell = q * scale;
      float box = abs(boxSdf(cell, vec2(0.62 + z * 0.16)));
      tunnel += smoothstep(0.045, 0.0, box) * (1.0 - z);
    }
    field += tunnel;
    field += spoke(q, 4.0, -phase) * 0.35;
  } else if (variant < 3.5) {
    vec2 q = p;
    q.x += sin(q.y * 5.0 + phase) * 0.13;
    q.y += sin(q.x * 4.0 - phase * 1.2) * 0.13;
    vec2 grid = abs(fract(q * 5.0 + vec2(phase * 0.08, -phase * 0.06)) - 0.5);
    float lines = smoothstep(0.035, 0.0, min(grid.x, grid.y));
    field += lines * smoothstep(1.15, 0.2, length(q));
    field += ring(q, 0.48 + 0.11 * sin(phase), 0.025);
  } else if (variant < 4.5) {
    vec2 q = p * rot(phase * 0.16);
    float petals = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float a = fi * 0.8975979 + phase * 0.32;
      vec2 center = vec2(cos(a), sin(a)) * (0.25 + 0.22 * sin(phase + fi));
      petals += ring((q - center) * rot(-a), 0.18 + 0.025 * fi, 0.026);
    }
    field += petals;
    field += ring(q, 0.82, 0.018) * 0.55;
  } else if (variant < 5.5) {
    vec2 q = p;
    float mirror = 0.0;
    for (int i = 0; i < 4; i++) {
      q = abs(q) - vec2(0.34, 0.21);
      q *= rot(phase * 0.08 + float(i) * 0.35);
      mirror += ring(q, 0.28, 0.018) * (1.0 - float(i) * 0.14);
    }
    field += mirror;
  } else if (variant < 6.5) {
    vec2 q = p * 3.0;
    vec2 id = floor(q);
    vec2 gv = fract(q) - 0.5;
    float rnd = hash21(id + u_seed);
    float gate = smoothstep(0.55, 1.0, sin(phase + rnd * 6.2831853) * 0.5 + 0.5);
    field += ring(gv, 0.18 + rnd * 0.14, 0.018) * gate;
    field += capsule(p, vec2(-0.86, sin(phase) * 0.28), vec2(0.86, -sin(phase) * 0.28), 0.015);
  } else {
    vec2 q = p * rot(-phase * 0.22);
    float drift = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 dir = vec2(cos(fi * 1.047 + phase * 0.4), sin(fi * 1.047 - phase * 0.27));
      drift += capsule(q, dir * -0.78, dir * 0.78, 0.012 + fi * 0.003);
    }
    field += drift;
    field += ring(q, 0.36 + 0.18 * sin(phase * 2.0), 0.032);
  }

  float scan = smoothstep(0.025, 0.0, abs(fract((uv.y + phase / 6.2831853) * 22.0) - 0.5));
  return field + scan * 0.22;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float cycle = mod(u_time, u_loop) / u_loop;
  float phase = cycle * PI * 2.0;

  float vignette = smoothstep(1.35, 0.25, length(uv));
  float field = variantField(uv, phase) * vignette;

  vec3 color = mix(u_a, u_b, 0.5 + 0.5 * sin(phase + length(uv) * (3.0 + u_variant * 0.37)));
  color *= field;
  color += pow(max(field, 0.0), 2.0) * (0.24 + 0.04 * u_variant);

  gl_FragColor = vec4(color, 1.0);
}
`.trim();

const fragmentShaders = {
  "core-loop": baseFragmentShader,
  "raymarch-objects": `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop;
uniform float u_variant;
uniform float u_seed;
uniform vec3 u_a;
uniform vec3 u_b;
#define PI 3.141592653589793
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float sdSphere(vec3 p,float r){return length(p)-r;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
float mapScene(vec3 p,float phase){
  float variant=floor(u_variant+0.5);
  p.xy*=rot(phase*.18+u_seed);
  p.xz*=rot(phase*.42);
  if(variant<2.5){
    vec3 q=p;
    q.y+=sin(q.x*2.2+phase)*.18;
    float shell=sdSphere(q,.72+.08*sin(phase*2.0));
    float cut=sdBox(q,vec3(.92,.18,.92));
    return max(shell,-cut);
  }
  if(variant<5.5){
    vec3 q=p;
    q.xy=mod(q.xy+1.0,2.0)-1.0;
    return min(sdTorus(p,vec2(.72,.035)),sdBox(q,vec3(.13,.13,.34)));
  }
  vec3 q=p;
  q=abs(q)-vec3(.28+.1*sin(phase),.16,.28);
  return min(sdSphere(q,.18),sdTorus(p,vec2(.62,.025)));
}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-u_resolution.xy)/min(u_resolution.x,u_resolution.y);
  float cycle=mod(u_time,u_loop)/u_loop;
  float phase=cycle*PI*2.0;
  vec3 ro=vec3(0.0,0.0,-3.15);
  vec3 rd=normalize(vec3(uv,1.55));
  rd.xz*=rot(sin(phase)*.18);
  rd.yz*=rot(cos(phase)*.12);
  float t=0.0, glow=0.0, hit=0.0;
  for(int i=0;i<86;i++){
    vec3 p=ro+rd*t;
    p.z+=sin(phase)*.55;
    float d=mapScene(p,phase);
    glow+=.016/(.018+abs(d));
    if(d<.002){hit=1.0;break;}
    t+=d*.68;
    if(t>6.8)break;
  }
  vec3 color=mix(u_a,u_b,.5+.5*sin(phase+uv.x*2.0+u_seed*6.0));
  float shade=exp(-t*.18)*hit;
  vec3 outColor=color*(shade*.95+glow*.045);
  outColor*=smoothstep(1.42,.18,length(uv));
  gl_FragColor=vec4(outColor,1.0);
}`.trim(),
  "feedback-fields": `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop;
uniform float u_variant;
uniform float u_seed;
uniform vec3 u_a;
uniform vec3 u_b;
#define PI 3.141592653589793
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float ring(vec2 p,float r,float w){return smoothstep(w,0.0,abs(length(p)-r));}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-u_resolution.xy)/min(u_resolution.x,u_resolution.y);
  float cycle=mod(u_time,u_loop)/u_loop;
  float phase=cycle*PI*2.0;
  vec2 p=uv;
  float variant=floor(u_variant+0.5);
  float field=0.0;
  for(int i=0;i<7;i++){
    float fi=float(i);
    p=abs(p*rot(.12*sin(phase+fi)+.18+u_seed*.2))-.22-.035*sin(phase+fi);
    float r=length(p);
    field+=smoothstep(.032,0.0,abs(r-(.12+.025*fi)))*(1.0-fi*.09);
  }
  vec2 grid=floor((uv+1.0)*vec2(18.0,12.0));
  float noise=hash(grid+floor(cycle*8.0)+u_seed);
  float gate=smoothstep(.62,.95,sin(phase*2.0+noise*6.2831)*.5+.5);
  if(variant>3.5)field+=gate*smoothstep(.018,0.0,abs(fract((uv.x+uv.y+cycle)*18.0)-.5))*.55;
  float scan=smoothstep(.02,0.0,abs(fract((uv.y-cycle)*30.0)-.5));
  field=(field+scan*.2)*smoothstep(1.35,.18,length(uv));
  vec3 color=mix(u_a,u_b,.5+.5*sin(phase+field*4.0));
  gl_FragColor=vec4(color*(field+field*field*.45),1.0);
}`.trim(),
  "typographic-signals": `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop;
uniform float u_variant;
uniform float u_seed;
uniform vec3 u_a;
uniform vec3 u_b;
#define PI 3.141592653589793
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float box(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
float strokeBox(vec2 p,vec2 b,float w){return smoothstep(w,0.0,abs(box(p,b)));}
float bar(vec2 p,vec2 a,vec2 b,float w){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return smoothstep(w,0.0,length(pa-ba*h));}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-u_resolution.xy)/min(u_resolution.x,u_resolution.y);
  float cycle=mod(u_time,u_loop)/u_loop;
  float phase=cycle*PI*2.0;
  vec2 p=uv*rot(.08*sin(phase));
  float field=0.0;
  for(int i=0;i<9;i++){
    float fi=float(i);
    vec2 g=p+vec2(sin(phase+fi)*.08,(fi-4.0)*.13);
    g.x=fract(g.x*3.0+cycle+fi*.11)-.5;
    field+=strokeBox(g,vec2(.18+.03*sin(fi+phase),.035),.012);
    field+=bar(g,vec2(-.22,.08),vec2(.22,-.08),.01)*.55;
  }
  field+=smoothstep(.018,0.0,abs(fract((uv.y+cycle)*44.0)-.5))*.35;
  field*=smoothstep(1.32,.2,length(uv));
  vec3 color=mix(u_a,u_b,.5+.5*sin(phase+uv.x*5.0));
  gl_FragColor=vec4(color*field*(1.0+field*.5),1.0);
}`.trim(),
  "matte-alpha-tools": `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_loop;
uniform float u_variant;
uniform float u_seed;
uniform vec3 u_a;
uniform vec3 u_b;
#define PI 3.141592653589793
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float ring(vec2 p,float r,float w){return smoothstep(w,0.0,abs(length(p)-r));}
float box(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.0-u_resolution.xy)/min(u_resolution.x,u_resolution.y);
  float cycle=mod(u_time,u_loop)/u_loop;
  float phase=cycle*PI*2.0;
  vec2 p=uv*rot(phase*.18);
  float mask=0.0;
  mask+=ring(p,.32+.08*sin(phase),.035);
  mask+=ring(p*vec2(1.45,.75),.54,.025)*.8;
  for(int i=0;i<6;i++){
    float fi=float(i);
    vec2 q=p-vec2(cos(fi*1.047+phase),sin(fi*1.047-phase*.5))*.32;
    mask+=smoothstep(.028,0.0,abs(box(q,vec2(.08+.02*sin(phase+fi),.18)) ))*.65;
  }
  mask*=smoothstep(1.25,.22,length(uv));
  vec3 color=mix(u_a,u_b,mask);
  gl_FragColor=vec4(color*mask,1.0);
}`.trim(),
};

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
let didBindResize = false;

initialize();

async function initialize() {
  await loadProjectData();
  activePiece = pickPiece(initialIso);

  if (!gl) {
    document.querySelector(".stage").innerHTML = "<p>WebGLを有効にしてください。</p>";
    return;
  }

  setupGl();
  renderContent();
  requestAnimationFrame(draw);
}

async function loadProjectData() {
  researchSources = fallbackSources;
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
    plannedDrops = [];
  }
}

function setupGl() {
  if (program) gl.deleteProgram(program);
  program = createProgram(vertexShader, shaderForPiece(activePiece));
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
    variant: gl.getUniformLocation(program, "u_variant"),
    seed: gl.getUniformLocation(program, "u_seed"),
    a: gl.getUniformLocation(program, "u_a"),
    b: gl.getUniformLocation(program, "u_b"),
  };

  if (!didBindResize) {
    window.addEventListener("resize", resize);
    didBindResize = true;
  }
  resize();
}

function draw(now) {
  resize();
  const elapsed = isPaused ? pausedAt : (now - startTime) / 1000;
  const speed = calmMotion ? 0.38 : 1;

  gl.useProgram(program);
  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.time, elapsed * speed);
  gl.uniform1f(uniforms.loop, activePiece.loopSeconds);
  gl.uniform1f(uniforms.variant, pieceVariant(activePiece));
  gl.uniform1f(uniforms.seed, pieceSeed(activePiece));
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

function renderContent() {
  document.querySelector("#piece-title").textContent = activePiece.title;
  document.querySelector("#piece-date").textContent = activePiece.date;
  document.querySelector("#detail-title").textContent = activePiece.title;
  document.querySelector("#detail-copy").textContent = activePiece.copy;
  document.querySelector("#loop-length").textContent = `${activePiece.loopSeconds}s`;
  document.querySelector("#why-copy").textContent = activePiece.why;
  document.querySelector("#shader-code").textContent = makePortableShader(activePiece);
  renderPurchaseLink(activePiece);

  const sourceList = document.querySelector("#source-list");
  sourceList.innerHTML = "";
  if (Array.isArray(activePiece.research)) {
    activePiece.research.forEach((entry) => {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `Daily Research ${entry.date}`;
      const note = document.createElement("p");
      note.textContent = entry.summary;
      li.append(title, note);
      if (Array.isArray(entry.sources)) {
        entry.sources.forEach((source) => {
          const link = document.createElement("a");
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noreferrer";
          link.textContent = source.label;
          const sourceNote = document.createElement("p");
          sourceNote.textContent = source.note;
          li.append(link, sourceNote);
        });
      }
      sourceList.append(li);
    });
  }
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
      setupGl();
      renderContent();
    });
    const small = document.createElement("small");
    small.textContent = `${piece.date} / ${piece.loopSeconds}s / ${pieceFamily(piece)}`;
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

document.querySelector("#copy-shader").addEventListener("click", async () => {
  await navigator.clipboard.writeText(makePortableShader(activePiece));
  const button = document.querySelector("#copy-shader");
  button.textContent = "COPIED";
  window.setTimeout(() => {
    button.textContent = "GLSL";
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
      u_family: pieceFamily(activePiece),
      u_variant: pieceVariant(activePiece),
      u_seed: pieceSeed(activePiece),
      u_a: activePiece.palette.slice(0, 3),
      u_b: activePiece.palette.slice(3, 6),
    },
    researchSources,
    shader: makePortableShader(activePiece),
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

function makePortableShader(piece) {
  return `${shaderForPiece(piece)}

// Daily XR/GLSL VJ Loop
// Date: ${piece.date}
// Title: ${piece.title}
// Loop seconds: ${piece.loopSeconds}
// Family: ${pieceFamily(piece)}
// Variant: ${pieceVariant(piece)}
// Seed: ${pieceSeed(piece).toFixed(3)}
// Uniforms expected: u_resolution, u_time, u_loop, u_variant, u_seed, u_a, u_b
// Palette A: vec3(${piece.palette.slice(0, 3).join(", ")})
// Palette B: vec3(${piece.palette.slice(3, 6).join(", ")})`;
}

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
    title: `Generated GLSL Loop ${date.replaceAll("-", ".")}`,
    loopSeconds: [8, 12, 16, 20][seed % 4],
    palette: [...hsv(hueA, 0.72, 0.92), ...hsv(hueB, 0.68, 0.8)],
    copy: "日付シードから生成される公開用GLSL VJループ。常に整数秒の周期で戻るため、素材として扱いやすい。",
    why: "手動更新が止まった日も公開が途切れないよう、日付からGLSLの色と尺を決定する。後から検索メモを足せば、その日のアーカイブとして固定できる。",
  };
}

function shaderForPiece(piece) {
  return fragmentShaders[pieceFamily(piece)] || fragmentShaders["core-loop"];
}

function pieceFamily(piece) {
  return piece.family || "core-loop";
}

function pieceVariant(piece) {
  const title = String(piece.title || "").toLowerCase();
  if (title.includes("mirror")) return 5;
  if (title.includes("tunnel") || title.includes("depth")) return 2;
  if (title.includes("lattice") || title.includes("feedback")) return 3;
  if (title.includes("orbit") || title.includes("halo")) return 1;
  if (title.includes("bloom") || title.includes("luma")) return 4;
  if (title.includes("scanline") || title.includes("signal")) return 6;
  if (title.includes("vector") || title.includes("chromatic")) return 7;
  return hash(`${piece.date}:${piece.title}`) % 8;
}

function pieceSeed(piece) {
  return (hash(`${piece.date}:${piece.title}:glsl`) % 10000) / 10000;
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
