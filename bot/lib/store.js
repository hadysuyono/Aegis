// Store — read/write file di GitHub repo Aegis lewat Octokit.
// Pakai handle path file dengan sha caching biar tidak conflict.

import { Octokit } from "@octokit/rest";

const {
  GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = "main",
} = process.env;

const gh = new Octokit({ auth: GITHUB_TOKEN });

const getFile = async (path) => {
  try {
    const res = await gh.repos.getContent({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path, ref: GITHUB_BRANCH,
    });
    return {
      sha: res.data.sha,
      content: Buffer.from(res.data.content, "base64").toString("utf-8"),
    };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
};

export const writeFile = async (path, content, message) => {
  const existing = await getFile(path);
  const encoded = Buffer.from(content, "utf-8").toString("base64");
  await gh.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, branch: GITHUB_BRANCH,
    path, message, content: encoded,
    sha: existing?.sha,
  });
};

export const readJSON = async (path, fallback = {}) => {
  const f = await getFile(path);
  if (!f) return fallback;
  try { return JSON.parse(f.content); } catch { return fallback; }
};

export const writeJSON = async (path, obj, message) =>
  writeFile(path, JSON.stringify(obj, null, 2) + "\n", message);

export const listFolder = async (path) => {
  try {
    const res = await gh.repos.getContent({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path, ref: GITHUB_BRANCH,
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
};

export const readText = async (path) => {
  const f = await getFile(path);
  return f ? f.content : null;
};
