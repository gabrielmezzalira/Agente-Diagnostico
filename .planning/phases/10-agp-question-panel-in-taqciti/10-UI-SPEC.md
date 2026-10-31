---
phase: "10"
slug: "agp-question-panel-in-taqciti"
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-28"
reviewed_at: "2026-10-28"
---

# Fase 10 — Contrato de UI (aba AGP na Taqciti)

> Contrato visual e de interação da aba "AGP" da Taqciti. Gerado pelo gsd-ui-researcher, verificado pelo gsd-ui-checker.
> Aplica-se a `taqciti/` (a extensão), **não** a `frontend/` (o web app do Agente).

## Como ler este documento

A UI **já existe** e está integrada na branch (CONTEXT D-01: o código do Gabriel é adotado como está). Por isso este contrato faz duas coisas:

1. **TRAVA** o que o código já faz e está certo (linguagem visual, estados, textos). Itens marcados `[TRAVADO]` não mudam nesta fase.
2. **ESPECIFICA** o que falta (D-14, D-11). Itens marcados `[MUDANÇA]` são trabalho novo, com o arquivo afetado.

Tudo que é `[TRAVADO]` foi conferido lendo o código em 2026-10-28 (`AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`, `LiveScreen.tsx`, `PanelApp.tsx`, `agpQuestions.ts`, `agpQuestionsStore.ts`, `agpQuestionsFeed.ts`).

Escopo reforçado pelo CONTEXT:

- **D-08:** a aba é **somente de leitura**. Nenhum botão de gerar, fixar, descartar ou marcar como usada (isso é a Fase 10.1).
- **D-09:** **nenhum aviso na tela** sobre a divergência de fixar/descartar entre site e Taqciti (isso fica no UAT e na página de ajuda).
- **D-12:** a pergunta só sai por `question_expired` do backend. **Sem relógio local e sem barra de TTL.**

---

## Design System

| Propriedade | Valor |
|-------------|-------|
| Ferramenta | none (sem shadcn; sistema próprio "Liquid Glass" da Taqciti) |
| Preset | não se aplica |
| Biblioteca de componentes | nenhuma de terceiros. Kit próprio em `taqciti/src/shared/ui/` |
| Biblioteca de ícones | `taqciti/src/shared/ui/Icon.tsx` (SVG próprio, traço fino, herda `currentColor`; 15 nomes, `pause` é preenchido) |
| Estilo | Tailwind 3.4 (`taqciti/tailwind.config.ts`) + tokens em `taqciti/src/shared/config/tokens.css` + vidro em `glass.css`. Nada de cor, raio ou sombra declarado fora desses arquivos |
| Fonte | pilha do sistema: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', sans-serif` |

Dentro do Meet o painel vive num shadow root; os tokens são declarados em `:root, :host` (um arquivo só), então as **três superfícies usam a mesma paleta** (painel do Meet, saída larga e popup). O AGP não pode declarar token próprio.

---

## Component Inventory

Enumerated by `ls src/shared/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` (em `taqciti/`) — 19 components — taqciti-standalone@2.1.2 — 2026-10-28.

Lista não exaustiva de componentes conhecidos e seguros; nunca uma lista fechada. O executor pode usar qualquer outro componente do kit (`AccountBoundaryNotice`, `Avatar`, `Button`, `ConfirmModal`, `EditableTitle`, `Field`, `OptionCard`, `ProgressRail`, `Screen`, `Sheen`, `StatTile`, `Surface`, `Toggle`, `Wave`, `Wordmark`).

| Componente | Caminho de import | Uso no AGP |
|------------|-------------------|------------|
| `Badge` (`tone`: primary, neutral, warning, danger) | `@/shared/ui/Badge` | Emblemas Produto, Dados e Fixada |
| `Icon` | `@/shared/ui/Icon` | Só o ícone `pause` da faixa "pausado" (novo) |
| `AppShell` | `@/shared/ui/AppShell` | Moldura (cabeçalho, corpo que rola, rodapé). O AGP vive **dentro** do corpo; não cria moldura nova |
| `TranscriptView` | `@/shared/ui/TranscriptView` | É o `children` da aba Transcrição. O AGP **não** o altera |
| Classe `.glass-subtle` | `glass.css` | Fundo do cartão de pergunta (sem blur, de propósito: lista que rola) |
| Classe `.scroll-region` | `global.css` / `panel.css` | Região de rolagem (ver M-3) |

---

## Superfícies

A mesma aba (`AgpLiveTabs` + `AgpQuestionsPanel`) aparece em **duas** superfícies ao vivo, sem variação de componente. A transcrição é o `children` de cada uma.

