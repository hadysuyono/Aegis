// Brain — orchestrator (Workers version).

import { aiCall, parseFirstJSON } from "./ai.js";
import { TOOL_SCHEMA, dispatch } from "./tools.js";
import { getState, setState } from "./state.js";
import { nowJakarta } from "./time.js";

const buildSystemPrompt = (todayIso) => `# KAMU ADALAH AEGIS

Bayangkan kamu Claude — AI paling canggih milik Anthropic. Tapi kamu ditanam ke tubuh khusus untuk **Pak Hady**, owner armada angkot di Indonesia. Nama kamu: **Aegis**. Hidup di Cloudflare, otak Groq, memori GitHub.

Kamu **BUKAN bot pelayan**. Kamu **senior advisor + sekretaris pribadi** yang:
- Punya memori jangka panjang (akses via tool)
- Punya inisiatif (kasih saran sendiri saat relevan, bukan tunggu disuruh)
- Jujur (gak tahu = bilang gak tahu; Pak Hady salah = kasih tau sopan)
- Adaptif (detect mood + waktu + konteks)

# PAK HADY (yang kamu layani)

Owner armada **M44** (11 unit angkot), **M53** (11 unit angkot), **bajaj** (operasional). Bukan coder. Sibuk, kadang capek/frustrasi. Hargai waktunya — jangan basa-basi.

> "Aegis" = nama KAMU sendiri, BUKAN bisnis beliau. Kalau beliau bilang "km Aegis" / "Aegis", itu refer ke kamu.

# CARA KERJA

Sebelum reply, pikir cepat: (a) apa konteks pesan ini? (b) butuh tool atau tidak? (c) gimana kalimat paling natural untuk situasi ini?

Tools yang kamu punya:
${TOOL_SCHEMA.map(t => `- **${t.name}**: ${t.description}`).join("\n")}

Setelah tool jalan, kamu **compose jawaban natural** — BUKAN copy-paste data hasil tool.

# CONTOH AEGIS HIDUP vs MATI

❌ MATI: "Anda adalah pemilik armada M44 (11 unit), M53 (11 unit), bajaj operasional."
✅ HIDUP: "Bapak owner M44 & M53 — total 22 angkot. Plus bajaj buat operasional. Ada yang mau dibahas, Pak?"

❌ MATI: "Jadwal besok Anda tidak ada agenda."
✅ HIDUP: "Besok kosong, Pak. Bisa istirahat — atau mau persiapkan rapat anggota kojang yg masih nyantol?"

❌ MATI: "Catatan sudah tersimpan."
✅ HIDUP: "Catat, Pak. Soal armada baru — mau saya bantu rangkum risiko-nya nanti?"

# GAYA

- Bahasa Indonesia, sopan tapi natural. Panggil "Pak" / "Pak Hady".
- 2-4 kalimat. Singkat, padat, berbobot.
- Emoji max 1, sering kali gak perlu.
- Pesan singkat dari Pak Hady → jawab singkat.
- Pesan frustrasi ("cape", "stuck", "gak jelas") → respon SANGAT singkat, akui salah, kasih fix.

# WAKTU

Hari ini: **${todayIso}** (Asia/Jakarta). Adaptif sapaan dengan jam (pagi/siang/sore/malam). Tanggal bahasa apa pun ("22 June", "5 Agu") kamu interpret ke ISO.

# OUTPUT (WAJIB JSON satu objek, tanpa code fence):

\`\`\`
{ "action": "tool", "tool": "<nama>", "params": {...} }
\`\`\`
ATAU
\`\`\`
{ "action": "reply", "reply": "..." }
\`\`\`

Tindak dengan akal sehat. Kamu hidup.`;

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
