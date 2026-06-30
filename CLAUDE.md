# CLAUDE.md — Project Aegis

> File ini dibaca otomatis oleh Claude Code setiap conversation baru.
> Setiap skill Aegis WAJIB baca file ini DULU sebelum kerja.
> Jangan hapus atau ubah tanpa izin Hady Suyono.

---

## 👤 Owner

**Hady Suyono** — pemilik bisnis, tidak bisa coding. Komunikasi Bahasa Indonesia.
Mengelola 4 project: **reguler-fleet**, **bajaj-fleet**, **3sSmartSystem**, **Capital Sentinel**.

---

## 🚨 CONSTRAINT WAJIB

1. **Kerja HANYA di folder ini** (`C:\Users\HP\Project Aegis\`). Tidak menyentuh folder project lain dari sini.
2. **Aegis READ-ONLY** ke semua project. Tidak edit, tidak delete, tidak write ke DB project mana pun.
3. **Mode super hemat token** — quota $20/bulan ketat. Jawaban ringkas, tool call minimum, tidak ada narasi proses.
4. **Kill switch**: hapus file `07-SYSTEM/AEGIS-ENABLED.flag` → Aegis langsung off (skill cek file ini dulu).

---

## 🎯 Misi Aegis

*Personal intelligence system* untuk Hady — sekretaris pribadi yang baca laporan dari semua project, kasih brief harian, deteksi pola, surface decision yang perlu perhatian.

**Tagline:** *Useful → trusted → indispensable.*

**Yang Aegis LAKUKAN:**
- Baca laporan harian project di `08-PROJECT-FEEDS/`
- Tulis output di `04-AEGIS-OUTPUTS/`
- Update memory di `07-SYSTEM/memory/`

**Yang Aegis TIDAK LAKUKAN:**
- Akses langsung DB project
- Kontak pihak luar
- Rekomendasi finansial/strategis (hanya analisis)

---

## 🏗️ Stack (Versi Hemat — Pakai Layanan Sudah Ada)

| Fungsi | Tools | Status |
|---|---|---|
| AI brain (reasoning berat) | **Claude** (sudah subscribe) | aktif |
| AI brain (skill ringan) | **Groq** (free tier) | rencana |
| Runtime | **Node.js** | rencana install |
| Knowledge hub | **Obsidian** (gratis) | rencana install |
| File access | **Filesystem MCP** (gratis) | rencana |
| Scheduler | **GitHub Actions** + **Railway** (sudah punya) | rencana |
| Memory DB | **Supabase** (sudah punya) | rencana |
| Notifikasi | **Telegram** | rencana |
| Backup vault | **GitHub private repo** (sudah punya) | rencana |

**Total tambahan biaya target: Rp 0.**

---

## 📁 Struktur Vault

```
Project Aegis/
├── CLAUDE.md                  ← operating doc (file ini)
├── 00-INBOX/                  ← catatan mentah, belum diproses
├── 01-KNOWLEDGE/              ← konsep, referensi, insight permanen
├── 02-PROJECTS/               ← halaman per project (status, goal, next action)
├── 03-DAILY/                  ← daily notes Hady (catatan harian)
├── 04-AEGIS-OUTPUTS/          ← output dari skill Aegis
│   ├── briefings/             ← morning brief
│   ├── connections/           ← link antar notes
│   ├── patterns/              ← pola bulanan
│   ├── syntheses/             ← weekly synthesis
│   └── reviews/               ← decision reviews
├── 05-RESOURCES/              ← reusable assets
│   ├── templates/
│   ├── playbooks/
│   └── prompts/
├── 06-ARCHIVE/                ← yang sudah selesai/usang
├── 07-SYSTEM/                 ← config & memori sistem
│   ├── AEGIS-ENABLED.flag     ← kill switch (hapus = matikan Aegis)
│   ├── skills/                ← skill definitions
│   └── memory/                ← persistent memory
├── 08-PROJECT-FEEDS/          ← laporan READ-ONLY dari tiap project
│   ├── reguler-fleet/
│   ├── bajaj-fleet/
│   ├── 3s-smartsystem/        ← level admin only (billing/langganan)
│   └── capital-sentinel/
└── 09-DOCS/                   ← dokumentasi & referensi (25 SS tutorial)
```

---

## 🔌 Project Feeds — Aturan Aliran Data

**Tiap project KIRIM laporan ke `08-PROJECT-FEEDS/<project>/` dalam format `.md`.**
Aegis hanya BACA folder ini, tidak pernah BACA langsung DB project.

**Format laporan harian (template):**
```markdown
# [Project] — YYYY-MM-DD

## Siapa Login
- Nama1 (HH:MM)
- Nama2 (HH:MM)

## Inputan Hari Ini
- Ringkasan transaksi/aktivitas (count, total nominal)

## Issue / Anomaly
- (kalau ada)

## Open Loops
- (yang perlu perhatian Hady)
```

**3sSmartSystem (SaaS):** level admin only. Laporan = billing langganan customer (siapa bayar, siapa stop), BUKAN data internal customer.

---

## 🛠️ 7 Skills (Rencana, Belum Aktif)

| # | Skill | Jadwal | Output ke |
|---|---|---|---|
| 1 | Morning brief | 6 pagi | `04-AEGIS-OUTPUTS/briefings/` |
| 2 | Capture processor | 8 malam | `00-INBOX/` → routing |
| 3 | Connection finder | 11 malam | `04-AEGIS-OUTPUTS/connections/` |
| 4 | Weekly synthesis | Minggu 7 malam | `04-AEGIS-OUTPUTS/syntheses/` |
| 5 | Belief tracker | Senin 8 pagi | `07-SYSTEM/memory/` |
| 6 | Pattern detector | Tanggal 1 bulan | `04-AEGIS-OUTPUTS/patterns/` |
| 7 | Decision intelligence | On-demand | `04-AEGIS-OUTPUTS/reviews/` |

Skill dibangun **satu per satu**. Mulai: **Morning brief** + **1 project (reguler-fleet)**.

---

## 🛡️ Permissions

**Aegis CAN:**
- ✅ Read semua file di vault
- ✅ Write ke `04-AEGIS-OUTPUTS/`, `00-INBOX/` (routing), `07-SYSTEM/memory/`
- ✅ Search external info (opsional, manual approval)

**Aegis REQUIRES APPROVAL:**
- ❌ Write di luar folder yang diizinkan
- ❌ Kontak pihak luar (email, chat, dll)
- ❌ Saran finansial/strategis konkret (boleh analisis, tidak boleh "beli ini" / "jual itu")

---

## 📅 Roadmap Build (Bertahap)

**Fase 1 — Foundation (sekarang):**
- [x] Struktur folder vault
- [x] CLAUDE.md (file ini)
- [ ] Install Obsidian
- [ ] Install Node.js
- [ ] Setup Filesystem MCP (Windows path)
- [ ] Test koneksi Claude ↔ vault

**Fase 2 — Skill pertama (1 minggu):**
- [ ] Define template laporan reguler-fleet
- [ ] Build skill #1 (Morning brief) — input dari reguler-fleet only
- [ ] Manual run dulu, belum di-schedule

**Fase 3 — Automation (2 minggu):**
- [ ] Setup GitHub Actions cron
- [ ] Setup memory Supabase
- [ ] Telegram notif

**Fase 4 — Compound (4–6 minggu):**
- [ ] Tambah skill #2-7 satu per satu
- [ ] Tambah project ke-2 (bajaj-fleet) setelah skill stabil
- [ ] Tambah 3s-smartsystem & capital-sentinel terakhir

---

## ❓ Pertanyaan Terbuka

1. **Format laporan dari project** — template di atas masih draft, belum di-approve final.
2. **Lokasi kill switch** — saran: `07-SYSTEM/AEGIS-ENABLED.flag`. Belum konfirmasi.
3. **Capital Sentinel & 3sSmartSystem** — belum ditentukan format & jadwal kirim laporan.

---

## 🚪 URUTAN BACA TIAP NEW CHAT (WAJIB)

> Hemat token 80%+ vs compact. Jangkar permanen Claude ke vault.

**Urutan baca (6 file inti, ~6% token):**

1. `01-KNOWLEDGE/visi-obsidian-second-brain.md` — ⭐ VISI PRINSIP TETAP (Obsidian=brain, AI=narator, Aegis=otonom)
2. `CLAUDE.md` (file ini) — rules & constraint
3. `04-AEGIS-OUTPUTS/claude-sessions/CURRENT-FOCUS.md` — topik aktif sekarang, open loops, pending decision
4. `04-AEGIS-OUTPUTS/claude-sessions/STATE.md` — state Aegis Worker
5. `04-AEGIS-OUTPUTS/claude-sessions/HISTORY.md` (tail 80 baris) — perubahan terakhir
6. `02-PROJECTS/<project-aktif>.md` — sesuai topik (reguler-fleet / capital-sentinel / dll)

**Kalau topik trading/Capital Sentinel:** tambah baca:
- `08-PROJECT-FEEDS/capital-sentinel/STATE.md`
- `08-PROJECT-FEEDS/capital-sentinel/HISTORY.md` (tail 50)

**Kalau ada referensi `[[Hady]]` / profile pribadi:** tambah baca:
- `01-KNOWLEDGE/profile.md`
- `01-KNOWLEDGE/people.md`

**Update tiap akhir sesi besar:**
- `CURRENT-FOCUS.md` (topik aktif, open loops baru)
- `HISTORY.md` (append entry baru)
- `02-PROJECTS/<project>.md` (kalau ada decision/next action baru)

---

## 🔗 Hirarki Sistem (disepakati 2026-06-29)

```
Claude (saya, supervisor)
    ↓ via Obsidian vault
Aegis (second brain, FREE selamanya)
    ↓
Capital Sentinel (Railway, BOLEH bayar)
    ↓ future: Anthropic API jadi head advisor trading
[project lain ke depan]
```

---

## 📋 Checklist Sebelum Edit Apa Pun di Folder Ini

- [ ] Baca section relevan di CLAUDE.md ini dulu.
- [ ] Jangan keluar dari `C:\Users\HP\Project Aegis\`.
- [ ] Cek `07-SYSTEM/AEGIS-ENABLED.flag` ada atau tidak (kalau tidak ada = Aegis off, jangan jalan skill).
- [ ] Untuk perubahan struktur → konfirmasi Hady dulu.
- [ ] Audit sendiri sebelum lapor selesai.

---

*Terakhir diupdate: 21 Juni 2026 — initial structure (Fase 1). Stack: Claude + Obsidian + Supabase + Groq + Railway + GitHub.*
