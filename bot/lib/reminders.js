// Reminders — kelola list jadwal di 07-SYSTEM/reminders.json

import { randomUUID } from "node:crypto";
import { readJSON, writeJSON } from "./store.js";
import { nowJakarta, isDue, formatFriendly } from "./time.js";

const PATH = "07-SYSTEM/reminders.json";

const load = () => readJSON(PATH, { reminders: [] });
const save = (data, msg) => writeJSON(PATH, data, msg);

// Fuzzy dedupe — kalau ada reminder dengan datetime <= 1 jam beda + event title 70% mirip → skip
const norm = (s) => (s || "").toLowerCase().replace(/[^\w\s]/g, "").trim();
const wordSet = (s) => new Set(norm(s).split(/\s+/).filter(w => w.length >= 3));
const overlap = (a, b) => {
  const sa = wordSet(a), sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let common = 0;
  for (const w of sa) if (sb.has(w)) common++;
  return common / Math.min(sa.size, sb.size);
};

export const addReminder = async ({ datetime_iso, event, source }) => {
  const data = await load();

  // Dedupe: cek apakah ada reminder mirip (event >=70% kata sama, datetime dalam ±60 menit)
  const target = new Date(datetime_iso).getTime();
  const dup = data.reminders.find(r => {
    if (r.notified) return false;
    const dt = Math.abs(new Date(r.datetime_iso).getTime() - target);
    if (dt > 60 * 60_000) return false;
    return overlap(r.event, event) >= 0.7;
  });
  if (dup) {
    console.log(`[reminder] dedupe — sudah ada "${dup.event}" @ ${dup.datetime_iso}, skip add`);
    return { id: dup.id, friendly: formatFriendly(dup.datetime_iso), deduped: true };
  }

  const id = randomUUID().slice(0, 8);
  data.reminders.push({
    id, datetime_iso, event, source,
    created: nowJakarta().iso,
    notified: false,
  });
  await save(data, `reminder: add ${id} — ${event}`);
  return { id, friendly: formatFriendly(datetime_iso) };
};

export const dueReminders = async () => {
  const data = await load();
  return data.reminders.filter(r => !r.notified && isDue(r.datetime_iso));
};

export const markNotified = async (ids) => {
  const data = await load();
  let changed = 0;
  for (const r of data.reminders) {
    if (ids.includes(r.id) && !r.notified) { r.notified = true; changed++; }
  }
  if (changed > 0) await save(data, `reminder: mark notified (${changed})`);
};

export const listActive = async () => {
  const data = await load();
  return data.reminders
    .filter(r => !r.notified)
    .sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso));
};

export const removeReminder = async (id) => {
  const data = await load();
  const before = data.reminders.length;
  data.reminders = data.reminders.filter(r => r.id !== id);
  if (data.reminders.length === before) return false;
  await save(data, `reminder: remove ${id}`);
  return true;
};
