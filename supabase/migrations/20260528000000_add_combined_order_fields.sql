alter table sales
  add column if not exists is_combined          boolean default false,
  add column if not exists combined_order_name  text,
  add column if not exists combined_items       jsonb;
