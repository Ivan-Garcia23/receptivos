// Rodar: node supabase/functions/ler-emails/regras.test.mjs  (dados fictícios)
import assert from 'node:assert/strict';
import { parseRemetentes, remetenteAutorizado, casarOrigem, sha256Hex } from './regras.js';

assert.deepEqual(parseRemetentes('A@x.com, @dominio.com;  b@y.com'), ['a@x.com', '@dominio.com', 'b@y.com']);
assert.equal(remetenteAutorizado('Aviso@Dominio.com', '@dominio.com'), true);
assert.equal(remetenteAutorizado('a@x.com', 'a@x.com'), true);
assert.equal(remetenteAutorizado('b@x.com', 'a@x.com'), false);
assert.equal(remetenteAutorizado('a@outrodominio.com', '@dominio.com'), false);
assert.equal(remetenteAutorizado('x@malicioso-dominio.com', '@dominio.com'), false);
assert.equal(remetenteAutorizado('a@x.com', ''), false); // lista vazia = ninguém
assert.equal(remetenteAutorizado('', 'a@x.com'), false);

const origens = [
  { id: 'o1', nome: 'Redes sociais', ativo: true, aliases: ['Instagram'] },
  { id: 'o2', nome: 'Google', ativo: true },
  { id: 'o3', nome: 'Referência', ativo: false },
];
assert.equal(casarOrigem('Redes Sociais', origens), 'o1');
assert.equal(casarOrigem('instagram', origens), 'o1');
assert.equal(casarOrigem('GOOGLE', origens), 'o2');
assert.equal(casarOrigem('Referência', origens), null); // inativa
assert.equal(casarOrigem('Outro', origens), null);
assert.equal(casarOrigem('', origens), null);

assert.equal((await sha256Hex('a@x.com')).length, 64);
assert.equal(await sha256Hex('a'), await sha256Hex('a'));
console.log('regras: todos os testes passaram');
