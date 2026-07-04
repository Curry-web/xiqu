create table if not exists home_openings (
  id bigserial primary key,
  title text not null,
  venue text not null,
  start_time time not null,
  opening_date date not null default current_date,
  image_path text not null,
  description text default '',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_openings_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists home_openings_today_idx
  on home_openings (opening_date, status, sort_order, start_time);

insert into home_openings (
  title,
  venue,
  start_time,
  opening_date,
  image_path,
  description,
  is_featured,
  sort_order,
  status
) values
  (
    '春江花月夜',
    '梨园小剧场',
    '19:30',
    current_date,
    'openings/today-opening-fan.png',
    '昆曲扇面身段与经典唱段展示',
    true,
    10,
    'published'
  ),
  (
    '水袖折子戏',
    '兰苑厅',
    '14:30',
    current_date,
    'openings/opening-water-sleeves.jpg',
    '水袖功法与折子戏片段',
    false,
    20,
    'published'
  ),
  (
    '变脸火彩',
    '锦绣戏台',
    '20:00',
    current_date,
    'openings/opening-fire.jpg',
    '川剧变脸与火彩表演',
    false,
    30,
    'published'
  );
