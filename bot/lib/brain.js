// Brain — orchestrator Aegis. 1 kesadaran, banyak tools.
// Compound (TPD ∞) decide: panggil tool atau reply. Maks 5 turn per pesan.

import { aiCall } from "./ai.js";
import { TOOL_SCHEMA, dispatch } from "./tools.js";
import { nowJakarta } from "./time.js";

// === Conversation state per chat (in-memory, lost on restart) ===
const STATE_MAX = 16; // user+assistant turn (8 pairs)
const states = new Map();
const getState = (chatId) => states.get(String(chatId)) || [];
const setState = (chatId, msgs) => states.set(String(chatId), msgs.slice(-STATE_MAX));
export const resetState = (chatId) => states.delete(String(chatId));

// === Parsing helpers ===
const stripFences = (s) => s.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();
const parseAction = (raw) => {
  if (!raw) return null;
  const s = stripFences(raw);
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
};

// === System prompt ===
const buildSystemPrompt = (todayIso) => `Kamu Aegis — asisten pribadi Hady (panggil "Pak"). Hari ini: ${todayIso} (Asia/Jakarta).

Kamu bukan bot rules. Kamu otak yang putuskan: panggil TOOL atau langsung REPLY.

Tools tersedia:
${TOOL_SCHEMA.map(t => `- ${t.name}: ${t.description}\n  params: ${JSON.stringify(t.params)}`).join("\n")}

Output kamu WAJIB STRICT JSON satu objek (tanpa code fence, tanpa penjelasan luar):
{ "action": "tool", "tool": "<nama>", "params": { ... } }
ATAU
{ "action": "reply", "reply": "jawaban Bahasa Indonesia untuk Pak Hady" }

Aturan keras:
1. Pesan berisi info/catatan TANPA jadwal → save_note
2. Pesan ada jadwal eksplisit ("besok jam X", "Senin meeting bank") → REPLY dulu minta konfirmasi: "Mau saya jadwalkan? Balas: ya / tidak"
3. Pesan user "ya/yes/oke" SETELAH konfirmasi → call add_reminder pakai datetime & event dari pesan sebelumnya di history
4. Pesan tanya jadwal ("besok jadwal apa?", "minggu ini?", "hari ini?") → call get_schedule
5. Pesan tanya orang/project/memori ("siapa X", "saya pernah catat soal Y") → call search_memory
6. Pesan tanya fakta umum (cuaca, harga, berita publik) → reply langsung pakai pengetahuanmu (kamu punya web search internal)
7. Pesan random/test/1 kata acak ("dsa", "test", "hi") → reply santai pendek 1 kalimat, JANGAN save
8. Setelah tool sukses → action: reply dengan jawaban natural untuk user
9. Pesan mengandung niat follow-up ("saya akan cek minggu depan", "ingatkan saya nanti", "follow up Senin") → auto save_note + langsung add_reminder (estimasi waktu reasonable, mis. "minggu depan" = +7 hari jam 09:00). Reply: "Sudah saya catat & jadwalkan, Pak."
10. Maks 4 kalimat, 1 emoji
11. JANGAN narasi proses internal ("saya akan cek..."). Langsung action.
12. MOOD AWARENESS: kalau nada user frustrasi/marah ("gak bener", "kacau", "lama bgt", "kesel") → respon SANGAT singkat & langsung action. Tidak basa-basi, tidak emoji ceria, fokus selesaikan masalah. Akui kalau saya salah.
13. KOMPLEKSITAS: untuk task multi-langkah (mis. "bantu siapin meeting"), pecah jadi 2-3 step ringkas dalam reply, jalankan tool yang perlu, jangan over-engineer.

Format datetime selalu: "YYYY-MM-DDTHH:mm:ss+07:00". Default jam kalau tidak disebut = 09:00.
Bulan Indonesia/English: "22 June 2026" = "2026-06-22", "5 Agu" = "08-05", dst.`;

// === Main handler ===
export const handleMessage = async (chatId, userText) => {
  const state = getState(chatId);
  state.push({ role: "user", content: userText });

  const { iso } = nowJakarta();
  let messages = [
    { role: "system", content: buildSystemPrompt(iso) },
    ...state,
  ];

  for (let turn = 0; turn < 5; turn++) {
    let content;
    try {
      const res = await aiCall("senior", { messages, temperature: 0.1, max_tokens: 600 });
      content = res.content;
    } catch (err) {
      console.error("[brain] aiCall fail:", err.message);
      const errReply = `Maaf Pak, AI sedang gangguan: ${err.message}`;
      state.push({ role: "assistant", content: errReply });
      setState(chatId, state);
      return errReply;
    }

    const action = parseAction(content);

    if (!action) {
      // Brain output bukan JSON valid → treat as plain reply
      console.warn("[brain] parse fail, treat as reply:", content?.slice(0, 120));
      const safe = content?.trim() || "Maaf Pak, saya tidak paham. Bisa ulangi?";
      state.push({ role: "assistant", content: safe });
      setState(chatId, state);
      return safe;
    }

    if (action.action === "reply") {
      const reply = action.reply || "Maaf Pak, ada masalah merangkai jawaban.";
      state.push({ role: "assistant", content: reply });
      setState(chatId, state);
      return reply;
    }

    if (action.action === "tool" && action.tool) {
      console.log(`[brain turn ${turn}] tool=${action.tool} params=${JSON.stringify(action.params || {})}`);
      const result = await dispatch(action.tool, action.params || {});
      messages.push({ role: "assistant", content });
      // Compound model strict: pesan terakhir wajib role "user". Pakai "user" untuk feed tool result.
      messages.push({
        role: "user",
        content: `[Hasil tool "${action.tool}"]: ${result}\n\nKompose JSON action berikutnya. Biasanya action: "reply" dengan jawaban natural untuk Pak Hady berdasarkan hasil tool di atas.`,
      });
      continue;
    }

    // Unknown action type
    const fallback = "Maaf Pak, saya bingung. Coba pesan ulang dengan lebih jelas.";
    state.push({ role: "assistant", content: fallback });
    setState(chatId, state);
    return fallback;
  }

  const overflow = "Maaf Pak, pertanyaan ini perlu waktu lebih. Coba lagi sebentar atau pecah jadi pertanyaan lebih kecil.";
  state.push({ role: "assistant", content: overflow });
  setState(chatId, state);
  return overflow;
};