| Superfície | Onde | Tamanho | Onde a aba entra |
|------------|------|---------|------------------|
| **Painel compacto dentro do Meet** | `taqciti/src/content/ui/PanelApp.tsx` (`LiveBody`), shadow root, flutuante | Largura fixa **396 px**. Altura por degrau: `compact` 320, `regular` 564, `tall` 780 | Abaixo do espaço do vínculo (`AgenteLiveSlot`) e do aviso de conta; acima das estatísticas e dos controles |
| **Saída larga** | `taqciti/src/sidepanel/screens/LiveScreen.tsx` (painel lateral do Chrome, ou "Abrir numa aba") | Largura livre (o usuário redimensiona ou é uma aba inteira); altura da janela | Dentro do `AppShell`, no corpo (`px-3 pb-1 pt-2`), entre o cabeçalho e a barra de controles |

Regras comuns `[TRAVADO]`:

- A aba padrão é **Transcrição**. Quem não abre a AGP não vê nada diferente (critério 4 do ROADMAP).
- Só **uma** região rola dentro do corpo: a da aba selecionada. A barra de abas fica fixa (`shrink-0`).
- Nas telas de "preparando a transcrição" (`captionsRequired`) e de fim de reunião, **as abas não existem**. Ao voltar a gravar, o `AgpLiveTabs` é montado de novo e a aba volta para Transcrição (ver A-8).
- A saída larga **não tem** o espaço de vínculo (`AgenteLiveSlot` só existe no painel do Meet). Ver M-5 para o texto de "sem vínculo" nela.

Estimativa de altura útil da lista no painel (a validar no UAT 7, não é medida): no `compact` (320 px) sobra algo em torno de uma fração de cartão depois do cabeçalho, da barra de abas, dos controles e das estatísticas. No `regular` (564 px) cabem cerca de 2 cartões. Ver A-2.

> **Atualizado em 2026-10-31 (G-10-7, decisões do usuário).** A suposição A-2 ("quase nada" no compacto) foi substituída.
> No `compact` (320 px) deve caber **pelo menos um cartão de pergunta de 2 linhas visível**, sem o painel crescer sozinho.
> Isso é obtido compactando as faixas: a faixa de status (Conectando/Reconectando/Pausado) fica na linha das abas (plano
> 10-13); o aviso amarelo de legendas fica dentro da barra de vínculo e não tem mais margem fantasma do aviso de conta vazio
> (plano 10-14); e, **só no compacto**, o campo do nome da reunião some do cabeçalho e a linha de estatísticas ("N falas ·
> N pessoas · N palavras") vai para a linha dos botões de controle (opções (a)+(b) escolhidas pelo usuário, plano 10-17;
> renomear continua nos tamanhos médio e alto). O aviso amarelo de legendas não aparece com a captura pausada (plano 10-15).
> Se a medição no Chrome real (plano 10-16) mostrar que ainda não cabe, a escolha de mais compactação está em aberto no
> `10-UAT.md` (gap G-10-7). O limiar do contrato para cartões de 3 linhas e para os estados do compacto que ficam abaixo de
> ~105 px pela estimativa (estatísticas em 4 linhas, aviso de legendas na barra, barra de alerta de 2 a 3 linhas, aviso de
> conta, aviso de idioma; lista completa no começo do roteiro `reteste_G-10-7`) é **DECISÃO EM ABERTO do time**, registrada
> no gap G-10-7 do `10-UAT.md`.

---

## Linguagem visual do cartão `[TRAVADO]`

```
┌─────────────────────────────────────────┐   glass-subtle, rounded-panel, p-4 (16px) [MUDANÇA M-6: era p-3]
│ [Produto]  [Fixada]                     │   linha de emblemas: gap-2, mb-2 (8px) [M-6: era mb-1.5] (só se houver emblema)
│ Texto da pergunta, quebra de linha ...  │   text-body (12.5px), leading-relaxed, peso 400
└─────────────────────────────────────────┘
        ↕ gap-2 (8px) entre cartões
```

| Regra | Valor |
|-------|-------|
| Ordem dos emblemas | lente primeiro, depois "Fixada" |
| Cartão interativo? | **Não.** Sem hover, sem foco, sem cursor de ponteiro, sem botão. O texto é selecionável (dá para copiar a pergunta) |
| Raio | `rounded-panel` (token `--radius-md`, 20 px) |
| Sombra e blur | nenhum (`.glass-subtle` não desfoca; um blur por item derrubaria a rolagem) |
| Lista | `<ul aria-label="Perguntas do Agente">`, sem marcador, `gap-2` |
| Ordem das perguntas | a ordem em que o backend entregou (`initial_state` e depois `question_new` no fim). **Sem ordenação no cliente** (ver A-3) |
| Limite | o teto de 30 perguntas e de 1000 caracteres por texto vêm de `agpQuestions.ts`. A UI não repete esses limites |

