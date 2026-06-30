# 🧠 DASHBOARD HADY

> Single pane view dari seluruh kehidupan Bapak. Auto-update dari vault.
> Pin file ini (Ctrl+P → "Pin") biar selalu di tab pertama.

---

## 📆 Jadwal Aktif (live dari `reminders.json`)

```dataviewjs
const data = dv.io.load("07-SYSTEM/reminders.json");
data.then(raw => {
  const obj = JSON.parse(raw);
  const now = Date.now();
  const lo = now - 86400000;            // 1 hari ke belakang
  const hi = now + 14 * 86400000;       // 14 hari ke depan
  const list = (obj.reminders || [])
    .map(r => ({...r, ts: new Date(r.datetime_iso).getTime()}))
    .filter(r => !isNaN(r.ts) && r.ts >= lo && r.ts <= hi)
    .sort((a,b) => a.ts - b.ts);
  if (list.length === 0) { dv.paragraph("✅ Tidak ada jadwal dalam rentang -1 sd +14 hari."); return; }
  dv.table(["Kapan", "Event", "Status"],
    list.map(r => {
      const d = new Date(r.datetime_iso);
      const diffMs = r.ts - now;
      const diffH = Math.round(diffMs / 3600000);
      const diffD = Math.round(diffMs / 86400000);
      let status;
      if (r.notified) status = "✅ sudah dikirim";
      else if (diffMs < 0) status = "🔴 telat";
      else if (diffH < 24) status = `🟢 ${diffH} jam lagi`;
      else status = `🟡 ${diffD} hari lagi`;
      return [d.toLocaleString("id-ID", {dateStyle:"medium", timeStyle:"short"}), r.event, status];
    })
  );
});
```

---

## 👥 Orang Tercatat (live dari `people.json`)

```dataviewjs
const data = dv.io.load("07-SYSTEM/memory/people.json");
data.then(raw => {
  const obj = JSON.parse(raw);
  const list = obj.people || [];
  if (list.length === 0) { dv.paragraph("(belum ada)"); return; }
  dv.table(["Nama", "Role", "Notes", "Last seen"],
    list.map(p => [p.name, p.role || "-", (p.notes || []).join(", ") || "-", p.last_mentioned])
  );
});
```

---

## 📦 Proyek Aktif

```dataview
TABLE WITHOUT ID file.link AS "Project", file.mtime AS "Last update"
FROM "02-PROJECTS"
SORT file.mtime DESC
```

---

## ✅ Tugas Terbuka (semua note)

```tasks
not done
sort by due
limit 15
```

---

## 📥 Inbox (belum di-distill)

```dataview
TABLE WITHOUT ID file.link AS "File", file.cday AS "Tanggal"
FROM "00-INBOX"
WHERE file.ext = "md"
SORT file.cday DESC
LIMIT 10
```

---

## 🩺 Health Aegis (status terakhir)

Cek kapan terakhir Aegis bot kirim notif → kalau > 1 jam, kemungkinan ada masalah.
Bot kirim Daily Health Digest setiap **22:00 WIB**.

- Worker URL: https://aegis-bot.asuyhung.workers.dev
- Debug: `/debug-grounding?q=test` di browser
- Vault repo: `github.com/hadysuyono/Aegis`

---

## 🔗 Quick Links

- [[01-KNOWLEDGE/visi-obsidian-second-brain|⭐ Visi Prinsip]]
- [[04-AEGIS-OUTPUTS/claude-sessions/CURRENT-FOCUS|🎯 Topik Aktif Claude]]
- [[02-PROJECTS/aegis|📦 Project: Aegis]]
- [[02-PROJECTS/reguler-fleet|🚗 Project: Reguler Fleet]]
- [[02-PROJECTS/capital-sentinel|📈 Project: Capital Sentinel]]
- [[02-PROJECTS/bajaj-fleet|🛺 Project: Bajaj Fleet]]
- [[02-PROJECTS/3s-smartsystem|💼 Project: 3sSmartSystem]]

---

*Auto-refresh setiap Bapak buka file. Tidak perlu manual update.*
