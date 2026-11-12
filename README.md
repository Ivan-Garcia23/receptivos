# Controle de Receptivos (Comercial)

App web (arquivo único) para controlar receptivos por dia, vendedor e origem, com meta de distribuição. Dados no Supabase; site estático na Vercel.

## Conteúdo
| Arquivo | Para quê |
|---|---|
| `index.html` | O app completo (cópia exata do deploy de produção) |
| `supabase/schema.sql` | Esquema do banco, sem dados |
| `CLAUDE.md` | Regras para o Claude Code |
| `CONTEXTO_PROJETO.md` | Funcionalidades, arquitetura, decisões e pendências |
| `.gitignore` | Ignora segredos, dados e planilhas |

## Abrir localmente no Windows
1. Instale o Python 3 (ou Node.js) e o Claude Code.
2. No PowerShell:
   ```powershell
   cd C:\caminho\receptivos-comercial
   python -m http.server 5500
   ```
   Abra http://localhost:5500 no Chrome ou Edge. Alternativa com Node: `npx serve -l 5500`.
3. Para trabalhar com o Claude Code: em outro PowerShell, na mesma pasta, rode `claude`. Ele lê o `CLAUDE.md` sozinho.

**Atenção:** como está, o app local usa o banco de PRODUÇÃO (constantes `SB_URL` e `SB_KEY` perto da linha 1029 de `index.html`). Para testar sem risco, crie um projeto Supabase de desenvolvimento, aplique `supabase/schema.sql` nele e troque as duas constantes só na sua cópia local, sem commitar.

## Banco de dados novo (desenvolvimento)
1. Crie um projeto no Supabase e abra o SQL Editor.
2. Cole e execute `supabase/schema.sql` (só em projeto vazio).
3. Em Authentication › URL Configuration, cadastre `http://localhost:5500` em Site URL e em Redirect URLs.
4. **Primeiro editor:** no SQL Editor, rode (troque pelo seu e-mail, em minúsculas):
   ```sql
   insert into public.convites(email, papel) values ('seu@email.com', 'editor');
   ```
   Depois abra o app, use "Primeiro acesso" › "Criar conta" com esse e-mail, confirme o e-mail e entre. Os demais usuários são convidados pela tela Configurações › Usuários.
5. Os dados do app (config e meses) começam vazios. Use Configurações › Importar planilha ou cadastre vendedores, origens e tipos.

## Publicar no futuro (ainda NÃO feito)
Hoje o deploy foi feito por upload direto, sem Git. Quando for migrar:
1. Crie o repositório no GitHub e faça o primeiro commit com estes arquivos.
2. Na Vercel, projeto `receptivos`, conecte o repositório (Settings › Git). Sem framework e sem comando de build; a raiz do projeto é a pasta com `index.html`.
3. Em Authentication › URL Configuration do Supabase de produção, ajuste Site URL para o domínio final (hoje o padrão do Supabase ainda não foi trocado).
4. Revise a proteção do projeto na Vercel (hoje exige login na Vercel).
5. Publique só depois de testar em um banco de desenvolvimento.
