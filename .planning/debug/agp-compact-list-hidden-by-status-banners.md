---
status: diagnosed
trigger: "agp-compact-list-hidden-by-status-banners (gap G-10-7 do UAT da Fase 10, teste 7 parte B)"
goal: find_root_cause_only
created: 2026-10-31
updated: 2026-10-31
---

## Current Focus

hypothesis: CONFIRMADA (por leitura estática do CSS/JSX, sem medir no Chrome). No degrau `compact` (janela de 320 px) as faixas de altura fixa (`shrink-0`) do corpo ao vivo somam mais do que o espaço disponível. A lista da aba AGP é a única peça "elástica" (`flex-1 min-h-0`), então fica com 0 px. Nenhum contêiner da aba corta o próprio conteúdo (sem `overflow-hidden`), então a barra de abas e a faixa "Pausado" transbordam da caixa de altura zero e são desenhadas por cima da linha de estatísticas ("1 fala · 1 pessoa · 31 palavras").
test: somar as alturas das faixas fixas do `LiveBody` (PanelApp.tsx) contra o corpo útil do degrau compact (320 - cabeçalho - padding).
expecting: soma das faixas >= corpo útil quando há pausa (aviso amarelo + faixa "Pausado"); sobra de ~39 px (só a borda do 1º cartão) quando está tudo saudável.
next_action: nenhuma (diagnóstico fechado). O caller decide o rumo da correção (ver Resolution.suggested_fix_direction e as decisões do time).
bug_class: Bohrbug (determinístico, depende só do degrau de altura e das faixas presentes)
reasoning_notes:
  candidate_causes:
    - "code: orçamento vertical do corpo ao vivo sem altura mínima reservada para a lista; contêineres da aba sem overflow-hidden (causa direta do sumiço e da sobreposição)"
    - "code: vigia de captura (`checkCaptureHealth`) não sabe de pausa e dispara o aviso amarelo 'As legendas do Meet pararam de chegar' mesmo com a pausa deliberada (causa de uma das duas faixas que estouram o orçamento)"
    - "config/design: UI-SPEC A-2 aceitou 'compact quase sem espaço para a lista', mas o roteiro do UAT 7 prometeu 'uma ou duas perguntas ocupam a lista' (contrato inconsistente; ninguém reservou altura)"
    - "environment/data: aviso 'Conta do Meet: <email>', aviso de idioma da legenda e barra de vínculo em 'offline' (2-3 linhas) podem se somar e piorar; o nome do cliente/ texto da pergunta não influenciam"
  and_gate: "SIM. Precisa de mais de uma condição ao mesmo tempo: degrau compact (320 px) + barra de vínculo + faixas extras da pausa (aviso amarelo + faixa 'Pausado'). Sem as faixas da pausa sobram ~39 px (só uma tira do cartão); em regular (564 px) sobram ~243 px (cerca de 2 cartões, como o UI-SPEC previu)."

## Symptoms

expected: Per UAT test 7 (10-UAT.md) and 10-UI-SPEC.md: in all three panel sizes (compact, medium, tall) the tab bar is fully visible; in the compact sizes one or two questions already fill the list and it scrolls; the status strip ("Reconectando ao Agente…" / "Pausado · mostrando as últimas perguntas") stays fixed at the top of the tab while the list scrolls underneath; long text without spaces wraps inside the card, no horizontal scroll.
actual: User report (verbatim, Portuguese): "capturei esse defeito em que o pausado fica junto com o numero de falas pessoas e palavras. quando eu clico em deixar ou fixar ou descartar ai na parte de comprimido eu não consigo visualizar mais as perguntas, porem antes disso eu conseguia". Screenshot "Screenshot 2026-10-31 144656.png" (NÃO foi encontrado na pasta Imagens/Screenshots durante o diagnóstico; a descrição abaixo vem do relato e do 10-UAT.md): panel header "Pausado · 03:45", a yellow notice "As legendas do Meet pararam de chegar. Religando sozinho.", the tab "AGP" with badge 3, then the strip "Pausado · mostrando as últimas perguntas" drawn ON TOP of the footer text "1 fala · 1 pessoa · 31 palavras", and NO question card visible at all.
errors: None reported.
reproduction: UAT test 7 part B (gap G-10-7). Panel in compact size, AGP tab with 3 questions, capture paused (strip "Pausado"), yellow captions notice shown.
started: Descoberto no UAT de 2026-10-31. O usuário diz que a lista estava visível antes na mesma sessão.

