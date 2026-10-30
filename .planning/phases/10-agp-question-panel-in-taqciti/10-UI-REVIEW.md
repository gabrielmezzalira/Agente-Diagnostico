# Fase 10 — Revisão de UI (aba AGP na Taqciti)

**Auditado em:** 2026-10-30
**Linha de base:** `10-UI-SPEC.md` (aprovado em 2026-10-28, 1 revisão do checker)
**Método:** só análise de código. Nenhum servidor, navegador ou captura de tela foi usado (pedido do orquestrador). A Taqciti é uma extensão, então não existe `localhost` para fotografar de qualquer forma.
**Capturas de tela:** não capturadas (análise de código)
**Capturas de interação:** off (`workflow.ui_interaction_capture` é `false`; nada foi rodado)
**Estado do código:** árvore limpa em `taqciti/src` (nenhuma modificação pendente além de `.planning/config.json` e `.planning/state.json`, que não são desta auditoria)

> Esta revisão julga o que está **escrito** no código. Tudo o que depende de pixel real (altura que sobra no degrau `compact`, contraste sobre o vidro, foco no teclado dentro do shadow root do Meet, rolagem horizontal com texto sem espaços) está listado ao final em "O que só um Chrome real prova" e continua pendente no UAT 7, que o plano 10-11 deixou **bloqueado** por decisão do usuário.

---

## Pontuação dos pilares

| Pilar | Nota | Achado principal |
|-------|------|------------------|
| 1. Textos (Copywriting) | 3/4 | Todos os textos batem com o contrato, mas "AGP" nunca é explicado na tela e o aviso do estado 2 não diz o que fazer |
| 2. Visual | 3/4 | Hierarquia correta; as perguntas "velhas" do estado Pausado têm a mesma cara das vivas (a transcrição, em pausa, fica esmaecida) |
| 3. Cor | 4/4 | Sem cor fixa no código do AGP; acento só onde o contrato manda (uma observação menor sobre o `hover`) |
| 4. Tipografia | 4/4 | 3 dos 5 degraus e 2 pesos, exatamente o contrato |
| 5. Espaçamento | 4/4 | Toda classe de espaçamento do AGP está em 4/8/16; nenhum valor arbitrário |
| 6. Experiência (Experience Design) | 3/4 | 7 estados cobertos e abas acessíveis, mas o foco do teclado fica invisível na lista e trocar de aba desmonta tudo |

**Total: 21/24**

Nenhum achado bloqueante (nota 1). Nenhum pilar abaixo de 3.

---

## As 3 correções que mais valem

Todas mexem em algo que o UI-SPEC trava, então cada uma é uma **DECISÃO EM ABERTO** do time, não do executor (regra do `CLAUDE.md`).

1. **Foco visível na região que rola** — `AgpQuestionsPanel.tsx:77` — quem navega por teclado cai na lista e não vê onde está — trocar `outline-none` por um anel de foco só no `:focus-visible` (o anel global já existe e seria herdado se a classe `outline-none` saísse) e ajustar o teste que hoje exige a classe.
2. **Trocar de aba não pode perder o lugar** — `AgpLiveTabs.tsx:84` — a lista volta para o topo e a transcrição volta para o fim — manter as duas montadas e esconder a inativa (por exemplo, `hidden` no painel que não está à vista) em vez de desmontar.
3. **Provar (ou corrigir) o degrau `compact`** — UAT 7 — no painel de 320 px a lista pode ficar menor que um cartão, e a faixa fixa do M-2 come mais 25 px — medir no Chrome real; se confirmar, decidir a A-2 (subir o painel para `regular` ao abrir a AGP, como o `AgenteLiveSlot` já faz).

---

## Conferência contra o contrato (M-1 a M-6 e itens pedidos)

