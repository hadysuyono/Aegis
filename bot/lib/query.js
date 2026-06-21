// Query — jawab pertanyaan Hady dari vault.
// Sumber jadwal: reminders.json (eksplisit) + events.json (hasil distill catatan).

import { listActive } from "./reminders.js";
import { readJSON } from "./store.js";
import { formatFriendly } from "./time.js";
import { formatScheduleAnswer } from "./groq.js";

const buildRange = (rangeKey) => {
  const now = new Date();
  const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = jakarta.getFullYear(), m = jakarta.getMonth(), d = jakarta.getDate();
  const at = (yy, mm, dd, hh = 0, mi = 0) =>
    new Date(Date.UTC(yy, mm, dd, hh - 7, mi)).toISOString();

  switch (rangeKey) {
    case "hari_ini":
      return [at(y, m, d, 0, 0), at(y, m, d, 23, 59), "hari ini"];
    case "besok":
      return [at(y, m, d + 1, 0, 0), at(y, m, d + 1, 23, 59), "besok"];
    case "lusa":
      return [at(y, m, d + 2, 0, 0), at(y, m, d + 2, 23, 59), "lusa"];
    case "minggu_ini": {
      const dow = jakarta.getDay();
      const monOffset = dow === 0 ? -6 : 1 - dow;
      return [at(y, m, d + monOffset, 0, 0), at(y, m, d + monOffset + 6, 23, 59), "minggu ini"];
    }
    case "minggu_depan": {
      const dow = jakarta.getDay();
      const monOffset = dow === 0 ? 1 : 8 - dow;
      return [at(y, m, d + monOffset, 0, 0), at(y, m, d + monOffset + 6, 23, 59), "minggu depan"];
    }
    case "bulan_ini":
      return [at(y, m, 1, 0, 0), at(y, m + 1, 0, 23, 59), "bulan ini"];
    default:
      return [at(y, m, d, 0, 0), at(y, m, d + 30, 23, 59), "30 hari ke depan"];
  }
};

export const answerSchedule = async (question, rangeKey) => {
  const [start, end, label] = buildRange(rangeKey);

  const [reminders, eventsDoc] = await Promise.all([
    listActive(),
    readJSON("07-SYSTEM/memory/events.json", { events: [] }),
  ]);

  const fromReminders = reminders.map(r => ({
    event: r.event, datetime_iso: r.datetime_iso, source: "reminder",
  }));
  const fromEvents = (eventsDoc.events || []).map(e => ({
    event: e.event, datetime_iso: e.datetime_iso, source: "event",
  }));

  // Gabung + dedupe by datetime+event (kalau muncul di dua tempat)
  const seen = new Set();
  const merged = [...fromReminders, ...fromEvents].filter(x => {
    if (!x.datetime_iso || !x.event) return false;
    const key = `${x.datetime_iso}|${x.event.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const inRange = merged
    .filter(r => r.datetime_iso >= start && r.datetime_iso <= end)
    .sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso))
    .map(r => ({ event: r.event, friendly: formatFriendly(r.datetime_iso) }));

  return formatScheduleAnswer(question, label, inRange);
};
