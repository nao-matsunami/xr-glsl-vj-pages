import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { projects } from "./project-registry.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetProjects = projects;

for (const project of targetProjects) {
  const projectDir = path.join(rootDir, project.path);
  const dropsPath = path.join(projectDir, "data", "drops.json");
  if (!await exists(dropsPath)) continue;

  const data = JSON.parse(await fs.readFile(dropsPath, "utf8"));
  const drops = Array.isArray(data.drops) ? data.drops : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];

  await ensureLivePage(projectDir);
  await fs.mkdir(path.join(projectDir, "reports"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "outputs"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "days"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "pages"), { recursive: true });

  for (const drop of drops) {
    await writeReport(projectDir, project, drop, sources);
    await writeOutput(projectDir, project, drop);
  }

  await writeBuildGallery(projectDir, project);
  await writeUpsertReport(projectDir);
  await updatePackageJson(projectDir);
  await runBuild(projectDir);
  console.log(`Migrated ${project.slug}`);
}

async function ensureLivePage(projectDir) {
  const indexPath = path.join(projectDir, "index.html");
  const livePath = path.join(projectDir, "live.html");
  if (!await exists(livePath)) {
    await fs.copyFile(indexPath, livePath);
  }
}

async function writeReport(projectDir, project, drop, sources) {
  const slug = `${drop.date}_${slugify(drop.title)}`;
  const links = [
    { label: "Today's sample", url: `../outputs/${slug}.html` },
    { label: "Live preview", url: "../live.html" },
    ...sources.map((source) => ({ label: source.label, url: source.url })),
  ];
  const researchSections = Array.isArray(drop.research)
    ? drop.research.map((entry) => ({
        title: `Daily Research ${entry.date}`,
        titleEn: `Daily Research ${entry.date}`,
        body: entry.summary || "",
        bodyEn: entry.summary || "",
        links: Array.isArray(entry.sources) ? entry.sources.map((source) => ({ label: source.label, url: source.url })) : [],
      }))
    : [];

  const report = {
    date: drop.date,
    headline: drop.title,
    headlineEn: drop.title,
    summary: drop.copy,
    summaryEn: drop.copy,
    links,
    sections: [
      {
        title: "今日の制作メモ",
        titleEn: "Production note",
        body: drop.why,
        bodyEn: drop.why,
        links: sources.map((source) => ({ label: source.label, url: source.url })),
      },
      ...researchSections,
      {
        title: "販売用データへの展開",
        titleEn: "Sales package route",
        body: `${project.label} はGitHub Pages上では軽量なサンプルとして公開し、MP4、alpha MOV、プロジェクトファイルなどの重い販売データはGumroadまたはPatreonへ置く前提です。`,
        bodyEn: `${project.label} is published on GitHub Pages as a lightweight sample. Heavy saleable files such as MP4, alpha MOV, and project files should live on Gumroad or Patreon.`,
      },
    ],
  };
  await fs.writeFile(path.join(projectDir, "reports", `${drop.date}.json`), `${JSON.stringify(report, null, 2)}\n`);
}

async function writeOutput(projectDir, project, drop) {
  const slug = `${drop.date}_${slugify(drop.title)}`;
  const output = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(drop.title)} / ${escapeHtml(project.label)}</title>
    <style>
      :root { color-scheme: dark; --bg: #050607; --ink: #f4f7f8; --muted: #9aa7ac; --line: #263236; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      header { padding: 18px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; align-items: center; }
      h1 { margin: 0; font-size: clamp(22px, 4vw, 42px); line-height: 1; }
      p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
      a { color: var(--ink); }
      iframe { display: block; width: 100%; height: calc(100vh - 116px); border: 0; background: #000; }
      @media (max-width: 760px) { header { display: block; } iframe { height: calc(100vh - 154px); } }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>${escapeHtml(drop.title)}</h1>
        <p>${escapeHtml(drop.date)} / ${escapeHtml(project.label)} / ${escapeHtml(String(drop.loopSeconds))}s loop</p>
      </div>
      <a href="../days/${escapeHtml(drop.date)}.html">Daily report</a>
    </header>
    <iframe src="../live.html?date=${encodeURIComponent(drop.date)}" title="${escapeHtml(drop.title)} live preview"></iframe>
  </body>
</html>`;
  await fs.writeFile(path.join(projectDir, "outputs", `${slug}.html`), output);
}

async function writeBuildGallery(projectDir, project) {
  const script = `import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = path.join(rootDir, "reports");
const outputsDir = path.join(rootDir, "outputs");
const daysDir = path.join(rootDir, "days");
const pagesDir = path.join(rootDir, "pages");
const pageSize = 12;
const siteTitle = ${JSON.stringify(project.label)};

async function main() {
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(outputsDir, { recursive: true });
  await fs.mkdir(daysDir, { recursive: true });
  await fs.mkdir(pagesDir, { recursive: true });
  const reports = await loadReports();
  const samples = await loadSamples();
  const days = reports.map((report) => ({ date: report.date, report, samples: samples.filter((sample) => sample.date === report.date) })).sort((a, b) => b.date.localeCompare(a.date));
  const totalPages = Math.max(1, Math.ceil(days.length / pageSize));
  await cleanHtmlDir(daysDir);
  await cleanHtmlDir(pagesDir);
  await fs.writeFile(path.join(rootDir, "index.html"), renderList(days.slice(0, pageSize), 1, totalPages, "", days.length));
  for (let page = 2; page <= totalPages; page += 1) {
    await fs.writeFile(path.join(pagesDir, page + ".html"), renderList(days.slice((page - 1) * pageSize, page * pageSize), page, totalPages, "../", days.length));
  }
  const pageMap = new Map(days.map((day, index) => [day.date, Math.floor(index / pageSize) + 1]));
  for (const day of days) {
    await fs.writeFile(path.join(daysDir, day.date + ".html"), renderDay(day, pageMap.get(day.date)));
  }
  console.log("Built gallery: " + days.length + " days");
}

async function loadReports() {
  const files = (await fs.readdir(reportsDir)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(reportsDir, file), "utf8"))));
}

