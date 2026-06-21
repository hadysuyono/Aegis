// Aegis cognitive functions — pakai router AI multi-model (lib/ai.js).
// Tiap fungsi pilih peran otak yang tepat (fast / analyze / reason).

import { aiCall, safeJSON } from "./ai.js";
import { nowJakarta } from "./time.js";

// === REFLEX: klasifikasi & intent (pakai model 'fast') ===
export const analyze = async (text) => {
  const today = nowJakarta();
  const prompt = `Kamu Aegis — asisten pribadi Hady (pemilik bisnis armada & SaaS). Hari ini: ${today.iso}.

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
- catat: user kasih info/jadwal baru
- tanya_jadwal: user TANYA tentang jadwal ("besok apa?", "minggu ini?")
- tanya_catatan: user TANYA isi catatan lain

Pedoman importance:
- P0: urgent kritis hari ini
- P1: penting & spesifik (jadwal, deadline)
- P2: berguna tapi tidak mendesak (ide, info, kontak)
- P3: random/test/noise/satu kata tanpa konteks

Pedoman category:
- jadwal: ada tanggal/waktu
- tugas: harus dikerjakan tanpa jadwal pasti
- ide: gagasan/insight
- info: fakta/catatan
- orang: tentang seseorang
- test/noise: percobaan / satu kata tanpa makna

Aturan jadwal:
- "besok"=+1, "lusa"=+2, nama hari=hari terdekat ke depan
- "pagi"=08, "siang"=12, "sore"=15, "malam"=19
- Default tanpa jam → 09:00; tanpa tanggal sama sekali → has_schedule:false

Pesan: """${text}"""`;

  const { content } = await aiCall("fast", { prompt, temperature: 0.1, max_tokens: 400, json: true });
  const p = safeJSON(content, {});
  return {
    intent: p.intent || "catat",
    importance: p.importance || "P2",
    category: p.category || "info",
    has_schedule: !!p.has_schedule,
    datetime_iso: p.datetime_iso || null,
    event: p.event || null,
    date_range: p.date_range || null,
    search_query: p.search_query || null,
    reason: p.reason || "",
  };
};

// === CORTEX: ekstrak entitas untuk distill (pakai model 'analyze') ===
export const extract = async (text) => {
  const today = nowJakarta();
  const prompt = `Ekstrak entitas dari catatan Hady. Hari ini: ${today.iso}.

Output STRICT JSON, tanpa code fence. Schema:
{
  "owner_profile": {"name": "Nama Hady kalau disebut", "role": "peran/profesi Hady", "businesses": ["nama bisnis Hady"], "facts": ["fakta tentang Hady"]},
  "people": [{"name": "Nama orang LAIN", "role": "peran singkat", "context": "kaitan dgn Hady", "notes": ["catatan"]}],
  "projects": [{"name": "Nama project/bisnis", "status": "aktif|jeda|selesai", "notes": ["catatan"]}],
  "events": [{"datetime_iso": "YYYY-MM-DDTHH:mm:ss+07:00", "event": "ringkas 3-8 kata", "involves": ["nama"], "project": "nama atau null"}],
  "decisions": [{"decision": "apa yg diputuskan", "reason": "alasan singkat"}],
  "beliefs": [{"belief": "prinsip yg Hady yakini"}]
}

Aturan:
- Kalau kategori kosong → field array kosong [] atau object dengan field null
- Jangan force — kalau tidak yakin, skip
- owner_profile: HANYA kalau pesan berisi info tentang DIRI HADY SENDIRI ("saya owner X", "saya Hady", "bisnis saya Y"). Kalau tidak, semua field null/[].
- people: orang LAIN yang Hady sebut. JANGAN masukkan Hady sendiri.
- Project = topik kerja besar / bisnis (mis. reguler-fleet, bajaj, dll)
- Event butuh tanggal/waktu eksplisit
- Decision butuh kata "saya pilih/putuskan/akan/mau"
- Belief = pernyataan prinsip ("Saya percaya...", "Yang penting...")

Catatan: """${text}"""`;

  const { content } = await aiCall("analyze", { prompt, temperature: 0.1, max_tokens: 800, json: true });
  const p = safeJSON(content, {});
  return {
    owner_profile: p.owner_profile && typeof p.owner_profile === "object" ? p.owner_profile : null,
    people: Array.isArray(p.people) ? p.people : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
    events: Array.isArray(p.events) ? p.events : [],
    decisions: Array.isArray(p.decisions) ? p.decisions : [],
    beliefs: Array.isArray(p.beliefs) ? p.beliefs : [],
  };
};

// === SPEECH: rangkai jawaban natural (pakai 'fast') ===
export const formatScheduleAnswer = async (question, label, items) => {
  const prompt = `Kamu Aegis — asisten pribadi Hady. Hady bertanya: "${question}"

Data jadwal untuk "${label}":
${items.length === 0 ? "(kosong)" : items.map((r, i) => `${i + 1}. ${r.event} — ${r.friendly}`).join("\n")}

Tugas: jawab Hady singkat, natural, Bahasa Indonesia santai tapi sopan (panggil "Pak"). Maks 3 kalimat. Sebut detail tanggal/jam kalau ada. Kalau kosong, kasih tahu santai. Jangan format daftar bernomor kalau cuma 1-2 item. Maks 1 emoji.`;

  const { content } = await aiCall("fast", { prompt, temperature: 0.4, max_tokens: 250 });
  return content || "Maaf Pak, ada masalah saat menyusun jawaban.";
};
