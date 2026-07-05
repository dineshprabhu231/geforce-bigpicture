const fs = require('fs');
const path = require('path');

const SHORTCUT_EXTS = ['.gfnpc', '.url', '.lnk'];

// One level deep, so a folder-of-folders (e.g. one subfolder per game) is
// still picked up without wandering arbitrarily deep into the disk.
function walk(dir, depth = 0, maxDepth = 1) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && depth < maxDepth) {
      results = results.concat(walk(full, depth + 1, maxDepth));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

// This is now the ONLY way shortcuts get discovered. There is no more
// broad auto-scan of Desktop/Public Desktop/Start Menu — those are shared
// system folders that can hold all sorts of unrelated shortcuts, which is
// exactly why the old scanner had to sniff .url/.lnk contents for GeForce
// NOW references before trusting them.
//
// Here, the user explicitly pointed us at this folder and said it holds
// their GeForce NOW shortcuts, so every .gfnpc/.url/.lnk file inside it is
// trusted directly — no content re-validation needed.
function scanSpecificFolder(folderPath) {
  const files = walk(folderPath, 0, 1);
  const shortcutFiles = files.filter((f) =>
    SHORTCUT_EXTS.includes(path.extname(f).toLowerCase())
  );
  return shortcutFiles.map((f) => {
    const ext = path.extname(f).toLowerCase();
    return { id: f, name: path.basename(f, ext), path: f, ext };
  });
}

module.exports = { scanSpecificFolder };
