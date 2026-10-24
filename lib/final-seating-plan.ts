export type FinalMeal = "Lamb" | "Salmon" | "Kids meal" | "No meal (baby)";

export type FinalSeat = {
  seat: number;
  label: string;
  meal: FinalMeal;
  aliases?: string[];
  household?: string;
  dietaryRequirements?: string;
  allergies?: string;
};

export type FinalSeatingTable = {
  key: string;
  name: string;
  aliases: string[];
  shape: "round" | "banquet";
  capacity: number;
  x: number;
  y: number;
  locked: boolean;
  notes: string;
  seats: FinalSeat[];
};

const seat = (
  seatNumber: number,
  label: string,
  meal: FinalMeal,
  options: Omit<FinalSeat, "seat" | "label" | "meal"> = {},
): FinalSeat => ({ seat: seatNumber, label, meal, ...options });

/**
 * Final Grand Salon kitchen and seating sheet supplied by Elaine on 24 October 2026.
 *
 * The aliases deliberately include previous table names so applying a revised plan
 * reuses the existing tables. Household hints disambiguate repeated preferred names.
 * Bakhtiar's shellfish allergy is retained from Elaine's direct instruction because
 * the supplied kitchen PDF omitted it; safety notes are never silently removed.
 */
export const FINAL_SEATING_PLAN: FinalSeatingTable[] = [
  {
    key: "vip",
    name: "VIP table",
    aliases: ["VIP table", "VIP", "VIP 1"],
    shape: "round", capacity: 10, x: 38, y: 20, locked: true,
    notes: "Bride, groom and immediate family",
    seats: [
      seat(1, "Elaine", "Lamb", { aliases: ["The Bride", "Elaine Pepper"] }),
      seat(2, "Haykal", "Salmon", { aliases: ["The Groom", "Haykal"] }),
      seat(3, "Bakhtiar", "Lamb", { allergies: "Slight shellfish allergy" }),
      seat(4, "Juzlinda", "Lamb"), seat(5, "Ibrahim", "Salmon"), seat(6, "Hasnah", "Lamb"),
      seat(7, "Alice", "Lamb"), seat(8, "Albert", "Salmon"),
    ],
  },
  {
    key: "table-1",
    name: "Table 1 High-School Friends",
    aliases: ["Table 1 High-School Friends", "Table 1 - High-School Friends", "Elaine’s HS friends", "Elaine's HS friends"],
    shape: "round", capacity: 10, x: 21, y: 31, locked: false, notes: "High-School Friends",
    seats: [
      seat(1, "Nur", "Salmon"), seat(2, "Emelia", "Salmon"), seat(3, "Samantha", "Salmon"),
      seat(4, "Rachel Phan", "Salmon"), seat(5, "Kimberly", "Salmon"), seat(6, "Rachel Jong", "Lamb"),
      seat(7, "Azreen", "Salmon"), seat(8, "Nisrina", "Salmon"),
    ],
  },
  {
    key: "table-2",
    name: "Table 2 Haykal's family",
    aliases: ["Table 2 Haykal's family", "Table 2 - Haykal's family"],
    shape: "round", capacity: 10, x: 55, y: 36, locked: false, notes: "Haykal's family",
    seats: [
      seat(1, "Zilan", "Lamb"), seat(2, "Julieza", "Lamb"), seat(3, "Adham", "Lamb"),
      seat(4, "Faudziah", "Lamb"), seat(5, "Juliena", "Lamb"), seat(6, "Reza", "Lamb"),
      seat(7, "Juznida", "Lamb"), seat(8, "Mrs Park", "Salmon"), seat(9, "Datin Angie Teh", "Salmon"),
      seat(10, "Datuk Lee Jin Bok", "Lamb"),
    ],
  },
  {
    key: "table-3",
    name: "Table 3 Haykal's family",
    aliases: ["Table 3 Haykal's family", "Table 3 - Haykal's family"],
    shape: "round", capacity: 10, x: 74, y: 31, locked: false, notes: "Haykal's family",
    seats: [
      seat(1, "Doris", "Salmon", { allergies: "Honey allergy" }), seat(2, "Wan Aikhsan", "Salmon"),
      seat(3, "Ardeena", "Lamb"), seat(4, "Ani", "Salmon"), seat(5, "Shol", "Salmon"),
      seat(6, "Ismail", "Lamb", { household: "Zainab Rahim" }),
      seat(7, "Zainab", "Salmon", { household: "Zainab Rahim" }), seat(8, "Nurul", "Salmon"),
      seat(9, "Sumaiya", "Lamb"), seat(10, "Najib", "Salmon"),
    ],
  },
  {
    key: "table-3a",
    name: "Table 3A College Friends",
    aliases: ["Table 3A College Friends", "3A - College Friends", "Elaine’s College friends", "Elaine's College friends"],
    shape: "round", capacity: 10, x: 21, y: 48, locked: false, notes: "College Friends",
    seats: [
      seat(1, "Patrick", "Salmon"), seat(2, "Leanne", "Lamb"), seat(3, "Ashlea", "Salmon"),
      seat(4, "Wendy", "Lamb"), seat(5, "Joey", "Salmon"), seat(6, "Gabriel", "Lamb"),
      seat(7, "Annie", "Salmon"), seat(8, "Justin", "Lamb"),
    ],
  },
  {
    key: "table-5",
    name: "Table 5 Haykal's family",
    aliases: ["Table 5 Haykal's family", "Table 5 - Haykal's family"],
    shape: "round", capacity: 10, x: 59, y: 54, locked: false, notes: "Haykal's family",
    seats: [
      seat(1, "Zakiah Othman", "Lamb"), seat(2, "Adrian Feisal", "Lamb", { aliases: ["Adrian"] }),
      seat(3, "Aliff Qayyum", "Lamb", { aliases: ["Aliff"], household: "Aliff Qayyum" }),
      seat(4, "Ayesha", "Salmon"), seat(5, "Iman", "Kids meal"), seat(6, "Asma", "Salmon"),
      seat(7, "Isa", "Salmon"), seat(8, "Rahman", "Lamb"), seat(9, "Nadia", "Salmon"),
    ],
  },
  {
    key: "table-6",
    name: "Table 6 Haykal's family",
    aliases: ["Table 6 Haykal's family", "Table 6 - Haykal's family"],
    shape: "round", capacity: 10, x: 75, y: 49, locked: false, notes: "Haykal's family",
    seats: [
      seat(1, "Dato' Frank Koay", "Lamb", { aliases: ["Dato’ Frank Koay", "Dato Frank Koay"] }),
      seat(2, "Datin Vanessa", "Salmon"), seat(3, "Danny See", "Salmon"), seat(4, "Careena Lai", "Lamb"),
      seat(5, "Yeoh", "Salmon"), seat(6, "Shida", "Salmon"), seat(7, "Farah", "Salmon"),
      seat(8, "Zainee", "Lamb"), seat(9, "Farhana", "Salmon"), seat(10, "Mukhlis", "Lamb"),
    ],
  },
  {
    key: "table-7",
    name: "Table 7 Elaine's dad's guests",
    aliases: ["Table 7 Elaine's dad's guests", "Table 7 - Elaine's dad's guests", "Elaine dad work 2 (table of datuks)"],
    shape: "round", capacity: 10, x: 21, y: 66, locked: false, notes: "Elaine's dad's guests",
    seats: [
      seat(1, "Mr Sukhairy bin Abd Rahman", "Lamb", { aliases: ["Mr Sukhairy"] }),
      seat(2, "Mrs Sukhairy bin Abd Rahman", "Lamb", { aliases: ["Mrs Sukhairy"] }),
      seat(3, "Dato' Othman bin Sulan", "Salmon", { aliases: ["Dato’ Othman bin Sulan", "Dato Othman bin Sulan", "Dato' Othman"] }),
      seat(4, "Datin Othman bin Sulan", "Salmon", { aliases: ["Datin Othman"] }),
      seat(5, "Datuk Dr Visvanathan Ananthan", "Lamb", { aliases: ["Datuk Dr Visvanathan"] }),
      seat(6, "Datin Visvanathan Ananthan", "Lamb", { aliases: ["Datin Visvanathan"] }),
      seat(7, "Datuk Shanker Raj Ayanger", "Lamb", { aliases: ["Datuk Shanker Raj"] }),
      seat(8, "Datin Shanker Raj Ayanger", "Lamb", { aliases: ["Datin Shanker Raj"] }),
      seat(9, "Mr Abdul Rahman", "Lamb", { aliases: ["Mr Abdul Rahman bin Harun"] }),
      seat(10, "Mrs Abdul Rahman", "Lamb", { aliases: ["Mrs Abdul Rahman bin Harun"] }),
    ],
  },
  {
    key: "table-8",
    name: "Table 8 Haykal's friends",
    aliases: ["Table 8 Haykal's friends", "Table 8 - Haykal's friends", "PERTH PARTY PEOPLE"],
    shape: "round", capacity: 10, x: 60, y: 72, locked: false, notes: "Haykal's friends",
    seats: [
      seat(1, "Syahirah", "Salmon"), seat(2, "Ezqil", "Lamb"), seat(3, "Sebastian", "Salmon"),
      seat(4, "Zhi Yie", "Lamb"), seat(5, "Mahmud", "Lamb"), seat(6, "Iverson", "Lamb"),
      seat(7, "Syahiran", "Lamb"), seat(8, "Uyaina", "Salmon"),
    ],
  },
  {
    key: "table-9",
    name: "Table 9 Haykal's family",
    aliases: ["Table 9 Haykal's family", "Table 9 - Haykal's family"],
    shape: "round", capacity: 10, x: 75, y: 68, locked: false, notes: "Haykal's family",
    seats: [
      seat(1, "Ahmed Muaz", "Salmon"), seat(2, "Shariati", "Lamb"), seat(3, "Zainab Wan Chik", "Lamb"),
      seat(4, "Nurul Fatini Zulkifli", "Salmon"), seat(5, "Muzakir", "Lamb"), seat(6, "Muazzam", "Lamb"),
      seat(7, "Khairul", "Salmon"), seat(8, "Nur Endon", "Lamb"), seat(9, "Endon", "Salmon"),
    ],
  },
  {
    key: "table-10",
    name: "Table 10 Elaine's dad's guests",
    aliases: ["Table 10 Elaine's dad's guests", "Table 10 - Elaine's dad's guests", "Round table 4 (Elaine Dad work ppl)"],
    shape: "round", capacity: 10, x: 21, y: 82, locked: false, notes: "Elaine's dad's guests",
    seats: [
      seat(1, "Mdm Nainasuziha", "Salmon"), seat(2, "Teresa", "Salmon", { household: "Anthony & Tess" }),
      seat(3, "Anthony", "Lamb", { household: "Anthony & Tess" }), seat(4, "Mr Lee Ah Kong", "Salmon"),
      seat(5, "Mrs Lee", "Salmon"), seat(6, "Mr Puvalenthiran", "Salmon"), seat(7, "Ms Effa 'Azura", "Lamb"),
      seat(8, "Ms Waheda", "Lamb"),
    ],
  },
  {
    key: "table-11",
    name: "Table 11 Haykal's family friends",
    aliases: ["Table 11 Haykal's family friends", "Table 11 - Haykal's family friends"],
    shape: "round", capacity: 10, x: 58, y: 88, locked: false, notes: "Haykal's family friends - not on the venue plan",
    seats: [
      seat(1, "Dato' Tiffanee", "Lamb", { aliases: ["Dato’ Tiffanee", "Dato Tiffanee"] }),
      seat(2, "Dato' Prof. Mandy Chew", "Salmon", { aliases: ["Dato’ Prof. Mandy Chew", "Dato Prof Mandy Chew", "Mandy Chew"] }),
      seat(3, "Wesley", "Lamb"), seat(4, "Suzanne", "Salmon"), seat(5, "Alyn", "Lamb"),
      seat(6, "Fatima", "No meal (baby)", { dietaryRequirements: "No meal (baby) · High chair needed" }),
      seat(7, "Mirza", "Lamb"), seat(8, "Syed Wafa", "Lamb"), seat(9, "Ismail Ani Arope", "Lamb"),
    ],
  },
  {
    key: "elaine-viking",
    name: "Elaine's Viking curved table",
    aliases: ["Elaine's Viking curved table", "Elaine's Viking", "Elaine’s Viking", "Elaine’s colleagues + Perth people", "Elaine's colleagues + Perth people"],
    shape: "banquet", capacity: 24, x: 40, y: 57, locked: true,
    notes: "Seats 1-12 away from aisle, then 13-23 along aisle side",
    seats: [
      seat(1, "Wilson", "Lamb"), seat(2, "Zoey", "Lamb"), seat(3, "Cinzia", "Salmon"),
      seat(4, "Facundo", "Lamb"), seat(5, "Nathaniel", "Lamb"), seat(6, "Gemma", "Lamb"),
      seat(7, "Brian", "Lamb"), seat(8, "Natasha", "Lamb"), seat(9, "Alain", "Salmon"),
      seat(10, "Jinho", "Lamb"), seat(11, "Kita", "Salmon"), seat(12, "Dayoon", "Lamb"),
      seat(13, "Jordon", "Lamb"), seat(14, "Brandon", "Salmon"), seat(15, "Gregory", "Lamb"),
      seat(16, "Cecilia", "Lamb"), seat(17, "Bryan", "Salmon"), seat(18, "Loron", "Lamb"),
      seat(19, "Kit", "Salmon"), seat(20, "Josh", "Lamb"), seat(21, "Aine", "Salmon"),
      seat(22, "Jemma", "Salmon"), seat(23, "Aaryan", "Lamb"),
    ],
  },
  {
    key: "haykal-viking",
    name: "Haykal's Viking curved table",
    aliases: ["Haykal's Viking curved table", "Haykal's Viking", "Haykal’s Viking", "Viking 2"],
    shape: "banquet", capacity: 24, x: 60, y: 57, locked: true,
    notes: "Seats 1-11 away from aisle, then 12-23 along aisle side",
    seats: [
      seat(1, "Firzana", "Lamb"), seat(2, "Fauzan", "Lamb"), seat(3, "Sahil", "Lamb"),
      seat(4, "Sameeha", "Salmon"), seat(5, "Aliff", "Lamb", { household: "Soraya" }),
      seat(6, "Soraya", "Salmon"), seat(7, "Laura Esseu", "Salmon", { aliases: ["Laura"], household: "Anthony & Laura" }),
      seat(8, "Anthony Loustau", "Lamb", { aliases: ["Anthony"], household: "Anthony & Laura" }),
      seat(9, "Marcus", "Lamb"), seat(10, "Kamal", "Lamb"), seat(11, "Ainis", "Salmon"),
      seat(12, "Tiffiny", "Salmon"), seat(13, "Adam", "Lamb"), seat(14, "Syed Zain", "Lamb"),
      seat(15, "Muqri", "Lamb"), seat(16, "Afiq", "Lamb"), seat(17, "Manis", "Lamb"),
      seat(18, "Marissa", "Salmon"), seat(19, "Shawn", "Lamb"), seat(20, "Zhao Hang", "Salmon"),
      seat(21, "Hafeez", "Lamb"), seat(22, "Steven", "Lamb"), seat(23, "Aiman", "Lamb"),
    ],
  },
];

export const FINAL_SEATING_GUEST_COUNT = FINAL_SEATING_PLAN.reduce((total, table) => total + table.seats.length, 0);
