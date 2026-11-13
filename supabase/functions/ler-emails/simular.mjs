// SIMULAÇÃO LOCAL: lê a caixa por IMAP (somente leitura) e mostra a extração. NÃO grava no Supabase.
// Uso (PowerShell), com a senha só na sessão do terminal:
//   $env:DEPS_DIR='<pasta onde rodou npm install imapflow mailparser>'
//   $env:IMAP_PASS = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host 'Senha de app' -AsSecureString)))
//   $env:REMETENTES_AUTORIZADOS='remetente@exemplo.com'
//   node supabase/functions/ler-emails/simular.mjs
import { createRequire } from 'node:module';
import { extrairAviso } from './extrator.js';
import { remetenteAutorizado, sha256Hex } from './regras.js';

const dep = createRequire(`${process.env.DEPS_DIR || '.'}/`);
const { ImapFlow } = dep('imapflow');
const { simpleParser } = dep('mailparser');

const e = (k, d) => process.env[k] ?? d;
if (!e('IMAP_PASS')) { console.error('Defina IMAP_PASS na sessão (veja o topo do arquivo). Nada foi lido.'); process.exit(1); }

const mascarar = (s) => (s ? s.slice(0, 2) + '***' + s.slice(s.indexOf('@')) : '');
const caixa = e('IMAP_MAILBOX', 'INBOX');
const imap = new ImapFlow({
  host: e('IMAP_HOST', 'imap.gmail.com'),
  port: Number(e('IMAP_PORT', '993')),
  secure: e('IMAP_SECURE', 'true') !== 'false',
  auth: { user: e('IMAP_USER', 'criasoftivan@gmail.com'), pass: e('IMAP_PASS') },
  logger: false,
});

const brutos = [];
let naoLidasAntes, naoLidasDepois;
await imap.connect();
console.log('Conexão IMAP: OK');
naoLidasAntes = (await imap.status(caixa, { unseen: true })).unseen;
const lock = await imap.getMailboxLock(caixa, { readOnly: true });
try {
  console.log(`Caixa "${caixa}" aberta em modo SOMENTE LEITURA (${imap.mailbox.exists} mensagens)`);
  const desde = new Date(Date.now() - Number(e('JANELA_DIAS', '30')) * 86400000);
  const uids = ((await imap.search({ since: desde }, { uid: true })) || []).slice(-Number(e('MAX_POR_EXECUCAO', '50')));
  if (uids.length) for await (const m of imap.fetch(uids, { uid: true, source: true }, { uid: true })) brutos.push(m);
} finally { lock.release(); }
naoLidasDepois = (await imap.status(caixa, { unseen: true })).unseen;
await imap.logout();

// Remetente autorizado: lista explícita OU, se vazia, o ÚNICO endereço cujo nome de exibição
// contém REMETENTE_NOME (ex.: "Jade"), lido do cabeçalho From. Se houver mais de um, para.
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let autorizados = e('REMETENTES_AUTORIZADOS', '');
if (!autorizados && e('REMETENTE_NOME')) {
  const alvo = semAcento(e('REMETENTE_NOME'));
  const achados = new Set();
  for (const b of brutos) {
    const f = (await simpleParser(b.source)).from?.value?.[0];
    if (f?.address && semAcento(f.name ?? '').includes(alvo)) achados.add(f.address.toLowerCase());
  }
  if (achados.size !== 1) {
    console.log(`Remetente "${e('REMETENTE_NOME')}": encontrei ${achados.size} endereço(s) distinto(s): ${[...achados].join(', ') || '-'}.`);
    console.log('Nada foi autorizado. Defina REMETENTES_AUTORIZADOS com o endereço correto.');
    process.exit(2);
  }
  autorizados = [...achados][0];
  console.log(`Remetente autorizado (descoberto no cabeçalho): ${autorizados}`);
}

const vistos = new Set();
const leads = new Map();
const cont = { lidos: 0, nao_autorizados: 0, nao_reconhecidos: 0, aviso_ok: 0, msg_repetida: 0 };
for (const b of brutos) {
  cont.lidos++;
  const p = await simpleParser(b.source);
  const de = p.from?.value?.[0]?.address ?? '';
  const id = p.messageId ?? `uid:${b.uid}`;
  if (vistos.has(id)) { cont.msg_repetida++; continue; }
  vistos.add(id);
  if (!remetenteAutorizado(de, autorizados)) {
    cont.nao_autorizados++; console.log(`- uid ${b.uid} | de ${de} | NÃO autorizado`); continue;
  }
  const a = extrairAviso({ assunto: p.subject ?? '', texto: p.text ?? '', html: typeof p.html === 'string' ? p.html : '' });
  if (!a) { cont.nao_reconhecidos++; console.log(`- uid ${b.uid} | de ${de} | modelo NÃO reconhecido | assunto: ${(p.subject ?? '').slice(0, 60)}`); continue; }
  cont.aviso_ok++;
  const dia = (p.date ?? new Date()).toISOString().slice(0, 10);
  const chave = a.email ? `${await sha256Hex(a.email)}|${dia}` : null;
  const dup = chave && leads.has(chave) ? ' | DUPLICADO' : '';
  if (chave) leads.set(chave, (leads.get(chave) ?? 0) + 1);
  // Saída sem dados pessoais: só presença/forma dos campos e a origem (categoria, não é dado pessoal).
  const ok = (v) => (v ? 'ok' : 'VAZIO');
  console.log(`- uid ${b.uid} | ${a.fonte} | ${dia} | nome ${ok(a.nome)}(${a.nome.length}c) | email ${a.email ? '@' + a.email.split('@')[1] : 'VAZIO'} | tel ${a.telefone.length} dígitos | empresa ${ok(a.empresa)} | cidade ${ok(a.cidade)} | origem: "${a.origemBruta}"${dup}`);
}
console.log('\nResumo:', cont);
console.log(`Não lidas antes: ${naoLidasAntes} | depois: ${naoLidasDepois} ${naoLidasAntes === naoLidasDepois ? '(inalterado: nada foi marcado como lido)' : '(ATENÇÃO: mudou)'}`);
console.log('Nada foi gravado no Supabase.');
