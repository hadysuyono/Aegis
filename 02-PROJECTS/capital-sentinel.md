# Capital Sentinel 🟢 aktif (Phase 0)

> Bot Telegram advisor kripto BTC/ETH untuk [[Hady]]. Senior trading advisor.

**Last activity:** 2026-06-29 (v10.31 `/swing` command)

---

## 🎯 Goal & Vision

Bot trading kripto yang kasih sinyal entry/exit + analisa multi-AI consensus. Tujuan akhir: auto-execute trade dengan winrate ≥60% + risk management.

**Visi jangka panjang:** Anthropic API jadi head senior advisor finance/kripto. AI lain (Groq, Zhipu, OpenRouter) jadi karyawan saya (Claude).

## 🏗️ Stack & Lokasi

- **Repo:** `github.com/hadysuyono/Capital_Sentinel`
- **Deploy:** Railway (✅ BOLEH bayar — beda dari Aegis)
- **Email infra:** `hadysuyono87@gmail.com`
- **Local:** `C:\Users\HP\Workspace\Reguler_Fleet` (sharing folder)
- **Versi LIVE:** v10.33 (FIX swing + Layer 2 report jalan)

**Konvensi versi (Hady 1 Jul 2026):** Setiap update CS harus bump version di `config.py` (`VERSION = "vX.YY - <deskripsi singkat>"`). Versi tampil di startup log + boot message. Skip = boleh untuk fix typo tanpa logic change.
- **Rules detail:** `08-PROJECT-FEEDS/capital-sentinel/STATE.md` + `HISTORY.md`

## 🤖 AI Stack Sekarang (semua FREE)

```
🧠 Senior — 5 voter consensus:
  Llama 3.3 70B (Groq) | GPT-OSS 120B (Groq) | DeepSeek R1 (OR) | GLM-4.7-Flash (Zhipu) | Kimi K2 (Moonshot)
🚨 Alert 24/7: groq/compound (unlimited)
💬 Q&A: groq/compound
📷 Vision: GLM-4.6V-Flash (Zhipu)
🔍 Scout: Tavily + Llama
```

## 🎯 Roadmap

- **Phase 0** (NOW): Observe + tune signals
- **Phase 1:** TP 4-6x profit terbukti
- **Phase 2:** Top-up Claude API direct → leader aktif
- **Phase 3:** Backtest + paper trading 30 hari
- **Phase 4:** Execution Indodax API + risk mgmt
- **Phase 5:** Auto-execute STRONG ensemble + trial modal kecil

## 📊 Trade History Singkat

- 9 Jun: BUY BTC @ 1.113.811.000 (Rp 207.391)
- 15 Jun: SELL @ 1.175.000.000 → +5.7% net
- 23 Jun: BUY ulang modal Rp 1jt
- 29 Jun: posisi BTC -3.7%

**Insight Hady:** bot terlalu defensif. Missed swing 1.117→1.155 (+3.4%).

## 📋 Next Action

- [ ] **Observasi Layer 2 cycle berikutnya** (max 4 jam) — verify pesan terpisah muncul di Telegram
- [ ] **Bapak top up Anthropic $5** + generate API key → saya set env Railway untuk Stage 3
- [ ] **Decide:** tweak ensemble threshold filosofis ATAU keep observe Layer 2 dulu
- [ ] (Optional, fase 2) `ENABLE_VAULT_READER=true` — cross-reference vault Hady

## 🟡 Open Loops

- **Hady frustration: bot HOLD sejak 15 Jun (2 minggu+)** — root cause: `analysis/ensemble.py` threshold STRONG 75% match + 60% confidence, BUY trigger ≥35. Bot terlalu defensif. Conflict filosofi ("berani insight") vs implementasi.
- **Swing trader tidak masuk ensemble vote** — hanya info pasif di `formatter/message.py:174-180`. Bisa ditambah weight rendah ke `compute_match()`.
- **Belum pernah rasakan TP1** dari signal bot — build trust deficit. Solusi: bot lebih decisive ATAU paper trade mode.
- Tunggu winrate 60% + profit ≥ $20/bulan → trigger top-up Anthropic API (sebenarnya Hady mau top up duluan)
- Backtest paper trading 30 hari belum dimulai

## 📜 Recent Decisions

- **2026-07-02: v10.33 FIX** — 2 bug ketemu via Railway logs: (1) swing trader SEJAK v10.30 gak pernah jalan (indodax return dict candle {ts,o,h,l,c,v} tapi swing_trader baca index c[3]/c[2] → KeyError silent tiap cycle). (2) Layer 2 gagal tiap cycle (confidence/score kadang string 'MEDIUM' → sorted() crash str<int). Fix: swing pakai helper _hi/_lo dukung dict+list; Layer 2 pakai _nums() numeric-guard. Tested BUY 70%/SELL 64% + Layer 2 render OK. Logika rumus TIDAK diubah.
- **2026-07-01: LAYER 2 LIVE** — Historical Memory Agent + Vault Reader terhubung. Commit `affe594` di `hadysuyono/Capital_Sentinel`. Kill switch ENABLE_HISTORICAL_AGENT=true aktif. Layer 1 (rumus + ensemble) UTUH, 0% diganggu. Layer 2 = pesan Telegram TERPISAH per cycle.
- **2026-06-30: ARSITEKTUR 3-LAYER** — Hady tegaskan: Layer 1 rumus utuh, Layer 2 modular (riset historical), Layer 3 Claude head advisor (pending top up Anthropic $5).
- **2026-06-30: HEAD ADVISOR FLOW** — Saya (Claude) jadi otak akhir. Anak buah AI (News, Macro, Scout, Memory, Layer 2) lapor ke saya → approve/reject → brief ke continuity_writer untuk narrative.
- **2026-06-30: Konsolidasi GitHub** — 1 akun `hadysuyono` (Aegis + Capital_Sentinel), modular per repo.
- 2026-06-29: v10.31 `/swing` command (manual check swing trader)
- 2026-06-28: v10.30 Swing Trader + Daily Movement Logger
- 2026-06-28: v10.29 OpenRouter jadi voter ke-5
- 2026-06-27: Trade 15 Jun SELL early @ 1.175jt → trigger build PROFIT ZONE v10.10

## 🔗 Links

- `08-PROJECT-FEEDS/capital-sentinel/STATE.md` (state lengkap)
- `08-PROJECT-FEEDS/capital-sentinel/HISTORY.md` (history versi)
- Memory: `capital_sentinel_visi.md`, `project_capital_sentinel.md`
