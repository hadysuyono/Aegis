// Conversation state — KV store (per chat_id).
// Cap 16 messages.

const KEY = (chatId) => `conv:${chatId}`;
const MAX = 16;

export const getState = async (env, chatId) => {
  const raw = await env.AEGIS_KV.get(KEY(chatId), { type: "json" });
  return Array.isArray(raw) ? raw : [];
};

export const setState = (env, chatId, msgs) =>
  env.AEGIS_KV.put(KEY(chatId), JSON.stringify(msgs.slice(-MAX)), { expirationTtl: 60 * 60 * 24 * 7 });

export const resetState = (env, chatId) => env.AEGIS_KV.delete(KEY(chatId));
