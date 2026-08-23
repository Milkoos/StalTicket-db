import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR, FETCH_TIMEOUT_MS, githubRawUrl } from "./constants";
import { errorMessage, writeJSONSync } from "./utils/fsUtils";
const OUT_FILE = resolve(DATA_DIR, "achievements.json");
const RAW_URL = githubRawUrl("achievements.json");
const LOCAL_CANDIDATES = [resolve("merged", "achievements.json"), resolve("items", "achievements.json")];
interface RawAchievement {
	id?: string;
	title?: {
		lines?: Record<string, string>;
	};
	description?: {
		lines?: Record<string, string>;
	};
}
export interface Achievement {
	id: string;
	name_ru: string;
	description_ru: string;
}
function ru(lines: Record<string, string> | undefined): string {
	return lines?.ru ?? "";
}
function transform(raw: RawAchievement[]): Achievement[] {
	return raw
		.map((a) => ({
			id: a.id ?? "",
			name_ru: ru(a.title?.lines),
			description_ru: ru(a.description?.lines),
		}))
		.filter((a) => a.id)
		.sort((a, b) => a.id.localeCompare(b.id));
}
async function readLocal(): Promise<RawAchievement[] | null> {
	for (const candidate of LOCAL_CANDIDATES) {
		if (!existsSync(candidate)) continue;
		try {
			const data = JSON.parse(readFileSync(candidate, "utf8")) as RawAchievement[];
			console.log(`[Achievements] Using local file: ${candidate}`);
			return data;
		} catch (e) {
			console.warn(`[Achievements] Failed to parse ${candidate}: ${errorMessage(e)}`);
		}
	}
	return null;
}
async function fetchRemote(): Promise<RawAchievement[]> {
	const response = await fetch(RAW_URL, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return (await response.json()) as RawAchievement[];
}
export async function buildAchievements(): Promise<number> {
	const local = await readLocal();
	const raw = local ?? (await fetchRemote());
	if (!local) console.log(`[Achievements] Fetched from GitHub: ${RAW_URL}`);
	const achievements = transform(raw);
	writeJSONSync(OUT_FILE, achievements);
	console.log(`[Achievements] Written ${achievements.length} to ${OUT_FILE}`);
	return achievements.length;
}
if (import.meta.main) {
	try {
		const count = await buildAchievements();
		if (count === 0) {
			console.warn("[Achievements] No achievements written — exiting with error");
			process.exit(1);
		}
	} catch (e) {
		console.error("[Achievements] Failed:", errorMessage(e));
		process.exit(1);
	}
}
