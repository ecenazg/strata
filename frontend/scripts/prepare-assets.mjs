import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = resolve(frontendDir, "..");

await mkdir(resolve(frontendDir, "public"), { recursive: true });

// Copy tracks.json if it exists
const tracksSource = resolve(projectDir, "frontend", "public", "tracks.json");
const tracksAlt = resolve(projectDir, "tracks.json");
const tracksDest = resolve(frontendDir, "public", "tracks.json");

for (const src of [tracksSource, tracksAlt]) {
  try {
    await access(src);
    await copyFile(src, tracksDest);
    console.log(`Prepared frontend/public/tracks.json from ${src}`);
    break;
  } catch {
    // try next
  }
}

console.log("prepare-assets complete");
