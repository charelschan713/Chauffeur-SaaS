-- Step B: aschauffeured tenant theme
-- Sets primary_color (gold HSL), primary_foreground (dark), font_family, cancel_window_hours

UPDATE public.tenant_branding
SET
  primary_color        = '39 46% 60%',      -- gold  (matches platform default --primary)
  primary_foreground   = '240 8% 3%',       -- near-black on gold
  font_family          = 'Playfair Display', -- luxury serif
  cancel_window_hours  = 24
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
