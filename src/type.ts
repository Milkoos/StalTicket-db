export enum InfoColor {
	DEFAULT = "DEFAULT",
	QUEST_ITEM = "QUEST_ITEM",
	RANK_NEWBIE = "RANK_NEWBIE",
	RANK_STALKER = "RANK_STALKER",
	RANK_VETERAN = "RANK_VETERAN",
	RANK_MASTER = "RANK_MASTER",
	RANK_LEGEND = "RANK_LEGEND",
	ART_QUALITY_COMMON = "ART_QUALITY_COMMON",
	ART_QUALITY_UNCOMMON = "ART_QUALITY_UNCOMMON",
	ART_QUALITY_SPECIAL = "ART_QUALITY_SPECIAL",
	ART_QUALITY_RARE = "ART_QUALITY_RARE",
	ART_QUALITY_EXCLUSIVE = "ART_QUALITY_EXCLUSIVE",
	ART_QUALITY_LEGENDARY = "ART_QUALITY_LEGENDARY",
	ART_QUALITY_UNIQUE = "ART_QUALITY_UNIQUE",
}
export type LocalizedString = Record<string, string>;
export interface MessageText {
	type: "text";
	text: string;
}
export interface MessageTranslation {
	type: "translation";
	key: string;
	args: Record<string, string>;
	lines: LocalizedString;
}
export type Message = MessageText | MessageTranslation;
interface FormattedFields {
	formatted?: {
		value?: LocalizedString;
		nameColor?: string;
		valueColor?: string;
	};
}
export interface Colorable extends FormattedFields {
	nameColor?: string;
	valueColor?: string;
}
export interface PriceElement extends Colorable {
	type: "price";
	currency: string;
	amount: number;
}
export interface ItemElement extends Colorable {
	type: "item";
	name?: Message;
	id?: string;
}
export interface TextElement extends Colorable {
	type: "text";
	text: Message;
}
export interface StringKVElement extends Colorable {
	type: "key-value";
	key: Message;
	value: Message;
}
export interface NumericElement extends Colorable {
	type: "numeric";
	name: Message;
	value: number | number[];
}
export interface NumericRangeElement extends Colorable {
	type: "range";
	name: Message;
	min: number;
	max: number;
}
export interface NumericVariantsElement extends Colorable {
	type: "numericVariants";
	name: Message;
	value: number[];
}
export interface UsageElement extends Colorable {
	type: "usage";
	name: Message;
	value: number | number[];
}
export type InfoElement =
	PriceElement | ItemElement | TextElement | StringKVElement | NumericElement | NumericRangeElement | NumericVariantsElement | UsageElement;
export type InfoBlock = TextInfoBlock | ElementListBlock | DamageInfoBlock | AddStatBlock;
export interface TextInfoBlock extends FormattedFields {
	type: "text";
	title: Message;
	text: Message;
}
export interface ElementListBlock extends FormattedFields {
	type: "list";
	title: Message;
	elements: InfoElement[];
}
export interface AddStatBlock extends FormattedFields {
	type: "addStat";
	title: Message;
	elements: InfoElement[];
}
export interface DamageInfoBlock extends FormattedFields {
	type: "damage";
	startDamage: number;
	damageDecreaseStart: number;
	endDamage: number;
	damageDecreaseEnd: number;
	maxDistance: number;
}
export interface Item {
	id: string;
	category: string;
	name: Message;
	color: InfoColor;
	status?: {
		state: string;
	};
	infoBlocks: InfoBlock[];
}
