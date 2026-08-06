import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectProjects } from "./project-registry.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const targetDate = args.date || localIsoDate(new Date());
const selected = selectProjects(args.project || "starter");

await run("node", [
  "scripts/upsert-vj-report-sample.mjs",
  `--date=${targetDate}`,
  `--project=${selected.map((project) => project.slug).join(",")}`,
  "--publish",
  ...(args["notes-file"] ? [`--notes-file=${args["notes-file"]}`] : []),
], rootDir);

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const index = arg.indexOf("=");
    out[index === -1 ? arg.slice(2) : arg.slice(2, index)] = index === -1 ? "true" : arg.slice(index + 1);
  }
  return out;
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
