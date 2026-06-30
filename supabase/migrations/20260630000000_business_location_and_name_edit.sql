-- Agrega lat/lng y address a businesses (safe: IF NOT EXISTS para compatibilidad con PR #3)
alter table public.businesses
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists address   text;

-- Permite al dueño actualizar nombre, address y coordenadas desde /settings
-- La policy de update ya existe: businesses_update via RLS, basada en owner_id = auth.uid()
-- No se necesita nueva policy, solo columnas.