async function loadSamples() {
  const files = (await fs.readdir(outputsDir)).filter((file) => file.endsWith(".html"));
  return Promise.all(files.map(async (file) => {
    const html = await fs.readFile(path.join(outputsDir, file), "utf8");
    const date = file.slice(0, 10);
    const title = html.match(/<title>(.*?)<\\/title>/i)?.[1] || file;
    const description = html.match(/<p>([\\s\\S]*?)<\\/p>/i)?.[1]?.replace(/<[^>]*>/g, "") || "";
    return { date, file, title, description };
  }));
}

async function cleanHtmlDir(dir) {
  for (const file of await fs.readdir(dir)) {
    if (file.endsWith(".html")) await fs.unlink(path.join(dir, file));
  }
}

function renderList(days, currentPage, totalPages, basePath, totalItems) {
  return htmlShell(siteTitle, basePath, \`
    <section class="hero">
      <h1>\${escapeHtml(siteTitle)}</h1>
      <p>Daily VJ samples with research notes, output pages, and a preserved live preview. Entries: \${totalItems}</p>
      <div class="meta"><span>reports/YYYY-MM-DD.json</span><span>outputs/YYYY-MM-DD_*.html</span><span>GitHub Pages</span></div>
    </section>
    <nav class="pager">\${pagination(currentPage, totalPages, basePath)}</nav>
    <section class="grid">
      \${days.map((day) => {
        const sample = day.samples[0];
        return \`<article class="card">
          <p class="date">\${formatDate(day.date)}</p>
          <h2>\${escapeHtml(day.report.headline)}</h2>
          <p class="description">\${escapeHtml(day.report.summary)}</p>
          <p class="card-subtitle">samples: \${day.samples.length}</p>
          <div class="actions"><a class="primary" href="\${basePath}days/\${day.date}.html">その日のページ / Day</a>\${sample ? \`<a href="\${basePath}outputs/\${sample.file}">代表サンプル / Sample</a>\` : ""}</div>
        </article>\`;
      }).join("")}
    </section>
    <nav class="pager">\${pagination(currentPage, totalPages, basePath)}</nav>
  \`);
}

function renderDay(day, page) {
  const listHref = page === 1 ? "../index.html" : "../pages/" + page + ".html";
  const links = [...(day.report.links || [])];
  const samples = day.samples.map((sample) => \`<li><a href="../outputs/\${sample.file}">\${escapeHtml(sample.title)}</a><p>\${escapeHtml(sample.description)}</p></li>\`).join("");
  return htmlShell(day.report.headline, "../", \`
    <section class="hero">
      <p class="date">\${formatDate(day.date)}</p>
      <h1>\${escapeHtml(day.report.headline)}</h1>
      <p>\${escapeHtml(day.report.summary)}</p>
      <div class="actions"><a href="\${listHref}">一覧へ戻る / Back</a><a href="../live.html">Live preview</a></div>
    </section>
    <section class="content"><h2>この日のサンプル / Samples</h2><ul>\${samples}</ul></section>
    \${(day.report.sections || []).map((section) => \`<section class="content"><h2>\${escapeHtml(section.title)}</h2><p>\${escapeHtml(section.body || "")}</p>\${renderLinks(section.links)}</section>\`).join("")}
    <section class="content"><h2>参考リンク / Reference Links</h2>\${renderLinks(links)}</section>
  \`);
}

function htmlShell(title, basePath, body) {
  return \`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>\${escapeHtml(title)}</title><style>
  :root{color-scheme:dark;--bg0:#050607;--bg1:#10191d;--panel:rgba(13,21,25,.88);--line:rgba(140,220,255,.14);--ink:#f3f8fb;--muted:#97aab2;--accent:#7ce4ff;--accent2:#ffd868}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(180deg,var(--bg1),var(--bg0));color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1180px;margin:0 auto;padding:24px 18px 44px}.hero,.card,.content{border:1px solid var(--line);background:var(--panel);padding:18px;border-radius:8px}.hero h1{margin:0 0 10px;font-size:clamp(30px,6vw,72px);line-height:.95}.hero p,.description,.content p,li p{color:var(--muted);line-height:1.65}.meta,.actions,.pager{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.meta span,a{border:1px solid var(--line);border-radius:6px;padding:8px 10px;color:var(--ink);text-decoration:none;background:rgba(255,255,255,.04)}a:hover{border-color:var(--accent)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:18px}.date{color:var(--accent2);font-size:13px;letter-spacing:.04em}.card h2,.content h2{margin:0 0 10px}.card-subtitle{color:var(--muted);font-size:13px}.content{margin-top:16px}ul{padding-left:20px}.pager{justify-content:center}</style></head><body><main class="shell">\${body}</main></body></html>\`;
}

function renderLinks(links = []) {
  if (!links.length) return "";
  return \`<ul>\${links.map((link) => \`<li><a href="\${escapeHtml(link.url)}" target="_blank" rel="noreferrer">\${escapeHtml(link.label)}</a></li>\`).join("")}</ul>\`;
}

function pagination(currentPage, totalPages, basePath) {
  if (totalPages <= 1) return "";
  return Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const href = page === 1 ? basePath + "index.html" : basePath + "pages/" + page + ".html";
    return \`<a href="\${href}">\${page}</a>\`;
  }).join("");
}

function formatDate(date) { return date.replaceAll("-", "."); }
function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
`;
  await fs.writeFile(path.join(projectDir, "scripts", "build-gallery.mjs"), script);
}

async function writeUpsertReport(projectDir) {
  const script = `import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = path.join(rootDir, "reports");
const options = parseArgs(process.argv.slice(2));
const report = JSON.parse(options.stdin ? await readStdin() : await fs.readFile(path.resolve(options.file), "utf8"));
validate(report);
await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(reportsDir, report.date + ".json"), JSON.stringify(report, null, 2) + "\\n");
await run("node", ["scripts/build-gallery.mjs"], rootDir);
if (options.publish) await run("node", ["scripts/publish-pages.mjs"], rootDir);

function parseArgs(argv) {
  const options = { file: null, stdin: false, publish: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--file") options.file = argv[++i];
    else if (argv[i] === "--stdin") options.stdin = true;
    else if (argv[i] === "--publish") options.publish = true;
  }
  if (!options.file && !options.stdin) throw new Error("Provide --file <report.json> or --stdin");
  return options;
}
function validate(report) {
  for (const key of ["date", "headline", "summary"]) {
    if (!report[key] || typeof report[key] !== "string") throw new Error("Missing field: " + key);
  }
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(report.date)) throw new Error("Invalid date: " + report.date);
}
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(command + " " + args.join(" ") + " failed with code " + code)));
  });
}
`;
  await fs.writeFile(path.join(projectDir, "scripts", "upsert-report.mjs"), script);
}

async function updatePackageJson(projectDir) {
  const packagePath = path.join(projectDir, "package.json");
  const json = JSON.parse(await fs.readFile(packagePath, "utf8"));
  json.scripts = {
    build: "node scripts/build-gallery.mjs",
    "build:gallery": "node scripts/build-gallery.mjs",
    "upsert:report": "node scripts/upsert-report.mjs",
    ...json.scripts,
  };
  if (!json.scripts["daily:publish"]) {
    json.scripts["daily:publish"] = "node scripts/upsert-daily-drop.mjs && node scripts/publish-pages.mjs";
  }
  await fs.writeFile(packagePath, `${JSON.stringify(json, null, 2)}\n`);
}

function runBuild(projectDir) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/build-gallery.mjs"], { cwd: projectDir, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`build-gallery failed: ${projectDir}`)));
  });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample";
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
