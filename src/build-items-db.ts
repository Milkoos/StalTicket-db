import { basename, dirname, resolve } from "node:path";
import { COLOR_POLARITY, DATA_DIR, FACTOR_PREFIXES, OUT_DIR, type Polarity } from "./constants";
import type { AddStatBlock, ElementListBlock, InfoElement, NumericRangeElement } from "./type";
import { expandItemVariants } from "./itemVariants";
import { errorMessage, readJSONSync, scanJsonFiles, writeJSONSync } from "./utils/fsUtils";
const DATA_FILE = resolve(DATA_DIR, "items.json");
interface RawItemFile {
	name?: {
		lines?: Record<string, string>;
		text?: string;
	};
	color?: string;
	infoBlocks?: unknown[];
	info_blocks?: unknown[];
}

export interface ItemProperty {
	key: string;
	min?: number;
	max?: number;
	value?: number;
	values?: number[];
	polarity?: Polarity;
	name_ru?: string;
}
export interface ItemProperties {
	main?: ItemProperty[];
	additional?: ItemProperty[];
	slots?: number;
	effectiveness?: number;
	inner_protection?: number;
}
export interface ItemData {
	id: string;
	type: string;
	category: string;
	name_ru: string;
	rarity: string;
	item_properties?: ItemProperties;
}
const TARGET_CATEGORIES: Record<string, readonly string[]> = {
	weapon: ["assault_rifle", "sniper_rifle", "shotgun_rifle", "submachine_gun", "machine_gun"],
	armor: ["clothes", "combat", "combined", "scientist"],
	artefact: ["biochemical", "electrophysical", "gravity", "thermal", "other_arts"],
};
const FLAT_DIRS: Record<
	string,
	Readonly<{
		type: string;
		cat: string;
	}>
> = {
	backpacks: { type: "backpack", cat: "backpack" },
	containers: { type: "container", cat: "container" },
};
const dirTypeCache = new Map<
	string,
	{
		type: string;
		cat: string;
	} | null
>();
function resolveDirType(dir: string): {
	type: string;
	cat: string;
} | null {
	const cached = dirTypeCache.get(dir);
	if (cached !== undefined) return cached;
	const parts = dir.split(/[/\\]/).filter(Boolean);
	const leaf = parts.at(-1) ?? "";
	const parent = parts.at(-2) ?? "";
	const result = FLAT_DIRS[leaf] ?? (TARGET_CATEGORIES[parent]?.includes(leaf) ? { type: parent, cat: leaf } : null);
	dirTypeCache.set(dir, result);
	return result;
}
function extractFactorKey(fullKey: string): string {
	for (const prefix of FACTOR_PREFIXES) {
		if (fullKey.startsWith(prefix)) return fullKey.slice(prefix.length);
	}
	return fullKey;
}
function toPolarity(color: unknown): Polarity | undefined {
	if (typeof color !== "string") return undefined;
	return COLOR_POLARITY[color.toUpperCase()];
}
function translationOf(el: InfoElement): {
	key: string;
	ru?: string;
} {
	if (!("name" in el) || el.name?.type !== "translation") return { key: "" };
	return { key: el.name.key ?? "", ru: el.name.lines?.ru };
}
function parseRangeElement(el: NumericRangeElement): ItemProperty | null {
	const { key, ru } = translationOf(el);
	return {
		key: extractFactorKey(key),
		min: el.min,
		max: el.max,
		polarity: toPolarity(el.formatted?.valueColor),
		name_ru: ru,
	};
}
function parseVariantsElement(
	el: Extract<
		InfoElement,
		{
			type: "numericVariants" | "numeric";
		}
	>,
): ItemProperty | null {
	const { key, ru } = translationOf(el);
	const polarity = toPolarity(el.formatted?.valueColor ?? el.valueColor);
	if (Array.isArray(el.value)) {
		return { key: extractFactorKey(key), values: el.value, polarity, name_ru: ru };
	}
	return { key: extractFactorKey(key), value: el.value, polarity, name_ru: ru };
}
function parseBackpackSpecials(
	el: Extract<
		InfoElement,
		{
			type: "numeric";
		}
	>,
	out: ItemProperties,
): boolean {
	const key = translationOf(el).key;
	const scalar = Array.isArray(el.value) ? undefined : el.value;
	if (key.includes("backpack.info.size") || key.includes("capacity")) {
		if (typeof scalar === "number") out.slots = scalar;
		else {
			const digits = el.formatted?.value?.ru?.match(/\/(\d+)/)?.[1];
			const parsed = digits ? Number.parseInt(digits, 10) : Number.NaN;
			if (!Number.isNaN(parsed)) out.slots = parsed;
		}
		return true;
	}
	if (key.includes("backpack.stat_name.effectiveness")) {
		if (typeof scalar === "number") out.effectiveness = scalar;
		return true;
	}
	if (key.includes("backpack.stat_name.inner_protection")) {
		if (typeof scalar === "number") out.inner_protection = scalar;
		return true;
	}
	return false;
}
type ElementBlock = ElementListBlock | AddStatBlock;
function parseItemProperties(infoBlocks: unknown[]): ItemProperties | undefined {
	const main: ItemProperty[] = [];
	const additional: ItemProperty[] = [];
	const out: ItemProperties = {};
	for (const block of infoBlocks as ElementBlock[]) {
		if (!Array.isArray(block.elements)) continue;
		const target = block.type === "addStat" ? additional : main;
		for (const el of block.elements) {
			if (el.type === "range") {
				const prop = parseRangeElement(el);
				if (prop) target.push(prop);
				continue;
			}
			if (el.type !== "numeric") continue;
			if (block.type !== "addStat" && parseBackpackSpecials(el, out)) continue;
			if (!FACTOR_PREFIXES.some((p) => translationOf(el).key.startsWith(p))) {
				continue;
			}
			const prop = parseVariantsElement(el);
			if (prop) target.push(prop);
		}
	}
	if (main.length) out.main = main;
	if (additional.length) out.additional = additional;
	return Object.keys(out).length > 0 ? out : undefined;
}
function collectItems(dir: string, acc: ItemData[]): void {
	for (const file of scanJsonFiles(dir)) {
		try {
			const raw = readJSONSync<RawItemFile>(file);
			const allowed = resolveDirType(dirname(file));
			if (!allowed) continue;
			const item: ItemData = {
				id: basename(file, ".json"),
				type: allowed.type,
				category: allowed.cat,
				name_ru: raw.name?.lines?.ru || raw.name?.text || "Неизвестно",
				rarity: raw.color ?? "DEFAULT",
			};
			const props = parseItemProperties(raw.infoBlocks ?? raw.info_blocks ?? []);
			if (props) item.item_properties = props;
			acc.push(...expandItemVariants(item));
		} catch (e) {
			console.warn(`[BuildItems] Skip ${file}: ${errorMessage(e)}`);
		}
	}
}
function main(): void {
	console.log("[BuildItems] Scanning", resolve(OUT_DIR, "items"));
	const items: ItemData[] = [];
	collectItems(resolve(OUT_DIR, "items"), items);
	items.sort((a, b) => a.id.localeCompare(b.id));
	if (items.length === 0) {
		console.error(`[BuildItems] No items collected — aborting, keeping existing ${DATA_FILE}`);
		process.exit(1);
	}
	writeJSONSync(DATA_FILE, items);
	console.log(`[BuildItems] Written ${items.length} items to ${DATA_FILE}`);
}
main();
