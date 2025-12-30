-- Create Players Table
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Games Table
create table if not exists games (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null default 'active', -- 'active', 'completed'
  type text not null default 'skull_king'
);

-- Create Game Players Table (Link)
create table if not exists game_players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references games(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  total_score int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_id, player_id)
);

-- Create Rounds Table
create table if not exists rounds (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references games(id) on delete cascade not null,
  round_number int not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_id, round_number)
);

-- Create Scores Table
create table if not exists scores (
  id uuid default gen_random_uuid() primary key,
  round_id uuid references rounds(id) on delete cascade not null,
  game_player_id uuid references game_players(id) on delete cascade not null,
  bid int default 0,
  tricks_won int default 0,
  bonus_points int default 0,
  round_score int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(round_id, game_player_id)
);

-- Create Cards Table (for custom assets)
create table if not exists cards (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null, -- 'Pirate', 'Escape', 'Mermaid', etc.
  image_url text,
  is_custom boolean default false,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Open for MVP, lock down later)
alter table players enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table rounds enable row level security;
alter table scores enable row level security;
alter table cards enable row level security;

-- Allow public read/write for now (simplifies "shared password" logic)
create policy "Public Access" on players for all using (true) with check (true);
create policy "Public Access" on games for all using (true) with check (true);
create policy "Public Access" on game_players for all using (true) with check (true);
create policy "Public Access" on rounds for all using (true) with check (true);
create policy "Public Access" on scores for all using (true) with check (true);
create policy "Public Access" on cards for all using (true) with check (true);
