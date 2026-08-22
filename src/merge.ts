import path from "node:path";
import type { InfoElement, Item, NumericElement, NumericVariantsElement } from "./type";
import { ARMOR_BULLET_FACTOR_KEY, UPGRADE_STATS_TITLE_KEY, WEAPON_DAMAGE_KEY } from "./constants";
import { errorMessage, readJSONSync, scanJsonFiles, writeJSONSync } from "./utils/fsUtils";
interface Colors {
	nameColor?: string;
	valueColor?: string;
}
function isNumericLike(el: InfoElement): el is NumericElement | NumericVariantsElement {
	return el.type === "numeric" || el.type === "numericVariants";
}
function ensureNumberArray(v: number | number[] | undefined): number[] {
	if (Array.isArray(v)) return v.filter((x) => typeof x === "number");
	if (typeof v === "number") return [v];
	return [];
}
function uniqSorted(nums: number[]): number[] {
	return [...new Set(nums)].sort((a, b) => a - b);
}
function takeColors(el: InfoElement, into: Colors): void {
	if (!into.nameColor && el.formatted?.nameColor) into.nameColor = el.formatted.nameColor;
	if (!into.valueColor && el.formatted?.valueColor) into.valueColor = el.formatted.valueColor;
	if (!into.nameColor && el.nameColor) into.nameColor = el.nameColor;
	if (!into.valueColor && el.valueColor) into.valueColor = el.valueColor;
}
function translationKey(el: InfoElement | undefined): string | null {
	if (!el || !("name" in el)) return null;
	const name = el.name;
	return name?.type === "translation" ? name.key : null;
}
function collectFromVariant(
	variant: Item,
	matchKey: string,
): {
	nums: number[];
	colors: Colors;
} {
	const nums: number[] = [];
	const colors: Colors = {};
	for (const block of variant.infoBlocks ?? []) {
		if (block.type !== "list" && block.type !== "addStat") continue;
		const skipUpgradeStats =
			matchKey === ARMOR_BULLET_FACTOR_KEY && block.title.type === "translation" && block.title.key === UPGRADE_STATS_TITLE_KEY;
		for (const el of block.elements) {
			if (!isNumericLike(el) || translationKey(el) !== matchKey) continue;
			if (skipUpgradeStats) continue;
			nums.push(...ensureNumberArray(el.value));
			takeColors(el, colors);
		}
	}
	return { nums, colors };
}
export function mergeOneItem(orig: Item, variants: Item[]): Item {
	const category = orig.category ?? "";
	const matchKey = category.startsWith("weapon") ? WEAPON_DAMAGE_KEY : category.startsWith("armor") ? ARMOR_BULLET_FACTOR_KEY : null;
	if (!matchKey) return orig;
	const targets = (orig.infoBlocks ?? [])
		.filter(
			(
				b,
			): b is Extract<
				typeof b,
				{
					elements: InfoElement[];
				}
			> => b.type === "list" || b.type === "addStat",
		)
		.flatMap((b) => b.elements)
		.filter((el): el is NumericElement | NumericVariantsElement => isNumericLike(el) && translationKey(el) === matchKey);
	if (!targets.length) return orig;
	const allNums: number[] = [];
	const colors: Colors = {};
	for (const el of targets) {
		allNums.push(...ensureNumberArray(el.value));
		takeColors(el, colors);
	}
	for (const variant of variants) {
		const { nums, colors: variantColors } = collectFromVariant(variant, matchKey);
		allNums.push(...nums);
		colors.nameColor ??= variantColors.nameColor;
		colors.valueColor ??= variantColors.valueColor;
	}
	const merged = uniqSorted(allNums);
	for (const target of targets) {
		target.type = "numericVariants";
		target.value = merged;
		target.nameColor ??= colors.nameColor;
		target.valueColor ??= colors.valueColor;
		if (target.formatted) {
			delete target.formatted.value;
			delete target.formatted.nameColor;
			delete target.formatted.valueColor;
			if (!Object.keys(target.formatted).length) delete target.formatted;
		}
	}
	return orig;
}
export async function runMerge(origDir: string, outDir: string): Promise<void> {
	const allFiles = scanJsonFiles(origDir);
	console.log("[Merge] Found JSON files:", allFiles.length);
	for (const file of allFiles) {
		if (file.includes(`${path.sep}_variants${path.sep}`)) continue;
		try {
			const orig = readJSONSync<Item>(file);
			const base = path.basename(file, ".json");
			const variantsFolder = path.join(path.dirname(file), "_variants", base);
			const variants: Item[] = [];
			for (const vf of scanJsonFiles(variantsFolder)) {
				try {
					variants.push(readJSONSync<Item>(vf));
				} catch (e) {
					console.warn(`[Merge] Failed to read variant ${vf}:`, errorMessage(e));
				}
			}
			writeJSONSync(path.join(outDir, path.relative(origDir, file)), mergeOneItem(orig, variants));
		} catch (e) {
			console.error("[Merge] Error processing file", file, errorMessage(e));
		}
	}
	console.log("[Merge] Done.");
}
