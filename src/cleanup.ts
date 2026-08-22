import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { ORIG_DIR, OUT_DIR } from "./constants";
for (const dir of [resolve(ORIG_DIR), resolve(OUT_DIR)]) {
	if (!existsSync(dir)) continue;
	await rm(dir, { recursive: true, force: true });
	console.log(`[Cleanup] Removed: ${dir}`);
}
