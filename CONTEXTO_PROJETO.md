# CONTEXTO_PROJETO.md: Controle de Receptivos (Comercial)

Exportado em 12/11/2026 a partir do deploy de produção da Vercel e do esquema do Supabase. O código foi construído em conversas com o Claude (claude.ai); este arquivo registra o que o código faz e por quê.

## 1. Origem e estado
- Origem: planilha `RECEPTIVOS_2026.xlsx` (uma aba por mês, de JANEIRO a DEZEMBRO 2026) usada pelo dono para controlar receptivos.
- Produção: Vercel, projeto `receptivos` (`prj_lZlOOdhhpvZXtLSYuzFd9M0vBlmi`), time Suporte (`suporte20`), domínios `receptivos.vercel.app` e `receptivos-suporte20.vercel.app`. Único deploy: `dpl_Dj1ia8BrGcgi2vQWqMNpskhbrjX3`.
- Banco: Supabase, projeto `receptivos` (ID `ngpitlhdksqkrjkowwvb`), região sa-east-1, plano gratuito. É um projeto separado do usado pelo `performance-hub`.
- Sem repositório GitHub. Sem testes automatizados.
- Integridade: `index.html` com 99.715 bytes e SHA-1 `c7253b4d6e46d9c48f6bb09bbb63b4e78cf59c83`, igual ao identificador do arquivo no deploy (a Vercel o lista em `src/index.html`).
- Existe um artifact antigo no claude.ai (versão sem login e com banco próprio). Está obsoleto; não use como fonte.

## 2. Funcionalidades
**Painel** (mês e ano)
- Alcançado vs meta de 85% (configurável), com faixa de progresso, "meta batida/abaixo", quantas distribuições faltam ou sobram.
- Indicadores: total geral (com variação contra o mesmo mês de 2025), distribuídos, e um por tipo (Receptivo, Indicação, Já é cliente, Eventos).
- Gráfico por dia (barras empilhadas por tipo + ponto dos distribuídos); no ano: total por mês, alcançado por mês, tabela mês a mês e origens mês a mês.
- Barras por vendedor (uma cor só) e por origem, com linha "Total de origens".
- Botão amarelo "N sem vendedor" quando há pendentes.

**Lançar**
- **Dia:** botões − / + e campo numérico por tipo, vendedor e origem; navegação por dia e calendário; linha "Sem vendedor" com botão Atribuir.
- **Mês inteiro:** grade dia × (tipos, total, vendedores, sem vendedor), colunas de 84 px; comparativo do ano anterior; opção "Eventos fora da base da meta" por mês; quadro "Origens do mês" (total mensal por origem). Origens por dia não aparecem nesta grade (decisão do dono).
- **Lançamento guiado** (etiqueta "teste"): janela em passos Tipo → Origem → Vendedor → Confirmar; aceita "Não informar" origem e "Sem vendedor (atribuir depois)"; "Lançar e começar outro".
- **Sem vendedor:** o receptivo guarda tipo e origem em `pend`; depois se atribui o vendedor (ou exclui o lançamento). Pendentes antigos, sem detalhes, aparecem como "N sem detalhes".
- **Janela flutuante:** Document Picture-in-Picture (Chrome/Edge no computador) com lançamento rápido e aba "Sem vendedor". Se o navegador não permitir, há o **modo compacto** (`#mini`) para abrir em janela pequena. Não foi testada em produção pelo desenvolvedor (limitações do ambiente de desenvolvimento).

**Configurações:** meta (%), cadastro de vendedores, origens e tipos (renomear, reordenar, ativar/desativar, "juntar origem"), importar planilha, exportar Excel do ano, usuários (convidar, mudar papel, remover).

## 3. Arquitetura
- Front-end único (`index.html`): estado global `S`, render por template string em `#main`, delegação de eventos em `document`. Rotas por hash: `#painel`, `#lancar`, `#config`, `#mini`.
- Camada de dados `criarDb(sb)` sobre o Supabase: `doc('config/geral')` e `collection('meses')`, com leitura inicial e assinatura em tempo real (`postgres_changes`).
- Login: e-mail e senha (Supabase Auth). Após entrar, `rpc('entrar')` vincula o usuário a um convite e devolve o papel (`editor` ou `leitor`). Sem convite, a tela "Sem acesso ainda".
- Segurança: RLS. Membro lê tudo; só editor grava; só editor vê/gerencia convites e membros.
- Salvamento: `agendarSalvar` com atraso de 700 ms; grava o documento do mês inteiro (upsert).

