-- Add geolocation columns to businesses for client-side geofencing
alter table public.businesses
  add column if not exists lat            double precision,
  add column if not exists lng            double precision,
  add column if not exists geo_radius_m   integer not null default 200;
