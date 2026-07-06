-- CECA Dayworks 2025 plant rate supplement.
-- Source: CECA Dayworks Volume 2 - Digital Edition - 11 August 2025.
-- Adds missing high-use Section 10 excavator bands and related plant rows.

alter table public.ceca_plant_rates_simple
  add column if not exists search_aliases text;

delete from public.ceca_plant_rates_simple
where year = 2025
  and source_note = 'CECA 2025 Section 10 supplement';

insert into public.ceca_plant_rates_simple (
  id,
  section_name,
  item_name,
  capacity_text,
  hire_unit,
  ceca_rate,
  year,
  source_note,
  search_aliases,
  created_at
) values
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 14.0 tonnes',
    'hour',
    66.59,
    2025,
    'CECA 2025 Section 10 supplement',
    '14t excavator; 14 tonne excavator; 14 ton excavator; 14t digger; 14 tonne digger; 14t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 17.0 tonnes',
    'hour',
    74.07,
    2025,
    'CECA 2025 Section 10 supplement',
    '17t excavator; 17 tonne excavator; 17 ton excavator; 17t digger; 17 tonne digger; 17t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 21.0 tonnes',
    'hour',
    84.45,
    2025,
    'CECA 2025 Section 10 supplement',
    '21t excavator; 21 tonne excavator; 21 ton excavator; 21t digger; 21 tonne digger; 21t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 25.0 tonnes',
    'hour',
    94.95,
    2025,
    'CECA 2025 Section 10 supplement',
    '25t excavator; 25 tonne excavator; 25 ton excavator; 25t digger; 25 tonne digger; 25t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 30.0 tonnes',
    'hour',
    117.07,
    2025,
    'CECA 2025 Section 10 supplement',
    '30t excavator; 30 tonne excavator; 30 ton excavator; 30t digger; 30 tonne digger; 30t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 38.0 tonnes',
    'hour',
    147.65,
    2025,
    'CECA 2025 Section 10 supplement',
    '38t excavator; 38 tonne excavator; 38 ton excavator; 38t digger; 38 tonne digger; 38t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 55.0 tonnes',
    'hour',
    189.96,
    2025,
    'CECA 2025 Section 10 supplement',
    '55t excavator; 55 tonne excavator; 55 ton excavator; 55t digger; 55 tonne digger; 55t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Hydraulic excavator, crawler mounted, single equipment',
    'Up to 75.0 tonnes',
    'hour',
    251.35,
    2025,
    'CECA 2025 Section 10 supplement',
    '75t excavator; 75 tonne excavator; 75 ton excavator; 75t digger; 75 tonne digger; 75t 360; tracked excavator; crawler excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Long reach excavator',
    'Up to 10.0 tonnes and up to 10.0 metres reach',
    'hour',
    67.20,
    2025,
    'CECA 2025 Section 10 supplement',
    '10t long reach excavator; 10 tonne long reach digger; long reach 360; long reach tracked excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Long reach excavator',
    'Up to 24.0 tonnes and up to 15.0 metres reach',
    'hour',
    113.10,
    2025,
    'CECA 2025 Section 10 supplement',
    '24t long reach excavator; 24 tonne long reach digger; long reach 360; long reach tracked excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Long reach excavator',
    'Up to 38.0 tonnes and up to 22.0 metres reach',
    'hour',
    177.54,
    2025,
    'CECA 2025 Section 10 supplement',
    '38t long reach excavator; 38 tonne long reach digger; long reach 360; long reach tracked excavator',
    now()
  ),
  (
    gen_random_uuid(),
    'Crushers and Screens',
    'Tracked mobile crusher',
    'Up to 50.0 tonnes nominal capacity',
    'hour',
    227.65,
    2025,
    'CECA 2025 Section 10 supplement',
    'mobile crusher; tracked crusher; 50t crusher; concrete crusher; rubble crusher',
    now()
  ),
  (
    gen_random_uuid(),
    'Crushers and Screens',
    'Tracked mobile crusher',
    'Up to 80.0 tonnes nominal capacity',
    'hour',
    286.96,
    2025,
    'CECA 2025 Section 10 supplement',
    'mobile crusher; tracked crusher; 80t crusher; concrete crusher; rubble crusher',
    now()
  ),
  (
    gen_random_uuid(),
    'Crushers and Screens',
    'Tracked screen',
    '27.0 tonnes nominal capacity',
    'hour',
    92.97,
    2025,
    'CECA 2025 Section 10 supplement',
    'mobile screen; tracked screen; screener; 27t screen; soil screener',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Loading shovel',
    'Up to 5.0m3',
    'hour',
    148.07,
    2025,
    'CECA 2025 Section 10 supplement',
    'loading shovel; wheel loader; shovel loader; 5m3 loader',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Backhoe loader',
    'Up to 0.60m3 bucket capacity',
    'hour',
    41.40,
    2025,
    'CECA 2025 Section 10 supplement',
    'backhoe; backhoe loader; jcb; 3cx; excavator loader; 0.6m3 bucket',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Backhoe loader',
    'Up to 0.80m3 bucket capacity',
    'hour',
    54.49,
    2025,
    'CECA 2025 Section 10 supplement',
    'backhoe; backhoe loader; jcb; 3cx; excavator loader; 0.8m3 bucket',
    now()
  ),
  (
    gen_random_uuid(),
    'Excavators',
    'Backhoe loader',
    'Up to 1.00m3 bucket capacity',
    'hour',
    58.34,
    2025,
    'CECA 2025 Section 10 supplement',
    'backhoe; backhoe loader; jcb; 3cx; excavator loader; 1m3 bucket',
    now()
  );

update public.ceca_plant_rates_simple
set search_aliases = concat_ws(
  '; ',
  search_aliases,
  lower(replace(capacity_text, '.0 tonnes', 't')),
  lower(replace(capacity_text, ' tonnes', 't')),
  case
    when section_name ilike '%excavator%' or item_name ilike '%excavator%' then 'excavator; digger; 360; tracked excavator; crawler excavator'
    when item_name ilike '%fork lift%' then 'forklift; fork lift; telehandler; material handling'
    when item_name ilike '%dumper%' then 'dumper; dump truck; site dumper'
    when item_name ilike '%roller%' then 'roller; compaction roller; ride on roller'
    when item_name ilike '%loading shovel%' then 'loading shovel; wheel loader; shovel loader'
    else null
  end
)
where year = 2025
  and source_note = 'CECA 2025'
  and search_aliases is null;
