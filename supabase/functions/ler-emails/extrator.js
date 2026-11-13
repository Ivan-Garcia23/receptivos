// Extrator dos avisos de formulário (RD Station, site Criasoft, LP Synlua).
// Funções puras, sem dependências: rodam no Deno (Edge Function) e no Node (testes).

const SEP = '\u0001'; // separa célula-rótulo de célula-valor em tabelas HTML

export function htmlParaTexto(html) {
  return String(html)
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/t[dh]>/gi, SEP)
    .replace(/<br\s*\/?>|<\/(tr|p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const ROTULOS = {
  nome: 'nome',
  email: 'email',
  'email lead': 'email',
  'e-mail': 'email',
  telefone: 'telefone',
  empresa: 'empresa',
  cidade: 'cidade',
  'cidade/estado': 'cidade',
  'como conheceu': 'comoConheceu',
  'como nos conheceu': 'comoConheceu',
  origem: 'origem',
  identificador: 'identificador',
  mensagem: 'mensagem',
};

function chave(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Aceita três formas: "Rótulo: valor", tabela HTML (rótulo<SEP>valor) e rótulo numa linha
// com o valor na linha seguinte (como o Gmail converte tabelas para texto, comum em encaminhados).
function lerCampos(texto) {
  const linhas = texto.split('\n').map((l) => l.replace(/\r/g, '').trim()).filter(Boolean);
  const campos = {};
  const rotuloDe = (s) => ROTULOS[chave(String(s).replace(/:\s*$/, ''))];
  const guardar = (k, v) => {
    const limpo = String(v).replace(new RegExp(SEP, 'g'), ' ').replace(/\s+/g, ' ').trim();
    if (k && limpo && campos[k] === undefined) campos[k] = limpo;
  };
  const proximoValor = (i) => {
    const prox = linhas[i + 1];
    return prox && !prox.includes(SEP) && !rotuloDe(prox) ? prox : null;
  };
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const s = linha.indexOf(SEP);
    if (s > -1) { guardar(rotuloDe(linha.slice(0, s)), linha.slice(s + 1)); continue; }
    const m = linha.match(/^([^:]{2,30}):\s*(.*)$/);
    if (m) {
      const k = rotuloDe(m[1]);
      if (!k) continue;
      if (m[2]) guardar(k, m[2]);
      else { const v = proximoValor(i); if (v) { guardar(k, v); i++; } }
      continue;
    }
    const k = rotuloDe(linha);
    if (k) { const v = proximoValor(i); if (v) { guardar(k, v); i++; } }
  }
  return campos;
}

// Tira prefixos de resposta/encaminhamento do assunto: "Fwd:", "Enc:", "RES:", "Fw:"...
export function limparAssunto(assunto = '') {
  return String(assunto).replace(/^(\s*(fwd?|enc|res|re)\s*:\s*)+/i, '').trim();
}

export function detectarFonte({ assunto = '', texto = '' }) {
  const a = limparAssunto(assunto);
  if (/^\s*\[leads\]/i.test(a) || /Nova convers[aã]o realizada/i.test(texto)) return 'rd-station';
  if (/CONTATO REALIZADO PELO SITE/i.test(texto) || /^Receptivo\s*-/i.test(a)) return 'site-criasoft';
  if (/NOVO LEAD/i.test(a) || /NOVO LEAD/i.test(texto)) return 'lp-synlua';
  return null;
}

// Retorna null quando o e-mail não é um aviso reconhecido.
export function extrairAviso({ assunto = '', texto = '', html = '' }) {
  let corpo = texto && texto.trim() ? texto : htmlParaTexto(html);
  const fonte = detectarFonte({ assunto, texto: corpo });
  if (!fonte) return null;
  let c = lerCampos(corpo);
  // Texto alternativo sem os campos: tenta de novo pelo HTML (tabelas).
  if (!c.nome && !c.email && html) c = lerCampos(htmlParaTexto(html));
  if (!c.nome && !c.email) return null;
  const origemBruta = (c.comoConheceu || c.origem || '').split('|')[0].trim();
  return {
    fonte,
    nome: c.nome || '',
    email: (c.email || '').toLowerCase(),
    telefone: (c.telefone || '').replace(/\D/g, ''),
    empresa: c.empresa || '',
    cidade: c.cidade || '',
    origemBruta,
  };
}