| Item do contrato | Resultado | Evidência no código |
|------------------|-----------|---------------------|
| M-1 estado Pausado | Conforme | `agpQuestionsStore.ts:18` e `:29` incluem `'paused'` (sem isso o `normalizeAgpFeed` trocaria por `idle` em silêncio); `AgpQuestionsPanel.tsx:35-36` faixa com ícone `pause` de 11 px, `title` com a dica; `:47-51` corpo vazio próprio ("Nenhuma pergunta foi recebida antes da pausa.") |
| "Pausado" x "Reconectando" | Conforme | Só o pausado tem ícone (`withPauseIcon`); as duas faixas usam `text-caption text-muted`, `role="status"`, sem fundo nem borda (`:72`) |
| M-2 faixa fixa | Conforme | `:72` `shrink-0`, irmã da região que rola (`:77`), não filha dela; o teste `%s: a faixa fica fora da região que rola` prova a estrutura |
| M-3 rolagem, quebra, emblemas | Conforme, com ressalva | `scroll-region` + `tabIndex={0}` (`:77`), `break-words` (`:97`), linha de emblemas só com emblema (`:87`), `animate-fade-in motion-reduce:animate-none` (`:85`). Ressalva: `outline-none` (achado W-1) |
| M-4 abas acessíveis | Conforme | `AgpLiveTabs.tsx`: `h-8` (`:17`), `id` + `aria-controls` (`:62-66`), `tabIndex` móvel (`:68`), setas com `preventDefault` só nas duas teclas (`:49-55`), `tabpanel` com `aria-labelledby` (`:83`), `aria-label` singular/plural (`:20-23`); o texto visível continua `AGP2` |
| M-5 aviso da saída larga | Conforme | `UNLINKED_NOTICE + UNLINKED_WIDE_HINT` (`:16-17`, `:43-45`) dá exatamente "...perguntas do Agente. O vínculo é feito no painel do TaqCITi dentro do Meet."; `LiveScreen.tsx:68` passa `surface="wide"`; `PanelApp.tsx:916` não passa nada e fica só com a primeira frase |
| M-6 espaçamento 4/8/16 | Conforme | Ver pilar 5 (levantamento completo das classes) |
| Cartão não interativo | Conforme | O `<li>` (`:83-86`) não tem hover, foco, cursor nem botão; o texto continua selecionável |
| Lista `aria-label` e sem `aria-live` | Conforme | `:81`; teste `a lista não é aria-live` |
| Sem relógio local / sem botões (D-08, D-12) | Conforme | Nenhum botão, timer ou barra de TTL em `AgpQuestionsPanel.tsx` nem em `AgpLiveTabs.tsx`; `useAgpQuestions.ts` só assina o storage |

---

## Achados detalhados

### Pilar 1: Textos (3/4)

Nenhum rótulo genérico ("Enviar", "OK", "Cancelar", "Salvar", "No data") em `AgpQuestionsPanel.tsx` nem em `AgpLiveTabs.tsx`. Todas as frases do Contrato de copy estão no código **literalmente**:

- Aba: "Transcrição" e "AGP"; lista: "Perguntas do Agente" (`AgpQuestionsPanel.tsx:81`).
- Estado 1: `:16`; estado 1 na saída larga: `:16-17`; estado 2: `:64`; conectando e reconectando: `:32-34`; pausado: `:36`; vazio ao vivo e vazio pausado: `:47-51`; emblemas "Produto", "Dados", "Fixada" (`:11`, `:94`).
- Vocabulário ("Agente", "cliente", "vínculo") segue o resto da Taqciti.

Desvios e pontos fracos (nenhum quebra o contrato):

- **I-3** O rótulo "AGP" nunca é explicado dentro da Taqciti (todo o texto ao redor fala "Agente"). O público é produto/soluções; o `aria-label` "AGP, 2 perguntas" também será soletrado "A G P" por leitor de tela. O contrato trava o rótulo; fica como sugestão ao time.
- **I-4** O aviso do estado 2 ("A sessão do Agente não está ativa...") não diz o próximo passo (já era FLAG do checker). O aviso de duas frases da saída larga diz *onde* vincular, mas não como trazer de volta o painel do Meet se ele estiver minimizado em cápsula.
- O aviso de pausado não diz a causa (reunião pausada, legendas desligadas ou envio desligado); é a decisão A-5 do contrato, só registrada aqui.

