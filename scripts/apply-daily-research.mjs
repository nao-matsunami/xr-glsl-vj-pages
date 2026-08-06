import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { selectProjects } from "./project-registry.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || localIsoDate(new Date());
const selected = selectProjects(args.project || "core");
const notes = args["notes-file"] ? await readNotesFile(args["notes-file"]) : null;
const inlineSources = collectInlineSources(args.source);

for (const project of selected) {
  const projectDir = path.join(rootDir, project.path);
  await run("node", ["scripts/upsert-daily-drop.mjs", `--date=${targetDate}`], projectDir);

  const dropsPath = path.join(projectDir, "data", "drops.json");
  const data = JSON.parse(await fs.readFile(dropsPath, "utf8"));
  const drop = data.drops.find((item) => item.date === targetDate);
  if (!drop) throw new Error(`Daily drop not found after update: ${project.slug} ${targetDate}`);

  const note = projectNote(notes, project.slug);
  const summary = note?.summary || args.summary || defaultSummary(project);
  const sources = note?.sources || inlineSources || [];
  const entry = {
    date: targetDate,
    summary,
    sources,
    updatedAt: new Date().toISOString(),
  };

  const current = Array.isArray(drop.research) ? drop.research.filter((item) => item.date !== targetDate) : [];
  drop.research = [entry, ...current];

  data.drops.sort((a, b) => b.date.localeCompare(a.date));
  await fs.writeFile(dropsPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Applied research: ${project.slug} / ${targetDate}`);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const index = arg.indexOf("=");
    const key = index === -1 ? arg.slice(2) : arg.slice(2, index);
    const value = index === -1 ? "true" : arg.slice(index + 1);
    if (out[key]) out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    else out[key] = value;
  }
  return out;
}

async function readNotesFile(file) {
  const absolute = path.isAbsolute(file) ? file : path.join(rootDir, file);
  return JSON.parse(await fs.readFile(absolute, "utf8"));
}

function projectNote(notes, slug) {
  if (!notes) return null;
  return notes.projects?.[slug] || notes.projects?.default || null;
}

function collectInlineSources(value) {
  if (!value) return null;
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => {
    const [label = "Research Source", url = "", note = ""] = item.split("|");
    return { label, url, note };
  });
}

function defaultSummary(project) {
  return `${project.label} の日次サンプルを更新。追加調査がある日は --notes-file で検索要約と出典を差し込む。`;
}

function localIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}
