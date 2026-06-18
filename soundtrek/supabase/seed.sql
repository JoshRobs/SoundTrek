-- Starter seed data for SoundTrek
-- Fill in youtube_video_id or youtube_playlist_id before inserting
-- source_type: 'video' for single full-album videos, 'playlist' for YouTube playlists

INSERT INTO soundtracks (game_title, composer, console, release_year, cover_image_url, youtube_video_id, youtube_playlist_id, source_type, mood_tags, genre_tags)
VALUES
  ('Chrono Trigger',                   'Yasunori Mitsuda, Nobuo Uematsu',   'SNES',          1995, NULL, NULL, NULL, 'video',    ARRAY['nostalgic','epic','emotional'],        ARRAY['RPG','classic']),
  ('Final Fantasy VII',                'Nobuo Uematsu',                      'PlayStation',   1997, NULL, NULL, NULL, 'video',    ARRAY['epic','emotional','nostalgic'],        ARRAY['RPG','classic']),
  ('Undertale',                        'Toby Fox',                           'PC',            2015, NULL, NULL, NULL, 'video',    ARRAY['quirky','emotional','intense'],         ARRAY['RPG','indie']),
  ('Halo: Combat Evolved',             'Martin O''Donnell & Michael Salvatori','Xbox',        2001, NULL, NULL, NULL, 'video',    ARRAY['epic','intense','ambient'],            ARRAY['FPS','sci-fi']),
  ('Persona 5',                        'Shoji Meguro',                       'PlayStation 4', 2016, NULL, NULL, NULL, 'video',    ARRAY['upbeat','stylish','intense'],          ARRAY['RPG','JRPG']),
  ('Hollow Knight',                    'Christopher Larkin',                 'PC',            2017, NULL, NULL, NULL, 'video',    ARRAY['melancholic','ambient','intense'],     ARRAY['metroidvania','indie']),
  ('DOOM (2016)',                      'Mick Gordon',                        'PlayStation 4', 2016, NULL, NULL, NULL, 'video',    ARRAY['intense','aggressive','adrenaline'],  ARRAY['FPS','metal']),
  ('The Legend of Zelda: Ocarina of Time','Koji Kondo',                     'Nintendo 64',   1998, NULL, NULL, NULL, 'video',    ARRAY['epic','nostalgic','adventurous'],     ARRAY['action-adventure','classic']),
  ('NieR: Automata',                   'Keiichi Okabe',                      'PlayStation 4', 2017, NULL, NULL, NULL, 'video',    ARRAY['emotional','ambient','melancholic'],  ARRAY['action-RPG','sci-fi']),
  ('Celeste',                          'Lena Raine',                         'PC',            2018, NULL, NULL, NULL, 'video',    ARRAY['emotional','upbeat','intense'],        ARRAY['platformer','indie']),
  ('Streets of Rage 2',               'Yuzo Koshiro',                       'Sega Genesis',  1992, NULL, NULL, NULL, 'video',    ARRAY['upbeat','energetic','nostalgic'],     ARRAY['beat-em-up','classic']),
  ('Shadow of the Colossus',           'Kow Otani',                          'PlayStation 2', 2005, NULL, NULL, NULL, 'video',    ARRAY['epic','emotional','ambient'],         ARRAY['action-adventure','classic']),
  ('Stardew Valley',                   'ConcernedApe',                       'PC',            2016, NULL, NULL, NULL, 'video',    ARRAY['relaxing','nostalgic','cozy'],        ARRAY['simulation','indie']),
  ('Mega Man 2',                       'Takashi Tateishi',                   'NES',           1988, NULL, NULL, NULL, 'video',    ARRAY['upbeat','nostalgic','energetic'],     ARRAY['platformer','classic']),
  ('Katana ZERO',                      'Bill Kiley & Ludowic',               'PC',            2019, NULL, NULL, NULL, 'video',    ARRAY['intense','stylish','electronic'],     ARRAY['action','indie']);

-- After inserting, run an UPDATE to fill in the real YouTube IDs:
-- UPDATE soundtracks SET youtube_video_id = 'REAL_ID' WHERE game_title = 'Chrono Trigger';
