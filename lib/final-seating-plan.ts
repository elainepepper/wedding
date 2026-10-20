export type FinalSeat = {
  seat: number;
  label: string;
  aliases?: string[];
  household?: string;
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

const seat = (seatNumber: number, label: string, options: Omit<FinalSeat, "seat" | "label"> = {}): FinalSeat => ({
  seat: seatNumber,
  label,
  ...options,
});

/**
 * Final Grand Salon seating supplied by Elaine on 20 October 2026.
 *
 * The aliases deliberately use names already present in Guest Manager. A
 * household hint is required anywhere two guests share the same preferred
 * name, so applying this plan can never silently seat the wrong person.
 */
export const FINAL_SEATING_PLAN: FinalSeatingTable[] = [
  {
    key: "vip",
    name: "VIP",
    aliases: ["VIP", "VIP 1"],
    shape: "round",
    capacity: 10,
    x: 38,
    y: 20,
    locked: true,
    notes: "Bride, groom and immediate family",
    seats: [
      seat(1, "Elaine", { aliases: ["The Bride", "Elaine Pepper"] }),
      seat(2, "Haykal", { aliases: ["The Groom", "Haykal"] }),
      seat(3, "Bakhtiar"),
      seat(4, "Juzlinda"),
      seat(5, "Ibrahim"),
      seat(6, "Hasnah"),
      seat(7, "Alice"),
      seat(8, "Albert"),
    ],
  },
  {
    key: "table-1",
    name: "Table 1 - High-School Friends",
    aliases: ["Table 1 - High-School Friends", "Elaine’s HS friends", "Elaine's HS friends"],
    shape: "round",
    capacity: 10,
    x: 21,
    y: 31,
    locked: false,
    notes: "High-School Friends",
    seats: [
      seat(1, "Rachel Jong"), seat(2, "Azreen"), seat(3, "Nisrina"), seat(4, "Nur"),
      seat(5, "Emelia"), seat(6, "Samantha"), seat(7, "Rachel Phan"), seat(8, "Kimberly"),
    ],
  },
  {
    key: "table-2",
    name: "Table 2 - Haykal's family",
    aliases: ["Table 2 - Haykal's family"],
    shape: "round",
    capacity: 10,
    x: 55,
    y: 36,
    locked: false,
    notes: "Haykal's family",
    seats: [
      seat(1, "Mirza"), seat(2, "Fatima"), seat(3, "Alyn"), seat(4, "Zilan"),
      seat(5, "Julieza"), seat(6, "Reza"), seat(7, "Juliena"), seat(8, "Juznida"),
    ],
  },
  {
    key: "table-3",
    name: "Table 3 - Haykal's family",
    aliases: ["Table 3 - Haykal's family"],
    shape: "round",
    capacity: 10,
    x: 74,
    y: 31,
    locked: false,
    notes: "Haykal's family",
    seats: [
      seat(1, "Doris"), seat(2, "Wan Aikhsan"), seat(3, "Ardeena"), seat(4, "Shol"),
      seat(5, "Ani"), seat(6, "Ismail", { household: "Zainab Rahim" }),
      seat(7, "Zainab", { household: "Zainab Rahim" }), seat(8, "Nurul"),
      seat(9, "Sumaiya"), seat(10, "Najib"),
    ],
  },
  {
    key: "table-3a",
    name: "3A - College Friends",
    aliases: ["3A - College Friends", "Elaine’s College friends", "Elaine's College friends"],
    shape: "round",
    capacity: 10,
    x: 21,
    y: 48,
    locked: false,
    notes: "College Friends",
    seats: [
      seat(1, "Annie"), seat(2, "Gabriel"), seat(3, "Patrick"), seat(4, "Leanne"),
      seat(5, "Ashlea"), seat(6, "Justin"), seat(7, "Wendy"), seat(8, "Joey"),
    ],
  },
  {
    key: "table-5",
    name: "Table 5 - Haykal's family",
    aliases: ["Table 5 - Haykal's family"],
    shape: "round",
    capacity: 10,
    x: 59,
    y: 54,
    locked: false,
    notes: "Haykal's family",
    seats: [
      seat(1, "Zakiah Othman"), seat(2, "Adrian", { aliases: ["Adrian Feisal"] }),
      seat(3, "Aliff", { household: "Aliff Qayyum" }), seat(4, "Ayesha"), seat(5, "Asma"),
      seat(6, "Isa"), seat(7, "Iman"), seat(8, "Rahman"), seat(9, "Nadia"),
    ],
  },
  {
    key: "table-6",
    name: "Table 6 - Haykal's family",
    aliases: ["Table 6 - Haykal's family"],
    shape: "round",
    capacity: 10,
    x: 75,
    y: 49,
    locked: false,
    notes: "Haykal's family",
    seats: [
      seat(1, "Adham"), seat(2, "Faudziah"), seat(3, "Mukhlis"), seat(4, "Farah"),
      seat(5, "Farhana"), seat(6, "Zainee"), seat(7, "Shida"), seat(8, "Yeoh"),
    ],
  },
  {
    key: "table-7",
    name: "Table 7 - Elaine's dad's guests",
    aliases: ["Table 7 - Elaine's dad's guests", "Elaine dad work 2 (table of datuks)"],
    shape: "round",
    capacity: 10,
    x: 21,
    y: 66,
    locked: false,
    notes: "Elaine's dad's guests",
    seats: [
      seat(1, "Mr Sukhairy", { aliases: ["Mr Sukhairy bin Abd Rahman"] }),
      seat(2, "Mrs Sukhairy", { aliases: ["Mrs Sukhairy bin Abd Rahman"] }),
      seat(3, "Dato' Othman", { aliases: ["Dato’ Othman bin Sulan", "Dato Othman bin Sulan"] }),
      seat(4, "Datin Othman", { aliases: ["Datin Othman bin Sulan"] }),
      seat(5, "Datuk Dr Visvanathan", { aliases: ["Datuk Dr Visvanathan Ananthan"] }),
      seat(6, "Datin Visvanathan", { aliases: ["Datin Visvanathan Ananthan"] }),
      seat(7, "Datuk Shanker Raj", { aliases: ["Datuk Shanker Raj Ayanger"] }),
      seat(8, "Datin Shanker Raj", { aliases: ["Datin Shanker Raj Ayanger"] }),
      seat(9, "Mr Abdul Rahman", { aliases: ["Mr Abdul Rahman bin Harun"] }),
      seat(10, "Mrs Abdul Rahman", { aliases: ["Mrs Abdul Rahman bin Harun", "Mrs Abdul Rahman"] }),
    ],
  },
  {
    key: "table-8",
    name: "Table 8 - Haykal's friends",
    aliases: ["Table 8 - Haykal's friends", "PERTH PARTY PEOPLE"],
    shape: "round",
    capacity: 10,
    x: 60,
    y: 72,
    locked: false,
    notes: "Haykal's friends",
    seats: [
      seat(1, "Syahirah"), seat(2, "Ezqil"), seat(3, "Sebastian"), seat(4, "Zhi Yie"),
      seat(5, "Mahmud"), seat(6, "Iverson"), seat(7, "Syahiran"), seat(8, "Uyaina"),
    ],
  },
  {
    key: "table-9",
    name: "Table 9 - Haykal's family",
    aliases: ["Table 9 - Haykal's family"],
    shape: "round",
    capacity: 10,
    x: 75,
    y: 68,
    locked: false,
    notes: "Haykal's family",
    seats: [
      seat(1, "Ahmed Muaz"), seat(2, "Shariati"), seat(3, "Zainab Wan Chik"),
      seat(4, "Nurul Fatini Zulkifli"), seat(5, "Muzakir"), seat(6, "Muazzam"),
      seat(7, "Khairul"), seat(8, "Nur Endon"), seat(9, "Endon"),
    ],
  },
  {
    key: "table-10",
    name: "Table 10 - Elaine's dad's guests",
    aliases: ["Table 10 - Elaine's dad's guests", "Round table 4 (Elaine Dad work ppl)"],
    shape: "round",
    capacity: 10,
    x: 21,
    y: 82,
    locked: false,
    notes: "Elaine's dad's guests",
    seats: [
      seat(1, "Mdm Nainasuziha"), seat(2, "Teresa", { household: "Anthony & Tess" }),
      seat(3, "Anthony", { household: "Anthony & Tess" }), seat(4, "Mr Lee Ah Kong"),
      seat(5, "Mrs Lee"), seat(6, "Mr Puvalenthiran"), seat(7, "Ms Effa 'Azura"),
      seat(8, "Ms Waheda"),
    ],
  },
  {
    key: "table-11",
    name: "Table 11 - Haykal's family friends",
    aliases: ["Table 11 - Haykal's family friends"],
    shape: "round",
    capacity: 10,
    x: 58,
    y: 88,
    locked: false,
    notes: "Haykal's family friends - not on the venue plan",
    seats: [
      seat(1, "Dato' Frank Koay", { aliases: ["Dato’ Frank Koay", "Dato Frank Koay"] }),
      seat(2, "Datin Vanessa"), seat(3, "Wesley"), seat(4, "Suzanne"),
      seat(5, "Ismail Ani Arope"), seat(6, "Syed Wafa"), seat(7, "Careena Lai"),
      seat(8, "Danny See"), seat(9, "Mrs Park"),
    ],
  },
  {
    key: "elaine-viking",
    name: "Elaine's Viking",
    aliases: ["Elaine's Viking", "Elaine’s Viking", "Elaine’s colleagues + Perth people", "Elaine's colleagues + Perth people"],
    shape: "banquet",
    capacity: 24,
    x: 40,
    y: 57,
    locked: true,
    notes: "Seats 1-12 away from aisle, then 13-23 along aisle side",
    seats: [
      seat(1, "Wilson"), seat(2, "Zoey"), seat(3, "Cinzia"), seat(4, "Facundo"),
      seat(5, "Nathaniel"), seat(6, "Gemma"), seat(7, "Brian"), seat(8, "Natasha"),
      seat(9, "Alain"), seat(10, "Jinho"), seat(11, "Kita"), seat(12, "Dayoon"),
      seat(13, "Jordon"), seat(14, "Brandon"), seat(15, "Gregory"), seat(16, "Cecilia"),
      seat(17, "Bryan"), seat(18, "Loron"), seat(19, "Kit"), seat(20, "Josh"),
      seat(21, "Aine"), seat(22, "Jemma"), seat(23, "Aaryan"),
    ],
  },
  {
    key: "haykal-viking",
    name: "Haykal's Viking",
    aliases: ["Haykal's Viking", "Haykal’s Viking", "Viking 2"],
    shape: "banquet",
    capacity: 24,
    x: 60,
    y: 57,
    locked: true,
    notes: "Seats 1-11 away from aisle, then 12-23 along aisle side",
    seats: [
      seat(1, "Firzana"), seat(2, "Fauzan"), seat(3, "Sahil"), seat(4, "Sameeha"),
      seat(5, "Aliff", { household: "Soraya" }), seat(6, "Soraya"),
      seat(7, "Laura", { aliases: ["Laura Esseu"], household: "Anthony & Laura" }),
      seat(8, "Anthony", { aliases: ["Anthony Loustau"], household: "Anthony & Laura" }),
      seat(9, "Marcus"), seat(10, "Kamal"), seat(11, "Ainis"), seat(12, "Tiffiny"),
      seat(13, "Adam"), seat(14, "Syed Zain"), seat(15, "Muqri"), seat(16, "Afiq"),
      seat(17, "Manis"), seat(18, "Marissa"), seat(19, "Shawn"), seat(20, "Zhao Hang"),
      seat(21, "Hafeez"), seat(22, "Steven"), seat(23, "Aiman"),
    ],
  },
];

export const FINAL_SEATING_GUEST_COUNT = FINAL_SEATING_PLAN.reduce((total, table) => total + table.seats.length, 0);