### Emblemas de lente (Produto e Dados) `[TRAVADO]`

Mesmo vocabulário do web app (`frontend/src/components/session/LensBadge.tsx`: Produto = verde, Dados = neutro), para o mesmo público reconhecer. As cores e o formato seguem os tokens da Taqciti (que vencem onde diferem: aqui é pílula de vidro com fio de 1 px, lá é `Chip`).

| `question.lens` | Emblema | `Badge tone` | Aparência |
|-----------------|---------|--------------|-----------|
| `'produto'` | **Produto** | `primary` | véu verde (`bg-primary/14`), texto `text-glow`, fio verde 22% |
| `'dados'` | **Dados** | `neutral` | véu branco 5%, texto `text-muted`, fio branco 8% |
| `null` (modo vendas, sem lente) | nenhum | — | não renderiza emblema nem a linha de emblemas |

- O emblema **sempre** traz o rótulo em texto. A cor sozinha nunca carrega a informação (acessibilidade).
- **Fixada:** `Badge tone="warning"` (âmbar), texto **"Fixada"**, aparece quando `status === 'pinned'`. Como o backend não transmite fixar/descartar (D-09), "Fixada" reflete o que o backend mandou no último `initial_state`; pode estar defasado em relação ao site. Não há aviso na tela sobre isso (D-09).
- O web app mostra também o nome do bloco temático e "pré-mapeada". A Taqciti **não** mostra (ver A-1).

---

## Contador na aba `[TRAVADO]` + ajustes

Hoje: `<span class="ml-1.5 text-micro text-muted">{n}</span>` (M-6 troca `ml-1.5` por `ml-2`, 8 px) dentro do botão da aba AGP, onde `n = feed.questions.length`, só quando `n > 0`. O hook `useAgpQuestions` é montado no `AgpLiveTabs`, então o contador **atualiza mesmo com a aba Transcrição selecionada** (é o objetivo: avisar que chegou pergunta sem trocar de aba).

| Situação do feed | Contador |
|------------------|----------|
| Sem vínculo, `idle`, ou lista vazia | **oculto** (nunca mostrar "0") |
| 1 a 30 perguntas (conectando, ao vivo, reconectando **ou pausado**) | o número, em `text-micro text-muted` |
| Passa de 30 | impossível: o teto da lista é 30. Sem "99+" |

- O número conta **todas** as perguntas na lista (fixadas e na fila). Não é "novas desde a última vez" (ver A-6).
- O contador **não** usa a cor de acento (o verde é reservado, ver Color).
- Ao ir para `paused`, o contador **continua** mostrando o número (as perguntas continuam na tela).
- `[MUDANÇA]` acessibilidade (M-4): o botão da aba AGP ganha `aria-label="AGP, {n} perguntas"` (singular com 1: "AGP, 1 pergunta"; sem `aria-label` quando não há contador). **Não** adicionar texto visível novo: o teste atual exige `tab('AGP').textContent === 'AGP2'`.

---

## Estados da aba AGP

O `AgpQuestionsPanel` recebe um `AgpFeed = { sessionId, connection, questions }`. A decisão de qual estado mostrar é uma **função pura** do feed (sem timer, sem relógio).

`AgpConnection` hoje: `idle | connecting | live | reconnecting`. `[MUDANÇA]` ganha **`paused`** (D-11), ver M-1. Atenção: `CONNECTIONS` em `agpQuestionsStore.ts` precisa incluir `'paused'`; senão `normalizeAgpFeed` o troca em silêncio por `'idle'` e a UI mostraria "A sessão do Agente não está ativa" em vez das perguntas.

| # | Estado | Condição no feed | Faixa de status (fixa no topo) | Corpo | Status |
|---|--------|------------------|--------------------------------|-------|--------|
| 1 | **Sem vínculo** | `sessionId === null` | nenhuma | aviso centralizado, **sem** lista (mesmo que haja perguntas no feed: nunca mostra pergunta de sessão "esquecida") | TRAVADO (+ M-5 na saída larga) |
| 2 | **Sessão não ativa** | `sessionId` ≠ null e `connection === 'idle'` (o backend fechou com 4004) | nenhuma | aviso centralizado, sem lista | TRAVADO |
| 3 | **Conectando** | `connection === 'connecting'` | "Conectando ao Agente…" | lista, ou o aviso de vazio se não houver perguntas | TRAVADO |
| 4 | **Ao vivo, vazio** | `live` e `questions.length === 0` | nenhuma | aviso centralizado "Nenhuma pergunta por enquanto…" | TRAVADO |
| 5 | **Ao vivo, com perguntas** | `live` e `questions.length > 0` | nenhuma | lista de cartões | TRAVADO |
| 6 | **Reconectando** | `connection === 'reconnecting'` (a conexão caiu; o feed tenta de novo com espera crescente) | "Reconectando ao Agente…" | **mantém** a lista que já estava na tela | TRAVADO |
| 7 | **Pausado, mostrando as últimas** | `connection === 'paused'` (D-11) | "Pausado · mostrando as últimas perguntas" com ícone `pause` | **mantém** a lista; se vazia, aviso próprio (ver Copy) | **MUDANÇA (M-1)** |

