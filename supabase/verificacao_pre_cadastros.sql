-- SOMENTE LEITURA. Confere a estrutura da tabela public.pre_cadastros já existente.
-- Não altera nada e não mostra dados pessoais (só a contagem de linhas).
-- Rode no SQL Editor do Supabase e me envie o resultado (uma tabela só).

select 'colunas' as secao, lpad(ordinal_position::text, 2, '0') as item,
       column_name || ' ' || data_type || case when is_nullable = 'NO' then ' NOT NULL' else '' end
         || coalesce(' DEFAULT ' || column_default, '') as detalhe
  from information_schema.columns
 where table_schema = 'public' and table_name = 'pre_cadastros'
union all
select 'restricoes', conname, pg_get_constraintdef(oid)
  from pg_constraint where conrelid = 'public.pre_cadastros'::regclass
union all
select 'indices', indexname, indexdef
  from pg_indexes where schemaname = 'public' and tablename = 'pre_cadastros'
union all
select 'rls', 'ativa', 'enabled=' || relrowsecurity::text || ' forced=' || relforcerowsecurity::text
  from pg_class where oid = 'public.pre_cadastros'::regclass
union all
select 'politicas', policyname,
       cmd || ' | roles=' || roles::text || ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
  from pg_policies where schemaname = 'public' and tablename = 'pre_cadastros'
union all
-- r=select w=update a=insert d=delete D=truncate x=references t=trigger
select 'privilegios_tabela', 'relacl', coalesce(relacl::text, '(padrao)')
  from pg_class where oid = 'public.pre_cadastros'::regclass
union all
select 'privilegios_coluna', attname, attacl::text
  from pg_attribute
 where attrelid = 'public.pre_cadastros'::regclass and attnum > 0 and not attisdropped and attacl is not null
union all
select 'linhas', 'total', count(*)::text from public.pre_cadastros
order by 1, 2;

-- Opcional (consulta separada): se a migração foi registrada pelo CLI/MCP.
-- select version, name from supabase_migrations.schema_migrations order by version desc limit 10;
