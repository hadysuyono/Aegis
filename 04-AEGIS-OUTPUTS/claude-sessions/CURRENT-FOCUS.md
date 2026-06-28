# CURRENT FOCUS — Claude ↔ Hady

> File hidup. Update tiap akhir sesi besar.
> Format: ringkas, scan-able dalam 30 detik.

**Last updated:** 2026-06-29 (akhir sesi malam — Hady istirahat)

---

## 🎯 Topik Aktif Sekarang

**Capital Sentinel memory architecture** — bangun mirror report ke Obsidian + narrative memory lintas-hari. **BELUM eksekusi**, tunggu winrate 60%.

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

## 🔐 Aturan Push (mulai 2026-06-29)

Tiap mau `git push`, saya WAJIB announce dulu:
```
📤 Push ke github.com/<akun>/<repo>
   Folder: <path>
   Lanjut? [Y/N]
```
Bapak konfirmasi → baru gas. **Akun mapping:**
- `HadyAshlan/Aegis` — folder `C:\Users\HP\Project Aegis\`
- `hadysuyono/Capital_Sentinel` — folder Capital Sentinel di session Claude.ai

## 🟡 Open Loops (belum tuntas)

1. **Capital Sentinel memory via Obsidian** — rancangan sudah jelas:
   - Hook di akhir `_run_report()` → tulis markdown ke `08-PROJECT-FEEDS/capital-sentinel/reports/YYYY-MM-DD.md`
   - Tambah `narrative_memory.py` → baca 2-3 file terakhir → kasih konteks "sudah X hari di angka Y" di header
   - Template visual existing TIDAK diubah
   - **Trigger eksekusi:** setelah winrate 60% + profit ≥ $20/bln
2. **AI privacy Aegis Telegram** — sepakat pindah ke Cloudflare Workers AI (free + no training). BELUM eksekusi.
3. **TODO STATE.md Aegis** — 5 item pending (wire audit.js, redactMemory di cron, hapus dead code compound, /audit command, test e2e tools).
4. **Capture Processor cron stagnant 24 Jun** — perlu cek log Cloudflare Observability.
5. **Capital Sentinel** — Phase 0 observe, posisi BTC -3.7%. Tunggu signal swing.

## ⏳ Pending Decision (menunggu Bapak)

- Belum ada — semua keputusan menunggu eksekusi (bukan diskusi baru).

## 📌 Konvensi Komunikasi (penting!)

- **Mode super hemat token** — quota $20/bulan ketat. Jawaban ringkas, no narasi proses.
- **Hady tidak coding** — saya yang eksekusi, Bapak yang arahkan.
- **Tangkap sinyal** — kalau Bapak bilang "biasanya begini", itu ekspektasi behavior, BUKAN info teknis. Konfirmasi dulu sebelum lompat ke fix.
- **Audit sendiri** sebelum lapor selesai.
- **Push HARUS announce dulu** (lihat Aturan Push di atas).

## 📝 Last Conversation Summary (sesi 29 Jun malam)

1. Setup struktur second brain Obsidian (5 project page + CURRENT-FOCUS + update CLAUDE.md urutan baca)
2. Push commit `6f34de3` ke `HadyAshlan/Aegis` ✅
3. Sepakat aturan push: WAJIB announce akun+folder dulu (Bapak punya 2 akun GitHub, takut salah pilih)
4. Konfirmasi GitHub free unlimited private repo — Aegis & Capital Sentinel aman free selamanya
5. Diskusi Capital Sentinel butuh memory via Obsidian → cek template existing dulu di `crypto_advisor/` (session Claude.ai)
6. Confirmed: 6x daily report WIB 07/11/15/19/23/03 + alert 24/7. Template di `formatter/message.py` (1389 baris), schedule di `scheduler/jobs.py` baris 1087
7. Rancangan memory: mirror report markdown ke vault + narrative_memory.py untuk konteks lintas-hari. TIDAK ubah template visual.

## 🗺️ Next Action (besok)

- [ ] **Bapak putuskan:** A) saya update vault (`02-PROJECTS/capital-sentinel.md` + push), atau B) topik lain
- [ ] (Kalau A) push ke `HadyAshlan/Aegis` dengan announce dulu
- [ ] Pending: AI privacy migration (Z.AI → Cloudflare Workers AI) — kalau Bapak sudah siap
