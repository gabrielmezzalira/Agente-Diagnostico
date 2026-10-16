# Plano — Redesign do DocuData (design system CITi, tema escuro) + Produto + Discovery

Fonte visual: `~/Downloads/Documento visual pontos_positivos/DocuData Redesign.dc.html` (11 telas, 1440 px) e `DESIGN.md`.
Repo: `~/Documents/Faculdade/CIti/Liderança Dados/Agentes/Documentador`. **Trabalho num git worktree separado** (`../Documentador-redesign`, branch `feat/redesign-ui-citi`, cortada de `origin/main` em 9918211) para não tocar nas alterações não commitadas do usuário na pasta original.
Regras do AGENTS.md que valem aqui: estilo inline/CSS-in-JS atual (sem Tailwind nem framework visual novo), sem nova dependência sem decisão, sem commit/push salvo pedido, validação mínima `npm run build` em `docudata-frontend/`.

## 1. O que muda (em linguagem comum)
Hoje o DocuData é claro (fundo cinza-claro, cartões brancos). Vai virar o visual escuro da CITi dos protótipos, com menu lateral fixo e barra superior com busca e troca de subárea. É uma reforma da decoração: **as regras, rotas e dados não mudam**. Além disso entram telas que ainda não existem: a subárea **Produto** (hoje o backend aceita, a tela não conhece) e o **Discovery** (requisitos que saem das reuniões do Agente Diagnóstico: lista, detalhe com evidências, revisar, promover, reuniões e encaminhar para Dados ou Dev).

## 2. Como vai ser alterado (ordem, fatias reversíveis)
1. **Base visual:** `globals.css` com os tokens (variáveis CSS), fonte Geist/Geist Mono, fundo `#030504`; `app/lib/ds.ts` com os mesmos tokens para uso em estilos inline.
2. **Kit de componentes** `app/components/ds/` (Card, Button, Chip, StatusDot, PageHeader, Tabs, DetailRows, Field/Input, EmptyState…) com estilo inline.
3. **Casca:** `AppShell` (sidebar 248 + topbar 72: busca ⌘K, seletor Dados | Dev | Produto, + Novo projeto) aplicada no layout raiz e no de subárea; o badge de usuário vira o cartão do rodapé da sidebar; `AuthGuard` preservado.
4. **Recolorização das telas atuais:** script de substituição por propriedade (`color`, `background`, `border*`) das ~40 cores claras para os tokens escuros, aplicado arquivo a arquivo, revisado no diff; depois ajuste manual das telas do protótipo (01 a 11).
5. **Subárea Produto:** `Subarea` aceita `produto` (layout, seletor, formulário de novo projeto, rótulos).
6. **Discovery (telas novas):** aba "Requisitos" e "Reuniões" no projeto; detalhe do requisito (evidências, histórico de transições, promover); ação "Encaminhar" para Dados/Dev. Consomem a API que já existe em `/discovery/*` (login de gerente ou superior).
7. Cada fatia vira um commit atômico na branch; nenhum push sem pedido.

## 3. Riscos de cada ação
- Passo 4: recolorizar por regex pode inverter contraste em casos especiais (texto branco sobre botão verde, `#fff` usado como fundo e como texto), deixando texto ilegível; gráficos (recharts) têm cores próprias.
- Passo 3: a casca nova muda a estrutura de todas as páginas; páginas de login/cadastro não podem ganhar sidebar; o `UserBadge` fixo some.
- Passo 5/6: `Subarea` é usada em rotas e chamadas de API; erro de tipo ou de rota quebra o build; a API de discovery exige cargo gerente+.
- Geral: arquivos gigantes (`[id]/page.tsx` 2285 linhas, `TasksKanbanTab` 1550) tornam diffs grandes difíceis de revisar.

## 4. Como prevenir
- Substituição em lote só com mapa explícito de cores revisado e diff por arquivo; conferir visualmente cada tela com uma API falsa (dados de exemplo) e comparar com o protótipo.
- Casca aplicada por layout com lista de rotas públicas (login, cadastro, esqueci/redefinir senha) sem sidebar.
- `npm run build` + `npm test` a cada fatia; tipos de `Subarea` centralizados.
- Telas de discovery testadas contra a API falsa e depois contra o ambiente real quando o usuário liberar.

## 5. Como consertar (rollback)
Cada fatia é um commit reversível (`git revert`). Todo o trabalho vive na branch `feat/redesign-ui-citi` e no worktree; a pasta original do usuário e a `main` não são tocadas. Sem migration, sem variável de ambiente nova, sem mudança de backend.

## 6. Decisões que são do usuário/time
- **Decidido:** DocuData depois do Agente; telas novas = Discovery + Produto; fidelidade ao protótipo.
- **DECISÃO EM ABERTO:** fontes por CDN (Google Fonts) versus empacotar a fonte (dependência nova); começo por CDN, como no protótipo.
- **DECISÃO EM ABERTO:** recharts (gráficos) precisa de cores próprias do tema; sigo o `DESIGN.md` (verde realizado, cinza `#4a5550` referência).
- **DECISÃO EM ABERTO:** a tela de Produto no DocuData não tem protótipo próprio; uso o mesmo layout de subárea de Dados.
- Não faço commit nem push no DocuData sem pedido; a pasta original do usuário não é alterada.

## 7. Verificação (ponta a ponta)
- `npm run build` e `npm test` em `docudata-frontend/` verdes.
- Conferência visual das 11 telas contra o protótipo (1440 px) e em 1024 px, com API falsa.
- Fluxo real depois de liberado: login → subárea → projeto → abas → Requisitos (listar, abrir, validar, promover) → Encaminhar.
- Acessibilidade: contraste AA, foco visível, `prefers-reduced-motion`, rótulos.
