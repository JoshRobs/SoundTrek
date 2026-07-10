-- SoundTrek: composer profile images
ALTER TABLE composers ADD COLUMN IF NOT EXISTS image_url TEXT;
