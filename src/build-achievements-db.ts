import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import axios from "axios";
import { GITHUB_BRANCH, GITHUB_OWNER, GITHUB_REPO } from "./constants";

const CANDIDATES = ["merged/achievements.json", "items/achievements.json"];
const OUT_FILE = resolve("data/achievements.json");
const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/ru/achievements.json`;

interface RawAchievement {
	id?: string;
	title?: { lines?: Record<string, string> };
	description?: { lines?: Record<string, string> };
	points?: number;
}

interface Achievement {
	id: string;
	name_ru: string;
	description_ru: string;
}

function parse(lines: Record<string, string> | undefined): string {
	return (lines && lines.ru) || "";
}

function transform(raw: RawAchievement[]): Achievement[] {
	const achievements: Achievement[] = raw.map((a) => ({
		id: a.id || "",
		name_ru: parse(a.title?.lines),
		description_ru: parse(a.description?.lines),
	}));

	achievements.sort((a, b) => a.id.localeCompare(b.id));
	return achievements;
}

export async function buildAchievements(): Promise<number> {
	let raw: RawAchievement[] | null = null;

	for (const candidate of CANDIDATES) {
		const p = resolve(candidate);
		if (existsSync(p)) {
			try {
				raw = JSON.parse(readFileSync(p, "utf8"));
				console.log(`[Achievements] Using local file: ${candidate}`);
				break;
			} catch (e) {
				console.warn(
					`[Achievements] Failed to parse ${candidate}, trying remote…`,
					e instanceof Error ? e.message : e,
				);
			}
		}
	}

	if (raw == null) {
		console.log(`[Achievements] Fetching from GitHub: ${RAW_URL}`);
		const res = await axios.get<RawAchievement[]>(RAW_URL, {
			headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
			timeout: 15000,
		});
		raw = res.data;
	}

	const achievements = transform(raw);
	writeFileSync(OUT_FILE, JSON.stringify(achievements), "utf8");
	console.log(`Written ${achievements.length} achievements to ${OUT_FILE}`);
	return achievements.length;
}

if (import.meta.main) {
	try {
		const n = await buildAchievements();
		if (n === 0) {
			console.warn("[Achievements] No achievements written — exiting with error");
			process.exit(1);
		}
	} catch (e) {
		console.error(
			"[Achievements] Failed:",
			e instanceof Error ? e.message : e,
		);
		process.exit(1);
	}
}