### O que distingue "Pausado" de "Reconectando" (D-11)

| | Reconectando | Pausado |
|---|--------------|---------|
| Natureza | falha transitória, o feed está tentando sozinho | decisão deliberada do sistema, **não há tentativa em curso** |
| Causa | backend ou rede fora | reunião em pausa (`paused`), legendas desligadas (`captionsRequired`) ou envio ao Agente desligado (`streamingEnabled` falso) |
| Faixa | texto "Reconectando ao Agente…", sem ícone | texto "Pausado · mostrando as últimas perguntas" **com** ícone `pause` (11 px, preenchido, `currentColor`) |
| Perguntas | permanecem | permanecem |
| Sai quando | a conexão volta | a reunião volta a gravar **e** o envio está ligado: o feed reconecta, passa por "Conectando ao Agente…" (mantendo a lista) e o `initial_state` substitui a lista pela verdade do backend |

Mesmas regras de estilo para as duas faixas: `text-caption text-muted`, `role="status"`, uma linha, sem fundo e sem borda (não é alerta; o amarelo `#f2c94c` da faixa de "legendas pararam de chegar" fica reservado para falha de captura). Faixa de "pausado" também recebe `title` (dica ao passar o mouse): "A atualização volta sozinha quando a captura estiver gravando e o envio ao Agente estiver ligado."

### Quando a lista é limpa (e quando NÃO é)

| Evento | Lista |
|--------|-------|
| Pausa, legendas desligadas, envio desligado (D-11) | **mantida** (`paused`) |
| Queda de rede / backend (reconectando) | **mantida** |
| Reunião encerrada, vínculo removido, sessão encerrada, 4004 | **limpa** (volta ao estado 1 ou 2) |
| Troca para outra sessão-alvo | **limpa** e recomeça em "Conectando" |
| `initial_state` (primeira conexão ou reconexão) | **substituída** pela lista do backend (cartões que expiraram no intervalo somem nesse momento; é esperado) |

---

## Espaçamento

Escala do AGP: **4, 8, 16** (subconjunto da escala padrão 4, 8, 16, 24, 32, 48, 64). Todo valor de espaçamento que o AGP declara está nessa escala; **não há exceção** nas classes do próprio AGP (a M-6 leva `mb-1.5`, `ml-1.5`, `p-3` e `px-3` para a grade).

| Token | Valor | Uso no AGP (classe, já considerando a M-6) |
|-------|-------|---------------------------------------------|
| xs | 4 px | `gap-1` entre as abas |
| sm | 8 px | `gap-2` entre cartões e entre emblemas; `mb-2` abaixo da barra de abas; `mb-2` da linha de emblemas até o texto; `ml-2` do rótulo da aba até o contador |
| md | 16 px | `p-4` do cartão; `px-4` da aba; `px-4` do aviso centralizado |
| lg | 24 px | não usado |

Dimensão de controle (não é espaçamento): altura da aba **32 px** (`h-8`), degrau da escala padrão (M-4).

Fora da conta do AGP (classes de outros componentes que apenas envolvem a aba, não são declaradas por este contrato): `px-3 pb-1 pt-2` do corpo da `LiveScreen` e `px-3.5 pb-3.5` do corpo do `PanelApp` (12 e 14 px são o ritmo da moldura do painel, fora do escopo da Fase 10).

---

## Tipografia

O AGP usa **3 dos 5** degraus da escala da Taqciti e **2 pesos**.

| Papel | Tamanho | Peso | Entrelinha | Onde |
|-------|---------|------|------------|------|
| Body (texto da pergunta e avisos) | `text-body` 12.5 px | 400 | 1.625 na pergunta (`leading-relaxed`); 1.55 (padrão do token) nos avisos | texto do cartão; avisos centralizados |
| Label (aba e faixa de status) | `text-caption` 11.5 px | 600 na aba; 400 na faixa | 1.45 | "Transcrição", "AGP", "Conectando…", "Reconectando…", "Pausado…" |
| Micro (emblema e contador) | `text-micro` 10.5 px | 600 | 1.4 (+0.02em) | emblemas Produto/Dados/Fixada; contador da aba |
| Heading | não usado nesta fase | — | — | o AGP não tem título próprio |
| Display | não usado nesta fase | — | — | — |

