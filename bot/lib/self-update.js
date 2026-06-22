// Self-update layer: Aegis introspect & saran update operating doc + improvement prompt.
// Output → 04-AEGIS-OUTPUTS/self-tuning/. Tidak auto-write CLAUDE.md (Hady review dulu).

import { aiCall } from "./ai.js";
import { readJSON, readText, writeFile } from "./store.js";
import { nowJakarta } from "./time.js";

export const generateClaudeMdSuggestion = async () => {
  const today = nowJakarta();
  const [feedbackDoc, ownerDoc, projDoc, belDoc, decDoc, currentClaude] = await Promise.all([
    readJSON("07-SYSTEM/feedback.json", { items: [] }),
    readJSON("07-SYSTEM/memory/owner.json", {}),
    readJSON("07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON("07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
    readJSON("07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readText("CLAUDE.md"),
  ]);

  const feedbackTally = { up: 0, down: 0, bySource: {} };
  for (const f of feedbackDoc.items || []) {
    feedbackTally[f.rating]++;
    feedbackTally.bySource[f.source] ||= { up: 0, down: 0 };
    feedbackTally.bySource[f.source][f.rating]++;
  }

  const prompt = `Kamu Aegis. Review operating doc Bapak Hady (CLAUDE.md) berdasarkan data terbaru. Saran update yang RINGKAS.

CLAUDE.md sekarang (excerpt 1000 char pertama):
"""
${(currentClaude || "(belum ada)").slice(0, 1000)}
"""

Data Pak Hady saat ini:
- Profil: ${JSON.stringify(ownerDoc)}
- ${(projDoc.projects || []).filter(p => p.status === "aktif").length} project aktif
- ${(belDoc.beliefs || []).length} belief
- ${(decDoc.decisions || []).length} decision

Feedback ringkasan: 👍 ${feedbackTally.up} • 👎 ${feedbackTally.down}
${Object.entries(feedbackTally.bySource).map(([s, c]) => `  ${s}: 👍${c.up}/👎${c.down}`).join("\n")}

Tugas (format Markdown, total 300 kata max):
## 📝 Update Saran untuk CLAUDE.md

### Yang Bagus (jangan diubah)
(2-3 hal yang work)

### Yang Perlu Tambah
(1-2 section atau detail baru yang reflect Hady saat ini)

### Yang Perlu Revisi
(1-2 bagian yang outdated atau bertentangan dgn data)

### Patch yang Saya Saran
(berikan diff conceptual: section X jadi Y)

Jujur, jangan dipaksa kalau tidak ada saran kuat.`;

  const { content } = await aiCall("reason", { prompt, temperature: 0.3, max_tokens: 700 });
  const path = `04-AEGIS-OUTPUTS/self-tuning/${today.date}-claude-md-suggestion.md`;
  const body = `---\ncreated: ${today.iso}\nsource: self_update\n---\n\n${content}\n`;
  await writeFile(path, body, `self-tuning: claude.md suggestion ${today.date}`);
  return { path, snippet: content.slice(0, 400) };
};

export const generateFeedbackDigest = async () => {
  const today = nowJakarta();
  const feedbackDoc = await readJSON("07-SYSTEM/feedback.json", { items: [] });
  const items = feedbackDoc.items || [];
  if (items.length === 0) return { skipped: true };

  const recent = items.slice(-50);
  const bySource = {};
  for (const f of recent) {
    bySource[f.source] ||= { up: 0, down: 0 };
    bySource[f.source][f.rating]++;
  }

  const problematic = Object.entries(bySource).filter(([_, c]) => c.down > c.up).map(([s, c]) => `${s}: 👎${c.down} > 👍${c.up}`);

  const prompt = `Kamu Aegis. Analisis feedback Pak Hady (50 terakhir):

Per source:
${Object.entries(bySource).map(([s, c]) => `- ${s}: 👍${c.up} | 👎${c.down}`).join("\n")}

Sources problematik:
${problematic.join("\n") || "(tidak ada)"}

Tugas (300 kata max):
## 📊 Feedback Digest

### Pola
(apa yang muncul dari data)

### Sumber Bermasalah
(source mana yang downvote tinggi & kemungkinan penyebab)

### Saran Tuning Prompt
(usulan revisi prompt internal untuk source yang downvote)

Jujur dan to-the-point.`;

  const { content } = await aiCall("reason", { prompt, temperature: 0.3, max_tokens: 500 });
  const path = `04-AEGIS-OUTPUTS/self-tuning/${today.date}-feedback-digest.md`;
  const body = `---\ncreated: ${today.iso}\nsource: feedback_digest\n---\n\n${content}\n`;
  await writeFile(path, body, `self-tuning: feedback digest ${today.date}`);
  return { skipped: false, path, snippet: content.slice(0, 400) };
};
