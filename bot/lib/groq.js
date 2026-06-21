// Groq analyzer — analisis pesan: importance + kategori + jadwal (1 call hemat token)

import Groq from "groq-sdk";
import { nowJakarta } from "./time.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const buildPrompt = (text) => {
  const today = nowJakarta();
  return `Kamu Aegis — asisten pribadi Hady (pemilik bisnis armada & SaaS). Hari ini: ${today.iso}.

Analisis pesan dari Hady. Output STRICT JSON, tanpa code fence, tanpa penjelasan tambahan.

Schema:
{
  "intent": "catat|tanya_jadwal|tanya_catatan",
  "importance": "P0|P1|P2|P3",
  "category": "jadwal|ide|tugas|info|orang|test|noise",
  "has_schedule": boolean,
  "datetime_iso": "YYYY-MM-DDTHH:mm:ss+07:00" atau null,
  "event": "ringkas 3-8 kata" atau null,
  "date_range": "hari_ini|besok|lusa|minggu_ini|minggu_depan|bulan_ini" atau null,
  "search_query": "kata kunci kalau tanya_catatan" atau null,
  "reason": "1 kalimat singkat alasan klasifikasi"
}

Pedoman intent:
- catat: user kasih info/jadwal baru ("besok jam 10 meeting", "ide bisnis baru")
- tanya_jadwal: user TANYA tentang jadwal ("jadwal besok apa?", "minggu ini ada apa?", "hari ini saya ngapain?", "ada apa lusa?")
- tanya_catatan: user TANYA isi catatan lain ("saya pernah catat soal X?", "siapa orang yang saya tulis kemarin?", "ide apa yang saya simpan minggu lalu?")

Pedoman importance:
- P0: urgent kritis hari ini (rapat bos, bayar tagihan jatuh tempo)
- P1: penting & spesifik (jadwal meeting, deadline, decision)
- P2: berguna tapi tidak mendesak (ide bisnis, info, kontak orang)
- P3: random/test/noise/tidak bermakna (mis. "tes", "halo", "abc", "asdf", coba-coba)

Pedoman category:
- jadwal: ada tanggal/waktu eksplisit/implisit
- tugas: yang harus dikerjakan tapi tanpa jadwal pasti
- ide: gagasan bisnis/insight/refleksi
- info: fakta/data/catatan
- orang: catatan tentang seseorang (nama, kontak, hubungan)
- test: percobaan bot ("test", "tes", "ping", kata acak)
- noise: emoji doang, satu kata tanpa konteks, spam

Aturan jadwal:
- "besok" = +1 hari, "lusa" = +2 hari, nama hari = hari terdekat ke depan
- "pagi"=08:00, "siang"=12:00, "sore"=15:00, "malam"=19:00
- "jam 10" tanpa AM/PM → 10:00
- Tanpa waktu spesifik → default 09:00
- Tanpa tanggal sama sekali → has_schedule: false, datetime_iso & event = null

Pesan Hady:
"""${text}"""`;
};

export const analyze = async (text) => {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: buildPrompt(text) }],
    temperature: 0.1,
    max_tokens: 400,
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content?.trim() || "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      intent: parsed.intent || "catat",
      importance: parsed.importance || "P2",
      category: parsed.category || "info",
      has_schedule: !!parsed.has_schedule,
      datetime_iso: parsed.datetime_iso || null,
      event: parsed.event || null,
      date_range: parsed.date_range || null,
      search_query: parsed.search_query || null,
      reason: parsed.reason || "",
    };
  } catch {
    return { intent: "catat", importance: "P2", category: "info", has_schedule: false, reason: "parse error" };
  }
};
