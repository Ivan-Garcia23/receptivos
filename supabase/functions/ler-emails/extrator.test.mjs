// Rodar: node supabase/functions/ler-emails/extrator.test.mjs
// Todos os dados abaixo são FICTÍCIOS.
import assert from 'node:assert/strict';
import { extrairAviso, htmlParaTexto } from './extrator.js';

// 1) RD Station (texto)
const rd = extrairAviso({
  assunto: '[leads] [Contato Site] Maria EXEMPLO - Empresa X',
  texto: `Nova conversão realizada!
Maria EXEMPLO
Detalhes da conversão:
Conta: Empresa X
Identificador: Contato Site
Email lead: Maria.Exemplo@Teste.com
Mensagem: Gostaria de fazer o orçamento
Nome: MARIA EXEMPLO
Cidade: Cuiabá
Empresa: LABORATORIO EXEMPLO LTDA
Telefone: (65) 99999-0000
Cargo: Outros
Origem: Referência | exemplo.com.br`,
});
assert.deepEqual(rd, {
  fonte: 'rd-station', nome: 'MARIA EXEMPLO', email: 'maria.exemplo@teste.com',
  telefone: '65999990000', empresa: 'LABORATORIO EXEMPLO LTDA', cidade: 'Cuiabá', origemBruta: 'Referência',
});

// 2) Site Criasoft (texto)
const site = extrairAviso({
  assunto: 'Receptivo - "Joana"',
  texto: `CONTATO REALIZADO PELO SITE DA CRIASOFT:
Nome: Joana
Email: joana@teste.com
Telefone: 73988880000
Empresa: Alfa Exemplo
Cidade: Porto Seguro
Como conheceu: Redes Sociais

Mensagem enviada:
Orçamento`,
});
assert.equal(site.fonte, 'site-criasoft');
assert.equal(site.origemBruta, 'Redes Sociais');
assert.equal(site.email, 'joana@teste.com');

// 3) LP Synlua (HTML em tabela; "Como nos conheceu" vence "Origem")
const lp = extrairAviso({
  assunto: 'NOVO LEAD - LP SYNLUA — Ana Exemplo (Site (geral))',
  html: `<h2>NOVO LEAD - LP SYNLUA</h2><table>
<tr><td>Nome</td><td><b>Ana Exemplo</b></td></tr>
<tr><td>E-mail</td><td><b>ana@teste.com</b></td></tr>
<tr><td>Telefone</td><td><b>18 99999-1111</b></td></tr>
<tr><td>Empresa</td><td><b>em criação</b></td></tr>
<tr><td>Cidade/Estado</td><td><b>Araçatuba</b></td></tr>
<tr><td>Como nos conheceu</td><td><b>Google</b></td></tr>
<tr><td>Origem</td><td><b>Site (geral)</b></td></tr>
<tr><td>Página</td><td><b>https://exemplo.com/?a=1&amp;b=2</b></td></tr></table>`,
});
assert.equal(lp.fonte, 'lp-synlua');
assert.equal(lp.nome, 'Ana Exemplo');
assert.equal(lp.cidade, 'Araçatuba');
assert.equal(lp.origemBruta, 'Google');
assert.equal(lp.telefone, '18999991111');

// 3b) Encaminhados: prefixo "Fwd:"/"ENC:" no assunto e cabeçalho de encaminhamento no corpo
const fwd = extrairAviso({
  assunto: 'Fwd: Receptivo - "Eliezer"',
  texto: `---------- Forwarded message ---------
De: Fulano <fulano@exemplo.com>
Data: sex., 13 de nov.
Assunto: Receptivo - "Eliezer"
Para: criasoft@exemplo.com

CONTATO REALIZADO PELO SITE DA CRIASOFT:
Nome: Eliezer
Email: eliezer@teste.com
Telefone: 11977770000
Empresa: Beta Exemplo
Cidade: Campinas
Como conheceu: Google`,
});
assert.equal(fwd.fonte, 'site-criasoft');
assert.equal(fwd.nome, 'Eliezer');
assert.equal(fwd.origemBruta, 'Google');
assert.equal(extrairAviso({ assunto: 'ENC: NOVO LEAD - LP SYNLUA', texto: 'NOVO LEAD\nNome: X\nEmail: x@t.com' }).fonte, 'lp-synlua');
assert.equal(extrairAviso({ assunto: 'FW: [leads] /pagina/', texto: 'Nova conversão realizada!\nNome: Y\nEmail lead: y@t.com' }).fonte, 'rd-station');

// 3c) LP Synlua ENCAMINHADA: texto com rótulo numa linha e valor na linha seguinte (sem ":")
const lpFwd = extrairAviso({
  assunto: 'Fwd: NOVO LEAD - LP SYNLUA — CARLOS EXEMPLO (Site (geral))',
  texto: `---------- Forwarded message ---------
De: NOVO LEAD - LP SYNLUA <aviso@exemplo.com>
Assunto:
NOVO LEAD - LP SYNLUA — CARLOS EXEMPLO (Site (geral))
Data:
07/11/2026 15:30
De:
NOVO LEAD - LP SYNLUA <aviso@exemplo.com>
Para:
a@exemplo.com, b@exemplo.com
Responder para:
carlos@teste.com

NOVO LEAD - LP SYNLUA
Origem: Site (geral)

Nome
CARLOS EXEMPLO
E-mail
carlos@teste.com
Telefone
11 98888-0000
Empresa
EMPRESA EXEMPLO
Cidade/Estado
Sorocaba
Como nos conheceu
Google
Origem
Site (geral)
Página
https://exemplo.com/?a=1`,
});
assert.deepEqual(lpFwd, {
  fonte: 'lp-synlua', nome: 'CARLOS EXEMPLO', email: 'carlos@teste.com',
  telefone: '11988880000', empresa: 'EMPRESA EXEMPLO', cidade: 'Sorocaba', origemBruta: 'Google',
});
// 3d) Texto sem os campos, mas HTML com tabela: usa o HTML
const lpHtml = extrairAviso({
  assunto: 'Fwd: NOVO LEAD - LP SYNLUA',
  texto: 'Veja a mensagem abaixo.',
  html: '<table><tr><td>Nome</td><td>Dora Exemplo</td></tr><tr><td>E-mail</td><td>dora@teste.com</td></tr><tr><td>Como nos conheceu</td><td>Google</td></tr></table>NOVO LEAD',
});
assert.equal(lpHtml.nome, 'Dora Exemplo');
assert.equal(lpHtml.origemBruta, 'Google');

// 4) E-mail não reconhecido
assert.equal(extrairAviso({ assunto: 'Fatura do mês', texto: 'Olá, segue a fatura.' }), null);

assert.ok(htmlParaTexto('<td>a</td><td>b</td>').includes('\u0001'));
console.log('extrator: todos os testes passaram');