## 4. Modelo de dados (tabela `public.documentos`, jsonb)
- `('config','geral')`: `{ meta: 0.85, tipos:[{id,nome,ativo}], vendedores:[{id,nome,ativo}], origens:[{id,nome,ativo,aliases?}] }`
- `('meses','AAAA-MM')`: `{ ano, mes, atualizadoEm, arquivo?, comparativo, eventosForaDaMeta, dias:{ "<dia>":{ t:{tipoId:n}, v:{vendedorId:n}, o:{origemId:n} } }, origensMes:{origemId:n}, pend:[{id,d,t,o,em}] }`
- Cálculos: total do dia = soma de `t`; distribuídos = soma de `v`; sem vendedor = total − distribuídos; base da meta = total (menos Eventos se `eventosForaDaMeta`); alcançado = distribuídos ÷ base; total de origens = soma de `o` dos dias + `origensMes`.
- `pend` guarda os pendentes; o app associa os primeiros N de cada dia aos N receptivos sem vendedor daquele dia.
- Tabelas de acesso: `membros(user_id,email,papel)` e `convites(email,papel)`.

## 5. Integrações
- Supabase Auth, Postgres e Realtime. Vercel (hospedagem estática).
- CDN: `xlsx@0.18.5` e `@supabase/supabase-js@2.118.0` (jsDelivr); Google Fonts (Figtree).
- Não há integração com e-mail, GitHub nem APIs externas.

## 6. Decisões tomadas
- Arquivo único, sem build, para facilitar edição e publicação.
- Saiu do claude.ai (artifact) para Vercel + Supabase para liberar a janela flutuante (o navegador bloqueia dentro do claude.ai) e ter endereço e login próprios.
- Acessos por convite de e-mail, com papéis Editor e Leitor.
- Meta calculada sobre o total geral; Eventos podem ficar fora da base por mês (em junho/2026 foram 55 eventos fora da base).
- Linha da planilha com data fora do mês (ex.: 01/07 dentro de JUNHO) foi somada ao último dia do mês, na importação.
- Interface discreta: painel compacto, barras de vendedor em cor única.

## 7. Pendências e riscos conhecidos
1. **Sem repositório GitHub** nem vínculo Git na Vercel (deploy foi por upload).
2. **Supabase Auth:** o Site URL ainda é o padrão; ajustar para o domínio de produção antes de convidar a equipe (o link de confirmação de e-mail depende disso).
3. **Vercel:** a proteção do projeto exige login na Vercel; a equipe fica bloqueada até mudar para Standard Protection (ou equivalente). Mudança proposta, não aplicada.
4. **Dois bancos divergentes:** lançamentos feitos no artifact antigo depois de 09/11/2026 não estão no Supabase.
5. **Conflito de gravação:** cada gravação sobrescreve o documento do mês inteiro (última gravação vence). Dois editores no mesmo mês podem perder alterações um do outro. Considerar gravar por dia ou usar controle de versão.
6. **Endurecimento sugerido:** `authenticated` tem privilégios amplos (inclui TRUNCATE) nas três tabelas por causa dos padrões do Supabase. A API REST não expõe TRUNCATE e a RLS protege as demais operações, mas vale reduzir para select/insert/update/delete. Cadastro de contas está aberto a qualquer e-mail (sem convite a conta não acessa dados). Um aviso do verificador do Supabase sobre `entrar()` ser executável por usuários logados é intencional.
7. **Integração por e-mail (não iniciada):** objetivo: ler e-mails, criar pré-cadastros numa nova tela "Aguardando aprovação" e, ao aprovar, lançar no sistema. Faltam definir (perguntas feitas, sem resposta): provedor (Gmail, Outlook ou outro) e tipo de e-mail (avisos automáticos de formulário, e-mails de clientes ou os dois). Ideia: tabela de pré-cadastros, função no Supabase para ler/analisar, tela de aprovação com Aprovar/Descartar.
8. Código morto/provisório: botão e etiqueta "teste" do lançamento guiado; `S.showOrig` e a ação `toggle-orig` sem uso na interface; variável `S.dl` sem uso. Mantidos para não alterar o deploy.
9. Sem testes automatizados no repositório. Durante o desenvolvimento usou-se simulação em jsdom fora do repositório (não exportada).
10. A janela flutuante (Picture-in-Picture) ainda não foi confirmada num Chrome/Edge real.

## 8. Limitações desta exportação
- Não exportados: dados (config, meses, membros, convites), usuários do Auth e senhas, chaves secretas, configurações do painel do Supabase (Auth, SMTP, modelos de e-mail, Realtime) e da Vercel (proteção, domínios).
- O esquema foi reconstruído por consultas ao catálogo do Postgres (leitura). Não foi executado em um banco de teste.
