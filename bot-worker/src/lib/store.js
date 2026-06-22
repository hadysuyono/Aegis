// Store — GitHub repo sebagai database. Pakai fetch native (Workers compatible).
// env: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (default main)

const api = (env, path, init = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "aegis-bot-worker",
      Accept: "application/vnd.github+json",
      ...(init.headers || {}),
    },
  });

const repoPath = (env, p) =>
  `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodeURIComponent(p).replace(/%2F/g, "/")}`;

const getFile = async (env, path) => {
  const res = await api(env, `${repoPath(env, path)}?ref=${env.GITHUB_BRANCH || "main"}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getFile ${path}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // Workers base64 decode
  const content = atob(data.content.replace(/\n/g, ""));
  return { sha: data.sha, content };
};

export const writeFile = async (env, path, content, message) => {
  const branch = env.GITHUB_BRANCH || "main";
  // base64 encode UTF-8
  const utf8 = new TextEncoder().encode(content);
  const b64 = btoa(String.fromCharCode(...utf8));
  for (let attempt = 1; attempt <= 3; attempt++) {
    const existing = await getFile(env, path);
    const body = { message, content: b64, branch, ...(existing?.sha ? { sha: existing.sha } : {}) };
    const res = await api(env, repoPath(env, path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return;
    const errText = await res.text();
    const conflict = res.status === 409 || /expected/i.test(errText);
    if (!conflict || attempt === 3) throw new Error(`writeFile ${path}: ${res.status} ${errText}`);
    await new Promise(r => setTimeout(r, 300 * attempt));
  }
};

export const readText = async (env, path) => {
  const f = await getFile(env, path);
  return f ? f.content : null;
};

export const readJSON = async (env, path, fallback = {}) => {
  const f = await getFile(env, path);
  if (!f) return fallback;
  try { return JSON.parse(f.content); } catch { return fallback; }
};

export const writeJSON = (env, path, obj, message) =>
  writeFile(env, path, JSON.stringify(obj, null, 2) + "\n", message);

export const listFolder = async (env, path) => {
  const res = await api(env, `${repoPath(env, path)}?ref=${env.GITHUB_BRANCH || "main"}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`listFolder ${path}: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

export const deleteFile = async (env, path, message) => {
  const existing = await getFile(env, path);
  if (!existing) return false;
  const res = await api(env, repoPath(env, path), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: existing.sha, branch: env.GITHUB_BRANCH || "main" }),
  });
  return res.ok;
};
