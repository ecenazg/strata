import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = resolve(frontendDir, "..");
const destination = resolve(frontendDir, "public", "features.json");

await mkdir(dirname(destination), { recursive: true });
await copyFile(resolve(projectDir, "features.json"), destination);
console.log("Prepared frontend/public/features.json");
