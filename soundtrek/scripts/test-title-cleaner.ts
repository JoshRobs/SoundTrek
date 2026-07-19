// Harness for the title cleaner — run: npx tsx scripts/test-title-cleaner.ts
import {
  cleanTrackTitle,
  cleanTracklistTitles,
  type TrackTitleContext,
} from "../src/utils/trackTitle";

const cases: [string, TrackTitleContext, string][] = [
  [
    'Gustavo Santaolalla - All Gone, from "The Last of Us Part I" Soundtrack',
    { gameTitle: "The Last of Us Remastered", composers: ["Gustavo Santaolalla"] },
    "All Gone",
  ],
  [
    "FFXII: The Zodiac Age OST Stilshrine of Miriam",
    { gameTitle: "Final Fantasy XII: The Zodiac Age" },
    "Stilshrine of Miriam",
  ],
  [
    "Momodora Reverie Under the Moonlight OST   Confrontation",
    { gameTitle: "Momodora: Reverie Under the Moonlight" },
    "Confrontation",
  ],
  [
    "The Lord of the Rings: The Return of the King CR - 12. The Siege Of Gondor",
    { gameTitle: "The Lord of the Rings: The Return of the King" },
    "The Siege Of Gondor",
  ],
  [
    "Yakuza 0 OST - 17 One Eyed Slugger",
    { gameTitle: "Yakuza 0", trackNumber: 17 },
    "One Eyed Slugger",
  ],
  [
    "7 PM (Snow) - Animal Crossing: Wild World Soundtrack",
    { gameTitle: "Animal Crossing: Wild World", trackNumber: 7 },
    "7 PM (Snow)",
  ],
  [
    "Stronghold Crusader: Definitive Edition (2025) OST Soundtrack - Honor 5 [4K FLAC UHD]",
    { gameTitle: "Stronghold Crusader" },
    "Honor 5",
  ],
  [
    "Honkai Impact 3rd OST: Reborn [EXTENDED].",
    { gameTitle: "Honkai Impact 3rd" },
    "Reborn",
  ],
  [
    "Counter-Strike: Global Offensive Soundtrack - Stocking Up",
    { gameTitle: "Counter-Strike: Global Offensive" },
    "Stocking Up",
  ],
  [
    'The Last of Us: DLC-The Left Behind Soundtrack:"Apprehension" (HQ)',
    { gameTitle: "The Last of Us", composers: ["Gustavo Santaolalla"] },
    "Apprehension",
  ],
  ["Flow - Flow theme", { gameTitle: "Flow" }, "Flow theme"],
  ["Flow - Flow", { gameTitle: "Flow" }, "Flow"],
  [
    'Gustavo Santaolalla - The Last of Us, from "The Last of Us Part I" Soundtrack',
    { gameTitle: "The Last of Us", composers: ["Gustavo Santaolalla"] },
    "The Last of Us",
  ],
  [
    'Gustavo Santaolalla - All Gone (No Escape), from "The Last of Us Part I" Soundtrack',
    { gameTitle: "The Last of Us", composers: ["Gustavo Santaolalla"] },
    "All Gone (No Escape)",
  ],
  [
    "Dino Crisis Ost 5 - An Encounter",
    { gameTitle: "Dino Crisis" },
    "An Encounter",
  ],
  [
    "Fell Spirits (Total War: Warhammer Soundtrack)",
    { gameTitle: "Total War: Warhammer" },
    "Fell Spirits",
  ],
  [
    "Welcome, Fruit Ninja - Fruit Ninja Music",
    { gameTitle: "Fruit Ninja" },
    "Welcome, Fruit Ninja",
  ],
  [
    "Nighttime Fruit Festival (LNY Mix) - Fruit Ninja Music",
    { gameTitle: "Fruit Ninja" },
    "Nighttime Fruit Festival (LNY Mix)",
  ],
  [
    "Batman The Enemy Withing Soundtack - The Pact Fight",
    { gameTitle: "Batman: The Enemy Within" },
    "The Pact Fight",
  ],
  [
    "Leonidas Fallen | Assassin's Creed Odyssey (OST) | The Flight",
    { gameTitle: "Assassin's Creed Odyssey", composers: ["The Flight"] },
    "Leonidas Fallen",
  ],
  [
    "Doom 64 Soundtrack - Map 17 - Watch Your Step",
    { gameTitle: "Doom 64" },
    "Map 17 - Watch Your Step",
  ],
  [
    "Soul Calibur II OST - Under The Star Of Destiny",
    { gameTitle: "SoulCalibur II" },
    "Under The Star Of Destiny",
  ],
  [
    "Perfect Solution - Super Paper Mario OST",
    { gameTitle: "Super Paper Mario" },
    "Perfect Solution",
  ],
  [
    "Half-Life 2 OST — Triage at Dawn",
    { gameTitle: "Half-Life 2" },
    "Triage at Dawn",
  ],
  ["01. The Quarantine Zone", { gameTitle: "The Last of Us" }, "The Quarantine Zone"],
  ["7 Days", { gameTitle: "Whatever" }, "7 Days"],
  ["1000 Words", { gameTitle: "Final Fantasy X-2" }, "1000 Words"],
  [
    "Gotham Knights - Official Court of Owls Story Trailer Song: \"Mephistos Lullaby\"",
    { gameTitle: "Gotham Knights" },
    "Mephistos Lullaby",
  ],
  [
    "Final Fantasy 7 OST - Aerith's Theme",
    { gameTitle: "Final Fantasy VII" },
    "Aerith's Theme",
  ],
  [
    "The Legend of Zelda: Breath of the Wild OST - Kass' Theme",
    { gameTitle: "The Legend of Zelda: Breath of the Wild" },
    "Kass' Theme",
  ],
  [
    "Main Theme - The Elder Scrolls V: Skyrim Original Game Soundtrack",
    { gameTitle: "The Elder Scrolls V: Skyrim", composers: ["Jeremy Soule"] },
    "Main Theme",
  ],
];

