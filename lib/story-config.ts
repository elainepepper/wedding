// Auto-generated from public/wedding/story/config.json — the landing page.
// Chapter words and which painting each stands in. Arrange in Story-Studio.
export const defaultStoryConfig = {
  "version": 3,
  "depth": 1500,
  "stations": [
    {
      "x": 0,
      "y": 0
    },
    {
      "x": -70,
      "y": -15
    },
    {
      "x": 75,
      "y": 8
    },
    {
      "x": -45,
      "y": 20
    },
    {
      "x": 55,
      "y": -15
    },
    {
      "x": -65,
      "y": 12
    },
    {
      "x": 0,
      "y": 0
    }
  ],
  "chapters": [
    {
      "id": "title",
      "kind": "title",
      "overline": "Elaine & Haykal · 07 · 11 · 2026",
      "heading": "Our Story & Yours",
      "line": "a hand-painted journey to our wedding day",
      "planes": [],
      "bg": "dream-1"
    },
    {
      "id": "kuching",
      "overline": "Chapter one · Kuching, Sarawak",
      "heading": "A girl from the city of cats",
      "line": "Elaine grew up in Kuching, among old streets, warm rain and stories waiting to be told.",
      "planes": [],
      "bg": "dream-2"
    },
    {
      "id": "georgetown",
      "blue": true,
      "overline": "Chapter two · George Town, Penang",
      "heading": "A boy from the island",
      "line": "Haykal grew up among painted shophouses, sea air and the generous bustle of George Town.",
      "planes": [],
      "bg": "dream-3"
    },
    {
      "id": "perth",
      "overline": "Chapter three · Perth, 2016",
      "heading": "Of all the cities in the world",
      "line": "Two strangers crossed different oceans to the same quiet city, and did not yet know it.",
      "planes": [],
      "bg": "dream-1"
    },
    {
      "id": "together",
      "overline": "Chapter four · Perth, 2020",
      "heading": "The year the world stood still",
      "line": "Somewhere between ordinary days and long conversations, friendship quietly became love.",
      "planes": [],
      "bg": "dream-2"
    },
    {
      "id": "seoul",
      "overline": "Chapter five · Seoul, autumn 2025",
      "heading": "On one knee, under falling leaves",
      "line": "On an autumn afternoon in Seoul, Haykal asked. Elaine said yes.",
      "planes": [],
      "bg": "dream-3"
    },
    {
      "id": "wedding",
      "kind": "finale",
      "overline": "Chapter six · Kuala Lumpur",
      "heading": "…and now, forever",
      "finale": {
        "overline": "You are warmly invited",
        "heading": "7 November 2026",
        "line": "The Grand Salon · Grand Hyatt Kuala Lumpur\nDoors from 6:00pm · the celebration from 6:45pm",
        "cta": "Step into our celebration ↓"
      },
      "planes": [],
      "bg": "dream-1"
    }
  ]
} as const;
export type StoryConfig = typeof defaultStoryConfig;
