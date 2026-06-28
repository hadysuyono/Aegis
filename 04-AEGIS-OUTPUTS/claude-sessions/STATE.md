# Aegis — STATE (Claude take-over)

> Jangkar untuk Claude tiap new chat sesi Aegis.
> Ganti compact (~70% token) → baca file ini (~3-5%).

**Last updated:** 2026-06-29 (take-over sesi pertama)

---

## 🎯 Project

- **Aegis** = personal intelligence system untuk [[Hady]] (mirip Jarvis)
- Repo: `github.com/HadyAshlan/Aegis` (private)
- Deploy: **Cloudflare Workers** (FREE forever, NOT Railway)
- Email infra: `asuyhung@gmail.com`
- Vault local: `C:\Users\HP\Project Aegis\`
- Project rules: `C:\Users\HP\Project Aegis\CLAUDE.md` (WAJIB baca dulu)

## 🏗️ Stack (semua FREE)

```
Runtime         : Cloudflare Workers
Storage         : Cloudflare KV (AEGIS_KV) + GitHub repo
Brain           : Z.AI GLM-4.7-Flash (primary)
Reasoner        : Z.AI Flash → OpenRouter (deepseek-r1, llama-70b)
Analyze (JSON)  : Z.AI Flash → OpenRouter qwen-72b → Groq fallback
Fast            : Z.AI Flash → OpenRouter llama-70b → Groq fallback
Vision          : GLM-4.6V-Flash (Zhipu)
Image gen       : Cloudflare Workers AI Flux-1-Schnell
Voice           : Groq Whisper-large-v3
Web search      : Tavily (1000 cred/bln)
Scheduler       : Cloudflare Cron (*/5)
Vault sync      : Obsidian Git plugin (auto-pull 5m, push 10m) + Task Scheduler backup
```

**Aturan vendor:** Telegram chat = pakai high-context model (Z.AI Flash 128K). Groq cuma last fallback (sering 413 char limit).

## 🔐 Privacy 2-Tier

- **Tier 1** (`src/lib/privacy.js`): `redactMemory` filter nominal + private. Sudah dipakai di `search_memory`. BELUM dipakai di cron jobs (briefings/recap/anomaly/reflect) — TODO.
- **Tier 2** (`src/lib/audit.js`): `logExposure` audit ke `07-SYSTEM/audit.json`. BELUM diwire ke `ai.js` — TODO.

## 📋 TODO Pending (urutan prioritas)

1. Wire `audit.js` → `ai.js` (panggil `logExposure` tiap aiCall)
2. Apply `redactMemory` di briefings, recap, anomaly, reflect
3. Hapus dead code compound di `ai.js` (`QUOTA_ALERT_KEY`, `compoundExhausted`, `notifyQuotaExhausted`) — notif "Compound limit habis" misleading
4. `/audit` command Telegram
5. Test end-to-end: `search_memory`, `brainstorm`, `calculate`, `web_search`

## 🛠️ Sync Flow

```
Telegram → Cloudflare Worker (autoSaveToInbox) → GitHub Aegis repo
                                                       ↓
[Obsidian open]  → Obsidian Git plugin pull 5 menit (primary)
[Obsidian close] → Task Scheduler PowerShell pull 2 menit (backup)
                                                       ↓
Vault local C:\Users\HP\Project Aegis\
```

**Sync sebelumnya stuck 23 Jun** (Task Scheduler stop). FIX 29 Jun: install Obsidian Git plugin v2.38.5, reset hard ke origin/main, pull 172 commit yg ketinggalan.

## 🎯 Cron Jobs (jadwal WIB)

- 06:00 — morning brief
- 12:00 — anomaly scan
- 21:00 — evening recap
- 23:00 — daily distill (INBOX → 5 memory JSON + archive)
- 03:00 — backup snapshot
- Minggu 19:00 — weekly reflection
- Minggu 20:00 — self-tune

## 🤖 40+ Tools di `src/lib/tools.js`

Memory: `save_note, search_memory, consolidate_memory, get_schedule, add_reminder, list_reminders, remove_reminder`
File I/O: `read_file, write_file, list_folder`
Web/skill: `web_fetch, web_search, learn_skill, list_skills, use_skill`
Reasoning: `analyze_text, decompose_task, evaluate_decision, summarize, translate, calculate, financial_calc`
Track: `record_decision, record_belief, aegis_status`
Code: `generate_code, execute_python, review_code, debug_help, generate_tests`
Multimedia: `analyze_image, generate_image`
Planning: `make_plan, compare_options, brainstorm`
Writing: `draft_document, long_form_write, rewrite, analyze_data`

## 🔗 Links

- [[Capital Sentinel]] → `08-PROJECT-FEEDS/capital-sentinel/STATE.md`
- [[CLAUDE.md vault]] (rules lengkap)
- HISTORY.md (rolling log perubahan)

## 📝 Convention untuk Claude (HEMAT TOKEN)

**New chat Aegis:**
1. Read `C:\Users\HP\Project Aegis\CLAUDE.md` (rules)
2. Read `STATE.md` ini (current state)
3. Read `HISTORY.md` (recent changes)
4. Gas — hemat 80%+ vs compact

**Akhir sesi besar:**
1. Update "Last updated"
2. Append entry baru ke `HISTORY.md`
3. Decision penting → `01-KNOWLEDGE/decisions.md`
4. Commit + push agar tersimpan di GitHub (vault remote = source of truth)
