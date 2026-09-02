create or replace function elastic_link_processing_schema.increment_dataset_version(p_user_id text)
returns void
language sql
as $$
  insert into elastic_link_processing_schema.user_datasets (
    user_id,
    dataset_version,
    last_mutation_at
  )
  values (
    p_user_id,
    1,
    now()
  )
  on conflict (user_id)
  do update
  set dataset_version = elastic_link_processing_schema.user_datasets.dataset_version + 1,
      last_mutation_at = now();
$$;