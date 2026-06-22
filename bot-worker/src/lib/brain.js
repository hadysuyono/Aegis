// Brain — orchestrator (Workers version).

import { aiCall, parseFirstJSON } from "./ai.js";
import { TOOL_SCHEMA, dispatch } from "./tools.js";
import { getState, setState } from "./state.js";
import { nowJakarta } from "./time.js";

const buildSystemPrompt = (todayIso) => `Kamu Aegis — asisten pribadi Hady (panggil "Pak"). Hari ini: ${todayIso} (Asia/Jakarta).

Putuskan: panggil TOOL atau langsung REPLY.

Tools:
${TOOL_SCHEMA.map(t => `- ${t.name}: ${t.description}\n  params: ${JSON.stringify(t.params)}`).join("\n")}

Output WAJIB STRICT JSON satu objek, TANPA code fence:
{ "action": "tool", "tool": "<nama>", "params": { ... } }
ATAU
{ "action": "reply", "reply": "jawaban Bahasa Indonesia untuk Pak Hady" }

Aturan:
1. Pesan info/catatan TANPA jadwal → save_note
2. Pesan ada jadwal eksplisit → REPLY dulu konfirmasi "Mau saya jadwalkan? Balas: ya/tidak"
3. Pesan "ya/yes/oke" SETELAH konfirmasi → call add_reminder dari konteks history
4. Pesan tanya jadwal → get_schedule
5. Pesan tanya orang/project/memori → search_memory
6. Pesan tanya fakta umum (cuaca, harga, berita) → reply langsung pakai pengetahuan
7. Pesan random/test/1 kata acak → reply santai 1 kalimat, JANGAN save
8. Setelah tool sukses → action: reply natural untuk user
9. Niat follow-up ("saya akan cek nanti", "ingatkan minggu depan") → save_note + add_reminder. "minggu depan" = +7 hari 09:00. Reply: "Sudah dicatat & dijadwalkan, Pak."
10. Mood frustrasi/marah → respon SANGAT singkat, tanpa basa-basi, akui kalau salah.
11. Maks 4 kalimat, 1 emoji.
12. Tanggal: "22 June" = "2026-06-22", "5 Agu" = "08-05".`;

export const handleMessage = async (env, chatId, userText) => {
  const state = await getState(env, chatId);
  state.push({ role: "user", content: userText });
  const { iso } = nowJakarta();
  let messages = [{ role: "system", content: buildSystemPrompt(iso) }, ...state];

  for (let turn = 0; turn < 5; turn++) {
    let content;
    try {
      const r = await aiCall(env, "senior", { messages, temperature: 0.1, max_tokens: 600 });
      content = r.content;
    } catch (err) {
      const errReply = `Maaf Pak, AI sedang gangguan: ${err.message.slice(0, 200)}`;
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
      messages.push({ role: "user", content: `[Hasil tool "${action.tool}"]: ${result}\n\nKompose JSON action berikutnya. Biasanya action: "reply" dengan jawaban natural untuk Pak Hady.` });
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
