import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import {
	ALLOWED_ITEM_CATEGORIES,
	FETCH_TIMEOUT_MS,
	GITHUB_BRANCH,
	GITHUB_REPO,
	NOTIFY_TIMEOUT_MS,
	STANDALONE_FILES,
	SYNC_WEBHOOK_URL,
	githubCommitApiUrl,
} from "./constants";
export async function downloadZip(url: string, dest: string, proxy?: string): Promise<void> {
	const response = await fetch(url, {
		proxy,
	} as RequestInit & {
		proxy?: string;
	});
	if (!response.ok || !response.body) {
		throw new Error(`Download failed: HTTP ${response.status}`);
	}
	await Bun.write(dest, response);
	const sizeMb = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
	console.log(`[GitHub] Download completed (${sizeMb} MB)`);
}
export function extractItemsFromZip(zipPath: string, targetDir: string): void {
	const zip = new AdmZip(zipPath);
	const rootPrefix = `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/`;
	const itemsPrefix = `${rootPrefix}items/`;
	for (const entry of zip.getEntries()) {
		if (entry.isDirectory) continue;
		const relToRoot = entry.entryName.startsWith(rootPrefix) ? entry.entryName.slice(rootPrefix.length) : "";
		let outRel: string | undefined;
		if ((STANDALONE_FILES as readonly string[]).includes(relToRoot)) {
			outRel = relToRoot;
		} else if (entry.entryName.startsWith(itemsPrefix)) {
			const itemRel = entry.entryName.slice(itemsPrefix.length);
			const category = itemRel.split("/")[0];
			if (itemRel && category && ALLOWED_ITEM_CATEGORIES.has(category)) {
				outRel = `items/${itemRel}`;
			}
		}
		if (!outRel) continue;
		const outPath = path.join(targetDir, outRel);
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, entry.getData());
	}
}
export async function notifySync(): Promise<void> {
	const token = process.env.SYNC_TOKEN;
	if (!token) return;
	try {
		const response = await fetch(SYNC_WEBHOOK_URL, {
			method: "POST",
			headers: { "x-sync-token": token },
			signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		console.log("[Sync] sync-server notified");
	} catch (e) {
		console.warn("[Sync] failed to notify sync-server:", e);
	}
}
interface GitHubCommitResponse {
	sha: string;
}
export async function getRemoteSha(): Promise<string | null> {
	try {
		const headers: Record<string, string> = { accept: "application/vnd.github+json" };
		if (process.env.GITHUB_TOKEN) {
			headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		}
		const response = await fetch(githubCommitApiUrl(), {
			headers,
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = (await response.json()) as Partial<GitHubCommitResponse>;
		return data.sha ?? null;
	} catch (e) {
		console.warn("[GitHub] Failed to fetch remote sha:", e);
		return null;
	}
}