## Eliminated

- hypothesis: "Depois de usar/fixar/descartar no site, a lista do painel filtra ou remove cartões por status."
  evidence: "AgpQuestionsPanel.tsx desenha `feed.questions` sem filtro nenhum (const visible = feed.questions). A normalização em agpQuestions.ts só aceita status 'queued' ou 'pinned' na entrada. O backend não avisa pin/dismiss/use por WebSocket (D-09), então essas ações no site não mexem na lista do painel até a reconexão. O contador da aba continuou em 3, ou seja, as 3 perguntas continuavam no feed; só não havia altura para desenhá-las."
  timestamp: 2026-10-31

- hypothesis: "A faixa de status usa posicionamento absoluto/sticky e colide com o rodapé."
  evidence: "A faixa é um `<p role=\"status\" class=\"flex shrink-0 ...\">` em fluxo normal (AgpQuestionsPanel.tsx linha 72). Não há absolute/sticky/fixed. A sobreposição vem de transbordamento (overflow) de caixas com altura zero, não de posicionamento."
  timestamp: 2026-10-31

- hypothesis: "O degrau de altura é diferente do esperado (preferências do painel)."
  evidence: "PANEL_HEIGHTS.compact = 320 px, fixo (PanelApp.tsx linha 135-139); o `<section>` é um grid de 2 linhas `auto minmax(0,1fr)` com overflow-hidden. A geometria bate com o que o UI-SPEC descreve."
  timestamp: 2026-10-31

## Evidence

- timestamp: 2026-10-31
  checked: "taqciti/src/content/ui/PanelApp.tsx (LiveBody, LiveStats, LiveControls, <section> do painel) e taqciti/src/sidepanel/components/AgpLiveTabs.tsx / AgpQuestionsPanel.tsx"
  found: |
    Cadeia de layout no painel compact (320 px):
      <section grid rows [auto, minmax(0,1fr)] overflow-hidden, height 320>
        PanelHeader (~94 px: pt 14 + linha de botões 28 + título ~42 + pb 10)
        <div flex flex-col min-h-0 px-3.5 pb-3.5>            <- corpo útil ~212 px (320 - 94 - 14)
          liveSlot (AgenteBindingBar "Enviando ao vivo para X")  min-h 40 + mb-2 = 48, shrink-0
          <div mb-2 shrink-0><AccountBoundaryNotice/></div>      0 px de conteúdo, mas a margem mb-2 (8 px) fica mesmo vazia; ~43 px se mostrar "Conta do Meet: email"
          aviso de idioma da legenda (se não for pt)             ~80-100 px, shrink-0
          aviso amarelo "As legendas do Meet pararam de chegar"   ~45 px (1 linha) a ~63 px (2 linhas), shrink-0
          <AgpLiveTabs flex-1 min-h-0>                           ÚNICA peça elástica
            tablist  h-8 + mb-2 = 40 px, shrink-0
            tabpanel flex-1 min-h-0
              AgpQuestionsPanel flex-1 min-h-0 gap-2
                faixa de status <p shrink-0>  ~17 px + gap-2 8 px
                scroll-region flex-1 min-h-0                      <- a lista
          LiveStats  mt-2.5 + 1 linha = ~27 px, shrink-0
          LiveControls mt-2.5 + botões h-10 = 50 px, shrink-0
  implication: "Tudo ao redor da lista é `shrink-0`; a lista só ganha o que sobrar, e não há altura mínima reservada nem corte (`overflow-hidden`) em AgpLiveTabs, no tabpanel nem no AgpQuestionsPanel."

