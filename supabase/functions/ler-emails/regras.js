// Regras puras (sem rede): remetentes autorizados e casamento de origem.

function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// lista: texto "a@x.com, @dominio.com, outro@y.com" (ou array). Vazia = ninguém autorizado.
// Item com "@" no início autoriza o domínio inteiro; sem "@" no início, o endereço exato.
export function parseRemetentes(lista) {
  const itens = Array.isArray(lista) ? lista : String(lista ?? '').split(/[,;\s]+/);
  return itens.map(norm).filter(Boolean);
}

export function remetenteAutorizado(endereco, lista) {
  const end = norm(endereco);
  if (!end || !end.includes('@')) return false;
  return parseRemetentes(lista).some((r) => (r.startsWith('@') ? end.endsWith(r) : end === r));
}

// origens: [{id,nome,ativo,aliases?}] da config do app. Devolve o id ou null.
export function casarOrigem(textoOrigem, origens) {
  const alvo = norm(textoOrigem);
  if (!alvo || !Array.isArray(origens)) return null;
  for (const o of origens) {
    if (o.ativo === false) continue;
    const nomes = [o.nome, ...(Array.isArray(o.aliases) ? o.aliases : [])].map(norm);
    if (nomes.includes(alvo)) return o.id;
  }
  return null;
}

export async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
