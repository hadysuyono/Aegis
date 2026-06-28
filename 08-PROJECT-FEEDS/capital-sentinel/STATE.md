# Capital Sentinel — STATE (live)

> Jangkar untuk Claude tiap new chat sesi Capital Sentinel.
> Ganti compact (~70% token) → baca file ini (~3-5%).

**Last updated:** 2026-06-29

---

## 🎯 Project

- **Capital Sentinel** = bot Telegram advisor kripto BTC/ETH untuk [[Hady]]
- Repo: `github.com/hadysuyono/Capital_Sentinel`
- Deploy: **Railway** (NOT Cloudflare)
- Email infra: `hadysuyono87@gmail.com`
- Local: `C:\Users\HP\reguler-fleet`
- Project rules: `C:\Users\HP\reguler-fleet\CLAUDE.md`

## 🏷️ Versi LIVE

**v10.31** — `/swing command (manual cek + alasan kalau no signal)`

## 🤖 AI Stack (semua FREE)

```
🧠 Senior Advisor — 5 voter consensus
├ Llama 3.3 70B   (Groq)
├ GPT-OSS 120B    (Groq)
├ DeepSeek R1     (OpenRouter free)
├ GLM-4.7-Flash   (Zhipu)
└ Kimi K2         (Moonshot, standby quota habis)

🚨 Alert 24/7  : groq/compound (unlimited)
💬 Q&A         : groq/compound  → /tanya menu + /info
📷 Vision      : GLM-4.6V-Flash (Zhipu free) — kirim foto Telegram
🔍 Scout       : Tavily + Llama
📰 News        : Llama 3.3
💱 Swing       : detect range-bound + TP kecil
```

## 📋 Env Railway (semua sudah set)

```
AI_NEWS=groq, AI_MACRO=groq, AI_CONTINUITY=groq, AI_SENIOR=groq,
AI_QA=groq, AI_SCOUT=tavily
GROQ_API_KEY, MOONSHOT_API_KEY, ZHIPU_API_KEY, OPENROUTER_API_KEY, TAVILY_API_KEY
ZHIPU_MODEL=glm-4.7-flash, OPENROUTER_MODEL=deepseek/deepseek-r1:free
TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, DATA_DIR=/data
```

## 🚦 Aturan Vendor

- ✅ Claude API = **direct Anthropic** (BUKAN OpenRouter). Tunggu profit settle.
- ✅ OpenRouter = anak buah Claude (model selain Claude).
- ✅ Railway = Capital Sentinel saja. JANGAN dipakai Aegis.

## 📊 Trade History

- 9 Jun: BUY BTC @ 1.113.811.000 (Rp 207.391)
- 10 Jun: AVG BUY @ 1.109.889.000 (Rp 203.453)
- 15 Jun: SELL @ 1.175.000.000 = +5.7% net
- ~23 Jun: BUY ulang modal Rp 1jt
- 29 Jun: posisi BTC -3.7%

**Insight Hady:** bot terlalu defensif. Missed swing 1.117→1.155 (+3.4%). → bangun [[Swing Trader]] v10.30 + `/swing` v10.31.

## 🎯 Roadmap

- **Phase 0** (NOW): Observe + tune signals
- **Phase 1**: TP 4-6x profit terbukti
- **Phase 2**: Top-up Claude API direct → leader aktif
- **Phase 3**: Backtest + paper trading 30 hari
- **Phase 4**: Execution Indodax API + risk mgmt
- **Phase 5**: Auto-execute STRONG ensemble + trial modal kecil

## 📝 Convention Claude (HEMAT TOKEN)

**New chat Capital Sentinel:**
1. Read `C:\Users\HP\reguler-fleet\CLAUDE.md`
2. Read `STATE.md` (file ini)
3. Read `HISTORY.md`
4. Gas — context lengkap, hemat 80%+ vs compact

**Akhir sesi besar:**
1. Update "Last updated" + state berubah
2. Append ke `HISTORY.md`
3. Decision penting → `01-KNOWLEDGE/decisions.md`