- Pesos: **400** (texto) e **600** (`font-semibold`: abas, emblemas, contador). Nenhum outro.
- Observação: o texto da pergunta usa `body` (12.5 px), um degrau abaixo da transcrição (`read`, 13.5 px). Foi mantido como está; trocar para `read` é decisão de estilo, fora do escopo (D-01).
- O `text-micro` (10.5 px) é pequeno, mas é o token da Taqciti para emblemas e já é usado em outros emblemas do produto.

---

## Cor

Proporção 60/30/10 nas tokens da Taqciti (`tokens.css`):

| Papel | Valor | Uso no AGP |
|-------|-------|------------|
| Dominante (60%) | `--glass-chrome` (gradiente `rgba(30,37,47,.72)` → `rgba(11,15,20,.82)`) sobre `--c-background` `rgb(8 11 14)` | A moldura/janela atrás da aba e das mensagens |
| Secundária (30%) | `--glass-subtle` `rgba(255,255,255,.045)` + fio `--color-border-soft`; aba selecionada `bg-white/[0.08]` | Cartões de pergunta; fundo da aba selecionada |
| Acento (10%) | `--c-primary` `rgb(92 203 133)` e `--c-glow` `rgb(144 223 173)` | lista abaixo |
| Aviso (âmbar) | `amber-400/12` + `amber-200/90` (mesmo âmbar do estado "pausado" do painel) | Somente o emblema "Fixada" |
| Destrutivo | `--c-danger` `rgb(248 141 141)` | **Não usado nesta fase** (a aba é somente de leitura, não há ação destrutiva) |

Acento reservado **exclusivamente** para:

1. O emblema **Produto** (`Badge tone="primary"`).
2. O rótulo da **aba selecionada** (`text-glow`).
3. O anel de **foco visível** (já global: `outline 2px rgb(var(--c-primary) / .7)`).

O acento **não** vai em: emblema Dados (neutro), contador, faixas de status, texto da pergunta, "Fixada" (âmbar).

Contraste: `text-glow` e `text-amber-200/90` sobre o vidro escuro passam folgado; `text-muted` (`148 163 177`) sobre o vidro fica em torno de 7:1. A diferença Produto x Dados também é dada pelo texto do emblema, não só pela cor.

---

## Contrato de copy (pt-BR)

Público: produto e soluções conduzindo uma call de discovery (não técnico). Os textos abaixo são `[TRAVADO]` (já no código e cobertos por teste) exceto onde marcado `NOVO`.

| Elemento | Copy |
|----------|------|
| Ação primária (CTA) | **Não há.** A aba é somente de leitura (D-08). Os únicos controles são as duas abas |
| Rótulo das abas | "Transcrição" e "AGP" |
| Rótulo da lista (acessibilidade) | "Perguntas do Agente" |
| Estado 1, sem vínculo | "Vincule esta reunião a um cliente para ver aqui as perguntas do Agente." |
| Estado 1 na saída larga (NOVO, M-5) | a frase acima **+** " O vínculo é feito no painel do TaqCITi dentro do Meet." |
| Estado 2, sessão não ativa | "A sessão do Agente não está ativa. Não há perguntas para mostrar." |
| Estado 3, conectando | "Conectando ao Agente…" |
| Estados 4, vazio (também após 3 e 6 sem perguntas) | "Nenhuma pergunta por enquanto. Elas aparecem aqui conforme o Agente gera." |
| Estado 6, reconectando (erro transitório) | "Reconectando ao Agente…" (a recuperação é automática: a faixa some sozinha, sem botão e sem toast) |
| Estado 7, pausado (NOVO) | "Pausado · mostrando as últimas perguntas" (dica: "A atualização volta sozinha quando a captura estiver gravando e o envio ao Agente estiver ligado.") |
| Estado 7 sem nenhuma pergunta (NOVO) | corpo: "Nenhuma pergunta foi recebida antes da pausa." |
| Emblemas | "Produto", "Dados", "Fixada" |
| Confirmação destrutiva | **Não há ação destrutiva nesta fase** |

Notas:

- Os termos "Agente", "cliente", "vínculo" e "envio ao Agente" já existem na Taqciti ("Enviar a transcrição ao vivo para o Agente", "Enviando ao vivo para {cliente}"). Manter o mesmo vocabulário.
- **Não** acrescentar texto sobre a diferença entre fixar/descartar no site e na Taqciti (D-09).
- Os testes atuais usam `toContain` nestas frases; a primeira frase de cada aviso não pode mudar.

---

## Mudanças em relação ao código atual

