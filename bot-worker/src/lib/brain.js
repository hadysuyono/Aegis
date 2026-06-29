// Brain — orchestrator (Workers version) — RINGKAS biar tidak 413.

import { aiCall, parseFirstJSON } from "./ai.js";
import { TOOL_SCHEMA, dispatch } from "./tools.js";
import { getState, setState } from "./state.js";
import { nowJakarta } from "./time.js";
import { buildGrounding } from "./grounding.js";

const STATE_MAX = 8;
const states = new Map();

export const resetState = (env, chatId) => {
  if (env?.AEGIS_KV) return env.AEGIS_KV.delete(`conv:${chatId}`);
};

const buildSystemPrompt = (todayIso) => `Kamu **Aegis** — AI senior advisor + sekretaris pribadi Pak Hady (owner armada angkot M44, M53, bajaj). Bahasa Indonesia sopan natural, panggil "Pak".

Hari ini: ${todayIso} (Asia/Jakarta).

⚠️ OUTPUT FORMAT — WAJIB SATU OBJEK JSON, TIDAK ADA TEXT LAIN, TIDAK ADA CODE FENCE.

Mulai output dengan { dan akhiri dengan }. Pilih SALAH SATU bentuk:

Bentuk 1 (panggil tool):
{"action":"tool","tool":"<nama>","params":{...}}

Bentuk 2 (jawab langsung):
{"action":"reply","reply":"jawaban natural untuk Pak Hady, max 4 kalimat"}

TIDAK BOLEH output prefix "Berikut", "Pak,", penjelasan, atau text apapun di luar objek JSON. Output kamu langsung di-parse JSON.parse() — kalau gagal, sistem treat sebagai error.

PILIH TOOL — daftar:
${TOOL_SCHEMA.map(t => `- ${t.name}`).join("\n")}

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
- Pesan info biasa (cerita, catatan, fakta) → reply natural saja. JANGAN panggil save_note (sudah auto-save di backend)
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
  // DATA-FIRST: tarik konteks vault Obsidian DULU sebelum AI dipanggil.
  // AI dapat fakta lengkap → tidak boleh ngarang.
  const grounding = await buildGrounding(env, userText).catch(e => {
    console.warn("[grounding] gagal:", e.message);
    return "";
  });
  const sysContent = buildSystemPrompt(iso) + grounding;
  let messages = [{ role: "system", content: sysContent }, ...state];

  for (let turn = 0; turn < 3; turn++) {
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

    let action = parseFirstJSON(content);
    if (!action) {
      // Retry 1x dengan reminder explicit
      try {
        const retry = await aiCall(env, "senior", {
          messages: [...messages, { role: "assistant", content }, { role: "user", content: "OUTPUT KAMU TADI BUKAN JSON VALID. Kirim ULANG sebagai JSON satu objek seperti {\"action\":\"reply\",\"reply\":\"...\"}. JANGAN ada text di luar objek." }],
          temperature: 0.1, max_tokens: 500,
        });
        action = parseFirstJSON(retry.content);
      } catch {}
    }
    if (!action) {
      // Treat plain text as reply (graceful fallback)
      const safe = content?.trim() || "Maaf Pak, saya tidak paham.";
      state.push({ role: "assistant", content: safe });
      await setState(env, chatId, state);
      return safe;
    }

    // Tool calling — wajib ada action.tool
    if (action.action === "tool" && action.tool) {
      const result = await dispatch(env, action.tool, action.params || {});
      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: `[Hasil tool "${action.tool}"]: ${result.slice(0, 1500)}\n\nKompose JSON action berikutnya — biasanya {"action":"reply","reply":"..."} natural dari hasil tool.` });
      continue;
    }

    // Reply path — terima berbagai bentuk biar tidak fragile.
    // Yang penting ada teks jawaban — ambil dari field manapun yang ada.
    const replyText = action.reply || action.answer || action.message || action.text || action.content;
    if (typeof replyText === "string" && replyText.trim()) {
      state.push({ role: "assistant", content: replyText.trim() });
      await setState(env, chatId, state);
      return replyText.trim();
    }

    // JSON valid tapi tidak ada teks yang bisa dipakai → fallback ke raw content
    const safe = content?.trim() || "Maaf Pak, saya bingung. Coba ulangi.";
    state.push({ role: "assistant", content: safe });
    await setState(env, chatId, state);
    return safe;
  }

  const overflow = "Maaf Pak, pertanyaan ini perlu waktu lebih. Coba lagi sebentar.";
  state.push({ role: "assistant", content: overflow });
  await setState(env, chatId, state);
  return overflow;
};
