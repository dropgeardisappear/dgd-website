alter table public.directory_messages add column photos jsonb not null default '[]'::jsonb check(jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=2 and length(photos::text)<=1400000);