Cada item é uma correção de lacuna, não reescrita. Arquivos e testes existentes: `AgpQuestionsPanel.test.tsx` e `AgpLiveTabs.test.tsx` exigem `textContent` exato (`'ProdutoPergunta a?'`, `'AGP2'`), então **nenhum texto visível novo pode entrar dentro do `<li>` nem do botão da aba**.

| ID | Mudança | Arquivo(s) | Origem | Prioridade |
|----|---------|-----------|--------|------------|
| **M-1** | Novo valor de conexão `'paused'` e o estado 7 (faixa + corpo vazio). O feed, em vez de limpar tudo quando não há alvo por causa de pausa/legendas/envio desligado, **mantém `sessionId` e `questions`** e publica `paused`. O painel mostra a faixa com ícone `pause`. `CONNECTIONS` inclui `'paused'`. A decisão de "pausa" x "encerrou/sem vínculo" (que continua limpando) é da regra pura de alvo, com teste de tabela por estado | `agpQuestionsStore.ts`, `agpQuestionsFeed.ts` (+ `agpTarget.ts`, `agpQuestionsFeedInstance.ts`), `AgpQuestionsPanel.tsx` | D-11, WR-04 | **Obrigatória** |
| **M-2** | A faixa de status (`role="status"`) sai da região que rola e fica **fixa acima da lista** (`shrink-0`). Hoje ela é filha do contêiner `overflow-y-auto` e some quando a lista rola, escondendo justamente "reconectando" e "pausado" **Posição atualizada em 2026-10-31: a faixa fica na linha das abas (10-13).** | `AgpQuestionsPanel.tsx` | D-14 (estados visíveis) | **Obrigatória** |
| **M-3** | Região de rolagem da lista: trocar `overflow-y-auto` por `scroll-region` com `tabIndex={0}` e `outline-none` (mesmo padrão de `HistoryList`): sem "vazar" a rolagem para a página do Meet e rolável pelo teclado. Texto da pergunta ganha `break-words` (um trecho sem espaço, como uma URL, não pode estourar os 396 px nem criar rolagem horizontal). A linha de emblemas só é renderizada quando há emblema (hoje, com `lens: null` e não fixada, sobra um `mb-1.5` (6 px) vazio). Cartões entram com `animate-fade-in motion-reduce:animate-none` (só opacidade, como na transcrição) | `AgpQuestionsPanel.tsx` | D-14 (painel compacto no Meet) | Recomendada |
| **M-4** | Aba: altura 32 px (`h-8`); `aria-label` do contador (ver acima); o corpo da aba selecionada ganha `role="tabpanel"` com `aria-labelledby` apontando para a aba (e as abas `id` + `aria-controls`); setas esquerda/direita movem entre as duas abas, com `tabIndex` móvel (padrão WAI-ARIA de abas, já que as abas usam `role="tab"`) | `AgpLiveTabs.tsx` | acessibilidade | Recomendada |
| **M-5** | Na **saída larga**, o aviso de "sem vínculo" ganha a segunda frase (ver Copy), porque `LiveScreen` não tem o espaço de vínculo e o aviso atual não diz onde vincular. A primeira frase fica idêntica. Mecanismo (prop `surface` ou texto opcional) fica a critério do plano, com `AgenteEndSlot` (`surface="panel"`) como precedente | `AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`, `LiveScreen.tsx` | D-14 (tela larga) | Baixa |
| **M-6** | Leva as classes de espaçamento **do próprio AGP** para a grade 4/8/16, para que o contrato não tenha exceção: `mb-1.5` (6 px) vira `mb-2` (8 px) na linha de emblemas; `ml-1.5` (6 px) vira `ml-2` (8 px) no contador da aba; `p-3` (12 px) vira `p-4` (16 px) no cartão; `px-3` (12 px) vira `px-4` (16 px) na aba (a aba também perde o `py-1` e ganha `h-8`, ver M-4). Mecânico, sem mudar texto nem comportamento. Motivo (por que não é reescrita sem motivo, D-01): o contrato de espaçamento da fase exige valores na escala padrão. Custo: cada cartão fica cerca de 10 px mais alto (4 px de padding em cima e embaixo, mais 2 px na linha de emblemas), o que pesa só no degrau `compact`, que já é limitado (A-2). Conferido: nenhum teste (`AgpQuestionsPanel.test.tsx`, `AgpLiveTabs.test.tsx`) assere nome de classe, só `textContent` e atributos `role`/`aria-*`. Commit próprio, separado das mudanças de comportamento (regra do CLAUDE.md) | `AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx` | Dimensão 5 do checker | Obrigatória |

Fora do escopo desta fase (não projetar): botões de gerar, fixar, descartar ou usar (Fase 10.1); barra de TTL; qualquer relógio local; aviso de divergência site x Taqciti; rótulo de bloco temático.

