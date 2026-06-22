// Time helpers — Asia/Jakarta.
const TZ = "Asia/Jakarta";
const parts = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
};
export const nowJakarta = () => {
  const p = parts();
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}${p.minute}${p.second}`,
    iso: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} WIB`,
    isoOffset: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+07:00`,
  };
};
export const formatFriendly = (isoOffset) => {
  const d = new Date(isoOffset);
  const dateStr = d.toLocaleDateString("id-ID", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("id-ID", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit",
  });
  return `${dateStr} jam ${timeStr} WIB`;
};
export const isDue = (isoOffset) => new Date(isoOffset).getTime() <= Date.now();
