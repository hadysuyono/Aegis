// Query — jawab pertanyaan Hady dari vault.

import { listActive } from "./reminders.js";
import { formatFriendly } from "./time.js";

// Range tanggal dalam timezone Jakarta → window [start, end] ISO
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
      const dow = jakarta.getDay(); // 0=Min
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

export const answerSchedule = async (rangeKey) => {
  const [start, end, label] = buildRange(rangeKey);
  const all = await listActive();
  const inRange = all
    .filter(r => r.datetime_iso >= start && r.datetime_iso <= end)
    .sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso));

  if (inRange.length === 0) return `📭 Tidak ada jadwal ${label}.`;
  const lines = inRange.map((r, i) =>
    `${i + 1}. 📝 ${r.event}\n   📅 ${formatFriendly(r.datetime_iso)}`
  );
  return `📋 Jadwal ${label} (${inRange.length}):\n\n${lines.join("\n\n")}`;
};
