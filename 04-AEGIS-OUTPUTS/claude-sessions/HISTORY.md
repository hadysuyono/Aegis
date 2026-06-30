# Aegis — HISTORY (Claude take-over log)

> Newest on top. Append akhir tiap sesi.

---

## 2026-06-30 — Aegis Brain Rebuild (DATA-FIRST + Groq primary)

**Konteks awal:**
- Bot Aegis sering jawab "Maaf Pak, saya tidak paham" / "saya bingung"
- Bot ngarang "belum ada jadwal tercatat" padahal reminder ada di vault
- Hady frustrasi: "saya cape, Aegis goblok banget"

**Diagnosis berturut-turut:**
1. Awal: AI router refactor v1 (CF Workers AI primary chat) → GAGAL: Llama 3.3 70B di CF ngarang/skip tool, tidak patuh JSON-strict
2. Revert ke Z.AI primary + tambah Groq backup
3. Bug 'Compound limit habis': dead code di `notifyQuotaExhausted` ai.js → dihapus
4. OLD bot Node.js (Railway Aegis project belum benar2 ke-delete) ngerampas Telegram polling → setelah Hady klik Deploy di Railway, OLD bot mati
5. Webhook self-heal aktif (cronWebhookHealth dipanggil di scheduled handler)
6. Webhook secret_token disertakan saat setWebhook
7. AbortController timeout per fetch (cegah waitUntil 30s overflow)

**Diskusi arsitektur (BESAR):**
Hady tegaskan visi: "AI WAJIB tarik data Obsidian DULU sebelum jawab. AI bukan otak yang putuskan, AI cuma narator dari data."
→ Bangun `lib/grounding.js` middleware: sebelum AI dipanggil, sistem auto-fetch SEMUA memory vault (owner, people, projects, decisions, events, beliefs, reminders, 02-PROJECTS pages) dan inject ke system prompt.

**Achieved:**
- New: `bot-worker/src/lib/grounding.js` v2 — ALWAYS-LOAD CORE memory
- brain.js: panggil buildGrounding sebelum AI + prioritas KONTEKS_VAULT > tool call
- ai.js: senior + reason chain pindah ke **Groq llama-3.3-70b PRIMARY** (1-2s response, vs Z.AI yg sering abort 15s+)
- KV rate-limit blacklist 60s skip provider yg baru 429
- Endpoint debug: `/debug-grounding?q=<query>` — BUKTI Aegis baca vault (return raw grounding output)
- Endpoint: `/setup-webhook` — force re-set Telegram webhook
- wrangler.toml: observability persist (logs ON, traces invalid di wrangler v3 → dihapus)
- OpenRouter API key di-set ulang di Cloudflare secret
- Fetch timeout 8s → 15s (Z.AI butuh waktu utk grounding besar)
- MAX_TURN 5 → 3 (cegah waitUntil overflow)
- brain.js graceful reply parsing: terima reply/answer/message/text/content

**Bukti data flow (via /debug-grounding?q=siapa+karyawan):**
- ✅ Worker reads from GitHub HadyAshlan/Aegis@main
- ✅ owner.json loaded (Hady, M44/M53/bajaj/Aegis)
- ✅ reminders.json loaded (30 Juni 07:00 Keselamatan berkendara)
- ✅ people.json loaded (Arip hutang 3.450.000, Bembeng 1.000.000, Isa 500.000)
- ✅ projects.json loaded
- Grounding total: 12,791 chars (~3,198 tokens)

**Decisions:**
- ARSITEKTUR: DATA-FIRST grounding — AI WAJIB pakai konteks vault, JANGAN ngarang
- AI provider: Groq PRIMARY (cepat & reliable utk JSON), Z.AI backup
- CF Workers AI Llama 3.3 70B BUKAN utk decision-making (ngarang/skip tool) — cuma utk fast role
- Privacy migration ditunda (Hady prefer Aegis FREE selamanya, privacy = future task)
- Push protocol: WAJIB announce akun + folder dulu

**Pending (next session):**
- Hady stress test 3 pertanyaan list/cross-reference ("daftar karyawan", "projek apa aktif", "siapa hutang sama saya")
- Capital Sentinel memory architecture (tunggu winrate 60% + profit ≥ $20/bln)
- TODO STATE.md: audit.js + privacy.redact di cron (low priority)