### Pilar 2: Visual (3/4)

- Hierarquia: aba selecionada com véu e `text-glow`; emblemas de pílula; texto da pergunta em `text-body` com `leading-relaxed`. Foco natural = emblema + texto do cartão, e a faixa de status quando há.
- Ícone `pause` é decorativo: o `Icon` já entrega `aria-hidden="true"` (`Icon.tsx`). Não há botão só de ícone na aba.
- Cartão `glass-subtle` sem blur, como o contrato exige (`glass.css`: só `.glass` e `.glass-raised` desfocam).
- **I-5 (visual)** No estado Pausado a transcrição fica esmaecida (`dimmed` em `LiveScreen.tsx:73` e `PanelApp.tsx:921`), mas os cartões da AGP ficam idênticos aos vivos; só a faixa fina de `text-caption text-muted` avisa. Quem olha só os cartões não percebe que são "as últimas". É o que o contrato pede ("mantém a lista"), então não é desvio, mas é a leitura menos óbvia do estado.
- **W-3** (ver Experiência) o degrau `compact` pode deixar a lista com menos de um cartão.

### Pilar 3: Cor (4/4)

- Cor fixa (`#...`, `rgb(`, `rgba(`) nos dois arquivos do AGP: **nenhuma**. Tudo vem de classes de token (`text-muted`, `text-glow`, `bg-white/[0.08]`) e do `Badge`.
- Acento (`text-glow`/`primary`): aba selecionada (`AgpLiveTabs.tsx:70`) e emblema Produto (`AgpQuestionsPanel.tsx:90`), mais o anel de foco global. Contador, faixas, texto da pergunta e emblema Dados ficam sem acento. Âmbar só no "Fixada" (`:94`). Destrutivo: não usado.
- **I-1** A aba **não** selecionada usa `hover:text-glow` (`AgpLiveTabs.tsx:70`): é um quarto uso do acento que a lista "exclusivamente para" do contrato não prevê. É omissão do contrato (o código da aba já era assim e foi marcado TRAVADO), mas fica registrado.
- **I-6** O contraste do contrato ("`text-muted` em torno de 7:1") supõe fundo escuro. O vidro (`--glass-chrome`) tem opacidade de 0.72 a 0.82 e fica sobre a página do Meet; sobre fundo claro o contraste cai. Código não prova isso, só o Chrome real (ver final).

### Pilar 4: Tipografia (4/4)

- Tamanhos em uso nos dois arquivos: `text-body` (cartão e avisos), `text-caption` (aba e faixa), `text-micro` (contador). São **3 dos 5** degraus; nenhum `text-xs/sm/lg`, nenhum valor em px solto.
- Pesos: `font-semibold` (aba, `AgpLiveTabs.tsx:17`) e o 400 padrão; o `Badge` compartilhado usa `font-semibold`. Dois pesos, como o contrato.
- `leading-relaxed` no texto do cartão (1.625) é o previsto; avisos e faixas ficam no padrão do token.
- 10.5 px (`micro`) é o mínimo do produto; o contrato já registra que não deve diminuir.

### Pilar 5: Espaçamento (4/4)

Levantamento das classes de espaçamento do AGP (todas em escala):

| Classe | Valor | Onde |
|--------|-------|------|
| `gap-1` | 4 px | entre as abas (`AgpLiveTabs.tsx:79`); ícone e texto da faixa (`AgpQuestionsPanel.tsx:72`) |
| `gap-2` | 8 px | entre cartões (`:81`); entre emblemas (`:88`); faixa e lista (`:70`) |
| `mb-2` | 8 px | abaixo da barra de abas (`AgpLiveTabs.tsx:79`); da linha de emblemas ao texto (`:88`) |
| `ml-2` | 8 px | rótulo da aba até o contador (`AgpLiveTabs.tsx:73`) |
| `p-4` | 16 px | cartão (`:85`) |
| `px-4` | 16 px | aba (`AgpLiveTabs.tsx:17`); aviso centralizado (`:55`) |
| `h-8` | 32 px | altura da aba (dimensão de controle, não espaçamento) |