// Playlist-level cases: [titles, ctx, expected]
const listCases: [string[], TrackTitleContext, string[]][] = [
  // Majority game-name prefix, no separators (Crysis Warhead pattern).
  // "Theme" suffix must survive: only 6/8 share it exactly, and it's
  // meaningful anyway.
  [
    [
      "Crysis Warhead Mine Fight Theme",
      "Crysis Warhead Hunter Fight Theme",
      "Crysis Warhead Hero Theme",
      "Crysis Warhead Boss Fight Theme2",
      "Crysis Warhead Boss Fight Theme1",
      "Crysis Warhead Train Battle theme",
      "Crysis Warhead Hovercraft Pursuit theme",
      "Crysis Warhead main menu theme",
    ],
    { gameTitle: "Crysis Warhead", composers: ["Peter Antovski"], studio: "Crytek Budapest" },
    [
      "Mine Fight Theme",
      "Hunter Fight Theme",
      "Hero Theme",
      "Boss Fight Theme2",
      "Boss Fight Theme1",
      "Train Battle theme",
      "Hovercraft Pursuit theme",
      "main menu theme",
    ],
  ],
  // Majority noise suffix word ("Audio") — stripped.
  [
    [
      "Neon Rush Audio",
      "Starlit Chase Audio",
      "Final Lap Audio",
      "Podium Glory Audio",
      "Cool Down",
    ],
    { gameTitle: "Some Racer" },
    ["Neon Rush", "Starlit Chase", "Final Lap", "Podium Glory", "Cool Down"],
  ],
  // Majority meaningful suffix word ("Theme") — protected, kept.
  [
    [
      "Hero Theme",
      "Villain Theme",
      "Battle Theme",
      "Shop Theme",
      "Ending Theme",
    ],
    { gameTitle: "Some RPG" },
    ["Hero Theme", "Villain Theme", "Battle Theme", "Shop Theme", "Ending Theme"],
  ],
  // Majority trailing segment (channel/label name) — content-agnostic drop.
  [
    [
      "Green Greens - GilvaSunner",
      "Butter Building - GilvaSunner",
      "Rest Area - GilvaSunner",
      "King Dedede - GilvaSunner",
    ],
    { gameTitle: "Kirby's Dream Land" },
    ["Green Greens", "Butter Building", "Rest Area", "King Dedede"],
  ],
  // Prefix strip never empties the title named exactly after the affix.
  [
    ["Flow", "Flow Big City", "Flow Ocean Deep", "Flow Night Sky", "Flow Caves"],
    { gameTitle: "Flow" },
    ["Flow", "Big City", "Ocean Deep", "Night Sky", "Caves"],
  ],
  // Under quorum (2/5 share prefix) — nothing happens.
  [
    [
      "Menu Loop",
      "Deep Woods",
      "Deep Waters",
      "Skyline",
      "Credits Roll",
    ],
    { gameTitle: "Some Platformer" },
    ["Menu Loop", "Deep Woods", "Deep Waters", "Skyline", "Credits Roll"],
  ],
];

let pass = 0;
for (const [raw, ctx, want] of cases) {
  const got = cleanTrackTitle(raw, ctx);
  const ok = got === want;
  if (ok) pass++;
  console.log(`${ok ? "✓" : "✗"} ${raw}`);
  if (!ok) console.log(`    want: ${want}\n    got:  ${got}`);
}

let listPass = 0;
for (const [titles, ctx, want] of listCases) {
  const got = cleanTracklistTitles(
    titles.map((title) => ({ title })),
    ctx,
  );
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) listPass++;
  console.log(`${ok ? "✓" : "✗"} [playlist] ${titles[0]} … (${titles.length})`);
  if (!ok) {
    for (let i = 0; i < titles.length; i++) {
      if (got[i] !== want[i]) {
        console.log(`    ${titles[i]}\n      want: ${want[i]}\n      got:  ${got[i]}`);
      }
    }
  }
}
console.log(
  `\n${pass}/${cases.length} title cases, ${listPass}/${listCases.length} playlist cases passed`,
);
