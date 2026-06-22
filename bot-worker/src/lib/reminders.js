// Reminders — file di GitHub repo + dedupe fuzzy.

import { readJSON, writeJSON } from "./store.js";
import { nowJakarta, isDue, formatFriendly } from "./time.js";

const PATH = "07-SYSTEM/reminders.json";

const norm = (s) => (s || "").toLowerCase().replace(/[^\w\s]/g, "").trim();
const wordSet = (s) => new Set(norm(s).split(/\s+/).filter(w => w.length >= 3));
const overlap = (a, b) => {
  const sa = wordSet(a), sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let common = 0;
  for (const w of sa) if (sb.has(w)) common++;
  return common / Math.min(sa.size, sb.size);
};

const uid = () => Math.random().toString(36).slice(2, 10);

export const addReminder = async (env, { datetime_iso, event, source }) => {
  const data = await readJSON(env, PATH, { reminders: [] });
  const target = new Date(datetime_iso).getTime();
  const dup = data.reminders.find(r => {
    if (r.notified) return false;
    const dt = Math.abs(new Date(r.datetime_iso).getTime() - target);
    if (dt > 60 * 60_000) return false;
    return overlap(r.event, event) >= 0.7;
  });
  if (dup) return { id: dup.id, friendly: formatFriendly(dup.datetime_iso), deduped: true };

  const id = uid();
  data.reminders.push({
    id, datetime_iso, event, source,
    created: nowJakarta().iso,
    notified: false,
  });
  await writeJSON(env, PATH, data, `reminder: add ${id} — ${event}`);
  return { id, friendly: formatFriendly(datetime_iso) };
};

export const dueReminders = async (env) => {
  const data = await readJSON(env, PATH, { reminders: [] });
  return data.reminders.filter(r => !r.notified && isDue(r.datetime_iso));
};

export const markNotified = async (env, ids) => {
  const data = await readJSON(env, PATH, { reminders: [] });
  let changed = 0;
  for (const r of data.reminders) {
    if (ids.includes(r.id) && !r.notified) { r.notified = true; changed++; }
  }
  if (changed > 0) await writeJSON(env, PATH, data, `reminder: mark notified (${changed})`);
};

export const listActive = async (env) => {
  const data = await readJSON(env, PATH, { reminders: [] });
  return data.reminders
    .filter(r => !r.notified)
    .sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso));
};

export const removeReminder = async (env, id) => {
  const data = await readJSON(env, PATH, { reminders: [] });
  const before = data.reminders.length;
  data.reminders = data.reminders.filter(r => r.id !== id);
  if (data.reminders.length === before) return false;
  await writeJSON(env, PATH, data, `reminder: remove ${id}`);
  return true;
};
