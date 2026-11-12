# CLAUDE.md: Controle de Receptivos (Comercial)

Leia primeiro este arquivo. Para contexto completo, abra `CONTEXTO_PROJETO.md` só se precisar.

## O que é
App web de controle de receptivos comerciais: lançamento diário por tipo, vendedor e origem, com meta de 85% de distribuição. Interface em português do Brasil.

## Stack e arquivos
- `index.html`: o app inteiro (HTML + CSS + JS puro, sem build, sem npm). Cerca de 1.170 linhas, 100 KB.
- `supabase/schema.sql`: esquema do banco (tabelas, funções, RLS, permissões). Sem dados.
- Bibliotecas por CDN, versões fixas: `xlsx@0.18.5` e `@supabase/supabase-js@2.118.0` (jsDelivr), fonte Figtree (Google Fonts).
- Banco, login e tempo real: Supabase. Hospedagem: Vercel (site estático).
- Ainda não existem: repositório GitHub, testes automatizados, `supabase/migrations/`, `package.json`.

## Regras obrigatórias
1. Nunca alterar o Supabase de produção (SQL, migrações, políticas, convites) sem pedido explícito do dono. Mudança de banco = arquivo SQL novo em `supabase/migrations/` (criar a pasta na primeira vez) e aplicação só após aprovação.
2. Nunca fazer deploy, `git push` nem mexer na Vercel sem pedido explícito.
3. Nunca gravar segredos no repositório. A chave `sb_publishable_...` em `index.html` é pública por desenho; qualquer outra chave (`service_role`, senhas, tokens) nunca entra em arquivo.
4. O app local aponta para o banco de PRODUÇÃO por padrão (`SB_URL` e `SB_KEY` em `index.html`). Para testar, use um projeto Supabase de desenvolvimento e troque essas duas constantes só localmente, sem commitar.
5. Não mexer no projeto `performance-hub` (Vercel, Supabase ou GitHub). São projetos separados.
6. Manter arquivo único e sem build, a menos que o dono peça outra arquitetura.
7. Textos da interface em pt-BR, com acentos. Datas no formato brasileiro.

## Regras de código
- Acesso a dados só pela camada `criarDb(sb)` (imita `doc().set/onSnapshot` e `collection().onSnapshot`). Não espalhar chamadas `sb.from(...)` pelo código, exceto na tela Usuários.
- Valores recebidos do banco vêm protegidos: sempre `clone()` antes de alterar.
- Alterar lançamentos só por `setValor(...)` ou `getDoc(k)` seguido de `agendarSalvar(k)`. O salvamento é adiado em 700 ms e grava o documento do mês inteiro.
- O cálculo está em `calcMes(k)` e `calcAno(y)`. Não duplicar a fórmula em outros lugares.
- Escapar texto dinâmico com `esc()` antes de colocar em `innerHTML`.
- Permissão: `S.canWrite` (papel `editor`). A segurança real é a RLS do banco; o front só esconde botões.
- Fórmula central: alcançado = distribuídos ÷ base; base = total do período (menos Eventos se o mês tiver `eventosForaDaMeta`).

## Como economizar tokens
- NÃO leia `index.html` inteiro. Procure primeiro (PowerShell: `Select-String -Path index.html -Pattern "function nomeDaFuncao"`) e leia só o trecho, por faixa de linhas.
- Mapa de seções (linhas aproximadas; confirme com `Select-String -Pattern "^// ====="`):
  - CSS 13–274 · HTML 276–285 · Parser de planilha 287–333
  - utilidades 334 · estado 359 · cálculo 366 · render principal 399 · painel 423
  - gráficos SVG 499 · lançamentos (mês inteiro e dia) 568 · lançamento guiado 646
  - sem vendedor 689 · janela flutuante e modo compacto 726 · configurações 852
  - importação 901 · exportação 950 · eventos 971 · dados 1022 · Supabase e login 1028 · usuários 1110
- Edite com substituições pequenas e exatas, não reescreva o arquivo.
- Não cole o conteúdo de `schema.sql` nem de `CONTEXTO_PROJETO.md` na conversa; cite o nome e leia só o que precisa.
- Antes de entregar uma mudança em JS, valide a sintaxe do bloco `<script>` (extraia e rode `node --check`).
- Responda curto: o que mudou, onde, como testar.
