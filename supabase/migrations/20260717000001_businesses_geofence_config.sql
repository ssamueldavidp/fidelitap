alter table public.businesses
  add column if not exists timezone              text not null default 'America/Bogota',
  add column if not exists geofence_enabled      boolean not null default false,
  add column if not exists geofence_radius_m     int not null default 300
                              check (geofence_radius_m in (100, 300, 500)),
  add column if not exists geofence_message      text,
  add column if not exists geofence_cooldown_h   int not null default 24,
  add column if not exists quiet_hours_start     int not null default 22
                              check (quiet_hours_start between 0 and 23),
  add column if not exists quiet_hours_end       int not null default 6
                              check (quiet_hours_end between 0 and 23);
