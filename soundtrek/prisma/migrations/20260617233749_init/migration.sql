-- CreateTable
CREATE TABLE "soundtracks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_title" TEXT NOT NULL,
    "composer" TEXT NOT NULL,
    "console" TEXT NOT NULL,
    "release_year" INTEGER NOT NULL,
    "cover_image_url" TEXT,
    "youtube_playlist_id" TEXT,
    "youtube_video_id" TEXT,
    "source_type" TEXT NOT NULL,
    "mood_tags" TEXT[],
    "genre_tags" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soundtracks_pkey" PRIMARY KEY ("id")
);
