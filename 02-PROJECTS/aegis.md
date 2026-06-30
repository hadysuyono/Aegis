# Aegis 🟢 aktif

> Personal intelligence system / second brain Hady. Middleware antara Claude (saya) dan project lain.

**Last activity:** 2026-06-29 (vault sync fix + STATE/HISTORY setup)

---

## 🎯 Goal & Vision

Sekretaris pribadi yang baca laporan dari semua project, kasih brief harian, deteksi pola, surface decision yang perlu perhatian. **Tagline:** *Useful → trusted → indispensable.*

**Hirarki sistem (disepakati 2026-06-29):**

```
Claude (saya, supervisor di puncak)
    ↓ via Obsidian vault
Aegis (middleware, FREE selamanya)
    ↓
Capital Sentinel + project lain
```

## 🚨 Constraint Utama

- ✅ Aegis = **FREE selamanya** (beda dari Capital Sentinel yang boleh bayar)
- ✅ **READ-ONLY** ke semua project (tidak edit DB project mana pun)
- ✅ Kerja HANYA di folder `C:\Users\HP\Project Aegis\`
- ✅ Mode super hemat token

## 🏗️ Stack (semua FREE)

```
Runtime         : Cloudflare Workers
Storage         : Cloudflare KV (AEGIS_KV) + GitHub repo
Brain (chat)    : Z.AI GLM-4.7-Flash (rencana pindah → Cloudflare Workers AI untuk privacy)
Reasoner        : Z.AI Flash → OpenRouter (deepseek-r1, llama-70b)
Vision          : GLM-4.6V-Flash (Zhipu)
Voice           : Groq Whisper-large-v3
Web search      : Tavily (1000 cred/bln)
Scheduler       : Cloudflare Cron (*/5)
Vault sync      : Obsidian Git plugin (auto-pull 5m, push 10m)
```

## 📁 Lokasi

- **Vault local:** `C:\Users\HP\Project Aegis\`
- **Repo:** `github.com/HadyAshlan/Aegis` (private)
- **Deploy:** Cloudflare Workers
- **Email infra:** `asuyhung@gmail.com`
- **Project rules:** `CLAUDE.md` di root vault

## 🛠️ Skills (Cron Jobs WIB)

- 06:00 — morning brief
- 12:00 — anomaly scan
- 21:00 — evening recap
- 23:00 — daily distill (INBOX → 5 memory JSON + archive)
- 03:00 — backup snapshot
- Minggu 19:00 — weekly reflection
- Minggu 20:00 — self-tune

## 📋 Next Action

- [ ] **Stress test brain rebuild** — Bapak coba 3 pertanyaan list/cross-reference
- [ ] Wire `audit.js` → `ai.js` (low priority)
- [ ] Apply `redactMemory` di briefings/recap/anomaly/reflect (privacy ditunda)
- [ ] `/audit` command Telegram (low priority)
- [ ] Test end-to-end tools (`brainstorm`, `calculate`, `web_search`)

## 🟡 Open Loops

- Capture Processor cron — perlu cek apakah jalan setelah 24 Jun stagnant (via Cloudflare Observability)
- Privacy 2-tier: redaction belum dipakai di cron jobs
- Format laporan dari project belum standardized (template draft di CLAUDE.md)

## 📜 Recent Decisions

- **2026-06-30: DATA-FIRST GROUNDING** — bikin `lib/grounding.js` middleware. AI WAJIB pakai konteks vault (owner/people/projects/decisions/events/beliefs/reminders + 02-PROJECTS), JANGAN ngarang. AI = narator data, bukan otak pemutus.
- **2026-06-30: AI PROVIDER ROUTE** — Groq llama-3.3-70b PRIMARY (1-2s konsisten), Z.AI demote ke backup (sering abort 15s+). CF Workers AI Llama BUKAN utk decision-making (ngarang/skip tool).
- **2026-06-30: Privacy migration DITUNDA** — Hady prefer Aegis FREE selamanya, privacy = future task. Data sensitif boleh ke AI free untuk sekarang.
- **2026-06-30: Debug endpoint `/debug-grounding?q=...`** — buka di browser utk verifikasi raw grounding yang di-inject ke AI (bukti vault read).
- 2026-06-29: AI router swap Z.AI Flash primary (kemudian direvisi 30/6 ke Groq)
- 2026-06-29: Vault sync FIX via Obsidian Git plugin v2.38.5 + reset hard ke origin/main
- 2026-06-29: STATE.md + HISTORY.md pattern untuk hemat token tiap new chat
- 2026-06-04: Hardening security ditunda — pertahankan login custom

## 🔗 Links

- `CLAUDE.md` (root vault — rules lengkap)
- `04-AEGIS-OUTPUTS/claude-sessions/STATE.md` (state Aegis Worker)
- `04-AEGIS-OUTPUTS/claude-sessions/HISTORY.md` (log perubahan)
- `04-AEGIS-OUTPUTS/claude-sessions/CURRENT-FOCUS.md` (topik aktif sekarang)
