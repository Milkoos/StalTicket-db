import {
	CLEAN_ORIG,
	DEFAULT_PROXY,
	FORCE_PULL,
	ORIG_DIR,
	OUT_DIR,
	SHA_FILE,
	UPDATE_COOLDOWN_MS,
	ZIP_FILE,
	githubZipUrl,
	resolveIn,
} from "./constants";
import { downloadZip, extractItemsFromZip, getRemoteSha, notifySync } from "./github";
import { runMerge } from "./merge";
import { additionalStatsParse } from "./additionalStats";
import { errorMessage, loadSavedSha, removeDir, saveSha, sha256File } from "./utils/fsUtils";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function proxyArg(): string | undefined {
	const enabled = process.argv.includes("--proxy") || process.env.PROXY === "true";
	return enabled ? (process.env.PROXY_URL ?? DEFAULT_PROXY) : undefined;
}
async function mergeAndEnrich(proxy?: string): Promise<void> {
	await removeDir(resolveIn(OUT_DIR));
	await runMerge(resolveIn(ORIG_DIR), resolveIn(OUT_DIR));
	await additionalStatsParse(resolveIn(OUT_DIR), proxy);
}
async function syncOnce(): Promise<boolean> {
	const proxy = proxyArg();
	if (CLEAN_ORIG) {
		await removeDir(resolveIn(ORIG_DIR));
		console.log("[Main] Cleaned", ORIG_DIR);
	}
	if (process.argv.includes("--force-merge")) {
		console.log("[Main] Force merge requested.");
		await mergeAndEnrich(proxy);
		return true;
	}
	const savedSha = loadSavedSha(resolveIn(SHA_FILE));
	const remoteSha = await getRemoteSha();
	console.log("[Main] savedSha =", savedSha, "| remoteSha =", remoteSha);
	const needUpdate = FORCE_PULL || !savedSha || (!!remoteSha && remoteSha !== savedSha);
	if (!needUpdate) return false;
	console.log("[Main] Updating from GitHub...");
	const zipPath = resolveIn(ZIP_FILE);
	await downloadZip(githubZipUrl(), zipPath, proxy);
	const versionId = remoteSha ?? (await sha256File(zipPath));
	await removeDir(resolveIn(ORIG_DIR));
	extractItemsFromZip(zipPath, resolveIn(ORIG_DIR));
	saveSha(resolveIn(SHA_FILE), versionId);
	await removeDir(zipPath);
	console.log("[Main] Updated. Version:", versionId);
	await mergeAndEnrich(proxy);
	return true;
}
async function runAndNotify(): Promise<void> {
	if (await syncOnce()) {
		console.log("[Main] Changes detected → syncing");
		await notifySync();
	} else {
		console.log("[Main] No changes");
	}
}
if (process.argv.includes("--no-loop")) {
	try {
		await runAndNotify();
		process.exit(0);
	} catch (e) {
		console.error("[Main] Error during single run:", errorMessage(e));
		process.exit(1);
	}
}
while (true) {
	try {
		await runAndNotify();
	} catch (e) {
		console.error("[Loop] Loop error:", errorMessage(e));
	}
	await sleep(UPDATE_COOLDOWN_MS);
}
