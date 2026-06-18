import { PrismaClient } from "./generated/prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
export const prisma = new PrismaClient({ adapter });

const seedData = [
  {
    game_title: "Chrono Trigger",
    composer: "Yasunori Mitsuda, Nobuo Uematsu",
    console: "SNES",
    release_year: 1995,
    source_type: "video" as const,
    youtube_video_id: null, // replace with real YouTube ID
    mood_tags: ["nostalgic", "epic", "emotional"],
    genre_tags: ["RPG", "classic"],
  },
  {
    game_title: "Final Fantasy VII",
    composer: "Nobuo Uematsu",
    console: "PlayStation",
    release_year: 1997,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["epic", "emotional", "nostalgic"],
    genre_tags: ["RPG", "classic"],
  },
  {
    game_title: "Undertale",
    composer: "Toby Fox",
    console: "PC",
    release_year: 2015,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["quirky", "emotional", "intense"],
    genre_tags: ["RPG", "indie"],
  },
  {
    game_title: "Halo: Combat Evolved",
    composer: "Martin O'Donnell & Michael Salvatori",
    console: "Xbox",
    release_year: 2001,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["epic", "intense", "ambient"],
    genre_tags: ["FPS", "sci-fi"],
  },
  {
    game_title: "Persona 5",
    composer: "Shoji Meguro",
    console: "PlayStation 4",
    release_year: 2016,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["upbeat", "stylish", "intense"],
    genre_tags: ["RPG", "JRPG"],
  },
  {
    game_title: "Hollow Knight",
    composer: "Christopher Larkin",
    console: "PC",
    release_year: 2017,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["melancholic", "ambient", "intense"],
    genre_tags: ["metroidvania", "indie"],
  },
  {
    game_title: "DOOM (2016)",
    composer: "Mick Gordon",
    console: "PlayStation 4",
    release_year: 2016,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["intense", "aggressive", "adrenaline"],
    genre_tags: ["FPS", "metal"],
  },
  {
    game_title: "The Legend of Zelda: Ocarina of Time",
    composer: "Koji Kondo",
    console: "Nintendo 64",
    release_year: 1998,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["epic", "nostalgic", "adventurous"],
    genre_tags: ["action-adventure", "classic"],
  },
  {
    game_title: "NieR: Automata",
    composer: "Keiichi Okabe",
    console: "PlayStation 4",
    release_year: 2017,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["emotional", "ambient", "melancholic"],
    genre_tags: ["action-RPG", "sci-fi"],
  },
  {
    game_title: "Celeste",
    composer: "Lena Raine",
    console: "PC",
    release_year: 2018,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["emotional", "upbeat", "intense"],
    genre_tags: ["platformer", "indie"],
  },
  {
    game_title: "Streets of Rage 2",
    composer: "Yuzo Koshiro",
    console: "Sega Genesis",
    release_year: 1992,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["upbeat", "energetic", "nostalgic"],
    genre_tags: ["beat-em-up", "classic"],
  },
  {
    game_title: "Shadow of the Colossus",
    composer: "Kow Otani",
    console: "PlayStation 2",
    release_year: 2005,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["epic", "emotional", "ambient"],
    genre_tags: ["action-adventure", "classic"],
  },
  {
    game_title: "Stardew Valley",
    composer: "ConcernedApe",
    console: "PC",
    release_year: 2016,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["relaxing", "nostalgic", "cozy"],
    genre_tags: ["simulation", "indie"],
  },
  {
    game_title: "Mega Man 2",
    composer: "Takashi Tateishi",
    console: "NES",
    release_year: 1988,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["upbeat", "nostalgic", "energetic"],
    genre_tags: ["platformer", "classic"],
  },
  {
    game_title: "Katana ZERO",
    composer: "Bill Kiley & Ludowic",
    console: "PC",
    release_year: 2019,
    source_type: "video" as const,
    youtube_video_id: null,
    mood_tags: ["intense", "stylish", "electronic"],
    genre_tags: ["action", "indie"],
  },
];

async function main() {
  const existing = await prisma.soundtrack.count();
  if (existing > 0) {
    console.log(`Skipping seed — ${existing} soundtracks already exist.`);
    return;
  }

  const result = await prisma.soundtrack.createMany({ data: seedData });
  console.log(`Seeded ${result.count} soundtracks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
