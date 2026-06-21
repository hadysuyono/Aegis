// Tool registry — semua kemampuan Aegis sebagai fungsi yang brain bisa panggil.
// Tiap tool: input params (validated) → output JSON-serializable.

import { saveToFile } from "./capture.js";
import { distillText } from "./distill.js";
import { addReminder, listActive, removeReminder } from "./reminders.js";
import { answerSchedule } from "./query.js";
import { answerCatatan } from "./recall.js";
import { nowJakarta } from "./time.js";

// Schema yang brain baca → tahu params apa yang harus dia kirim
export const TOOL_SCHEMA = [
  {
    name: "save_note",
    description: "Simpan catatan/info baru ke inbox. Pakai untuk pesan tanpa jadwal (ide, info, fakta).",
    params: { text: "string isi catatan", importance: "P0|P1|P2 (jangan P3 untuk tool ini)", category: "ide|tugas|info|orang" },
  },
  {
    name: "get_schedule",
    description: "Ambil jadwal Hady untuk periode tertentu. Pakai saat Hady tanya 'besok jadwal apa', 'minggu ini ada apa', dll.",
    params: { range: "hari_ini|besok|lusa|minggu_ini|minggu_depan|bulan_ini" },
  },
  {
    name: "add_reminder",
    description: "Buat reminder/jadwal baru. PENTING: harus reply user konfirmasi DULU sebelum panggil tool ini (kecuali user sudah jelas approve).",
    params: { datetime_iso: "YYYY-MM-DDTHH:mm:ss+07:00", event: "ringkas 3-8 kata", source: "pesan asli user" },
  },
  {
    name: "search_memory",
    description: "Cari di memori Aegis (profil owner, orang, project, decision, belief). Pakai saat user tanya 'siapa X', 'project apa', 'saya pernah catat soal Y'.",
    params: { query: "pertanyaan user" },
  },
  {
    name: "list_reminders",
    description: "Lihat semua reminder aktif. Pakai saat user ketik /list atau tanya 'apa saja reminder aktif'.",
    params: {},
  },
  {
    name: "remove_reminder",
    description: "Hapus reminder by ID. ID didapat dari list_reminders.",
    params: { id: "string ID reminder" },
  },
];

const J = (obj) => JSON.stringify(obj);
const validP = ["P0", "P1", "P2"];
const validCat = ["ide", "tugas", "info", "orang", "jadwal"];
const validRange = ["hari_ini", "besok", "lusa", "minggu_ini", "minggu_depan", "bulan_ini"];

export const dispatch = async (toolName, params = {}) => {
  try {
    switch (toolName) {
      case "save_note": {
        if (!params.text || params.text.length < 3) return J({ error: "text terlalu pendek" });
        const importance = validP.includes(params.importance) ? params.importance : "P2";
        const category = validCat.includes(params.category) ? params.category : "info";
        const { date, time, iso } = nowJakarta();
        const path = `00-INBOX/${date}-${time}.md`;
        const front = `created: ${iso}\nsource: telegram\nimportance: ${importance}\ncategory: ${category}`;
        const body = `---\n${front}\n---\n\n${params.text}\n`;
        await saveToFile(path, body, `inbox: ${date}-${time}`);
        // Trigger distill async (non-blocking)
        distillText(params.text, path.split("/").pop()).catch(e => console.error("[tool save_note] distill fail:", e.message));
        return J({ ok: true, saved_to: path });
      }
      case "get_schedule": {
        const range = validRange.includes(params.range) ? params.range : "besok";
        const answer = await answerSchedule(`Ambil jadwal ${range}`, range);
        return J({ ok: true, summary: answer });
      }
      case "add_reminder": {
        if (!params.datetime_iso || !params.event) return J({ error: "datetime_iso dan event wajib" });
        const r = await addReminder({
          datetime_iso: params.datetime_iso,
          event: params.event,
          source: params.source || params.event,
        });
        return J({ ok: true, id: r.id, friendly: r.friendly });
      }
      case "search_memory": {
        if (!params.query) return J({ error: "query wajib" });
        const ans = await answerCatatan(params.query);
        return J({ ok: true, answer: ans });
      }
      case "list_reminders": {
        const items = await listActive();
        return J({ ok: true, count: items.length, items: items.slice(0, 20).map(r => ({ id: r.id, event: r.event, datetime_iso: r.datetime_iso })) });
      }
      case "remove_reminder": {
        if (!params.id) return J({ error: "id wajib" });
        const ok = await removeReminder(params.id);
        return J({ ok, removed: ok });
      }
      default:
        return J({ error: `tool "${toolName}" tidak dikenal` });
    }
  } catch (err) {
    console.error(`[tool ${toolName}] error:`, err.message);
    return J({ error: err.message });
  }
};
