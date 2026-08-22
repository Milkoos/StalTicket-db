import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
export function readJSONSync<T>(filePath: string): T {
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
export function writeJSONSync(filePath: string, data: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}
export function exists(filePath: string): boolean {
	return fs.existsSync(filePath);
}
export function removeDir(dirPath: string): Promise<void> {
	return fs.promises.rm(dirPath, { recursive: true, force: true });
}
export function scanJsonFiles(dir: string): string[] {
	const out: string[] = [];
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...scanJsonFiles(full));
		else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
	}
	return out;
}
export function sha256File(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash("sha256");
		fs.createReadStream(filePath)
			.on("data", (chunk) => hash.update(chunk))
			.on("error", reject)
			.on("end", () => resolve(hash.digest("hex")));
	});
}
export function loadSavedSha(shaFile: string): string | null {
	try {
		if (!fs.existsSync(shaFile)) return null;
		const sha = fs.readFileSync(shaFile, "utf8").trim();
		return sha || null;
	} catch {
		return null;
	}
}
export function saveSha(shaFile: string, sha: string): void {
	fs.mkdirSync(path.dirname(path.resolve(shaFile)), { recursive: true });
	fs.writeFileSync(shaFile, sha, "utf8");
	console.log("[SHA] Last sha saved");
}
export function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
