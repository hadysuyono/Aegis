// Capture — helper untuk simpan file ke vault (dipakai oleh tools & index).
// Thin wrapper di atas store.writeFile.

import { writeFile } from "./store.js";

export const saveToFile = (path, content, message) => writeFile(path, content, message);
