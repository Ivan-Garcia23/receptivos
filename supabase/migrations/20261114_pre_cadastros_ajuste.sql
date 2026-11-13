-- Ajuste complementar de public.pre_cadastros. APLICADO em produção pelo dono (SQL Editor, "Success").
-- Antes dele, a verificação (supabase/verificacao_pre_cadastros.sql) já mostrava a estrutura esperada;
-- ele foi executado mesmo assim por ser idempotente. Tabela vazia (0 linhas) na época.
-- Preserva todos os dados: não usa DROP TABLE, não recria a tabela, não apaga linhas.
-- Idempotente: pode rodar mais de uma vez. Cada bloco só é necessário se a verificação mostrar diferença.
-- Se faltar COLUNA ou a restrição check/unique, não está neste arquivo: eu preparo sob medida.

-- 1) RLS ligada (sem efeito se já estiver).
alter table public.pre_cadastros enable row level security;

-- 2) Políticas: membro lê, só editor altera. Recria as duas (não mexe nas linhas).
drop policy if exists pre_cadastros_ler on public.pre_cadastros;
create policy pre_cadastros_ler on public.pre_cadastros for select to authenticated
  using (((select private.papel()) is not null));
drop policy if exists pre_cadastros_alterar on public.pre_cadastros;
create policy pre_cadastros_alterar on public.pre_cadastros for update to authenticated
  using (((select private.papel()) = 'editor'::text))
  with check (((select private.papel()) = 'editor'::text));

-- 3) Privilégios mínimos: só leitura, e update apenas nas colunas da decisão.
revoke all on public.pre_cadastros from anon, authenticated;
grant select on public.pre_cadastros to authenticated;
grant update (status, decidido_por, decidido_em) on public.pre_cadastros to authenticated;
grant all on public.pre_cadastros to service_role;

-- 4) Chave estrangeira não pode bloquear a remoção de usuários (on delete set null).
--    Só troca a restrição (não a tabela). Tabela pequena: trava por um instante.
alter table public.pre_cadastros drop constraint if exists pre_cadastros_decidido_por_fkey;
alter table public.pre_cadastros
  add constraint pre_cadastros_decidido_por_fkey
  foreign key (decidido_por) references auth.users(id) on delete set null;

-- 5) Índices: garante o de status e remove o de lead_hash, sem uso (opcional).
create index if not exists pre_cadastros_status_idx on public.pre_cadastros (status, recebido_em desc);
drop index if exists public.pre_cadastros_lead_idx;
