import path from "node:path";
export const ORIG_DIR = "items";
export const OUT_DIR = "merged";
export const DATA_DIR = "data";
export const SHA_FILE = ".last_sha";
export const ZIP_FILE = "stalzone-database.zip";
export const GITHUB_OWNER = "EXBO-Studio";
export const GITHUB_REPO = "stalzone-database";
export const GITHUB_BRANCH = "main";
export const FORCE_PULL = process.env.FORCE_PULL === "1";
export const CLEAN_ORIG = process.env.CLEAN_ORIG === "1";
export const UPDATE_COOLDOWN_MS = 30000;
export const FETCH_TIMEOUT_MS = 15000;
export const NOTIFY_TIMEOUT_MS = 5000;
export const SYNC_WEBHOOK_URL = "http://sync:7829/sync";
export const DEFAULT_PROXY = "http://127.0.0.1:10808";
export const FACTORS_SOURCE_URL = "https://sctools.tech/api/exbo/items/?category=artefact";
export const WEAPON_DAMAGE_KEY = "core.tooltip.stat_name.damage_type.direct";
export const ARMOR_BULLET_FACTOR_KEY = "stalker.artefact_properties.factor.bullet_dmg_factor";
export const UPGRADE_STATS_TITLE_KEY = "stalker.tooltip.armor_artefact.info.upgrade_stats";
export const FACTOR_PREFIXES = ["stalker.artefact_properties.factor.", "stalker.artefact.properties.factor."] as const;
export const POSITIVE_COLOR = "53C353";
export const NEGATIVE_COLOR = "FF4D4D";
export const STANDALONE_FILES = ["listing.json", "achievements.json"] as const;
export const ALLOWED_ITEM_CATEGORIES = new Set(["weapon", "armor", "artefact", "backpacks", "containers"]);
export function githubZipUrl(): string {
	return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;
}
export function githubCommitApiUrl(): string {
	return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;
}
export function githubRawUrl(file: string): string {
	return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/ru/${file}`;
}
export function resolveIn(...parts: string[]): string {
	return path.resolve(...parts);
}
