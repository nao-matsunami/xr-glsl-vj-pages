import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { selectProjects } from "./project-registry.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || localIsoDate(new Date());
const selected = selectProjects(args.project || "starter");
const notes = args["notes-file"] ? await readJson(args["notes-file"]) : null;
const publish = Boolean(args.publish);

for (const project of selected) {
  const projectDir = path.join(rootDir, project.path);
  await run("node", ["scripts/upsert-daily-drop.mjs", `--date=${targetDate}`], projectDir);

  const dropsPath = path.join(projectDir, "data", "drops.json");
  const data = JSON.parse(await fs.readFile(dropsPath, "utf8"));
  const drop = data.drops.find((item) => item.date === targetDate);
  if (!drop) throw new Error(`Daily drop not found: ${project.slug} / ${targetDate}`);

  const note = notes?.projects?.[project.slug] || notes?.projects?.default || null;
  const research = {
    date: targetDate,
    summary: note?.summary || defaultSummary(project),
    sources: note?.sources || [],
    updatedAt: new Date().toISOString(),
  };
  drop.research = [research, ...(Array.isArray(drop.research) ? drop.research.filter((item) => item.date !== targetDate) : [])];
  data.drops.sort((a, b) => b.date.localeCompare(a.date));
  await fs.writeFile(dropsPath, `${JSON.stringify(data, null, 2)}\n`);

  await writeReport(projectDir, project, drop, data.sources || [], research);
  await writeOutput(projectDir, project, drop);
  await run("node", ["scripts/build-gallery.mjs"], projectDir);
  if (publish) await run("npm", ["run", "publish:pages"], projectDir);
  console.log(`Upserted report sample: ${project.slug} / ${targetDate}`);
}

async function writeReport(projectDir, project, drop, sources, research) {
  const sampleSlug = `${drop.date}_${slugify(drop.title)}`;
  const report = {
    date: drop.date,
    headline: drop.title,
    headlineEn: drop.title,
    summary: drop.copy,
    summaryEn: drop.copy,
    links: [
      { label: "Today's sample", url: `../outputs/${sampleSlug}.html` },
      { label: "Live preview", url: "../live.html" },
      ...sources.map((source) => ({ label: source.label, url: source.url })),
      ...research.sources.map((source) => ({ label: source.label, url: source.url })),
    ],
    sections: [
      {
        title: "今日の制作メモ",
        titleEn: "Production note",
        body: drop.why,
        bodyEn: drop.why,
        links: sources.map((source) => ({ label: source.label, url: source.url })),
      },
      {
        title: `Daily Research ${drop.date}`,
        titleEn: `Daily Research ${drop.date}`,
        body: research.summary,
        bodyEn: research.summary,
        links: research.sources.map((source) => ({ label: source.label, url: source.url })),
      },
      {
        title: "今日のミニ試作候補",
        titleEn: "Today's mini prototype candidate",
        body: `${drop.title} を ${drop.loopSeconds} 秒でループするVJサンプルとして固定しました。GitHub Pagesでは軽量プレビューを見せ、販売用のMP4やalpha MOVは選抜後にMac miniで固定FPSレンダーします。`,
        bodyEn: `${drop.title} is fixed as a ${drop.loopSeconds}-second looping VJ sample. GitHub Pages carries the lightweight preview, while saleable MP4 and alpha MOV masters should be rendered later on the Mac mini at fixed FPS.`,
        links: [{ label: "Today's sample", url: `../outputs/${sampleSlug}.html` }],
      },
    ],
  };
  await fs.mkdir(path.join(projectDir, "reports"), { recursive: true });
  await fs.writeFile(path.join(projectDir, "reports", `${drop.date}.json`), `${JSON.stringify(report, null, 2)}\n`);
}

async function writeOutput(projectDir, project, drop) {
  const sampleSlug = `${drop.date}_${slugify(drop.title)}`;
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
      header { min-height: 104px; padding: 18px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; align-items: center; }
      h1 { margin: 0; font-size: clamp(22px, 4vw, 42px); line-height: 1; }
      p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
      a { color: var(--ink); }
      iframe { display: block; width: 100%; height: calc(100vh - 104px); border: 0; background: #000; }
      @media (max-width: 760px) { header { display: block; } iframe { height: calc(100vh - 142px); } }
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
  await fs.mkdir(path.join(projectDir, "outputs"), { recursive: true });
  await fs.writeFile(path.join(projectDir, "outputs", `${sampleSlug}.html`), output);
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

async function readJson(file) {
  const absolute = path.isAbsolute(file) ? file : path.join(rootDir, file);
  return JSON.parse(await fs.readFile(absolute, "utf8"));
}

function defaultSummary(project) {
  return `${project.label} の日次レポートを追加。追加調査がある日は --notes-file で検索要約と出典を差し込む。`;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`)));
  });
}

function localIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample";
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
