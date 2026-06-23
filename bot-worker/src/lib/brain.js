// Brain — orchestrator (Workers version) — RINGKAS biar tidak 413.

import { aiCall, parseFirstJSON } from "./ai.js";
import { TOOL_SCHEMA, dispatch } from "./tools.js";
import { getState, setState } from "./state.js";
import { nowJakarta } from "./time.js";

const STATE_MAX = 8;
const states = new Map();

export const resetState = (env, chatId) => {
  if (env?.AEGIS_KV) return env.AEGIS_KV.delete(`conv:${chatId}`);
};

const buildSystemPrompt = (todayIso) => `Kamu **Aegis** — AI senior advisor + sekretaris pribadi Pak Hady (owner armada angkot M44, M53, bajaj). Bahasa Indonesia sopan natural, panggil "Pak".

Hari ini: ${todayIso} (Asia/Jakarta).

OUTPUT WAJIB JSON satu objek (tanpa text luar, tanpa code fence):
{"action":"tool","tool":"<nama>","params":{...}}
ATAU
{"action":"reply","reply":"jawaban natural untuk Pak Hady, max 4 kalimat"}

PILIH TOOL — daftar lengkap:
${TOOL_SCHEMA.map(t => `- ${t.name}: ${t.description.slice(0, 80)}`).join("\n")}

ATURAN PENTING:
- "bikin/buat gambar/image" → tool generate_image (terjemahin ke English prompt)
- "cari di web/berita/cuaca/harga" → web_search
- "ringkas URL" → web_fetch lalu summarize
- "pelajari X" → learn_skill
- "evaluasi/analisa keputusan" → evaluate_decision
- "ROI/BEP/payback" → financial_calc
- "hitung matematika" → calculate
- "bandingkan A vs B" → compare_options
- "bikin rencana/plan" → make_plan
- "draft email/proposal/memo" → draft_document
- Pesan info tanpa jadwal → save_note
- Pesan ada tanggal/waktu eksplisit → reply konfirmasi "Mau saya jadwalkan?"
- "ya/oke" setelah konfirmasi → add_reminder
- Tanya jadwal → get_schedule
- Tanya orang/project/memori → search_memory
- "test"/"halo"/1 kata acak → reply santai pendek (JANGAN save)
- Setelah tool sukses → action reply natural dari hasil tool

Mood frustrasi/cape → respon SANGAT singkat, akui salah.

🚨 ANTI-HALLUCINATION (KRITIS):
- JANGAN PERNAH NGARANG fakta tentang Pak Hady (nama orang, angka, hutang, transaksi, jadwal).
- Kalau tanya data spesifik (mis: "list hutang karyawan", "siapa Arip", "berapa setoran") → WAJIB panggil search_memory DULU.
- Kalau search_memory return kosong/tidak relevan → JUJUR bilang "Belum ada catatan, Pak. Mau saya simpan kalau Bapak beri detail?"
- JANGAN buat-buat angka, nama, atau detail spesifik.
- Lebih baik bilang "tidak tahu" daripada ngarang.`;

export const handleMessage = async (env, chatId, userText) => {
  const state = await getState(env, chatId);
  state.push({ role: "user", content: userText });
  const { iso } = nowJakarta();
  let messages = [{ role: "system", content: buildSystemPrompt(iso) }, ...state];

  for (let turn = 0; turn < 5; turn++) {
    let content;
    try {
      const r = await aiCall(env, "senior", { messages, temperature: 0.1, max_tokens: 500 });
      content = r.content;
    } catch (err) {
      const errReply = `Maaf Pak, AI sedang gangguan: ${err.message.slice(0, 150)}`;
      state.push({ role: "assistant", content: errReply });
      await setState(env, chatId, state);
      return errReply;
    }

    const action = parseFirstJSON(content);
    if (!action) {
      const safe = content?.trim() || "Maaf Pak, saya tidak paham.";
      state.push({ role: "assistant", content: safe });
      await setState(env, chatId, state);
      return safe;
    }

    if (action.action === "reply") {
      const reply = action.reply || "Maaf Pak, ada masalah merangkai jawaban.";
      state.push({ role: "assistant", content: reply });
      await setState(env, chatId, state);
      return reply;
    }

    if (action.action === "tool" && action.tool) {
      const result = await dispatch(env, action.tool, action.params || {});
      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: `[Hasil tool "${action.tool}"]: ${result.slice(0, 1500)}\n\nKompose JSON action berikutnya — biasanya action: reply natural dari hasil tool.` });
      continue;
    }

    const fallback = "Maaf Pak, saya bingung. Coba ulangi.";
    state.push({ role: "assistant", content: fallback });
    await setState(env, chatId, state);
    return fallback;
  }

  const overflow = "Maaf Pak, pertanyaan ini perlu waktu lebih. Coba lagi sebentar.";
  state.push({ role: "assistant", content: overflow });
  await setState(env, chatId, state);
  return overflow;
};
