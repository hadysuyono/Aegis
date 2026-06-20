# 08-PROJECT-FEEDS

Laporan READ-ONLY dari tiap project ke Aegis.

## Aturan
- Tiap project tulis laporan harian sendiri di subfolder masing-masing.
- Aegis hanya BACA folder ini. Tidak pernah edit/hapus.
- Format file: `YYYY-MM-DD.md` (1 file per hari).

## Template (semua project pakai struktur ini)
```markdown
# [Project] — YYYY-MM-DD

## Siapa Login
- Nama (HH:MM)

## Inputan Hari Ini
- Ringkasan transaksi (count, total nominal)

## Issue / Anomaly
- (kalau ada)

## Open Loops
- (yang perlu perhatian Hady)
```

## Catatan per project
- **reguler-fleet** — operasional armada Hady
- **bajaj-fleet** — auto 3 owner (P/E/Y)
- **3s-smartsystem** — SaaS; HANYA level admin (billing langganan), BUKAN data internal customer
- **capital-sentinel** — bot kripto Telegram
