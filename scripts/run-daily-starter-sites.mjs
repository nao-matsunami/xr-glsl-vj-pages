import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || tokyoIsoDate(new Date());
const lockPath = path.join("/tmp", `vj-starter-daily-${targetDate}.lock`);

let lock;
try {
  await fs.mkdir(path.join(rootDir, "logs", "daily-starter-sites"), { recursive: true });
  lock = await fs.open(lockPath, "wx");
} catch (error) {
  if (error.code === "EEXIST") {
    console.log(`Daily starter publish is already running or completed for ${targetDate}: ${lockPath}`);
    process.exit(0);
  }
  throw error;
}

try {
  console.log(`[${new Date().toISOString()}] Daily starter publish start: ${targetDate}`);
  const notesFile = args["notes-file"] || path.join("logs", "daily-starter-sites", `${targetDate}-research-notes.json`);
  if (!args["notes-file"]) {
    await run("node", [
      "scripts/create-daily-research-notes.mjs",
      `--date=${targetDate}`,
      `--project=${args.project || "starter"}`,
      `--out=${notesFile}`,
    ], rootDir);
  }
  await run("node", [
    "scripts/daily-publish-all.mjs",
    `--project=${args.project || "starter"}`,
    `--date=${targetDate}`,
    `--notes-file=${notesFile}`,
  ], rootDir);
  console.log(`[${new Date().toISOString()}] Daily starter publish complete: ${targetDate}`);
} finally {
  await lock?.close();
  if (args["keep-lock"] !== "true") {
    await fs.rm(lockPath, { force: true });
  }
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

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}