- timestamp: 2026-10-31
  checked: "Conta do orçamento vertical no compact (estimativa por CSS; NÃO medida no Chrome; margem de erro de alguns px). Tokens: text-caption 11.5 px/1.45, text-body 12.5 px/1.55, text-title 15 px/1.35 (tailwind.config.ts)."
  found: |
    Corpo útil: ~212 px. Altura que sobra para o corpo da aba (tabpanel = lista + faixa):
      A) Saudável (sem aviso amarelo, sem faixa Pausado): 212 - (48 + 8 + 40 + 27 + 50 = 173) = ~39 px
         -> só a borda do 1º cartão (16 px de padding + linha do emblema ~23 px); nem uma linha de texto da pergunta.
      B) Só a faixa "Pausado" (17 + gap 8 = 25 px):  ~14 px para a lista -> nenhum cartão legível.
      C) Aviso amarelo + faixa "Pausado" (o caso do print): 212 - (173 + ~45) = ~-6 px (ou ~-24 px se o aviso quebrar em 2 linhas) -> o tabpanel recebe 0 px; a lista recebe 0 px.
    Um cartão inteiro precisa de ~105-125 px (p-4 = 32 + emblema 23 + gap 8 + 2 a 3 linhas de ~20 px).
    Conferência da escala: em `regular` (564 px) o mesmo cálculo dá ~243 px para a lista, "cerca de 2 cartões", exatamente o que o UI-SPEC estimou.
  implication: "O defeito é de orçamento de altura. No caso do print a lista tem 0 px, por isso 'contador 3, nenhum cartão'."

- timestamp: 2026-10-31
  checked: "Por que a faixa 'Pausado' e a barra de abas aparecem POR CIMA do rodapé"
  found: |
    Com o tabpanel em 0 px, a faixa de status (shrink-0, ~17 px) não cabe, mas nada corta: ela é desenhada para fora, abaixo da barra de abas (em y = 40 px relativo ao topo do AgpLiveTabs). A linha de estatísticas começa logo abaixo do AgpLiveTabs (que ficou com ~35 px ou menos) + mt-2.5 (10 px), ou seja em y ~ 45 px. Resultado: faixa em y 40-57 e estatísticas em y 45-62, sobrepostas em ~12 px. Bate com o print ("Pausado... desenhado sobre '1 fala · 1 pessoa · 31 palavras'").
  implication: "A sobreposição é consequência de contêineres sem `overflow-hidden` ao redor de filhos `shrink-0` quando o pai tem altura zero."

- timestamp: 2026-10-31
  checked: "Por que o aviso amarelo aparece em pausa deliberada: GoogleMeetProvider.checkCaptureHealth() (linhas ~458-481) e setCapturePaused() (linhas 288-302)"
  found: |
    `checkCaptureHealth` roda a cada poll (linha 431) e NÃO consulta `capturePaused`. Em pausa o observer é desligado (nenhum chunk novo), as legendas do Meet continuam ligadas e com texto na região; passados CAPTURE_STALL_TIMEOUT_MS = 25 s, `captureStalled` vira true, o controller marca `captureHealthy = false` e o PanelApp mostra "As legendas do Meet pararam de chegar. Religando sozinho." O próprio print mostra os dois estados juntos: cabeçalho "Pausado · 03:45" + aviso amarelo.
    (Não verifiquei no Chrome se a região de legenda ainda tem texto durante a pausa; o print e a ausência de guarda no código apontam que sim.)
  implication: "Pausar gera DUAS faixas novas de uma vez: a faixa 'Pausado' do AGP (M-1/M-2, plano 10-07) e este aviso amarelo, que é um alarme falso (a captura foi pausada de propósito). Juntas, estouram o orçamento do compact."