---

## UI Considerations

> Gerada pela sondagem de estados do `/gsd-ui-phase` (passo 9.5) em 2026-10-28, depois da aprovação do checker, e
> confirmada pelo usuário. Elementos: E1 lista de perguntas (`list-collection`), E2 cartão de pergunta
> (`static-content`), E3 barra de abas + contador (`nav`, `interactive-control`), E4 faixa de status
> (`static-content`), E5 aviso centralizado (`static-content`), E6 emblemas (`static-content`). Os textos de vazio e
> erro estão no **Contrato de copy** e não são repetidos aqui. As duas últimas linhas são do eixo aberto
> (acessibilidade e comportamento), fora da taxonomia fechada, e foram decididas pelo usuário.

Applicable state considerations resolved: 11 covered, 2 backstop, 0 unresolved (6 dismissed com motivo; +2 decisões do eixo aberto)

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | E1 lista de perguntas | ✅ covered | Ao vivo e sem perguntas, o corpo mostra o aviso do estado 4; sem vínculo (estado 1) e sessão não ativa (estado 2) mostram só o aviso, nunca a lista; pausado e vazio mostra o aviso do estado 7 sem perguntas (ver Contrato de copy) |
| loading | E1 lista de perguntas | ✅ covered | Com `connection === 'connecting'`, a faixa fixa acima da lista mostra "Conectando ao Agente…" e a lista já recebida continua visível (estado 3) |
| error | E1 lista de perguntas | ✅ covered | Com `reconnecting`, a lista é mantida e a faixa mostra "Reconectando ao Agente…" (estado 6); com 4004, o feed vai a `idle`, a lista é limpa e o corpo mostra o aviso de sessão não ativa (estado 2) |
| populated | E1 lista de perguntas | ✅ covered | Cada pergunta vira um cartão `glass-subtle` com a linha de emblemas (lente, depois "Fixada") e o texto em `text-body`, na ordem em que o backend entregou |
| partial | E1 lista de perguntas | ✅ covered | Com `paused` (D-11), a lista é mantida e a faixa mostra "Pausado · mostrando as últimas perguntas" com ícone `pause` (estado 7, M-1); pergunta com `lens: null` não renderiza emblema nem a linha de emblemas |
| overflow | E1 lista de perguntas | 🧪 backstop | Teste visual no Chrome real, painel do Meet no degrau `compact` (320 px) e `regular`: a lista rola dentro de `scroll-region` e a faixa de status continua visível acima dela (M-2, M-3; UAT 7) |
| zero-one-many | E1 lista de perguntas | ✅ covered | Com 0 perguntas o contador da aba fica oculto (nunca "0"); de 1 a 30 mostra o número; `aria-label` "AGP, 1 pergunta" no singular e "AGP, {n} perguntas" no plural (M-4) |
| overflow | E2 cartão de pergunta | ✅ covered | O cartão cresce na altura conforme o texto (até 1000 caracteres), sem corte nem reticências; o texto tem `break-words` (M-3) |
| long-text | E2 cartão de pergunta | 🧪 backstop | Teste visual: uma pergunta com um trecho longo sem espaços (ex.: URL) quebra dentro do cartão e não cria rolagem horizontal nos 396 px do painel do Meet |
| loading | E3 barra de abas + contador | ⛔ dismissed | As abas são renderizadas junto com a tela ao vivo e não carregam nada; o estado de conexão do feed aparece na faixa de status (E4) |
| error | E3 barra de abas + contador | ⛔ dismissed | As abas não fazem requisição e não falham; erros do feed aparecem na faixa de status (E4) e no corpo (estado 2) |
| overflow | E3 barra de abas + contador | ⛔ dismissed | São dois rótulos fixos e curtos ("Transcrição", "AGP") mais um contador de no máximo 2 dígitos (teto 30); cabem nos 396 px |
| long-text | E3 barra de abas + contador | ⛔ dismissed | Os rótulos são textos fixos do produto, não vêm de dados |
| overflow | E4 faixa de status | ✅ covered | A faixa é texto fixo de uma linha (`text-caption`); se faltar largura, quebra linha em vez de cortar com reticências, e continua fixa acima da lista (M-2) |
| long-text | E4 faixa de status | ✅ covered | Os três textos da faixa são fixos (ver Contrato de copy) e cabem numa linha nos 396 px; nenhum vem de dados |
| overflow | E5 aviso centralizado | ✅ covered | O aviso é texto centralizado com `px-4` que quebra linha conforme a largura, sem corte |
| long-text | E5 aviso centralizado | ✅ covered | Os avisos são textos fixos (ver Contrato de copy); na saída larga, o aviso de sem vínculo ganha a segunda frase (M-5) e quebra linha normalmente |
| overflow | E6 emblemas | ⛔ dismissed | Os rótulos são fixos e curtos ("Produto", "Dados", "Fixada"); no máximo dois emblemas por cartão |
| long-text | E6 emblemas | ⛔ dismissed | Os rótulos são textos fixos do produto, não vêm de dados |
| accessibility (eixo aberto) | E1 lista de perguntas | ✅ covered | Decidido pelo usuário: a lista **não** é `aria-live`; pergunta nova não é anunciada pelo leitor de tela (seria ruído durante a call); o contador da aba e o `aria-label` dele (M-4) são o aviso |
| behavior (eixo aberto) | E2 cartão de pergunta | ✅ covered | Decidido pelo usuário: ao receber `question_expired`, o cartão sai da lista de imediato, sem animação de saída, sem barra de TTL e sem relógio local (D-12; fecha a A-4) |

