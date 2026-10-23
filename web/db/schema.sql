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
-- added later: detected content language, and official brand channels (kept for share of voice, not creator search)
alter table creators add column if not exists language text not null default 'English';
alter table creators add column if not exists is_brand boolean not null default false;

-- ============ Campaigns, deals & deliverables ============

create table if not exists brands (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

-- rules: {"hashtags":[], "links":[], "mentions":[], "keywords":[]} (see src/lib/scout/campaigns.ts)
create table if not exists campaigns (
  id         text primary key,
  brand_id   text not null references brands (id) on delete cascade,
  name       text not null,
  status     text not null default 'Planned' check (status in ('Planned', 'Live', 'Completed')),
  start_date date not null,
  end_date   date not null,
  rules      jsonb not null default '{"hashtags":[],"links":[],"mentions":[],"keywords":[]}',
  created_at timestamptz not null default now()
);

create table if not exists campaign_creators (
  campaign_id text not null references campaigns (id) on delete cascade,
  channel_id  text not null references creators (channel_id) on delete cascade,
  primary key (campaign_id, channel_id)
);

-- Every recent upload of a tracked channel, refreshed daily by the ingest.
create table if not exists videos (
  video_id     text primary key,
  channel_id   text not null references creators (channel_id) on delete cascade,
  platform     text not null default 'YouTube',
  title        text not null,
  description  text not null default '',
  published_at timestamptz not null,
  url          text not null,
  paid_flag    boolean,                 -- only known for creator-connected channels
  views        integer not null default 0,
  likes        integer not null default 0,
  comments     integer not null default 0,
  fetched_at   timestamptz not null default now()
);
create index if not exists videos_channel_published_idx on videos (channel_id, published_at desc);

-- Daily per-video stats: the campaign "views over time" curve.
create table if not exists video_snapshots (
  video_id text not null references videos (video_id) on delete cascade,
  taken_on date not null default current_date,
  views    integer not null,
  likes    integer not null,
  comments integer not null,
  primary key (video_id, taken_on)
);

-- The campaign folder. status filed/review/organic is set by the matcher; decided_by marks a human call that
-- the daily matcher must never overwrite (including 'rejected').
create table if not exists campaign_posts (
  campaign_id text not null references campaigns (id) on delete cascade,
  video_id    text not null references videos (video_id) on delete cascade,
  confidence  integer not null,
  reasons     text[] not null default '{}',
  status      text not null check (status in ('filed', 'review', 'organic', 'rejected')),
  disclosed   boolean not null default false,
  decided_by  text,
  matched_at  timestamptz not null default now(),
  primary key (campaign_id, video_id)
);

create table if not exists deals (
  id           text primary key,
  campaign_id  text references campaigns (id) on delete set null,
  brand_id     text not null references brands (id) on delete cascade,
  channel_id   text not null references creators (channel_id) on delete cascade,
  title        text not null,
  stage        text not null default 'Inbound' check (stage in ('Inbound', 'Negotiating', 'Contracted', 'In production', 'Live', 'Paid', 'Declined')),
  requirements text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- Append-only negotiation thread: both sides read the same history.
create table if not exists offers (
  id           bigint generated always as identity primary key,
  deal_id      text not null references deals (id) on delete cascade,
  by_party     text not null check (by_party in ('brand', 'creator')),
  fee          integer not null check (fee >= 0),
  deliverables text not null,
  usage_rights text not null,
  timeline     text not null,
  note         text,
  created_at   timestamptz not null default now()
);

create table if not exists deliverables (
  id              text primary key,
  deal_id         text not null references deals (id) on delete cascade,
  campaign_id     text references campaigns (id) on delete set null,
  channel_id      text not null references creators (channel_id) on delete cascade,
  kind            text not null,
  due             date not null,
  status          text not null default 'Planned' check (status in ('Planned', 'In production', 'Submitted', 'Live')),
  video_id        text references videos (video_id) on delete set null,
  projected_views integer not null default 0,
  fee             integer not null default 0
);

-- Automated discovery: pruned seeds (tiny or inactive channels) stop costing quota; each query pages deeper per run.
alter table channel_seeds add column if not exists active boolean not null default true;
create table if not exists discovery_queries (
  q          text primary key,
  page_token text,
  last_run   date,
  added      int not null default 0,
  done       boolean not null default false
);

-- Accounts. Google sign-in for both sides; role decides the onboarding.
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  google_sub   text not null unique,
  email        text not null,
  name         text not null default '',
  role         text not null check (role in ('creator', 'brand')),
  created_at   timestamptz not null default now(),
  onboarded_at timestamptz
);

-- A creator's connected YouTube channel: refresh token (AES-GCM sealed) and the private audience it unlocks.
-- No FK to creators: a newly connected channel gets its creators row from the ingest a moment later.
create table if not exists channel_connections (
  channel_id    text primary key,
  user_id       uuid not null unique references users (id) on delete cascade,
  refresh_token text not null,
  age           int[] not null default '{}',
  male          int,
  geo           jsonb not null default '[]',
  avg_view_pct  real,
  connected_at  timestamptz not null default now(),
  synced_at     timestamptz
);

create table if not exists creator_profiles (
  user_id         uuid primary key references users (id) on delete cascade,
  focus           text[] not null default '{}',
  languages       text[] not null default '{}',
  rate_video      int,
  rate_short      int,
  open_to_collabs boolean not null default true,
  updated_at      timestamptz not null default now()
);

create table if not exists brand_profiles (
  user_id    uuid primary key references users (id) on delete cascade,
  company    text not null,
  kind       text not null check (kind in ('brand', 'agency')),
  website    text,
  category   text,
  brief      text,
  budget     text,
  tracked    text[] not null default '{}', -- brand names / hashtags for share of voice
  updated_at timestamptz not null default now()
);

-- Real deals between brand accounts and creators. brands.id = the brand user's id (text); offers keep the thread.
alter table deals add column if not exists initiated_by text not null default 'brand' check (initiated_by in ('brand', 'creator'));
alter table deals add column if not exists due date;
alter table deals add column if not exists checklist jsonb not null default '[]'; -- [{ "text": "...", "done": false }]
alter table deals add column if not exists updated_at timestamptz not null default now();
create index if not exists deals_brand_idx on deals (brand_id, updated_at desc);
create index if not exists deals_channel_idx on deals (channel_id, updated_at desc);
create index if not exists offers_deal_idx on offers (deal_id, created_at);

-- Search: recurring words from each creator's own video titles (filled by the ingest; see lib/scout/topics.ts).
alter table creators add column if not exists topics text[] not null default '{}';

-- Channel description + keywords (first 1,500 chars), so niches can be re-derived offline when the classifier improves.
alter table creators add column if not exists about text not null default '';

-- Segregation detail (lib/scout/segment.ts): secondary niche + confidence; created_at drives the per-100 quality audit.
alter table creators add column if not exists niche2 text;
alter table creators add column if not exists niche_conf real not null default 0;
alter table creators add column if not exists created_at timestamptz not null default now();
create index if not exists creators_created_idx on creators (created_at, channel_id);

-- One row per audit of 100 newly added creators: segregation + calculation checks (lib/scout/audit.ts).
create table if not exists quality_audits (
  id        bigint generated always as identity primary key,
  run_at    timestamptz not null default now(),
  from_n    int not null, -- creators #from_n+1 … #to_n in order of creation
  to_n      int not null,
  passed    boolean not null,
  checks    jsonb not null
);

-- Hidden like counts are stored as NULL (unknown), not 0, so engagement can be recomputed exactly (quality audit).
alter table videos alter column likes drop not null;
alter table video_snapshots alter column likes drop not null;

-- Audit fixes (2026-10-23): sign-out ends every session; brands opt in before creators can see/pitch their brief.
alter table users add column if not exists session_version int not null default 0;
alter table brand_profiles add column if not exists pitchable boolean not null default false;
alter table discovery_queries add column if not exists pages int not null default 0;
create index if not exists videos_published_idx on videos (published_at);