- Nenhum valor arbitrário (`[..px]`, `[..rem]`), nenhum `.5` (6 px / 14 px) nos arquivos do AGP. O commit `635d1f6` (M-6) cumpriu a regra de ser mecânico.
- **I-2** O `Badge` compartilhado, desenhado dentro de cada cartão, usa `gap-1.5`, `px-2.5` e `py-1` (6, 10 e 4 px): fora da grade 4/8/16. O contrato diz "sem exceção nas classes do próprio AGP" e isso é verdade, mas a lista de exclusões (`LiveScreen` e `PanelApp`) não cita o `Badge`. É lacuna de documentação do contrato, não de código.
- Fora da conta do AGP, como o contrato prevê: `px-3 pb-1 pt-2` (`LiveScreen.tsx:67`) e `px-3.5 pb-3.5` (`PanelApp`).

### Pilar 6: Experiência (3/4)

Cobertura dos 7 estados (todos presentes e com teste): sem vínculo, sessão não ativa, conectando, ao vivo vazio, ao vivo com perguntas, reconectando e pausado, mais o vazio do pausado. Há cobertura de zero/um/muitos no contador. Movimento reduzido: `motion-reduce:animate-none` no cartão mais a regra global. A aba é somente leitura (D-08), então não existe ação destrutiva a confirmar.

Desvios e riscos:

- **W-1 foco do teclado invisível na lista** (`AgpQuestionsPanel.tsx:77`). A região rolável recebe `tabIndex={0}` mas também `outline-none`. No Tailwind 3.4 isso vira `outline: 2px solid transparent`, e a regra de foco global (`:where(...):focus-visible`, camada `base` em `global.css` e `panel.css`) perde para a camada `utilities`. Resultado: dá para chegar na lista com Tab, mas não há sinal visível (só aparece em modo de alto contraste do Windows). O teste `a região rolável usa scroll-region...` (`AgpQuestionsPanel.test.tsx:124-130`) **exige** a classe, então a falha está protegida por teste. O `outline-none` vem do M-3 ("mesmo padrão de `HistoryList`", `PanelApp.tsx:830`), mas o próprio contrato lista o "anel de foco visível" como um dos três usos do acento. Os dois trechos do contrato se contradizem.
- **W-2 trocar de aba desmonta o conteúdo** (`AgpLiveTabs.tsx:84`, `{tab === 'transcript' ? children : <AgpQuestionsPanel .../>}`). Ida e volta entre as abas: a lista de perguntas volta ao topo e os cartões refazem o fade de 200 ms; o `TranscriptView` é remontado com `stickToBottom` em `true` (`TranscriptView.tsx:67`) e o `ResizeObserver` (`:173-182`) cola no fim, então quem estava lendo uma fala antiga perde o lugar. O critério 4 do ROADMAP ("quem não abre a AGP não vê nada diferente") continua verdadeiro; o desvio é só para quem abre.
- **W-3 degrau `compact`** (320 px). Só a estrutura da AGP já consome: aba 32 px + `mb-2` 8 px + faixa de status ~17 px + `gap-2` 8 px ≈ 65 px antes da lista, e um cartão de uma linha com emblema mede ~83 px (16+16 de padding, linha de emblemas ~23 px com `mb-2`, ~20 px de texto). Somando o espaço de vínculo, os controles e as estatísticas que o painel já tem, a conta do próprio contrato (uma "fração de cartão") fica pior quando a faixa fixa aparece. É estimativa por código, não medida; vira achado de verdade só no UAT 7. A decisão A-2 (sem redimensionar sozinho) foi consciente.
- **I-5b** O `role="status"` da faixa é montado já com o texto (`:71-76` renderiza condicionalmente), e leitores de tela costumam não anunciar região viva que nasce com conteúdo. O `title` com a dica do pausado também não chega por teclado nem por toque. Ambos são decisões do contrato (o contador e a faixa são o aviso).
- **I-7** Abas: sem `Home`/`End` (opcionais no WAI-ARIA); as duas abas apontam o mesmo `tabpanel` (`aria-controls` igual), que só é rotulado pela aba selecionada; o `tabpanel` não é focável quando só mostra um aviso. Nenhum bloqueia o uso.
- **I-8** Já conhecidos e aceitos no contrato: pergunta nova entra no fim sem rolagem automática (A-3); aviso e cartões esticam em aba inteira sem largura máxima (A-7); a aba volta para Transcrição ao remontar a tela (A-8).