---

## 2026-06-29 (malam) — Setup Second Brain Obsidian

**Achieved:**
- Sepakat hirarki sistem: Claude (supervisor) → Obsidian → Aegis → Capital Sentinel + project lain
- Bikin struktur second brain biar new chat Claude nyambung tanpa abu-abu:
  - `04-AEGIS-OUTPUTS/claude-sessions/CURRENT-FOCUS.md` — topik aktif, open loops, pending decision
  - `02-PROJECTS/` — 5 page (reguler-fleet, bajaj-fleet, 3s-smartsystem, capital-sentinel, aegis)
  - Update `CLAUDE.md` vault: tambah section "URUTAN BACA TIAP NEW CHAT" + "Hirarki Sistem"
- Commit `6f34de3` push ke `HadyAshlan/Aegis` ✅
- Aturan baru: push WAJIB announce akun+folder dulu (Hady punya 2 akun GitHub, takut salah pilih)
- Verified: GitHub free = unlimited private repo, aman free selamanya untuk 2 project Hady

**Capital Sentinel Memory Design (BELUM eksekusi):**
- Lokasi asli: `crypto_advisor/` di session Claude.ai (volatile path), source permanen di GitHub `hadysuyono/Capital_Sentinel`
- Template existing: header + per coin (Harga/Sinyal/Skor/Status/Inti/Rezim/Posisi/Senior Advisor/Action Conf/Ensemble/Swing) + 4 tombol drill-down
- Jadwal: 6x WIB 07/11/15/19/23/03 + alert 24/7 (scheduler/jobs.py:1087)
- Memory sebagian sudah ada di Railway disk: `data/memory.py`, `daily_movement.json`, `calibration.json`, `history.json`
- Yang BELUM: mirror ke Obsidian + narrative memory lintas-hari ("sudah 2 hari di angka X")
- **Trigger eksekusi:** setelah winrate 60% + profit ≥ $20/bln (sambil top-up Anthropic API)

**Decisions:**
- Aegis tetap FREE selamanya (beda dari Capital Sentinel yang boleh bayar)
- Push aturan: WAJIB announce dulu sebelum eksekusi
- Memory architecture Capital Sentinel = tambah hook, BUKAN ubah template existing

**Pending (besok):**
- Hady putuskan: update vault dgn rancangan memory CS atau topik lain
- AI privacy migration Aegis (Z.AI → Cloudflare Workers AI) belum dimulai

---

## 2026-06-29 — Take-over Day 1

**Achieved:**
- Aegis vault sync FIX:
  - Diagnose: Task Scheduler stop 23 Jun → vault stagnant
  - Install Obsidian Git plugin v2.38.5 (via terminal direct download + config)
  - Resolve git conflict (1 local vs 172 remote commit)
  - `git reset --hard origin/main` → vault sync clean ✅
- AI router swap (anak buah head advisor decision):
  - `analyze` role: Groq → Z.AI GLM-4.7-Flash primary (128K context, hindari 413)
  - `fast` role: Groq → Z.AI GLM-4.5-Flash primary
  - Groq jadi last fallback saja
  - File: `bot-worker/src/lib/ai.js`
- Cloudflare Observability enabled (Logs + Traces)
- Create STATE.md + HISTORY.md di `08-PROJECT-FEEDS/capital-sentinel/`
- Create STATE.md + HISTORY.md di `04-AEGIS-OUTPUTS/claude-sessions/`
- Account mapping clarified:
  - Capital Sentinel: `hadysuyono87@gmail.com`
  - Aegis: `asuyhung@gmail.com`
  - Claude.ai chat: `asuyhung@yahoo.com`

**Pending (next session):**
- Audit Capture Processor cron — kenapa stagnant 24 Jun (mungkin sudah jalan, perlu verify via Cloudflare Observability log)
- Wire `audit.js` → `ai.js`
- Apply `redactMemory` di cron jobs
- Hapus dead code compound di `ai.js`
- `/audit` command Telegram

**Decisions:**
- Aegis chat = pakai Z.AI Flash (128K context) BUKAN Groq (hindari 413 char limit)
- Capital Sentinel state + Aegis state = save ke vault, baca tiap new chat (ganti compact)
