-- SoundTrek 015: Loaded prices, synced from the Impact product catalog.
--
-- Written daily by scripts/sync-loaded.ts for every soundtrack whose
-- loaded_url is a catalog product. loaded_original_price is only set when it's
-- above the current price (i.e. the product is discounted). SoundtrackView
-- hides the price once loaded_price_updated_at is more than 48h old, so a
-- stalled sync falls back to a plain link instead of showing a stale price.

ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS loaded_price NUMERIC(10, 2);
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS loaded_original_price NUMERIC(10, 2);
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS loaded_currency TEXT;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS loaded_price_updated_at TIMESTAMPTZ;