---

## O que só um Chrome real prova (UAT 7, plano 10-11 bloqueado)

Nada disto foi (nem podia ser) provado aqui; continua `result: [pending]` no `10-UAT.md`:

1. **Degraus do painel (320, 564 e 780 px):** a barra de abas aparece inteira em todos e quanto sobra para a lista no `compact` com e sem a faixa fixa (W-3).
2. **Faixa fixa em rolagem real:** com 3 a 5 perguntas, parar o backend para "Reconectando ao Agente…" aparecer e rolar a lista; a faixa precisa ficar parada no topo (a estrutura está provada por teste; a rolagem não).
3. **Texto sem espaços (URL ou 120 letras "a"):** quebra dentro do cartão e **não** cria rolagem horizontal nos 396 px (`break-words` mais `overflow-x: hidden` do `.scroll-region`; o jsdom não mede largura).
4. **Foco e teclado dentro do shadow root do Meet:** se a lista com `outline-none` mostra algum sinal (W-1); se as setas ← e → movem entre as abas **sem roubar** teclas do Meet (os eventos saem do shadow root em direção à página).
5. **Contraste de `text-muted` e do contador `text-micro` sobre o vidro:** com a janela do Meet clara e escura, medir o que sobra dos "7:1" do contrato com o `--glass-chrome` a 0.72–0.82 de opacidade (I-6).
6. **Leitor de tela:** o botão é lido "AGP, N perguntas"; a faixa de status é anunciada ou não (I-5b); o rótulo "AGP" soletrado (I-3).
7. **Aviso de duas frases na saída larga:** como quebra em painel lateral estreito e em aba inteira (A-7).
8. **Altura real dos cartões (~10 px a mais depois do M-6)** e quantos cabem em `regular` (o contrato estima uns 2).
9. **Aspecto do vidro no shadow root:** fio de luz do `glass-subtle` (máscara XOR), barra de rolagem de 8 px com `scrollbar-gutter: stable` e o fade de 200 ms.
10. **Movimento reduzido:** ligar "reduzir movimento" no sistema e ver o cartão aparecer sem animação.
11. **Parte B do teste 7 depende de IA com crédito** (perguntas reais e backend que possa ser parado); o Gemini seguia sem crédito quando o plano 10-11 foi adiado.

---

## Arquivos auditados

- `taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx`
- `taqciti/src/sidepanel/components/AgpLiveTabs.tsx`
- `taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx` e `AgpLiveTabs.test.tsx` (só os títulos e as asserções de classe)
- `taqciti/src/sidepanel/screens/LiveScreen.tsx` (superfície larga)
- `taqciti/src/content/ui/PanelApp.tsx` (`LiveBody`, `HistoryList`, alturas do painel)
- `taqciti/src/shared/config/agpQuestionsStore.ts`, `taqciti/src/shared/hooks/useAgpQuestions.ts`
- `taqciti/src/features/agente/agpTarget.ts`
- `taqciti/src/shared/ui/Badge.tsx`, `Icon.tsx`, `AppShell.tsx`, `TranscriptView.tsx` (só a parte de rolagem)
- `taqciti/src/shared/config/tokens.css`, `glass.css`, `global.css`, `taqciti/src/content/ui/panel.css`, `taqciti/tailwind.config.ts`
- Planos e resumos: `10-UI-SPEC.md`, `10-UAT.md` (teste 7), `10-07-SUMMARY.md`, `10-09-SUMMARY.md`, `10-11-SUMMARY.md`

*Fase: 10-agp-question-panel-in-taqciti — revisão retroativa por código, sem captura de tela.*
