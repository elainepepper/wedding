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

/** Elaine's final 59-person after-party list, with seating references refreshed on 5 November 2026. */
export const FINAL_AFTER_PARTY_LIST: FinalAfterPartyGuest[] = [
  guest("Aaryan", "elaine-viking", 25),
  guest("Adam", "haykal-viking", 14),
  guest("Afiq", "haykal-viking", 17),
  guest("Aine", "elaine-viking", 23),
  guest("Alain", "elaine-viking", 8),
  guest("Aliff", "haykal-viking", 6, { household: "Soraya" }),
  guest("Annie", "table-3a", 7),
  guest("Anthony Loustau", "haykal-viking", 23, { aliases: ["Anthony"], household: "Anthony & Laura" }),
  guest("Ashlea", "table-3a", 3),
  guest("Azreen", "table-1", 7),
  guest("Brandon", "elaine-viking", 16),
  guest("Brian", "elaine-viking", 6),
  guest("Bryan", "elaine-viking", 19),
  guest("Cecilia", "elaine-viking", 18),
  guest("Cinzia", "elaine-viking", 4),
  guest("Dayoon", "elaine-viking", 11),
  guest("Elaine", "vip", 1, { aliases: ["The Bride", "Elaine Pepper"] }),
  guest("Emelia", "table-1", 2),
  guest("Facundo", "elaine-viking", 5),
  guest("Gabriel", "table-3a", 6),
  guest("Gemma", "unseated", 0),
  guest("Gregory", "elaine-viking", 17),
  guest("Hafeez", "haykal-viking", 22),
  guest("Haykal", "vip", 2, { aliases: ["The Groom"] }),
  guest("Iverson", "table-8", 3),
  guest("Jemma", "elaine-viking", 24),
  guest("Jinho", "elaine-viking", 9),
  guest("Jordon", "elaine-viking", 15),
  guest("Josh", "elaine-viking", 22),
  guest("Justin", "table-3a", 8),
  guest("Kimberly", "table-1", 5),
  guest("Kit", "elaine-viking", 21),
  guest("Kita", "elaine-viking", 10),
  guest("Laura Esseu", "haykal-viking", 24, { aliases: ["Laura"], household: "Anthony & Laura" }),
  guest("Leanne", "table-3a", 2),
  guest("Loron", "elaine-viking", 20),
  guest("Mahmud", "haykal-viking", 10),
  guest("Manis", "haykal-viking", 18),
  guest("Marcus", "haykal-viking", 9),
  guest("Marissa", "haykal-viking", 19),
  guest("Muqri", "haykal-viking", 16),
  guest("Natasha", "elaine-viking", 7),
  guest("Nathaniel", "unseated", 0),
  guest("Nisrina", "table-1", 8),
  guest("Patrick", "table-3a", 1),
  guest("Rachel Jong", "table-1", 6),
  guest("Rachel Phan", "table-1", 4),
  guest("Samantha", "table-1", 3),
  guest("Sameeha", "haykal-viking", 4),
  guest("Sebastian", "table-8", 4),
  guest("Shawn", "haykal-viking", 20),
  guest("Soraya", "haykal-viking", 5),
  guest("Steven", "haykal-viking", 8),
  guest("Syed Zain", "haykal-viking", 15),
  guest("Tiffiny", "haykal-viking", 13),
  guest("Wilson", "elaine-viking", 1),
  guest("Zhao Hang", "haykal-viking", 21),
  guest("Zhi Yie", "table-8", 5),
  guest("Zoey", "elaine-viking", 2),
];

export const FINAL_AFTER_PARTY_COUNT = FINAL_AFTER_PARTY_LIST.length;
