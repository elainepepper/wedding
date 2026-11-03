export type FinalAfterPartyGuest = {
  label: string;
  aliases?: string[];
  household?: string;
  tableKey: string;
  seat: number;
};

const guest = (
  label: string,
  tableKey: string,
  seat: number,
  options: Omit<FinalAfterPartyGuest, "label" | "tableKey" | "seat"> = {},
): FinalAfterPartyGuest => ({ label, tableKey, seat, ...options });

/** Elaine's final 59-person After Hours list, supplied on 3 November 2026. */
export const FINAL_AFTER_PARTY_LIST: FinalAfterPartyGuest[] = [
  guest("Aaryan", "elaine-viking", 23),
  guest("Adam", "haykal-viking", 13),
  guest("Afiq", "haykal-viking", 16),
  guest("Aine", "elaine-viking", 21),
  guest("Alain", "elaine-viking", 9),
  guest("Aliff", "haykal-viking", 5, { household: "Soraya" }),
  guest("Annie", "table-3a", 7),
  guest("Anthony Loustau", "haykal-viking", 8, { aliases: ["Anthony"], household: "Anthony & Laura" }),
  guest("Ashlea", "table-3a", 3),
  guest("Azreen", "table-1", 7),
  guest("Brandon", "elaine-viking", 14),
  guest("Brian", "elaine-viking", 7),
  guest("Bryan", "elaine-viking", 17),
  guest("Cecilia", "elaine-viking", 16),
  guest("Cinzia", "elaine-viking", 3),
  guest("Dayoon", "elaine-viking", 12),
  guest("Elaine", "vip", 1, { aliases: ["The Bride", "Elaine Pepper"] }),
  guest("Emelia", "table-1", 2),
  guest("Facundo", "elaine-viking", 4),
  guest("Gabriel", "table-3a", 6),
  guest("Gemma", "elaine-viking", 6),
  guest("Gregory", "elaine-viking", 15),
  guest("Hafeez", "haykal-viking", 21),
  guest("Haykal", "vip", 2, { aliases: ["The Groom"] }),
  guest("Iverson", "table-8", 6),
  guest("Jemma", "elaine-viking", 22),
  guest("Jinho", "elaine-viking", 10),
  guest("Jordon", "elaine-viking", 13),
  guest("Josh", "elaine-viking", 20),
  guest("Justin", "table-3a", 8),
  guest("Kimberly", "table-1", 5),
  guest("Kit", "elaine-viking", 19),
  guest("Kita", "elaine-viking", 11),
  guest("Laura Esseu", "haykal-viking", 7, { aliases: ["Laura"], household: "Anthony & Laura" }),
  guest("Leanne", "table-3a", 2),
  guest("Loron", "elaine-viking", 18),
  guest("Mahmud", "table-8", 5),
  guest("Manis", "haykal-viking", 17),
  guest("Marcus", "haykal-viking", 9),
  guest("Marissa", "haykal-viking", 18),
  guest("Muqri", "haykal-viking", 15),
  guest("Natasha", "elaine-viking", 8),
  guest("Nathaniel", "elaine-viking", 5),
  guest("Nisrina", "table-1", 8),
  guest("Patrick", "table-3a", 1),
  guest("Rachel Jong", "table-1", 6),
  guest("Rachel Phan", "table-1", 4),
  guest("Samantha", "table-1", 3),
  guest("Sameeha", "haykal-viking", 4),
  guest("Sebastian", "table-8", 3),
  guest("Shawn", "haykal-viking", 19),
  guest("Soraya", "haykal-viking", 6),
  guest("Steven", "haykal-viking", 22),
  guest("Syed Zain", "haykal-viking", 14),
  guest("Tiffiny", "haykal-viking", 12),
  guest("Wilson", "elaine-viking", 1),
  guest("Zhao Hang", "haykal-viking", 20),
  guest("Zhi Yie", "table-8", 4),
  guest("Zoey", "elaine-viking", 2),
];

export const FINAL_AFTER_PARTY_COUNT = FINAL_AFTER_PARTY_LIST.length;
