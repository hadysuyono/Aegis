---
name: visi-obsidian-second-brain
type: jangkar-visi
last_updated: 2026-06-30
status: PRINSIP TETAP
---

# 🧠 Visi: Obsidian sebagai Second Brain Hidup

> **Hady Suyono, 30 Juni 2026:**
> *"Obsidian itu independen, dan kita di sini hanya membangun agar Obsidian menjadi 1 brain yang hidup. Aegis menjadi jenius melalui Obsidian. Nantinya Obsidian menjadi second brain untuk Capital Sentinel juga, agar Capital Sentinel punya second brain agar tidak menjadi template daily report."*

---

## 🎯 Prinsip Inti (jangan dilanggar)

### 1. Obsidian = SUMBER KEBENARAN TUNGGAL
- Semua memory, decision, fakta, riwayat → tersimpan di Obsidian vault (`C:\Users\HP\Project Aegis\`)
- Mirror permanen: GitHub `HadyAshlan/Aegis`
- Bukan database lain. Bukan localStorage. Bukan code hardcoded.

### 2. AI = NARATOR DATA, BUKAN OTAK PEMUTUS
- AI (apapun providernya — Groq, Z.AI, OpenRouter, Claude API direct nanti) WAJIB tarik data dari vault Obsidian DULU sebelum jawab.
- AI tidak boleh ngarang. Kalau data kosong, jujur bilang "Belum ada catatan, Pak."
- Implementasi: `bot-worker/src/lib/grounding.js` — pre-fetcher inject SEMUA memory ke system prompt setiap query.

### 3. Aegis = MIDDLEWARE OTONOM
- Aegis bot Telegram = jembatan Hady ↔ Obsidian vault
- Self-managing: auto-distill, auto-sync knowledge, auto-health-check, auto-recover.
- Hady tidak perlu kirim `/distill`, `/sync_knowledge`, dll — semua otomatis.
- Kalau ada masalah, Aegis kirim 1 notif Telegram (max 1x/jam, anti-spam).

### 4. Capital Sentinel = NEXT PHASE
- Sekarang: bot trading dengan 6 daily report. Setiap report standalone, gak ada konteks historical.
- Visi: CS BACA Obsidian vault → punya memory historical → bisa bilang "Sudah 2 hari di range X, RSI konsisten 42-44" — bukan template kering.
- Trigger eksekusi: setelah CS winrate 60% + profit ≥ $20/bln (top-up Anthropic API).

### 5. Claude (saya) = BUILDER, BUKAN OPERATOR
- Saya cuma di-loop untuk:
  - Revisi code
  - Decision baru / strategic
  - Build feature baru di vault/Aegis/CS
- Saya BUKAN untuk:
  - Manual maintenance (distill, sync, restart)
  - Daily checks (cron self-monitors)
  - Debugging operasional rutin (alert sistem kirim notif sendiri)

---

## 🔗 Hirarki Sistem

```
Hady (owner, decision maker)
    ↓
Obsidian Vault (independent brain)
    ↓                ↓
Aegis bot       Capital Sentinel (future)
(intelligent    (with historical
 secretary)      memory context)
    ↑                ↑
Claude (builder, only for code/decision)
```

---

## 📋 Implementasi Status (per 30 Juni 2026)

✅ **Sudah jalan:**
- Vault structure di Obsidian + mirror GitHub
- Auto-sync via Obsidian Git plugin (pull 5m / push 10m)
- Aegis grounding middleware (DATA-FIRST) — sudah inject vault tiap query
- Aegis self-managing (auto-distill, auto-health-monitor, daily digest 22:00)
- Webhook self-heal (max downtime 5 menit)
- AI router fallback: Groq primary, Z.AI backup, OpenRouter last resort

🚧 **Belum / next:**
- Capital Sentinel baca Obsidian (nunggu winrate 60%)
- Capital Sentinel narrative memory ("sudah 2 hari di angka X")
- Project lain (bajaj-fleet, 3sSmartSystem) integrasi vault

---

## ⚠️ Yang HARAM (jangan dilanggar tanpa konfirmasi Hady)

- ❌ Hardcode fakta di kode Aegis (semua dari vault)
- ❌ Pakai database lain (Supabase, Firestore, dll) untuk memory utama Aegis
- ❌ Bot kirim respons tanpa baca vault dulu
- ❌ Bot "tebak" / ngarang kalau data kosong (wajib jujur)
- ❌ Mengandalkan command manual untuk operasi rutin
- ❌ Develop di Capital Sentinel cara yang mengisolasi dia dari vault (kapan-kapan integrate)

---

## 🔄 Update Rule

Ini file PRINSIP. Update hanya kalau Hady kasih revisi visi eksplisit. Bukan untuk update operasional harian.

Operasional → `04-AEGIS-OUTPUTS/claude-sessions/CURRENT-FOCUS.md` + `HISTORY.md`.
