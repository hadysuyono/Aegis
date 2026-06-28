# reguler-fleet 🟢 aktif

> Operasional armada reguler (M44 + M53). React SPA + Supabase.

**Last activity:** 2026-06-29 (cek terakhir)

---

## 🎯 Goal & Vision

Aplikasi internal untuk karyawan kelola cashflow, setoran, pengeluaran, dan service armada — 23+ hari operasional dengan data real.

## 🏗️ Stack & Lokasi

- **Local:** `C:\Users\HP\reguler-fleet\`
- **Frontend:** React (SPA, 1 file `src/App.jsx`)
- **Backend:** Supabase (RLS disabled, anon key bisa write)
- **Deploy:** Vercel (`vercel --prod`)
- **Rules detail:** `C:\Users\HP\reguler-fleet\CLAUDE.md`

## 🚨 Constraint

- ❌ JANGAN rusak flow: cashflow → pengeluaran → setoran ke bank
- ❌ JANGAN ubah logika COH, PettyCash, cicilan, verifikasi
- ❌ JANGAN campur kode bajaj-fleet ke sini

## ✅ Status Terkini (2026-06-29)

- **Karyawan aktif:** Esra (input shift malam), Apri (verifikasi siang)
- **Divisi:** M44 + M53
- **Fitur stabil:** cashflow, KS tracker, setoran bank, service history, checklist harian, tutup buku, auto-update detection
- **Security:** RLS disabled (custom auth via sessionStorage `rf_user`). Migrasi Supabase Auth = ditunda (Bapak: "cukup paham dulu")

## 📋 Next Action

- (kosong — Bapak belum ada perintah)

## 🟡 Open Loops

- Hardening security (Supabase Auth) — ditunda indefinitely
- Backup procedure manual via Pengaturan → Excel/JSON (sudah jalan)

## 📜 Recent Decisions

- 2026-06-15: Idempotent insert via unique index `cashflow(div, created_at)` + `on_conflict ignore-duplicates` → fix dobel/hilang saat koneksi jelek
- 2026-06-15: KS replace mode HANYA kalau ada logKS cocok (cegah KS pembayaran langsung kehapus saat "Selesai")
- 2026-06-10: Recovery duplikat massal M53 (43 baris) + pasang guard anti-duplikat di 3 jalur tulis
- 2026-06-09: Bug UUID `ks_logs.id` ditemukan + fix → KS tersimpan benar
- 2026-06-04: RLS migration ditunda — Bapak prefer pertahankan login custom

## 🔗 Links

- `08-PROJECT-FEEDS/reguler-fleet/` (laporan harian ke Aegis — masih kosong, belum ada feed)
- Backup snapshot: `C:\Users\HP\reguler-fleet\backup\YYYYMMDD\`
