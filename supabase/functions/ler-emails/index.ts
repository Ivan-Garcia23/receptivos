// Edge Function: lê UMA caixa por IMAP (somente leitura) e grava pré-cadastros.
// Não apaga, não move e não marca mensagens como lidas: abre a caixa em modo somente leitura
// (EXAMINE) e busca o corpo com BODY.PEEK. Configuração só por variáveis de ambiente.
// @ts-nocheck  (roda no Deno da Supabase; imports npm: não são tipados no editor local)
import { ImapFlow } from 'npm:imapflow@^1';
import { simpleParser } from 'npm:mailparser@^3';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { extrairAviso } from './extrator.js';
import { remetenteAutorizado, casarOrigem, sha256Hex } from './regras.js';

const PROJETO_PRODUCAO = 'ngpitlhdksqkrjkowwvb'; // nunca rodar aqui sem AMBIENTE=producao explícito

const env = (k: string, padrao?: string) => Deno.env.get(k) ?? padrao;
function obrigatoria(k: string) {
  const v = env(k);
  if (!v) throw new Error(`Variável ausente: ${k}`);
  return v;
}

// O app (navegador) chama a função, então responde ao pré-voo CORS. A proteção é a autenticação abaixo.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-ler-emails-segredo',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) => Response.json(obj, { status, headers: CORS });

// Autorizado se: (a) o cabeçalho x-ler-emails-segredo bate (agendamento/testes), ou
// (b) o Bearer é o login de um usuário com papel "editor" (botão do app).
async function autorizado(req: Request, sb: any): Promise<boolean> {
  const segredo = env('LER_EMAILS_SEGREDO');
  if (segredo && req.headers.get('x-ler-emails-segredo') === segredo) return true;
  const auth = req.headers.get('authorization') ?? '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return false;
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return false;
  const { data: m } = await sb.from('membros').select('papel').eq('user_id', u.user.id).maybeSingle();
  return m?.papel === 'editor';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  // ?simular=1 lê e analisa, mas NÃO grava nada no banco.
  const simular = new URL(req.url).searchParams.get('simular') === '1';
  const res = { simulacao: simular, lidos: 0, remetente_nao_autorizado: 0, nao_reconhecidos: 0, novos: 0, novos_simulados: 0, ja_existiam: 0 };
  try {
    const supaUrl = obrigatoria('SUPABASE_URL');
    if (supaUrl.includes(PROJETO_PRODUCAO) && env('AMBIENTE') !== 'producao') {
      return json({ erro: 'Recusado: projeto de produção sem AMBIENTE=producao.' }, 403);
    }
    const sb = createClient(supaUrl, obrigatoria('SUPABASE_SERVICE_ROLE_KEY'));
    if (!(await autorizado(req, sb))) return json({ erro: 'Não autorizado' }, 401);
    const caixa = obrigatoria('CAIXA_NOME');
    const remetentes = env('REMETENTES_AUTORIZADOS', '');
    const janela = Number(env('JANELA_DIAS', '3'));
    const maximo = Number(env('MAX_POR_EXECUCAO', '200'));

    const cfg = await sb.from('documentos').select('dados').eq('colecao', 'config').eq('id', 'geral').maybeSingle();
    const origens = cfg.data?.dados?.origens ?? [];

    // 1) Lê a caixa (somente leitura) e guarda os e-mails brutos.
    const imap = new ImapFlow({
      host: obrigatoria('IMAP_HOST'),
      port: Number(env('IMAP_PORT', '993')),
      secure: env('IMAP_SECURE', 'true') !== 'false',
      auth: { user: obrigatoria('IMAP_USER'), pass: obrigatoria('IMAP_PASS') },
      logger: false,
    });
    const brutos: { uid: number; source: Uint8Array }[] = [];
    await imap.connect();
    const lock = await imap.getMailboxLock(env('IMAP_MAILBOX', 'INBOX'), { readOnly: true });
    try {
      const desde = new Date(Date.now() - janela * 86400000);
      const uids = ((await imap.search({ since: desde }, { uid: true })) || []).slice(-maximo);
      if (uids.length) {
        for await (const m of imap.fetch(uids, { uid: true, source: true }, { uid: true })) {
          brutos.push({ uid: m.uid, source: m.source });
        }
      }
    } finally {
      lock.release();
      await imap.logout();
    }

    // 2) Analisa e grava. A unicidade (caixa, message_id) no banco impede reprocessar,
    //    inclusive depois de reiniciar a função.
    for (const b of brutos) {
      res.lidos++;
      const p = await simpleParser(b.source);
      const de = p.from?.value?.[0]?.address ?? '';
      if (!remetenteAutorizado(de, remetentes)) { res.remetente_nao_autorizado++; continue; }
      const aviso = extrairAviso({ assunto: p.subject ?? '', texto: p.text ?? '', html: typeof p.html === 'string' ? p.html : '' });
      if (!aviso) { res.nao_reconhecidos++; continue; }
      const messageId = p.messageId ?? `uid:${b.uid}:${await sha256Hex(new TextDecoder().decode(b.source).slice(0, 2000))}`;
      if (simular) { res.novos_simulados++; continue; }
      const { data, error } = await sb.from('pre_cadastros').upsert({
        caixa,
        message_id: messageId,
        fonte: aviso.fonte,
        recebido_em: (p.date ?? new Date()).toISOString(),
        nome: aviso.nome,
        empresa: aviso.empresa,
        cidade: aviso.cidade,
        origem_bruta: aviso.origemBruta,
        origem_id: casarOrigem(aviso.origemBruta, origens),
        lead_hash: aviso.email ? await sha256Hex(aviso.email) : null,
      }, { onConflict: 'caixa,message_id', ignoreDuplicates: true }).select('id');
      if (error) throw new Error(`Gravação falhou: ${error.message}`);
      if (data?.length) res.novos++; else res.ja_existiam++;
    }
    return json(res); // só contagens: nunca devolve nem registra dados de leads
  } catch (e) {
    return json({ ...res, erro: String(e?.message ?? e) }, 500);
  }
});
