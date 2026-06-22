// Backup harian — snapshot memory + reminders ke 06-ARCHIVE/backup/YYYY-MM-DD/

import { readJSON, writeFile } from "./store.js";
import { nowJakarta } from "./time.js";

const FILES = [
  "07-SYSTEM/memory/owner.json",
  "07-SYSTEM/memory/people.json",
  "07-SYSTEM/memory/projects.json",
  "07-SYSTEM/memory/events.json",
  "07-SYSTEM/memory/decisions.json",
  "07-SYSTEM/memory/beliefs.json",
  "07-SYSTEM/reminders.json",
];

export const dailySnapshot = async (env) => {
  const { date } = nowJakarta();
  const targets = [];
  for (const path of FILES) {
    const data = await readJSON(env, path, null);
    if (!data) continue;
    const archivePath = `06-ARCHIVE/backup/${date}/${path.split("/").pop()}`;
    await writeFile(env, archivePath, JSON.stringify(data, null, 2) + "\n", `backup: ${date} ${path.split("/").pop()}`);
    targets.push(path.split("/").pop());
  }
  return { date, count: targets.length, files: targets };
};
