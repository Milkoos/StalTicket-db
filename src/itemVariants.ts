export interface ItemVariant {
	suffix: string;
	label_ru: string;
}
export const ITEM_VARIANTS: Record<string, readonly ItemVariant[]> = {
	"96n2l": [
		{ suffix: "stalkers", label_ru: "сталкеры" },
		{ suffix: "bandits", label_ru: "бандиты" },
	],
};
export function expandItemVariants<T extends { id: string; name_ru: string }>(item: T): T[] {
	const variants = ITEM_VARIANTS[item.id];
	if (!variants) return [item];
	return variants.map((v) => ({
		...item,
		id: `${item.id}.${v.suffix}`,
		name_ru: `${item.name_ru} (${v.label_ru})`,
	}));
}
