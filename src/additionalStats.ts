import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { FACTORS_SOURCE_URL, FETCH_TIMEOUT_MS } from "./constants";
import type { AddStatBlock, NumericRangeElement } from "./type";
import { errorMessage, scanJsonFiles } from "./utils/fsUtils";
interface ApiStat {
	isPositive?: boolean;
	name?: Record<string, string>;
	key?: string;
	minValue?: number;
	maxValue?: number;
	formattedValue?: Record<string, string>;
}
interface ApiItem {
	id: string;
	custom_id?: string;
	key?: string;
	add_info?: {
		addStats?: ApiStat[];
	};
}
interface RawItemFile {
	id?: string;
	custom_id?: string;
	key?: string;
	infoBlocks?: unknown[];
	info_blocks?: unknown[];
}
async function fetchApiItems(proxy?: string): Promise<ApiItem[]> {
	const response = await fetch(FACTORS_SOURCE_URL, {
		headers: { accept: "application/json" },
		proxy,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	} as RequestInit & {
		proxy?: string;
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return (await response.json()) as ApiItem[];
}
function toAddStatBlock(stats: ApiStat[]): AddStatBlock {
	const elements: NumericRangeElement[] = [];
	for (const stat of stats) {
		const { isPositive, name, key, minValue, maxValue, formattedValue } = stat ?? {};
		if (typeof minValue !== "number" || typeof maxValue !== "number") continue;
		const element: NumericRangeElement = {
			type: "range",
			name: {
				type: "translation",
				key: key ?? "",
				args: {},
				lines: name ? { ...name } : {},
			},
			min: minValue,
			max: maxValue,
		};
		const formatted: NonNullable<NumericRangeElement["formatted"]> = {};
		if (formattedValue && typeof formattedValue === "object") {
			formatted.value = formattedValue;
		}
		if (isPositive === true) formatted.valueColor = "positive";
		else if (isPositive === false) formatted.valueColor = "negative";
		if (Object.keys(formatted).length) element.formatted = formatted;
		elements.push(element);
	}
	return { type: "addStat", title: { type: "text", text: "" }, elements };
}
export async function additionalStatsParse(outDir: string, proxy?: string): Promise<void> {
	console.log("[AddStats] Fetching artefacts from API…");
	let apiItems: ApiItem[];
	try {
		apiItems = await fetchApiItems(proxy);
		console.log(`[AddStats] API items received: ${apiItems.length}`);
	} catch (e) {
		console.error("[AddStats] API fetch failed:", errorMessage(e));
		return;
	}
	const artefactsDir = path.join(outDir, "items", "artefact");
	if (!existsSync(artefactsDir)) {
		console.warn(`[AddStats] Directory not found: ${artefactsDir}`);
		return;
	}
	const jsonFiles = scanJsonFiles(artefactsDir);
	console.log(`[AddStats] JSON files found: ${jsonFiles.length}`);
	if (!jsonFiles.length) return;
	const index = new Map<string, string[]>();
	for (const file of jsonFiles) {
		try {
			const json = JSON.parse(await fs.readFile(file, "utf8")) as RawItemFile;
			const keys = [json.id, json.custom_id, json.key, path.basename(file, ".json")].filter((k): k is string => Boolean(k));
			for (const key of keys) {
				const files = index.get(key) ?? [];
				files.push(file);
				index.set(key, files);
			}
		} catch (e) {
			console.warn(`[AddStats] Broken json: ${file} — ${errorMessage(e)}`);
		}
	}
	console.log(`[AddStats] Index keys generated: ${index.size}`);
	let matched = 0;
	const lastBlockByFile = new Map<string, AddStatBlock>();
	for (const item of apiItems) {
		const lookupKeys = [item.id, item.custom_id, item.key].filter((k): k is string => Boolean(k));
		const files = [...new Set(lookupKeys.flatMap((key) => index.get(key) ?? []))];
		if (!files.length) continue;
		const stats = item.add_info?.addStats;
		if (!Array.isArray(stats) || !stats.length) continue;
		const block = toAddStatBlock(stats);
		if (!block.elements.length) continue;
		matched++;
		for (const file of files) lastBlockByFile.set(file, block);
	}
	let modified = 0;
	for (const [file, block] of lastBlockByFile) {
		try {
			const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawItemFile;
			const infoBlocks = raw.infoBlocks ?? raw.info_blocks ?? [];
			raw.infoBlocks = [
				...infoBlocks.filter(
					(b) =>
						(
							b as {
								type?: string;
							}
						).type !== "addStat",
				),
				block,
			];
			delete raw.info_blocks;
			await fs.writeFile(file, JSON.stringify(raw, null, 2), "utf8");
			modified++;
		} catch (e) {
			console.warn(`[AddStats] Failed to update file ${file}: ${errorMessage(e)}`);
		}
	}
	console.log(`[AddStats] Done. Matched: ${matched}, Files updated: ${modified}`);
}
