import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import axios from "axios";
import {
	GITHUB_BRANCH,
	GITHUB_OWNER,
	GITHUB_REPO,
	PROXY_CONFIG,
} from "./constants";

export async function downloadZip(url: string, dest: string, proxy = false) {
	let totalSize = 0;

	try {
		const headRes = await axios.head(url, {
			proxy: proxy ? PROXY_CONFIG : false,
		});
		totalSize = Number(headRes.headers["content-length"] || 0);
	} catch {
		console.log("Could not determine file size");
	}

	const response = await axios.get(url, {
		responseType: "stream",
		proxy: proxy ? PROXY_CONFIG : false,
	});

	const fileStream = fs.createWriteStream(dest);
	let downloaded = 0;

	response.data.on("data", (chunk: Buffer) => {
		downloaded += chunk.length;
		if (totalSize) {
			const perc = ((downloaded / totalSize) * 100).toFixed(1);
			Bun.stdout.write(
				`\rDownloading: ${perc}% [${(downloaded / 1024 / 1024).toFixed(
					2,
				)} / ${(totalSize / 1024 / 1024).toFixed(2)} MB]`,
			);
		} else {
			Bun.stdout.write(
				`\rDownloading: ${(downloaded / 1024 / 1024).toFixed(2)} MB...`,
			);
		}
	});

	await new Promise<void>((resolve, reject) => {
		fileStream.on("finish", () => {
			console.log("\n✓ Download completed");
			resolve();
		});
		fileStream.on("error", reject);
		response.data.pipe(fileStream);
	});
}

const ALLOWED_ITEM_CATEGORIES = new Set([
	"weapon", "armor", "artefact", "backpacks", "containers",
]);

export async function extractItemsFromZip(zipPath: string, targetDir: string) {
	const zip = new AdmZip(zipPath);
	const entries = zip.getEntries();

	const itemsPrefix = `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/items/`;
	const listingPrefix = `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/listing.json`;

	for (const entry of entries) {
		const name = entry.entryName;

		if (name === listingPrefix) {
			const outPath = path.join(targetDir, "listing.json");
			fs.mkdirSync(path.dirname(outPath), { recursive: true });
			fs.writeFileSync(outPath, entry.getData());
			continue;
		}

		if (!name.startsWith(itemsPrefix)) continue;

		const relPath = name.slice(itemsPrefix.length);
		if (!relPath) continue;

		const topDir = relPath.split("/")[0];
		if (!ALLOWED_ITEM_CATEGORIES.has(topDir)) continue;

		const outPath = path.join(targetDir, "items", relPath);

		if (entry.isDirectory) {
			fs.mkdirSync(outPath, { recursive: true });
		} else {
			fs.mkdirSync(path.dirname(outPath), { recursive: true });
			fs.writeFileSync(outPath, entry.getData());
		}
	}
}

export async function notifySync() {
	if (!process.env.SYNC_TOKEN) return;

	try {
		await fetch("http://sync:7829/sync", {
			method: "POST",
			headers: {
				"x-sync-token": process.env.SYNC_TOKEN,
			},
		});

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
		const res = await axios.get<GitHubCommitResponse>(
			`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
			{
				headers: {
					...(process.env.GITHUB_TOKEN && {
						Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
					}),
				},
			},
		);

		return res.data.sha;
	} catch (e: unknown) {
		const err = e as {
			response?: { status?: number; data?: unknown };
			message?: string;
		};
		console.warn(
			"[GitHub] Failed to fetch remote sha:",
			err.response?.status,
			err.response?.data || err.message,
		);
		return null;
	}
}
