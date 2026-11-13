-- Pré-cadastros vindos dos avisos de e-mail (RD Station, site Criasoft, LP Synlua).
-- JÁ EXISTE em produção (criada pelo dono; o erro 42P07 ao rodar de novo confirmou). Estrutura conferida
-- e ajustada por 20261114_pre_cadastros_ajuste.sql. Este arquivo documenta o esquema; não rodar de novo.
-- Não guarda e-mail nem telefone do lead (LGPD): só um hash do e-mail, para marcar duplicados.

create table public.pre_cadastros (
  id            uuid primary key default gen_random_uuid(),
  caixa         text not null,                 -- caixa lida (ex.: raphael, criasoft)
  message_id    text not null,                 -- Message-ID do e-mail (evita ler duas vezes)
  fonte         text not null,                 -- rd-station | site-criasoft | lp-synlua
  recebido_em   timestamptz not null,          -- data do e-mail = data do lançamento
  nome          text not null default '',
  empresa       text not null default '',
  cidade        text not null default '',
  origem_bruta  text not null default '',      -- texto original ("Redes Sociais", "Google"...)
  origem_id     text,                          -- origem do app, se casou por nome/alias
  lead_hash     text,                          -- sha-256 do e-mail do lead (marca duplicados)
  status        text not null default 'pendente',
  decidido_por  uuid references auth.users(id) on delete set null,  -- remover um usuário não pode ser bloqueado por isto
  decidido_em   timestamptz,
  criado_em     timestamptz not null default now(),
  constraint pre_cadastros_status_check check (status in ('pendente','aprovado','descartado')),
  constraint pre_cadastros_msg_unica unique (caixa, message_id)
);

create index pre_cadastros_status_idx on public.pre_cadastros (status, recebido_em desc);

alter table public.pre_cadastros enable row level security;

-- Membro lê; só editor altera (aprovar/descartar). Inserção só pela Edge Function (service_role ignora RLS).
create policy pre_cadastros_ler on public.pre_cadastros for select to authenticated
  using (((select private.papel()) is not null));
create policy pre_cadastros_alterar on public.pre_cadastros for update to authenticated
  using (((select private.papel()) = 'editor'::text))
  with check (((select private.papel()) = 'editor'::text));

-- Privilégios mínimos: sem insert, delete nem truncate para usuários, e o editor só consegue
-- alterar as colunas da decisão (não o nome, a data nem o e-mail de origem).
revoke all on public.pre_cadastros from anon, authenticated;
grant select on public.pre_cadastros to authenticated;
grant update (status, decidido_por, decidido_em) on public.pre_cadastros to authenticated;
grant all on public.pre_cadastros to service_role;

-- Reversão (a tabela é nova; se precisar desfazer): drop table public.pre_cadastros;
