-- Enable PostGIS for geographic queries (nearby players, games)
create extension if not exists postgis with schema extensions;
