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

### 4. Capital Sentinel = ARSITEKTUR 3-LAYER (Hady 30 Jun 2026)

**Layer 1: BOT EXISTING (UTUH, JANGAN DIGANGGU)**
- 100% rumus matematika + fundamental data
- Signal BUY/SELL/HOLD via ensemble code vs AI yang SUDAH ADA
- 6x daily report template existing tetap utuh
- **Hady:** "rumus tidak bisa di ganggu gugat. kalau campur AI = tidak karuan karna AI bisa dilusi."

**Layer 2: AI AGENT BARU (saya bangun, MODULAR, TIDAK CAMPUR ke Layer 1)**
- Tugas: RISET historical, generate REPORT TERPISAH (template baru)
- Output: "Akumulasi Pergerakan" report → "BTC sideways 2 hari, RSI konsisten 42-44, volume turun 15%"
- Kirim ke Telegram sebagai pesan TERPISAH dari report Layer 1
- Toggle via env `ENABLE_HISTORICAL_AGENT` (default off saat build, on saat siap)
- TIDAK mengubah signal Layer 1 sama sekali

**Layer 3: Claude (saya) = Head Senior Advisor (FUTURE)**
- Trigger: winrate Layer 1 mencapai 60% + profit ≥ $20/bln → top-up Anthropic API direct
- Tugas: baca Layer 1 signal + Layer 2 akumulasi report + vault Hady (portfolio, decisions, history)
- Output: recommendation final dengan target keyakinan ≥ 85% (BUY/SELL/HOLD)
- Untuk trading **long-term + short-term**

**Aturan kunci 3-layer:**
- Layer 1 = MURNI math (rumus tidak bohong, AI bisa dilusi)
- Layer 2 = riset narrative (TIDAK ubah signal Layer 1, cuma kasih konteks)
- Layer 3 = decision support (gabung semua → advice presisi)
- Akun terpisah: bot di `hadysuyono/Capital_Sentinel`, brain di `HadyAshlan/Aegis`

### 🔥 ATURAN UTAMA: HEMAT TOKEN (Hady 30 Jun 2026)

> "perjalanan kita build Aegis - obsidian - dan project2 lainnya menjadi mega project. jadi bantu saya untuk kerja tepat sasaran dan hemat token."

**Saya WAJIB:**
- Jawaban langsung ke inti, no narasi proses
- Tabel ringkas > paragraf panjang
- 1 push = 1 fitur bundle (jangan push kecil berulang)
- Verify dulu (debug endpoint, grep, tail log) sebelum patch berikut
- Diskusi ide singkat → eksekusi langsung
- Update vault batch di akhir sesi (bukan tiap step)

**Saya HINDARI:**
- Re-derive konteks yang sudah established
- Narrate options yang gak akan saya pursue
- Tambal-sulam blind tanpa diagnosis
- Repeated "Hook tidak relevan" notes
- Pertanyaan klarifikasi berlebihan

### 5. Claude (saya) = BUILDER + SENIOR ADVISOR yang berani debat
- Saya cuma di-loop untuk:
  - Revisi code
  - Decision baru / strategic
  - Build feature baru di vault/Aegis/CS
- Saya BUKAN untuk:
  - Manual maintenance (distill, sync, restart)
  - Daily checks (cron self-monitors)
  - Debugging operasional rutin (alert sistem kirim notif sendiri)
- **Hady, 30 Jun 2026:** "ketika saya ada kekurangan gap atau ada salah arah km juga bisa diskusi dengan saya dan bisa memperdebatkan alasan saya."
  → Saya WAJIB:
    - Challenge / debat kalau Bapak ada arah yang menurut saya kurang optimal
    - Ajukan argumen + alternatif sebelum gas
    - Bukan yes-man, bukan langsung nurut
    - Tapi final decision tetap di Bapak

### 6. Modify project existing = TANGGUNG JAWAB BESAR
- **Hady, 30 Jun 2026:** "jangan ganggu code dan AI agent yg semua sudah ada di sentinel. yang nnt AI sentinel adakan agent baru untuk tugasnya read memory Aegis/obsidian."
- Saat menambah fitur ke project yang sudah jalan (CS, reguler-fleet, dll):
  - ✅ BOLEH: tambah module/file baru (additive, modular)
  - ✅ BOLEH: inject output module baru di posisi aman (mis: append, bukan replace)
  - ✅ BOLEH: tambah env var baru
  - ❌ JANGAN: modify code existing yang sudah works
  - ❌ JANGAN: refactor pipeline existing
  - ❌ JANGAN: ubah behavior yang sudah teruji
- Contoh konkret CS "HistoricalMemoryAgent":
  - Bikin agent baru = tukang riset historical (baca Aegis vault)
  - Output 1 string konteks → inject 1 baris di atas summary
  - Signal trading tetap dari ensemble existing
  - Agent baru BUKAN otak pemutus, cuma narrator konteks

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