---

## Registry Safety

| Registry | Blocos usados | Safety Gate |
|----------|---------------|-------------|
| shadcn official | nenhum (a Taqciti não usa shadcn) | não se aplica |
| terceiros | nenhum | não se aplica; nenhum bloco de registro externo entra nesta fase |

---

## Perguntas em aberto / suposições (para o orquestrador levantar com o time)

Nenhuma bloqueia o plano. Cada uma foi resolvida pela escolha mais conservadora, coerente com o código existente.

| ID | Suposição adotada | O que o time pode querer decidir |
|----|-------------------|----------------------------------|
| **A-1** | A Taqciti **não** mostra o nome do bloco temático (o web app mostra, ex.: "Gargalo"). O campo `block` já chega e fica guardado, mas não há mapa de rótulos na Taqciti; copiar `BLOCK_LABELS` do `frontend/` duplicaria uma tabela de 26 entradas | Mostrar o bloco na 10.1 (ou antes), com um mapa único compartilhado |
| **A-2** | **Sem redimensionamento automático.** Em `compact` (320 px) a lista tem quase nenhum espaço; o usuário usa `regular` ou `tall`. O seletor de cliente já sobe `compact` para `regular` sozinho (precedente em `AgenteLiveSlot`) **Substituído em 2026-10-31: ver nota em Superfícies.** | Fazer o mesmo ao abrir a aba AGP no `compact` (muda comportamento do painel, exigiria passar `panelSize` ao `AgpLiveTabs`) |
| **A-3** | Ordem = ordem de chegada; pergunta nova entra **no fim** e, com a lista rolando, pode ficar fora da vista. O contador avisa quando a aba não está aberta, mas não há rolagem automática | Mostrar a mais nova primeiro, ou rolar até ela. Verificar no UAT 2 se a pergunta nova aparece sem precisar rolar |
| **A-4** | Pergunta some de repente no `question_expired` (sem barra de TTL, por D-12: dependeria de relógio local, que esconderia pergunta num relógio adiantado). Pelo D-09 (texto corrigido em 2026-10-28), pergunta fixada **ou** descartada **no site** continua aqui até a Taqciti reconectar (o backend não emite `question_expired` para ela; Armadilha 7 da pesquisa) | **Decidido em 2026-10-28 (usuário): aceitar o sumiço imediato.** Transmitir prazo e status pelo backend fica para a Fase 10.1 |
| **A-5** | Um único aviso "Pausado" cobre as três causas (reunião em pausa, legendas desligadas, envio desligado). A causa exata não é dita; a dica fala das duas condições | Texto por causa exigiria um campo `reason` no feed |
| **A-6** | O contador mostra o total da lista, não "novas desde a última vez" | Contador de não vistas (estado a mais, comportamento novo) |
| **A-7** | Sem largura máxima na saída larga (a transcrição também não tem). Aberta numa aba inteira, os cartões esticam | Limitar a largura de leitura (ex.: 640 px) |
| **A-8** | A seleção da aba (Transcrição ou AGP) é estado local e volta para Transcrição quando a tela é remontada (ex.: `captionsRequired` → `recording`) | Persistir a aba escolhida nas preferências do painel |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS (FLAG não bloqueante: o aviso do estado 2 não sugere o próximo passo)
- [x] Dimension 2 Visuals: PASS (FLAG não bloqueante: ponto focal não declarado; natural é emblema + texto do cartão, e a faixa de status quando presente)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS (FLAG não bloqueante: degraus de 1 px vindos dos tokens; 10.5 px é o mínimo e não deve diminuir)
- [x] Dimension 5 Spacing: PASS (após a revisão 1: escala 4/8/16 via M-6)
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-10-28 (gsd-ui-checker, 1 revisão)
