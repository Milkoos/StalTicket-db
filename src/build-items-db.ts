import {
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  existsSync,
  rmSync,
} from "fs";
import { join, extname, basename, resolve } from "path";

const CANDIDATES = ["merged/items"];
const DATA_DIR = resolve(
  CANDIDATES.find((p) => existsSync(p)) || "merged/items",
);
const OUT_FILE = resolve("data/items.json");

const SKIP_CLEANUP = process.argv.includes("--no-cleanup");

const TARGET_CATEGORIES: Record<string, string[]> = {
  weapon: [
    "assault_rifle",
    "sniper_rifle",
    "shotgun_rifle",
    "submachine_gun",
    "machine_gun",
    "heavy",
  ],
  armor: ["clothes", "combat", "combined", "scientist"],
  artefact: [
    "biochemical",
    "electrophysical",
    "gravity",
    "thermal",
    "other_arts",
  ],
};

const FLAT_DIRS: Record<string, { type: string; cat: string }> = {
  backpacks: { type: "backpack", cat: "backpack" },
  containers: { type: "container", cat: "container" },
};

const FACTOR_PREFIXES = [
  "stalker.artefact_properties.factor.",
  "stalker.artefact.properties.factor.",
];

function extractFactorKey(fullKey: string): string {
  for (const prefix of FACTOR_PREFIXES) {
    if (fullKey.startsWith(prefix)) return fullKey.slice(prefix.length);
  }
  return fullKey;
}

interface ItemProperty {
  key: string;
  min?: number;
  max?: number;
  value?: number;
  values?: number[];
  valueColor?: string;
  name_ru?: string;
}

interface ItemProperties {
  main?: ItemProperty[];
  additional?: ItemProperty[];
  slots?: number;
  effectiveness?: number;
  inner_protection?: number;
}

interface ItemData {
  id: string;
  type: string;
  category: string;
  name_ru: string;
  rarity: string;
  item_properties?: ItemProperties;
}

function parseRangeElement(elem: any): ItemProperty | null {
  const key = extractFactorKey(elem.name?.key || "");
  if (typeof elem.min !== "number" || typeof elem.max !== "number") return null;
  return {
    key,
    min: elem.min,
    max: elem.max,
    valueColor: elem.formatted?.valueColor,
    name_ru: elem.name?.lines?.ru,
  };
}

function parseNumericElement(elem: any): ItemProperty | null {
  const key = extractFactorKey(elem.name?.key || "");
  if (typeof elem.value !== "number") return null;
  return {
    key,
    value: elem.value,
    valueColor: elem.formatted?.valueColor,
    name_ru: elem.name?.lines?.ru,
  };
}

function parseNumericVariantsElement(elem: any): ItemProperty | null {
  const key = extractFactorKey(elem.name?.key || "");
  if (!Array.isArray(elem.value)) return null;
  return {
    key,
    values: elem.value,
    valueColor: elem.valueColor,
    name_ru: elem.name?.lines?.ru,
  };
}

function parseItemProperties(infoBlocks: any[]): ItemProperties | undefined {
  const main: ItemProperty[] = [];
  const additional: ItemProperty[] = [];
  let slots: number | undefined;
  let effectiveness: number | undefined;
  let inner_protection: number | undefined;

  for (const block of infoBlocks) {
    if (!Array.isArray(block.elements)) continue;
    if (block.type === "addStat") {
      for (const elem of block.elements) {
        if (elem.type === "range") {
          const p = parseRangeElement(elem);
          if (p) additional.push(p);
        }
      }
      continue;
    }
    if (block.type === "list") {
      for (const elem of block.elements) {
        if (elem.type === "range") {
          const p = parseRangeElement(elem);
          if (p) main.push(p);
        }
        if (elem.type === "numeric") {
          const keyRaw = elem.name?.key || "";
          if (
            keyRaw.includes("backpack.info.size") ||
            keyRaw.includes("capacity")
          ) {
            if (typeof elem.value === "number") slots = elem.value;
            else if (elem.formatted?.value) {
              const m = elem.formatted.value.ru?.match(/\/(\d+)/);
              if (m) slots = parseInt(m[1], 10);
            }
            continue;
          }
          if (keyRaw.includes("backpack.stat_name.effectiveness")) {
            if (typeof elem.value === "number") effectiveness = elem.value;
            continue;
          }
          if (keyRaw.includes("backpack.stat_name.inner_protection")) {
            if (typeof elem.value === "number") inner_protection = elem.value;
            continue;
          }
          if (FACTOR_PREFIXES.some((p) => keyRaw.startsWith(p))) {
            const p = parseNumericElement(elem);
            if (p) main.push(p);
          }
        }
        if (elem.type === "numericVariants") {
          const p = parseNumericVariantsElement(elem);
          if (p) main.push(p);
        }
      }
    }
  }

  const result: ItemProperties = {};
  if (main.length) result.main = main;
  if (additional.length) result.additional = additional;
  if (slots !== undefined) result.slots = slots;
  if (effectiveness !== undefined) result.effectiveness = effectiveness;
  if (inner_protection !== undefined)
    result.inner_protection = inner_protection;
  return Object.keys(result).length > 0 ? result : undefined;
}

function isAllowedType(parts: string[]): { type: string; cat: string } | null {
  const leaf = parts[parts.length - 1] || "";
  const parent = parts.length >= 2 ? parts[parts.length - 2] : "";

  const flatType = FLAT_DIRS[leaf];
  if (flatType) return flatType;

  const cats = TARGET_CATEGORIES[parent];
  if (cats && cats.includes(leaf)) return { type: parent, cat: leaf };

  return null;
}

function walkDir(dir: string, acc: ItemData[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry.startsWith("_")) continue;
      walkDir(full, acc);
    } else if (stat.isFile() && extname(entry) === ".json") {
      try {
        const raw = JSON.parse(readFileSync(full, "utf8"));
        const parts = dir.split(/[/\\]/);
        const allowed = isAllowedType(parts);
        if (!allowed) continue;

        const item: ItemData = {
          id: basename(entry, ".json"),
          type: allowed.type,
          category: allowed.cat,
          name_ru: raw.name?.lines?.ru || raw.name?.text || "Неизвестно",
          rarity: raw.color || "DEFAULT",
        };
        const props = parseItemProperties(raw.infoBlocks || []);
        if (props) item.item_properties = props;
        acc.push(item);
      } catch (e) {
        console.warn(`Skip ${full}: ${(e as Error).message}`);
      }
    }
  }
}

const items: ItemData[] = [];
walkDir(DATA_DIR, items);
writeFileSync(OUT_FILE, JSON.stringify(items), "utf8");
console.log(`Written ${items.length} items to ${OUT_FILE}`);

if (!SKIP_CLEANUP) {
  const rawDir = resolve("items");
  if (existsSync(rawDir)) {
    rmSync(rawDir, { recursive: true, force: true });
    console.log("  Removed: items (raw EXBO data)");
  }
  const mergedDir = resolve("merged");
  if (existsSync(mergedDir)) {
    rmSync(mergedDir, { recursive: true, force: true });
    console.log("  Removed: merged (output artifacts)");
  }
}
