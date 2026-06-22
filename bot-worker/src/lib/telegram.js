// Telegram Bot API client — raw fetch (Workers compatible).

const api = (env, method, body) =>
  fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const sendMessage = (env, chat_id, text, extra = {}) =>
  api(env, "sendMessage", { chat_id, text, ...extra });

export const answerCallback = (env, callback_query_id, text) =>
  api(env, "answerCallbackQuery", { callback_query_id, text });

export const editMessageReplyMarkup = (env, chat_id, message_id, reply_markup) =>
  api(env, "editMessageReplyMarkup", { chat_id, message_id, reply_markup });

export const getFileLink = async (env, file_id) => {
  const res = await api(env, "getFile", { file_id });
  const data = await res.json();
  if (!data.ok) throw new Error(`getFile: ${JSON.stringify(data)}`);
  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
};

export const sendPhoto = async (env, chat_id, imageBuffer, caption = "") => {
  const fd = new FormData();
  fd.append("chat_id", String(chat_id));
  fd.append("photo", new Blob([imageBuffer], { type: "image/jpeg" }), "image.jpg");
  if (caption) fd.append("caption", caption);
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: fd,
  });
};

export const fbKeyboard = (source) => ({
  reply_markup: {
    inline_keyboard: [[
      { text: "👍 Bagus", callback_data: `fb:up:${source}` },
      { text: "👎 Kurang", callback_data: `fb:down:${source}` },
    ]],
  },
});
