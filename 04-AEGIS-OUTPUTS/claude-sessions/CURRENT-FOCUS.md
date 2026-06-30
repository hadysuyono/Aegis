# CURRENT FOCUS — Claude ↔ Hady

> File hidup. Update tiap akhir sesi besar.
> Format: ringkas, scan-able dalam 30 detik.

**Last updated:** 2026-06-30 (sesi siang: rebuild Aegis brain — DATA-FIRST + Groq primary)

---

## 🎯 Topik Aktif Sekarang

**Aegis brain rebuild SELESAI** — sekarang DATA-FIRST architecture: tiap pertanyaan, AI dapat seluruh memory vault. Bottleneck AI provider sudah pindah ke Groq (cepat 1-2s). Tinggal stress test.

## 🔗 Hirarki Sistem

```
Claude (saya, supervisor)
    ↓ via Obsidian vault
Aegis (second brain, FREE)
    ↓
Capital Sentinel (Railway, BOLEH bayar)
[project lain ke depan]
```

## 🔐 Aturan Push (mulai 2026-06-29)

Tiap mau `git push`, saya WAJIB announce dulu (akun + folder). Akun mapping:
- `hadysuyono/Aegis` — folder `C:\Users\HP\Project Aegis\`
- `hadysuyono/Capital_Sentinel` — folder Capital Sentinel di session Claude.ai

## 🟢 Decision Penting Sesi 30 Juni 2026

### ARSITEKTUR BARU — DATA-FIRST GROUNDING
> **Hady:** "AI WAJIB tarik data Obsidian DULU sebelum jawab. AI bukan otak yang putuskan, AI cuma narator dari data."

- File baru: `bot-worker/src/lib/grounding.js`
- Sebelum AI dipanggil, sistem auto-load SEMUA memory:
  - reminders.json, owner.json, people.json, projects.json
  - decisions.json, events.json, beliefs.json
  - 02-PROJECTS/*.md (semua project pages)
  - Inbox 7 hari (kalau hint "kemarin/recent/jelaskan")
- Cache 60s in-memory per Worker isolate
- AI dapat KONTEKS UTUH → bisa cross-reference (Arip + hutang + M44 → 1 jawaban)
- AI dilarang ngarang, wajib jujur kalau data kosong

### AI PROVIDER PRIORITAS
- **Senior + reason chain:** Groq llama-3.3-70b PRIMARY (1-2s response)
- Z.AI Flash demote ke backup (sering abort 15s+ untuk grounding besar)
- Groq llama-4-scout sebagai alt
- OpenRouter free sebagai last resort
- KV blacklist 60s skip provider yang rate-limit
- Fetch timeout 15s (dari 8s, biar Z.AI sempat fallback)

### PRIVACY DI-PAUSE
- User pilih BUKAN privacy-first (data sensitif boleh keluar ke AI free)
- Aegis = FREE selamanya
- Privacy migration (CF Workers AI, redact) = future task

## 🟡 Open Loops

1. **Stress test Aegis brain** — Bapak coba "daftar karyawan", "projek apa aktif", "siapa hutang sama saya" — verify response Groq primary cepat & akurat
2. **Capital Sentinel memory architecture** — rancangan sudah jelas (mirror report ke vault + narrative_memory.py). Trigger eksekusi: setelah winrate 60% + profit ≥ $20/bln
3. **Privacy 2-tier** (redactMemory di cron, audit.js) — ditunda, future task
4. **Capture Processor cron stagnant 24 Jun** — perlu cek (low priority)

## 🔧 Debug Tools

- **GET `/debug-grounding?q=<query>`** — return raw grounding yang di-inject ke AI. BUKTI Aegis baca vault. Buka di browser.
- **GET `/setup-webhook`** — force re-set Telegram webhook ke bot-worker.

## 📌 Konvensi Komunikasi

- **Mode super hemat token** — quota $20/bulan ketat. Jawaban ringkas, no narasi proses.
- **Hady tidak coding** — saya yang eksekusi, Bapak yang arahkan.
- **Tangkap sinyal** — kalau Bapak bilang "biasanya begini", itu ekspektasi behavior.
- **Audit sendiri** sebelum lapor selesai.
- **Push HARUS announce dulu** (lihat Aturan Push).
- **STOP tambal-sulam tanpa verify** — kalau ragu, buktikan dulu (debug endpoint, log tail) sebelum patch berikutnya.

## 📝 Last Conversation Summary (30 Jun 2026 siang)

1. AI router refactor v1: tambah CF Workers AI primary chat → ternyata Llama 3.3 70B di CF ngarang/skip tool (gak patuh JSON-strict)
2. Revert: Z.AI primary lagi, tambah Groq sebagai backup
3. **Diskusi besar arsitektur**: Hady tegaskan visi → AI = narator data vault, bukan otak putus sendiri
4. Bikin `grounding.js` v1 (intent-based) — schedule berhasil, person query gagal "saya tidak paham"
5. Rewrite `grounding.js` v2 (ALWAYS-LOAD CORE) — semua memory di-inject tiap query
6. Tail log → ketemu "operation was aborted" → Z.AI lambat untuk prompt 3K+ token
7. Bukti vault dibaca: `/debug-grounding` endpoint → return raw grounding (people.json lengkap)
8. Swap senior+reason ke Groq llama-3.3-70b primary (1-2s response, konsisten)
9. Wrangler config: observability persist (logs ON, traces invalid di wrangler v3)

## 🗺️ Next Action

- [ ] Bapak stress test Aegis brain (3 pertanyaan list/cross-reference)
- [ ] (Setelah lulus test) update HISTORY.md sesi tutup
- [ ] Capital Sentinel memory architecture (tunggu winrate 60%)
- [ ] TODO STATE.md: audit.js + privacy.redact di cron (low priority, future)
