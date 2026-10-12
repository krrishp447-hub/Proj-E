-- Scout live data (Postgres). Apply with: npm run db:migrate
-- Idempotent: safe to run repeatedly.

-- Channels to track. Filled by `npm run discover` (YouTube search) or by hand.
create table if not exists channel_seeds (
  channel_id text primary key,
  note       text,
  added_at   timestamptz not null default now()
);

-- Latest derived signals per channel (one row per creator), refreshed by the daily ingest cron.
create table if not exists creators (
  channel_id  text primary key,
  platform    text not null default 'YouTube',
  name        text not null,
  handle      text not null,
  country     text not null,
  niche       text not null,
  tags        text[] not null default '{}',
  subs        integer not null,
  avg_views   integer not null,
  eng         real not null,
  growth      real not null default 0,
  consistency integer not null,
  auth        integer not null,
  suspicious  integer not null,
  fetched_at  timestamptz not null default now()
);

-- Daily subscriber history: powers 90-day growth and the trend sparkline.
create table if not exists snapshots (
  channel_id text not null references creators (channel_id) on delete cascade,
  taken_on   date not null default current_date,
  subs       integer not null,
  primary key (channel_id, taken_on)
);

create index if not exists creators_niche_idx on creators (niche);