- timestamp: 2026-10-31
  checked: "10-UI-SPEC.md: seção Superfícies e A-2; roteiro do UAT 7 em 10-UAT.md"
  found: |
    O UI-SPEC já dizia: "no compact (320 px) sobra algo em torno de uma fração de cartão" e A-2: "Sem redimensionamento automático. Em compact a lista tem quase nenhum espaço; o usuário usa regular ou tall." Já o roteiro do UAT 7 diz o contrário: "nos compactos, uma pergunta ou duas já ocupam a lista, e ela rola". O plano 10-07 (faixa Pausado) acrescentou mais ~25 px fixos ao compact sem recalcular o orçamento. Nenhum teste mede altura: panelLayout.test.ts só confere `grid-cols-[minmax(0,1fr)]`, e os testes do AGP só conferem textContent/ARIA/classes (jsdom não calcula layout).
  implication: "Houve uma lacuna de contrato (UI-SPEC aceita 'quase sem espaço', UAT promete 1-2 perguntas) e uma lacuna de gate (nada na suíte pega estouro vertical)."

- timestamp: 2026-10-31
  checked: "Relação com 'clicar em usar/fixar/descartar no site'"
  found: "Nada nessas ações altera o painel (D-09). O que de fato aconteceu perto desse momento foi a PAUSA (UAT 11 registra: 'Bloco 3a, pausa: a faixa Pausado aparece, mas no compact se sobrepõe ao rodapé'; o cabeçalho do print diz 'Pausado · 03:45')."
  implication: "A causa percebida pelo usuário (ações no site) é coincidência de tempo; o gatilho real é a pausa (e qualquer outra faixa que some altura no compact)."

## Resolution

root_cause: |
  O corpo ao vivo do painel do Meet (PanelApp.tsx, LiveBody) empilha várias faixas de altura fixa (`shrink-0`) e deixa a lista da aba AGP como a única peça elástica (`flex-1 min-h-0`), sem altura mínima reservada e sem `overflow-hidden` nos contêineres da aba (AgpLiveTabs, tabpanel, AgpQuestionsPanel). No degrau compact (janela de 320 px, corpo útil de ~212 px) o que sobra para a lista já é só ~39 px com tudo saudável (uma tira do primeiro cartão). Ao pausar a captura entram duas faixas novas ao mesmo tempo: (1) a faixa "Pausado · mostrando as últimas perguntas" dentro da aba AGP (~25 px) e (2) o aviso amarelo "As legendas do Meet pararam de chegar" (~45-63 px), que é um alarme falso porque o vigia de captura (`GoogleMeetProvider.checkCaptureHealth`) não sabe que a captura está pausada. Somadas, as faixas passam do espaço do compact: a lista fica com 0 px (contador 3, nenhum cartão visível) e, como nada corta o transbordo, a barra de abas e a faixa "Pausado" são desenhadas por cima da linha de estatísticas do rodapé. Não tem relação com usar/fixar/descartar no site (o painel nem reage a essas ações, D-09); o gatilho real foi a pausa.
fix: ""
verification: ""
files_changed: []
suggested_fix_direction: |
  (Só direção, nada foi implementado.)
  1. Garantir espaço para a lista no compact: reservar altura mínima para o corpo da aba e/ou deixar as faixas ocuparem menos (ex.: pôr o texto "Pausado" na mesma linha da barra de abas, juntar aviso amarelo e barra de vínculo numa faixa só, ou subir o painel de compact para regular ao abrir a aba AGP, como o seletor de cliente já faz; UI-SPEC A-2 listou essa opção).
  2. Cortar o transbordo (`overflow-hidden` no tabpanel/AgpQuestionsPanel) para que, mesmo apertado, nada seja desenhado por cima do rodapé.
  3. Em commit separado (regra do CLAUDE.md: não misturar), tornar `checkCaptureHealth` ciente da pausa para não mostrar "legendas pararam de chegar" quando o usuário pausou.
  4. Tirar a margem fantasma do `<div mb-2 shrink-0>` do AccountBoundaryNotice quando ele não renderiza nada (já existe o precedente `empty:hidden` em LiveScreen.tsx).
  5. Deixar uma semente de teste: jsdom não mede layout, então ou um teste de "orçamento" com as alturas fixas, ou o passo manual no Chrome real em compact com pausa + aviso amarelo.
  Decisões que são do time: qual é o contrato do compact (a lista deve mostrar 1-2 cartões, como diz o UAT, ou aceitar "quase nada", como diz o UI-SPEC A-2) e se o aviso amarelo durante a pausa deve sumir (muda comportamento do painel).
