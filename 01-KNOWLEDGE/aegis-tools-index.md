---
name: aegis-tools-index
type: brain-level-index
description: Index brain-level semua tools, skills, dan capabilities Aegis. Bukan source code — ini "apa yang Aegis BISA lakukan".
last_updated: 2026-06-30
---

# 🛠️ AEGIS — Tools & Capabilities Index

> File ini = **brain Bapak tau Aegis bisa apa**.
> Source code-nya di `bot-worker/` (di-hide dari graph biar fokus).
> Update file ini kalau ada tool baru / hilang.

---

## 🧠 Core Engine

### `grounding.js` — DATA-FIRST middleware
- Sebelum AI dipanggil, auto-tarik SELURUH memory vault (owner, people, projects, decisions, events, beliefs, reminders, project pages)
- Cache 60s in-memory biar gak slam GitHub
- AI dapat KONTEKS UTUH → tidak bisa ngarang
- Inject sebagai `<KONTEKS_DARI_VAULT_OBSIDIAN_HADY>` di system prompt

### `brain.js` — orchestrator
- Compose system prompt + grounding + user message
- Loop max 3 turn (tool call atau reply)
- Graceful parsing: terima reply/answer/message/text/content field

### `ai.js` — AI router dengan fallback chain
- **senior chain:** Groq llama-3.3-70b → Z.AI Flash → Groq llama-4-scout → OpenRouter llama
- **reason chain:** Groq llama-3.3-70b → Z.AI Flash → DeepSeek-R1 → llama-4-scout
- **analyze chain:** Groq → CF/Z.AI → OpenRouter Qwen → llama-4-scout
- **fast chain:** Groq 8B → Z.AI mini → CF Llama 8B
- KV blacklist 60s skip provider yang baru kena 429
- Fetch timeout 15s

---

## 🛠️ Tools Aegis bisa panggil (via tool calling)

### Memory
- `save_note` — simpan ke 00-INBOX/ + auto-distill real-time
- `search_memory` — query natural language ke memory JSON
- `consolidate_memory` — gabung duplikat di memory
- `get_schedule` — ambil jadwal Hady utk periode tertentu
- `add_reminder` — set reminder dengan datetime
- `list_reminders` — list reminder aktif
- `remove_reminder` — hapus reminder by ID

### File I/O (di vault)
- `read_file` — baca file dari vault (path-based)
- `write_file` — tulis file ke vault
- `list_folder` — list isi folder

### Web/Skill
- `web_fetch` — fetch URL & extract text
- `web_search` — Tavily search (1000 cred/bln)
- `learn_skill` — pelajari skill baru
- `list_skills` — list skill yang sudah dipelajari
- `use_skill` — eksekusi skill

### Reasoning
- `analyze_text` — analisis text
- `decompose_task` — pecah task jadi sub-task
- `evaluate_decision` — analisa pros/cons decision
- `summarize` — ringkas long text
- `translate` — terjemahan
- `calculate` — matematika
- `financial_calc` — ROI/BEP/payback

### Track
- `record_decision` — catat decision penting
- `record_belief` — catat prinsip/value
- `aegis_status` — cek status sistem

### Code
- `generate_code` — bikin code snippet
- `execute_python` — eksekusi Python sandbox
- `review_code` — review code
- `debug_help` — bantuan debug
- `generate_tests` — bikin unit test

### Multimedia
- `analyze_image` — analisa foto via GLM-4.6V-Flash (Vision)
- `generate_image` — generate via Cloudflare Flux-1-Schnell

### Planning
- `make_plan` — bikin rencana step-by-step
- `compare_options` — bandingkan A vs B vs C
- `brainstorm` — generate ide

### Writing
- `draft_document` — draft email/memo/proposal
- `long_form_write` — tulis artikel panjang
- `rewrite` — rewrite kalimat
- `analyze_data` — analisis data tabular

---

## ⏰ Cron Jobs Otomatis (WIB)

| Jam | Apa | Interval |
|---|---|---|
| Tiap 5 menit | Webhook self-heal | continuous |
| Tiap 5 menit | Health monitor (KV/GitHub/webhook check) | continuous |
| Tiap 5 menit | Auto-distill kalau inbox ≥ 10 file | continuous |
| Tiap 5 menit | Dispatch reminder yang due | continuous |
| 03:00 | Backup snapshot vault | daily |
| 06:00 | Morning brief (ke Telegram) | daily |
| 12:00 | Anomaly scan | daily |
| 21:00 | Evening recap | daily |
| 22:00 | Daily Health Digest | daily |
| 23:00 | Distill malam + knowledge sync | daily |
| Minggu 19:00 | Weekly reflection | weekly |
| Minggu 20:00 | Self-tune (CLAUDE.md suggestion + feedback digest) | weekly |

---

## 🛡️ Permissions / Constraints

**Aegis BISA:**
- ✅ Read semua file di vault (via GitHub API)
- ✅ Write ke `04-AEGIS-OUTPUTS/`, `00-INBOX/`, `07-SYSTEM/memory/`, `01-KNOWLEDGE/`
- ✅ Web search (Tavily)
- ✅ Image generation (Cloudflare Workers AI Flux)

**Aegis TIDAK BISA:**
- ❌ Akses langsung DB project (Supabase reguler-fleet, dll)
- ❌ Kontak pihak luar tanpa permission (email, chat)
- ❌ Saran finansial/strategis konkret (analisis OK, tidak boleh "beli X / jual Y")

---

## 🔧 Debug Endpoints (browser-accessible)

- **`/debug-grounding?q=<query>`** — Lihat persis grounding yang di-inject ke AI. Bukti vault dibaca.
- **`/setup-webhook`** — Force re-set Telegram webhook ke bot-worker.

---

## 📚 Provider Stack

| Provider | Role | Notes |
|---|---|---|
| **Groq** | Primary senior/reason (ultra-fast 1-2s) | 30 req/min free |
| **Z.AI** | Backup, 128K context | Free forever |
| **Cloudflare Workers AI** | Fast role (CF Llama 8B), Vision (Flux gen) | 10rb neurons/hari |
| **OpenRouter** | Last resort fallback | 50 req/hari free |
| **Tavily** | Web search | 1000 cred/bln |
| **GLM-4.6V** | Vision/image analysis | via Zhipu free |

---

## 🔗 Source Code (di-hide dari graph, tapi tetap bisa Bapak baca)

Path repo: `bot-worker/src/`
- `worker.js` — entry Cloudflare Worker
- `lib/ai.js` — AI router
- `lib/brain.js` — orchestrator chat
- `lib/grounding.js` — DATA-FIRST middleware
- `lib/tools.js` — registry semua tools (700+ baris)
- `lib/distill.js` — extract memory dari catatan
- `lib/reminders.js` — reminder CRUD
- `lib/store.js` — file ops via GitHub API
- `lib/telegram.js` — Telegram API wrapper
- `lib/privacy.js` — redaction layer (TODO: wire)
- `lib/knowledge-sync.js` — sync memory → 01-KNOWLEDGE/*.md
- `lib/backup.js` — daily snapshot
- `lib/briefings.js`, `lib/reflect.js`, `lib/anomaly.js`, `lib/self-update.js`

Kalau ingin cek implementasi: buka via VS Code di `C:\Users\HP\Project Aegis\bot-worker\`.
