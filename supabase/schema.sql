-- =====================================================================
-- Controle de Receptivos (Comercial): esquema do banco Supabase
-- Projeto: receptivos (ID ngpitlhdksqkrjkowwvb), região sa-east-1
-- Exportado em 12/11/2026 por consultas de leitura ao catálogo do Postgres.
--
-- CONTÉM: tabelas, restrições, índices, funções, gatilho, RLS, políticas,
--         permissões e publicação de tempo real.
-- NÃO CONTÉM: dados (config/meses, membros, convites) nem configurações do
--         Supabase Auth feitas no painel (Site URL, e-mail, SMTP, signup).
--
-- Use em um projeto Supabase NOVO e vazio. Não rode sobre o projeto em uso.
-- Depois de criar o primeiro usuário, cadastre o convite do primeiro
-- editor (veja README.md, seção "Primeiro editor").
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Schema auxiliar (fora da API exposta)
-- ---------------------------------------------------------------------
create schema if not exists private;

-- ---------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------
create table public.membros (
  user_id   uuid not null,
  email     text not null,
  papel     text not null default 'leitor'::text,
  criado_em timestamp with time zone not null default now(),
  constraint membros_pkey primary key (user_id),
  constraint membros_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint membros_papel_check check ((papel = any (array['editor'::text, 'leitor'::text])))
);

create table public.convites (
  email     text not null,
  papel     text not null default 'editor'::text,
  criado_em timestamp with time zone not null default now(),
  constraint convites_pkey primary key (email),
  constraint convites_email_check check ((email = lower(email))),
  constraint convites_papel_check check ((papel = any (array['editor'::text, 'leitor'::text])))
);

create table public.documentos (
  colecao        text not null,
  id             text not null,
  dados          jsonb not null,
  atualizado_em  timestamp with time zone not null default now(),
  atualizado_por uuid default auth.uid(),
  constraint documentos_pkey primary key (colecao, id),
  constraint documentos_colecao_check check ((colecao = any (array['config'::text, 'meses'::text])))
);

-- Índices: apenas os das chaves primárias (criados acima):
--   membros_pkey (user_id), convites_pkey (email), documentos_pkey (colecao, id)

-- ---------------------------------------------------------------------
-- 3. Funções
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.papel()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select m.papel from public.membros m where m.user_id = (select auth.uid()) $function$;

CREATE OR REPLACE FUNCTION private.carimbar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin new.atualizado_em := now(); new.atualizado_por := (select auth.uid()); return new; end $function$;

CREATE OR REPLACE FUNCTION public.entrar()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := (select auth.uid()); em text; p text;
begin
  if uid is null then return null; end if;
  select m.papel into p from public.membros m where m.user_id = uid;
  if p is not null then return p; end if;
  select lower(u.email) into em from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  if em is null then return null; end if;
  select c.papel into p from public.convites c where c.email = em;
  if p is null then return null; end if;
  insert into public.membros(user_id, email, papel) values (uid, em, p) on conflict (user_id) do nothing;
  delete from public.convites where email = em;
  return p;
end $function$;

-- ---------------------------------------------------------------------
-- 4. Gatilho
-- ---------------------------------------------------------------------
CREATE TRIGGER documentos_carimbo BEFORE INSERT OR UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION private.carimbar();

-- ---------------------------------------------------------------------
-- 5. Row Level Security e políticas
--    Regra: quem está em public.membros lê tudo; só 'editor' grava.
-- ---------------------------------------------------------------------
alter table public.membros    enable row level security;
alter table public.convites   enable row level security;
alter table public.documentos enable row level security;

create policy membros_ler on public.membros for select to authenticated
  using ((( select private.papel() as papel) is not null));
create policy membros_editar on public.membros for update to authenticated
  using ((( select private.papel() as papel) = 'editor'::text))
  with check ((( select private.papel() as papel) = 'editor'::text));
create policy membros_remover on public.membros for delete to authenticated
  using ((( select private.papel() as papel) = 'editor'::text));

create policy convites_ler on public.convites for select to authenticated
  using ((( select private.papel() as papel) = 'editor'::text));
create policy convites_criar on public.convites for insert to authenticated
  with check ((( select private.papel() as papel) = 'editor'::text));
create policy convites_remover on public.convites for delete to authenticated
  using ((( select private.papel() as papel) = 'editor'::text));

create policy documentos_ler on public.documentos for select to authenticated
  using ((( select private.papel() as papel) is not null));
create policy documentos_criar on public.documentos for insert to authenticated
  with check ((( select private.papel() as papel) = 'editor'::text));
create policy documentos_alterar on public.documentos for update to authenticated
  using ((( select private.papel() as papel) = 'editor'::text))
  with check ((( select private.papel() as papel) = 'editor'::text));
create policy documentos_remover on public.documentos for delete to authenticated
  using ((( select private.papel() as papel) = 'editor'::text));

-- ---------------------------------------------------------------------
-- 6. Permissões (estado real exportado)
--    Observação: o estado real inclui os privilégios padrão do Supabase
--    (ALL para authenticated e service_role). A migração original pedia só
--    select/insert/update/delete. Veja "Endurecimento sugerido" em
--    CONTEXTO_PROJETO.md.
-- ---------------------------------------------------------------------
revoke all on public.membros, public.convites, public.documentos from anon;
grant all on public.membros, public.convites, public.documentos to authenticated, service_role;

grant usage on schema private to authenticated;

revoke all on function public.entrar() from public, anon;
grant execute on function public.entrar() to authenticated, service_role;

revoke all on function private.papel() from public, anon;
grant execute on function private.papel() to authenticated;

-- private.carimbar() mantém a permissão padrão (função de gatilho).

-- ---------------------------------------------------------------------
-- 7. Tempo real
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.documentos;

-- Extensões presentes no projeto (padrão do Supabase, não precisam de ação):
--   plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault
