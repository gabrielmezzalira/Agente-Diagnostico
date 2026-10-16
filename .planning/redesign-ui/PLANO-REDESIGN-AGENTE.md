# Plano — Redesign do Agente Diagnóstico (design system CITi, tema escuro)

Fonte visual: `~/Downloads/Documento visual pontos_positivos/Agente Diagnostico Redesign.dc.html` (4 telas, 1440 px) e `DESIGN.md` (copiado para a raiz do repo). Branch: `feat/redesign-ui-citi`. Modo UI-ONLY, tier COMPLEXA (protótipo = Etapa 8 já pronta; telas novas seguem o mesmo kit).

## 1. O que muda (em linguagem comum)
Hoje o Agente é claro (fundo cinza/branco, fonte Barlow). Vai virar o visual escuro da CITi dos protótipos: fundo quase preto com brilho verde no topo, cartões com contorno verde, fonte Geist, menu lateral fixo com logo, busca e usuário. É como trocar a decoração e a mobília de uma casa sem mexer nas paredes e na fiação: **nenhuma regra de negócio, rota de API ou comportamento muda**; só a aparência e a organização das telas. Além disso entram telas que ainda não existem (Sessões, Extensão Chrome, Configurações) e a informação do vínculo com o DocuData, que hoje só existe no backend.

## 2. Como vai ser alterado (ordem, commits atômicos)
1. **Base visual** — `index.html` (fontes Geist/Geist Mono), `index.css` (tokens do DESIGN.md; os nomes antigos `--color-*` passam a apontar para os valores escuros, assim nada quebra no meio do caminho), `CITiLogo` sem filtro preto. Mecânico, 1 commit.
2. **Kit de componentes** `src/components/ui/`: `Card`, `Button`, `Chip`, `StatusDot`, `Eyebrow`, `PageHeader`, `DetailRows`, `StatCard`, `EmptyState`, `Field/Input/Textarea/Select`, `ProgressBar`. Testes de renderização básicos. 1 commit.
3. **Casca** `src/components/layout/`: `AppShell` (sidebar 248 px + topbar 72 px com busca ⌘K) e `SessionShell` (topbar de 68 px da sessão ao vivo). 1 commit.
4. **Telas do protótipo**, uma por commit: 01 Projetos (`HomePage`), 02 Projeto (`ProjectDetailPage`), 03 Sessão encerrada, 04 Sessão ao vivo (`SessionActivePage`, 1135 linhas: só estilo e extração de subcomponentes, lógica intacta).
5. **Telas existentes sem protótipo**, no mesmo kit: formulário de projeto, setup de sessão, lista e editor de precificação.
6. **Telas novas**: Sessões (lista global, agregando `sessions.list` por projeto), Extensão Chrome (instruções hoje no banner), Configurações (somente leitura: endereço da API e estado da integração), bloco "Integração DocuData" no projeto (campo `docudata_project_id`, que o backend já aceita).
7. Depois, o mesmo kit é levado ao DocuData (plano à parte, repo separado).

## 3. Riscos de cada ação
- Passo 1: nome de token antigo apontando para cor escura pode deixar texto ilegível em páginas ainda não migradas (ex.: `text-white` sobre fundo claro virando invisível).
- Passo 2/3: componente novo com API diferente da usada hoje pode forçar mexer em muitas telas ao mesmo tempo.
- Passo 4: `SessionActivePage` tem WebSocket, timers e fila de perguntas; reorganizar JSX pode quebrar efeitos, cleanup ou atalhos.
- Passo 5: precificação tem tabelas densas que não existem no protótipo.
- Passo 6: Sessões agregada faz N chamadas (uma por projeto); Configurações pode sugerir algo editável que não existe.
- Geral: Tailwind 4 purga classes dinâmicas; fonte externa (Google Fonts) fora do ar cai para fonte do sistema.

## 4. Como prevenir
- Migrar tela por tela e rodar `npm run build` + `npm test` + `npm run lint` a cada commit; conferir no navegador (Vite dev) cada tela contra o protótipo.
- Manter nomes de props/estado das telas atuais; extrair visual em componentes sem tocar hooks.
- `SessionActivePage`: não mexer em `useSessionWS`, nem em handlers; só `className`/estrutura; conferir ao vivo com sessão de teste.
- Sessões agregada: busca em paralelo e com teto de projetos; mostrar erro parcial sem esconder o resto.
- Configurações é só leitura e diz isso na tela.
- Classes sempre completas (sem montar nome de classe por string).
- Fallback de fonte `system-ui` definido no tema.

## 5. Como consertar (rollback)
Cada commit é reversível sozinho (`git revert <sha>`); o redesign inteiro vive na branch `feat/redesign-ui-citi` e a `main` não é tocada até a revisão. Se um token escuro quebrar tela não migrada, reverter só o commit 1 restaura o tema claro. Nenhuma migration, nenhuma variável de ambiente e nenhum endpoint novo: nada fora do repo para desfazer.

## 6. Decisões que são do usuário/time
- **Decidido (usuário, 2026-10-14):** Agente primeiro; telas novas = Discovery + Produto + o que falta no Agente; fidelidade ao protótipo.
- **DECISÃO EM ABERTO:** tela de Configurações editável (trocar chave, URL do DocuData) exigiria endpoint novo e regras de segurança; por enquanto só leitura.
- **DECISÃO EM ABERTO:** campo `docudata_project_id` aparece no formulário de projeto como texto livre (o backend aceita; há risco de segurança já registrado: API do Agente sem autenticação). Dropdown com projetos do DocuData precisaria de endpoint novo e chave de serviço no front: não faremos sem decisão.
- **DECISÃO EM ABERTO:** atalho ⌘K de busca: primeira versão filtra projetos do Agente; busca global fica para depois.
- Sem push, sem merge na `main`, sem abrir PR sem pedido do usuário.

## 7. Verificação (ponta a ponta)
- `npm run build`, `npm test`, `npm run lint` verdes.
- Conferência visual de cada tela contra o protótipo (1440 px) e em largura menor (1024).
- Fluxo real: listar projetos → abrir projeto → nova sessão → sessão ao vivo (estado vazio do protótipo e com dados) → encerrar → tela de sessão encerrada → relatório.
- Acessibilidade: contraste AA do texto `muted` (#8a948e) sobre `#030504`, foco visível, `prefers-reduced-motion`, rótulos em inputs.
- Sementes de teste: testes de renderização dos componentes do kit (`Chip`, `DetailRows`, `Button` variantes).

## Contrato de UI (resumo do DESIGN.md aplicado)
- Tokens: bg `#030504`, sidebar `#070b09`, card gradiente `#0e1913→#0a120d` com borda `rgba(62,224,111,.2)`, inset `0 1px 0 rgba(62,224,111,.12)`, sombra `0 12px 32px rgba(0,0,0,.45)`, raio 16; verde `#3ee06f`, vermelho `#ff6b6b`, âmbar `#f2c14e`, violeta `#b197fc`; texto `#f2f5f3`/`#c3cbc6`/`#8a948e`/`#5d6661`.
- Tipografia: Geist 400–700 e Geist Mono (números, ids, datas, rótulos 11 px caixa alta, tracking .16em); H1 44/700, tracking −.035em; corpo 14–15.5/1.55.
- Layout: sidebar 248; topbar 72 (68 na sessão ao vivo); conteúdo `padding 40px 48px`, gap 28; sessão ao vivo em grade `300px | 1fr | 360px`.
- Botões 38 px, raio 10: primário verde com glow, secundário translúcido, ghost, perigo; "Nova sessão" é botão hero de 64 px. Um primário por card.
- Estados: loading, erro (card vermelho suave), vazio (borda tracejada, texto dim).
- Navegação: Projetos, Sessões, Extensão Chrome, Configurações; usuário no rodapé da sidebar.
