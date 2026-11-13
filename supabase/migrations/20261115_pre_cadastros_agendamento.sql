-- Agendamento da leitura de e-mails + tempo real da tabela pre_cadastros.
-- NÃO APLICADO. Rodar no SQL Editor do projeto receptivos só com autorização do dono, na ordem abaixo.
-- Não altera dados existentes. Para desligar o agendamento: ver o fim do arquivo.

-- ---------------------------------------------------------------------------
-- 0) PASSO MANUAL, ANTES DESTE ARQUIVO: guardar o segredo da função no Vault.
--    Não escreva o segredo aqui nem o commite. Rode, à parte e uma vez, algo como:
--      select vault.create_secret('<LER_EMAILS_SEGREDO>', 'ler_emails_segredo');
--    (o valor é o mesmo cadastrado em Edge Functions > Secrets). Depois apague a consulta do histórico.
-- ---------------------------------------------------------------------------

-- 1) Extensões (no Supabase: pg_cron em pg_catalog, pg_net em extensions).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2) Tempo real: o app recebe cada pré-cadastro novo e cada decisão (respeita a RLS de leitura).
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pre_cadastros') then
    alter publication supabase_realtime add table public.pre_cadastros;
  end if;
end $$;

-- 3) Função que chama a Edge Function lendo o segredo do Vault (ele não fica em texto no agendamento).
create or replace function private.chamar_ler_emails() returns void
language plpgsql security definer set search_path = '' as $$
declare seg text;
begin
  select decrypted_secret into seg from vault.decrypted_secrets where name = 'ler_emails_segredo';
  if seg is null then
    raise warning 'ler_emails_segredo ausente no Vault; leitura de e-mails nao chamada';
    return;
  end if;
  perform net.http_post(
    url := 'https://ngpitlhdksqkrjkowwvb.supabase.co/functions/v1/ler-emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ler-emails-segredo', seg),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function private.chamar_ler_emails() from public, anon, authenticated;

-- 4) Agendamento: a cada 10 min, segunda a sexta, 08:30 às 17:30 de Brasília (UTC-3 fixo, sem horário de verão).
--    O pg_cron roda em UTC: 08:30 BRT = 11:30 UTC e 17:30 BRT = 20:30 UTC. Três janelas cobrem 11:30 a 20:30.
select cron.schedule('ler-emails-abertura', '30,40,50 11 * * 1-5',  'select private.chamar_ler_emails()');  -- 08:30 a 08:50
select cron.schedule('ler-emails-dia',      '*/10 12-19 * * 1-5',   'select private.chamar_ler_emails()');  -- 09:00 a 16:50
select cron.schedule('ler-emails-fecho',    '0,10,20,30 20 * * 1-5', 'select private.chamar_ler_emails()'); -- 17:00 a 17:30

-- ---------------------------------------------------------------------------
-- DESLIGAR (quando quiser):
--   select cron.unschedule('ler-emails-abertura');
--   select cron.unschedule('ler-emails-dia');
--   select cron.unschedule('ler-emails-fecho');
-- CONFERIR:
--   select jobname, schedule, active from cron.job where jobname like 'ler-emails%';
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
-- ---------------------------------------------------------------------------
