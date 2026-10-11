---
phase: "08"
slug: taqciti-session-association
status: draft
shadcn_initialized: false
preset: none
created: "2026-10-11"
---

# Phase 08 — UI Design Contract

> Contrato visual e de interação da Fase 8 (Taqciti Session Association). Gerado pelo gsd-ui-researcher, verificado pelo gsd-ui-checker.
>
> **Onde esta UI mora:** na extensão Taqciti (`taqciti/`), não no `frontend/` do web app. Cobre o painel injetado no Meet (shadow DOM, 396px de largura) e a saída larga (aba / painel lateral do Chrome). O web app do Agente **não muda** nesta fase (08-CONTEXT D-16).
>
> **Regra de ouro desta fase:** nenhuma cor, raio, sombra ou escala nova. Tudo é montado com o kit "Liquid Glass" que já existe em `taqciti/src/shared/ui/` e com os tokens de `taqciti/src/shared/config/tokens.css`. Os únicos acréscimos permitidos estão em "Novos componentes e acréscimos ao kit".

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (sistema próprio "Liquid Glass" da Taqciti; shadcn não se aplica) |
| Preset | not applicable |
| Component library | none — kit próprio em `taqciti/src/shared/ui/` (React 18 + Tailwind 3.4, sem Radix/Base UI) |
| Icon library | kit próprio `taqciti/src/shared/ui/Icon.tsx` (SVG, traço 1.8, herda `currentColor`) |
| Font | pilha de sistema: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", sans-serif` |

**Por que `Tool: none`:** `components.json` não existe em `taqciti/` nem em `frontend/`, e a Taqciti já tem um sistema de design completo e deliberado (tokens em um arquivo só, kit de 20 componentes, receita de vidro em `glass.css`). Iniciar shadcn aqui criaria um segundo sistema competindo com o primeiro, o que o próprio `tokens.css` proíbe ("NÃO declare token de cor, raio, blur ou sombra em nenhum outro lugar"). O gate do shadcn foi avaliado e dispensado com essa justificativa; o orquestrador pode confirmar com o usuário (ver "Decisões a confirmar").

**Duas superfícies, um contrato:**

| Superfície | Onde | Largura | Raiz de estilo | Observação |
|------------|------|---------|----------------|------------|
| Painel no Meet | `taqciti/src/content/ui/PanelApp.tsx` | 396px fixos; alturas 320 / 564 / 780px | shadow root (`panel.css`, tokens em `:host`) | Nenhum portal para `document.body`; tudo renderiza dentro do shadow root. |
| Saída larga | `taqciti/src/sidepanel/` (`HomeScreen`, `RecordDetail`, `AgenteConfigScreen`) | fluida (aba) / ~360px (painel lateral do Chrome) | documento (`global.css`, tokens em `:root`) | Usa `AppShell` (cabeçalho de vidro fixo, uma única região que rola). |

---

## Component Inventory

Enumerated by `grep -hE "^export (function|const) [A-Z][a-z]" taqciti/src/shared/ui/*.tsx` — 20 components — taqciti-standalone@2.1.2 (resolvido de `taqciti/package.json`) — 2026-10-11.

Lista **não exaustiva** de componentes conhecidos e aprovados — nunca uma lista fechada. O executor pode usar qualquer coisa que o kit exporte; conferir um componente fora da tabela é o caminho esperado.

Todos os caminhos usam o alias `@/` (= `taqciti/src/`).

| Component | Import path | Uso nesta fase |
|-----------|-------------|----------------|
| Button (`primary`/`secondary`/`ghost`/`danger`, `default`/`compact`) | `@/shared/ui/Button` | Todas as ações. Um único `primary` por tela visível. `danger` só em "Descartar". |
| OptionCard (`role="single"`) | `@/shared/ui/OptionCard` | Linha de cliente na lista (rótulo = cliente, dica = projeto). |
| SearchField / TextField | `@/shared/ui/Field` | Busca de cliente, nome do cliente novo, ID manual. **Obrigatórios**: seguram o teclado para o Meet não tratar cada letra como atalho. |
| Badge (`primary`/`neutral`/`warning`/`danger`) | `@/shared/ui/Badge` | Selo de associação no histórico ("Sem cliente", "Enviada", "Envio parou"). |
| ConfirmModal | `@/shared/ui/ConfirmModal` | Confirmação de "Descartar" (D-11). |
| ProgressRail | `@/shared/ui/ProgressRail` | Progresso do envio em partes (sem `onBack`). |
| Surface (`card`/`item`/`inset`) | `@/shared/ui/Surface` | Cartão da decisão, barra de vínculo. |
| AppShell | `@/shared/ui/AppShell` | Moldura do picker na saída larga. |
| Icon | `@/shared/ui/Icon` | `plus`, `search`, `chevron`, `check`, `close`, `arrowDown`, `trash` (+ `alert`, novo). |
| Toggle | `@/shared/ui/Toggle` | Já usado em `AgenteConfigScreen`; continua como chave-mestra. |
| Wave | `@/shared/ui/Wave` | Estado vazio / cápsula. |
| Sheen, `SHEEN_HOST` | `@/shared/ui/Sheen` | Reflexo verde em controles clicáveis novos. |

---

## Spacing Scale

Valores declarados (múltiplos de 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Folga entre ícone e rótulo, deslocamento do bounce do ícone "!" |
| sm | 8px | Espaço entre linhas de lista (`space-y-2`), entre botões lado a lado (`gap-2`) |
| md | 16px | Padding interno de cartões (`p-4`), espaço entre blocos de um formulário |
| lg | 24px | Respiro de estados vazios, entre seções da tela |
| xl | 32px | Altura mínima do alvo do ícone "!" |
| 2xl | 48px | (não usado nesta fase) |
| 3xl | 64px | (não usado nesta fase) |

Valores intermediários também usados, todos múltiplos de 4: 12px (`px-3`/`gap-3`) para a barra de vínculo e entre campo e rótulo.

Exceções (todas herdadas do kit/painel, nenhuma nova):

- Gutter do corpo do painel = **14px** (`px-3.5`, definido em `PanelApp`); o conteúdo novo herda, não redefine.
- Folgas de 6px / 10px dos botões e controles do kit (`gap-1.5`, `gap-2.5`).
- Alturas de alvo de toque: `Button` default = **44px** (ação principal de cada tela); `Button compact` = **34px** (ações auxiliares); o ícone "!" tem alvo de **32px** (visual de 20px), no mesmo nível dos controles de cabeçalho do painel (28px). É uma ferramenta de desktop com mouse, e o 44px vale para as ações principais.
- Itens de lista (OptionCard) têm a altura que o kit entrega (conteúdo + padding próprio do componente); esta fase não fixa nem redefine essa altura.

---

## Typography

Os 4 degraus abaixo vêm da escala de 5 degraus que **já existe** em `tailwind.config.ts` (`fontSize`). A fase **não cria tamanho novo**. Pesos: apenas **400** (regular) e **600** (semibold), os dois que o kit usa.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (`text-read`) | 13.5px | 400 | 1.6 |
| Label (`text-caption`) | 11.5px | 600 (rótulos em caixa-alta com `tracking-wide`) / 400 (texto de apoio) | 1.45 |
| Heading (`text-title`) | 15px | 600 | 1.35 |
| Micro (`text-micro`) | 10.5px | 600 | 1.4 |

- Body: texto de cartões, linhas de lista, campos de texto. Label: rótulos de seção ("Clientes", "ID da sessão do Agente"), texto de apoio, barra de vínculo, toasts. Heading: título do cartão de decisão, título do picker, título do fim da reunião. Micro: **só** dentro de `Badge` e de metas de `OptionCard`.
- Entrelinha segue o kit (corpo 1.6 em vez de 1.5 do padrão GSD; já embutido nos tokens de fonte, não sobrescrever).
- Não há tamanho "Display" nesta fase (a marca é a imagem `Wordmark`).
- Exceções herdadas, não introduzidas por esta fase: os tamanhos internos de `Button` (`text-sm` 14px no default, `text-xs` 12px no compact) e o título de `ConfirmModal` (`text-sm` 14px, 600). Não replicar esses tamanhos em componente novo.
- Números que mudam ao vivo (contagem de falas na fila, "3 de 12") usam `tabular-nums`.

---

## Color

Tema único escuro. Os valores vêm de `tokens.css`; não declarar cor nova.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#080B0E` (`--c-background`) com os halos de aurora do `body` | Fundo da saída larga e o que o vidro do painel filtra |
| Secondary (30%) | `#10141A` surface / `#161B23` elevated + camadas de vidro (`.glass`, `.glass-raised`, `.glass-subtle`, `.glass-sunken`) | Moldura do painel, cartão de decisão, linhas de lista, barra de vínculo, campos |
| Accent (10%) | `#5CCB85` (`--c-primary`), brilho `#90DFAD` (`--c-glow`), texto sobre o verde `#0C3120` | Ver lista abaixo |
| Destructive | `#F88D8D` (`--c-danger`) | "Descartar" e a confirmação de descarte; e a mensagem de erro de uma ação do usuário que falhou sem perder dado (ex.: falha ao criar cliente, `text-danger` abaixo do campo). A falha no meio do envio em partes **não** usa danger: é warning (nada foi perdido, a transcrição segue guardada). |
| Warning (cor semântica já existente) | `#F2C94C` (borda/fundo a 25%/10%), texto `#F7DD8F` | Ícone "!" de reunião pendente; aviso de "Agente fora do ar"; selo "Sem cliente" e "Envio parou". É o mesmo literal que `PanelApp` já usa nos avisos de legenda e de captura. **Não** criar token novo nesta fase. |

Texto: `#F4F7FA` (`--c-text`), apoio `#94A3B1` (`--c-muted`).

**Accent reservado exclusivamente para:**

1. O botão `primary` único de cada tela ("Selecionar cliente agora", "Vincular reunião", "Enviar reunião", "Criar e vincular");
2. A linha de cliente **selecionada** na lista (fundo `bg-primary/12` + fio de 1px, o estado `selected` do `OptionCard`);
3. O ponto e o texto de "Enviando ao vivo para {cliente}" na barra de vínculo, enquanto tudo está saudável (`text-glow`);
4. Os selos "Enviada" e "Enviando" (`Badge tone="primary"`);
5. O anel de foco (`outline-primary/70`) e o fio interno de foco dos campos;
6. A parte preenchida do trilho do `ProgressRail` (envio do que já foi falado e envio em partes);
7. O `Icon check` de sucesso ("Reunião enviada para {cliente}.") e o `Icon check` da linha de cliente selecionada.

**Nunca em accent:** o ícone "!" (é warning), o aviso de Agente offline (warning), linhas de lista em repouso, o botão "Depois", o botão "Descartar" (é danger).

Hierarquia do aviso: warning = "precisa de atenção, nada foi perdido" (reunião sem cliente, Agente fora do ar com fila preservada). Danger = "ação destrutiva ou dado em risco".

---

## Copywriting Contract

Todo texto da UI em português (pt-BR), tom direto, sem jargão. "Taqciti" e "Agente" como nomes próprios. Placeholders e textos de apoio reaproveitam o padrão de `AgenteConfigScreen.tsx`.

### Aviso e decisão (D-07, D-06)

| Element | Copy |
|---------|------|
| Nome acessível do ícone "!" | `Reunião detectada. Escolher o cliente no Agente.` (`aria-label` e `title`) |
| Título do cartão de decisão | `Esta reunião é de qual cliente?` |
| Corpo do cartão | `Enquanto você não escolher, a Taqciti só guarda a transcrição neste navegador. Nada vai para o Agente.` |
| Primary CTA | `Selecionar cliente agora` |
| Ação secundária | `Depois` |
| Fechar (×) | `Fechar aviso` (`aria-label`; equivale a "Depois", D-06) |

### Picker de clientes (D-08)

| Element | Copy |
|---------|------|
| Título | `Escolher cliente` |
| Subtítulo, reunião ao vivo | `Tudo o que já foi falado vai junto para a sessão deste cliente.` |
| Subtítulo, reunião encerrada | `A transcrição guardada será enviada para a sessão deste cliente.` |
| Placeholder da busca | `Buscar cliente` |
| Contador | `1 cliente` / `{N} clientes`; com busca: `Resultados · {N}` |
| Linha de cliente | rótulo = nome do cliente; dica = nome do projeto (omitida se for igual ao cliente) |
| Ação de criar | `Criar cliente novo` |
| Primary CTA, ao vivo | `Vincular reunião` |
| Primary CTA, encerrada | `Enviar reunião` |
| Voltar | `Voltar` (equivale a "Depois" quando a reunião está ao vivo) |

### Criar cliente (D-08, D-14)

| Element | Copy |
|---------|------|
| Rótulo do campo | `Nome do cliente` |
| Placeholder | `Ex.: Empresa XYZ` |
| Apoio | `Só o nome basta. Tipo de projeto, maturidade e contexto você completa depois no Agente.` |
| Primary CTA, ao vivo | `Criar e vincular` |
| Primary CTA, encerrada | `Criar e enviar` |
| Ação secundária (`ghost`) | `Voltar à lista` (volta à lista de clientes sem criar nada; o texto digitado é descartado) |
| Em andamento | `Criando…` |
| Nome duplicado | `Já existe um cliente com esse nome. Selecione-o na lista.` |
| Erro | `Não foi possível criar o cliente. Confira a conexão e tente de novo.` |

### Estados da lista

| Element | Copy |
|---------|------|
| Empty state heading (nenhum cliente existe) | `Nenhum cliente cadastrado ainda.` |
| Empty state body | `Crie o primeiro para vincular esta reunião.` (CTA: `Criar cliente novo`) |
| Empty state da busca | `Nenhum cliente com “{busca}”.` (ação: `Criar cliente “{busca}”`, preenche o campo) |
| Carregando | `Carregando clientes…` (`aria-live="polite"`) |
| Error state (lista não carrega) | `Não consegui carregar os clientes. Confira a conexão e tente de novo — ou cole abaixo o ID de uma sessão que já existe.` |
| Ação do erro | `Tentar de novo` |
| Plano B, rótulo | `ID da sessão do Agente` |
| Plano B, placeholder | `cole aqui o ID (UUID) da sessão ativa` |
| Plano B, CTA | `Vincular com este ID` |
| Erro ao criar a sessão | `Não foi possível criar a sessão no Agente. A reunião continua guardada só aqui. Tente de novo.` |

### Barra de vínculo no painel (ao vivo)

| Element | Copy |
|---------|------|
| Adiada ("Depois") | `Sem cliente. A transcrição fica só aqui.` + ação `Selecionar cliente` |
| Enviando o que já foi falado (D-12) | `Enviando o que já foi falado… {x} de {y}` |
| Vinculada e saudável | `Enviando ao vivo para {cliente}` |
| Agente fora do ar (D-18) | `O Agente está fora do ar. Guardando as falas aqui e reenviando quando ele voltar.` + contador `{n} fala na fila` / `{n} falas na fila` |
| Agente voltou (toast, 2,2 s) | `Agente de volta. Falas reenviadas.` |
| Chave recusada (401/403) | reaproveita `rejectionText` de `agenteStatus.ts`, sem alterar |

### Fim da reunião e envio em partes (D-09, D-10)

| Element | Copy |
|---------|------|
| Título do cartão de fim | `Enviar esta reunião ao Agente?` |
| Corpo | `Ela está guardada só na Taqciti. Escolha o cliente ou descarte.` |
| Primary CTA | `Selecionar cliente` |
| Ação destrutiva | `Descartar` |
| Botão no painel / histórico (D-09) | `Enviar ao Agente` |
| Progresso | `Enviando para {cliente}…` + trilho `{x} de {y}` |
| Sucesso | `Reunião enviada para {cliente}.` |
| Falha no meio | `O envio parou na parte {x} de {y}. O que já chegou continua no Agente.` |
| Ação da falha | `Continuar envio` (**bloqueada** por Decisão do time 3, ver abaixo) |
| Apoio enquanto `Continuar envio` está bloqueado | `A transcrição continua guardada na Taqciti. Você pode copiá-la ou baixá-la enquanto isso.` |

### Selos no histórico

`Sem cliente` (warning) · `Enviando` (primary, com ponto) · `Enviada` (primary) · `Envio parou` (warning).

### Destrutivos

| Ação | Confirmação |
|------|-------------|
| Descartar (reunião nunca enviada) | Título `Descartar esta reunião?`. Corpo: `“{título}” será removida do histórico da Taqciti, com a transcrição. Nada foi enviado ao Agente, então não há como recuperar.` Confirmar: `Descartar` (`danger`). Recusar: `Manter reunião` (`ghost`, fecha o modal e preserva a reunião e a transcrição). |
| Apagar (já existente, reunião já enviada) | Mantém `Apagar do histórico?` e **acrescenta** ao corpo: `A cópia que já foi enviada ao Agente continua lá.` (D-11: nada é apagado no backend; sem essa frase a pessoa pode achar que apagou dos dois lados.) Recusar: `Manter no histórico` (mesmo mecanismo de override abaixo). |

**Override do rótulo de recusa do `ConfirmModal`:** o kit hoje fixa o texto `Cancelar` no `ConfirmModal` (`taqciti/src/shared/ui/ConfirmModal.tsx`, linha 60). Este contrato acrescenta uma prop opcional `cancelLabel?: string` ao `ConfirmModal`, com padrão `'Cancelar'` para não alterar chamadores existentes; todo uso desta fase **deve** passar `cancelLabel` explícito (`Manter reunião` / `Manter no histórico`). O `Esc` e o clique no fundo continuam chamando `onCancel`, sem mudança de comportamento.

### Tela "Agente Diagnóstico" (`AgenteConfigScreen`)

| Element | Copy |
|---------|------|
| Apoio no lugar do campo de ID (lista carregou) | `A associação é feita a cada reunião, pelo ícone “!” no painel do Meet.` |
| Campo de ID (plano B) | só aparece se a lista de clientes falhar ao carregar; mantém o rótulo, placeholder e apoio atuais |

---

## Screens and Interaction Contract

### Estados do vínculo (nomes de UI; o armazenamento é decisão do planejamento)

```
pending  --abrir cartão-->  choosing
pending  --reunião termina sem escolha-->  ended-unsent
choosing --"Depois" / × / Esc / minimizar painel-->  deferred
choosing --escolher cliente (ou ID manual)-->  linking
deferred --"Selecionar cliente"-->  choosing
deferred --reunião termina-->  ended-unsent
linking  --sessão criada + resumo enviado-->  linked   (sub-estado: offline)
linking  --falha ao criar-->  deferred  (com erro visível)
ended-unsent --"Selecionar cliente"--> sending --> sent | send-failed
ended-unsent --"Descartar" + confirmar--> discarded (some do histórico local)
```

### 1. Ícone "!" (aviso de reunião detectada) — D-07

- **Quando aparece:** reunião detectada (fase `captionsRequired`/`recording`/`paused`) **e** o envio ao Agente está ligado (chave-mestra do `AgenteConfigScreen`) **e** nada foi escolhido ainda. Ver "Decisões a confirmar" (a).
- **Onde (decisão desta fase, resposta ao "fica para a fase de UI" do D-07):** **dentro da página do Meet, preso ao próprio painel da Taqciti**, e não na barra do Chrome.
  - Painel minimizado: bolha no canto superior direito da **cápsula** (deslocada 4px para fora).
  - Painel aberto: a mesma bolha no **cabeçalho**, à esquerda do chip de status.
  - É um componente só (`AgenteNudge`) com duas ancoragens.
  - **Por que não na barra do Chrome:** o selo de `chrome.action` é texto estático (não anima), fica fora da área do Meet onde a pessoa está olhando, e a cápsula já é o ponto de reentrada garantido (uma reunião começando desfaz o "fechado" e traz pelo menos a cápsula, ver `PanelApp`).
- **Aparência:** círculo de 20px, fundo `#F2C94C`, glifo "!" (`Icon name="alert"`, 12px, 600) em `text-background`, sem sombra dura. Alvo de clique de 32px.
- **Movimento (D-07):** sobe e desce levemente a cada 5 s. Keyframe novo `nudge`, **somente `transform: translateY`**, nunca opacidade (a lição do `dock-in`: animação que começa em opacidade 0 pode deixar o elemento invisível quando o quadro de animação não roda). Curva: 0 → -4px → 0 → -2px → 0 dentro dos primeiros ~20% de um ciclo de 5 s, repouso no resto. `ease-flow`, `infinite`.
- **Movimento reduzido:** a regra global de `prefers-reduced-motion` (`global.css` / `panel.css`) já neutraliza a animação; a bolha continua visível e estática. Nada a acrescentar.
- **Para de pular quando:** o cartão de decisão é aberto, ou o estado deixa de ser `pending`.
- **Clique:**
  - Na bolha do cabeçalho: abre o cartão de decisão.
  - Na cápsula (inclusive na bolha): abre o painel, e o painel abre **já com o cartão de decisão visível**. Isso unifica os dois caminhos e evita depender de o clique na bolha atravessar a captura de ponteiro do arraste da cápsula (`useFloating`).
- **Sem som, sem notificação do sistema, sem foco roubado.** Nunca interrompe a reunião.

### 2. Cartão de decisão — D-06, D-07

- Aparece no topo do corpo do painel, acima da transcrição ao vivo (mesma posição dos avisos `LanguageWarningBanner`/captura). Não é modal; a transcrição continua rolando por baixo.
- Visual: `Surface level="card"` (`glass-raised rounded-panel`), `p-4`, título `text-title`, corpo `text-read text-muted`, botão × de 28px no canto superior direito.
- Botões em uma linha, `gap-2`: `Selecionar cliente agora` (`primary`, `flex-1`) e `Depois` (`ghost`, `shrink-0`).
- **Fechar sem escolher = "Depois"** (D-06): vale para ×, `Esc` com o foco no cartão, e **minimizar ou fechar o painel enquanto o cartão está aberto**. `Esc` fecha o cartão antes de minimizar o painel (o `Esc` global do painel recolhe a janela; dentro do cartão ele deve parar a propagação).
- "Selecionar cliente agora" leva ao picker.

### 3. Picker de clientes — D-08 (tela nova)

Componente apresentacional `ClientPicker`: recebe a lista, o estado (`loading` | `ready` | `error`) e callbacks. **Não busca dado** (CLAUDE.md: componentes sem chamada de API). A origem dos clientes fica atrás da interface `ClientDirectory` (inversão de dependência, 08-CONTEXT Claude's Discretion), para o AGM poder trocar a fonte sem mexer na tela.

**Estrutura (de cima para baixo):**

1. Cabeçalho da tela: botão `ghost compact` `Voltar` (chevron rotacionado), título `Escolher cliente` (`text-title`), subtítulo conforme `live`/`ended`.
2. `SearchField` (`Buscar cliente`), com foco automático. Filtro local, **insensível a maiúsculas e a acentos** (pt-BR: "açaí" casa com "acai").
3. Linha de ação `Criar cliente novo` (`secondary compact`, `Icon plus`) fixa acima da lista.
4. Lista `ul` com `scroll-region`, `space-y-2`, `aria-label="Clientes"`, `tabIndex={0}`. Cada item é um `OptionCard role="single"`: rótulo = cliente, dica = projeto. Ordem alfabética pelo cliente.
5. Rodapé fixo (faixa `glass` fina): botão `primary` com o CTA do modo (`Vincular reunião` | `Enviar reunião`), **desabilitado até haver uma linha selecionada**.

**Interação:**

- **Dois passos, de propósito.** Clicar numa linha só a *seleciona* (estado `selected` verde). Quem cria sessão e envia é o botão do rodapé. Criar uma sessão no backend a cada clique errado geraria sessões órfãs, e o `OptionCard` já suporta `selected` sem avançar sozinho (o avanço automático dele é do papel `single` do fluxo antigo, não obrigatório).
- Selecionar outra linha troca a seleção. Selecionar de novo a mesma linha desmarca.
- `Criar cliente novo` troca a lista por um formulário inline: `TextField` `Nome do cliente` + texto de apoio + `primary` (`Criar e vincular` | `Criar e enviar`) + `ghost` `Voltar à lista` (volta à lista sem criar nada). `Enter` envia; `Esc` aciona `Voltar à lista`. Quando a busca não acha nada, a ação `Criar cliente “{busca}”` abre o formulário já preenchido.
- **Enviando:** o CTA vira `Criando…`/`Enviando…`, fica desabilitado, e a lista fica inerte (`aria-busy`). Em falha, a mensagem aparece abaixo do campo (`text-caption text-danger`, `aria-live="assertive"`) e o valor digitado é preservado.
- **Painel compacto (320px):** ao abrir o picker em `compact`, o painel sobe para `regular` (564px) uma vez. Em 320px a lista receberia menos de duas linhas.
- **Saída larga:** o picker ocupa a tela inteira dentro do `AppShell` (cabeçalho de vidro fixo, lista com `scroll-region`, rodapé fixo).
- **Teclado:** `↓` no campo de busca move o foco para a primeira linha; `Esc` volta (e, se a reunião está ao vivo, equivale a "Depois"); toda digitação passa por `TextField`/`SearchField` (sem vazar atalhos para o Meet).
- **Plano B (D-02):** só quando o estado é `error`, a lista é substituída pela mensagem de erro + `Tentar de novo` (`secondary`) + o campo `ID da sessão do Agente` + `Vincular com este ID` (`primary`). O campo nunca aparece com a lista carregada.

### 4. Barra de vínculo — estado visível durante a reunião (D-12, D-18)

Faixa de uma linha acima da transcrição ao vivo (`LiveBody`), `Surface level="item"` (`glass-subtle rounded-control`), `px-3 py-2`, mínimo 40px, `text-caption`. Só aparece quando o envio ao Agente está ligado.

| Estado | Conteúdo | Cor |
|--------|----------|-----|
| `deferred` | `Sem cliente…` + botão `ghost compact` `Selecionar cliente` | texto `muted` |
| `linking` | `Enviando o que já foi falado… x de y` + trilho fino (`ProgressRail` sem voltar) | `muted` + trilho verde |
| `linked` | ponto verde + `Enviando ao vivo para {cliente}` (nome com `truncate` e `title`) | `text-glow` (accent) |
| `linked` + offline | troca para o aviso warning (mesmo estilo do aviso de captura: `rounded-control border border-[#f2c94c]/25 bg-[#f2c94c]/10 px-3 py-2 text-caption text-[#f7dd8f]`, `role="status"`, `aria-live="polite"`) + contagem de falas na fila | warning |

- Quando o Agente volta, o aviso some e o toast do painel (já existente, 2,2 s) mostra `Agente de volta. Falas reenviadas.`
- O aviso de offline **não bloqueia nada** e a captura do Meet segue normal (padrão fire-and-forget da Fase 7, reforçado em D-18).

### 5. Fim da reunião — D-09, D-10, D-11

- `MeetingScreen` (tela "Transcrição salva", que o painel abre sozinho no fim) ganha, **acima** da linha de botões, o cartão `Enviar esta reunião ao Agente?` quando a reunião tem falas e **não** foi enviada: `Selecionar cliente` (`primary`) e `Descartar` (`ghost`, texto `text-danger/80`, mesmo padrão do "Apagar" de `RecordDetail`).
- Reunião vazia (0 falas) continua na `EmptyCaptureScreen` atual; sem cartão.
- Reunião já vinculada: sem cartão; uma linha de apoio `Enviada para {cliente}` (`text-caption text-muted`).
- **Mesmo pedido, por botão** (D-09): `Enviar ao Agente` (`secondary compact`, largura total) acima da fileira Copiar / Baixar .txt / Apagar, em `RecordDetail` (saída larga) e na `MeetingScreen` (painel). Aparece só para reuniões não enviadas. Reuso da mesma `MeetingScreen`/`RecordDetail`; **não** criar telas irmãs.
- **Envio em partes:** substitui o cartão por `Enviando para {cliente}…` + `ProgressRail` `{x} de {y}` (singular `1 de 1` quando for uma parte só). **Sem botão Cancelar** nesta fase: o envio continua no service worker mesmo se o painel for fechado. Ver "Decisões a confirmar" (e).
- **Sucesso:** o cartão vira `Reunião enviada para {cliente}.` com `Icon check` em `text-primary`, e o selo do histórico passa a `Enviada`.
- **Falha no meio:** mostra o texto de falha (warning) e `Continuar envio` **só quando a Decisão do time 3 estiver resolvida**; até lá exibir apenas o texto de falha + a linha de apoio (`A transcrição continua guardada…`), sem botão de retry (risco de duplicar fala). Enquanto estiver bloqueado, o que a pessoa pode fazer é `Copiar`, `Baixar .txt` e `Apagar` (já existentes, este último com a frase extra de D-11); `Enviar ao Agente` **não reaparece** para uma reunião em `send-failed`, porque reenviar do zero duplicaria as partes que já chegaram. O selo do histórico fica `Envio parou`.
- **Descartar:** `ConfirmModal` com `danger`. Depois de confirmar, a reunião sai do histórico e o painel volta ao histórico. Irreversível (one-way, D-11).
- **Conferir no teste manual (D-20c):** o painel tem `scale-100` (transform), que faz o `fixed` do `ConfirmModal` ficar contido na caixa do painel em vez da viewport. Se for isso, é aceitável (o modal cobre o painel). O `ConfirmModal` hoje só é usado na saída larga.

### 6. Selo e ações no histórico

- `HistoryCard` e `RecordDetail` mostram o selo de associação ao lado do `StatusBadge` atual (mesma linha; nunca dois selos de associação).
- Selo só aparece em reuniões criadas com o envio ao Agente ligado. Reuniões antigas ficam sem selo (não inventar "Sem cliente" para o passado).

### 7. Tela "Agente Diagnóstico" (`AgenteConfigScreen`) — D-02

- O campo `ID da sessão do Agente` **deixa de ser fixo**. A tela tenta carregar a lista de clientes ao montar (mesmo `ClientDirectory`); enquanto carrega não mostra o campo; se falhar, mostra o campo com o rótulo, placeholder e apoio de hoje; se carregar, mostra `A associação é feita a cada reunião, pelo ícone “!” no painel do Meet.`
- Toggle, URL do backend e chave (`AgenteApiKeyField`) ficam como estão.
- O aviso de "reunião nova detectada" (CR-01, botão `Continuar enviando para esta sessão`) só faz sentido no caminho do ID manual; no caminho do seletor cada reunião ganha sessão própria (D-03). **O planejamento confirma** se ele sai da tela ou fica restrito ao plano B.

### Acessibilidade (resumo do contrato)

- Foco visível sempre (regra global `:focus-visible`, anel verde 2px); nunca remover.
- Contraste: texto `#080B0E` sobre `#F2C94C` na bolha (~12:1); texto `#F7DD8F` sobre fundo warning translúcido segue o padrão do aviso de captura já em produção.
- `aria-live="polite"` no status do vínculo e no carregamento; `assertive` só em erro de ação do usuário.
- Todo ícone sem texto tem `aria-label` e `title`.
- Nenhuma informação só por cor: warning/danger sempre acompanham texto; o selecionado da lista tem fio e (no `role="single"`) o `Icon check`.
- Movimento só em `transform`/`opacity` curtos; respeita `prefers-reduced-motion` pela regra global.

---

## Novos componentes e acréscimos ao kit

Nomes sugeridos; o planejamento decide a divisão final em arquivos (um componente, uma responsabilidade; lógica de estado em hooks, nunca em JSX). Todos apresentacionais, em `taqciti/src/sidepanel/components/` (usados pelas duas superfícies) ou `taqciti/src/shared/ui/`.

| Item | Tipo | Observação |
|------|------|------------|
| `AgenteNudge` | componente | Bolha "!" com duas ancoragens (cápsula / cabeçalho). |
| `AgenteDecisionCard` | componente | Cartão "Esta reunião é de qual cliente?". |
| `ClientPicker` | componente | Busca, criar, lista, rodapé. Recebe `status`, `clients`, `mode: 'live' \| 'ended'`, `onSelect`, `onCreate`, `onManualId`. |
| `AgenteBindingBar` | componente | Barra de vínculo (4 estados). |
| `AgenteEndPrompt` | componente | Cartão de fim da reunião + estado de envio em partes. |
| `AssociationBadge` | componente | Mapeia estado → `Badge`. |
| `Icon` `alert` | acréscimo | Traço de exclamação, mesma espessura de 1.8, sem círculo. Entra em `IconName` e `PATHS`. |
| `nudge` | acréscimo | `keyframes` + `animation` em `tailwind.config.ts`, 5 s, só `transform`. |
| `ConfirmModal` prop `cancelLabel` | acréscimo | Prop opcional (`string`, padrão `'Cancelar'`) para o rótulo do botão de recusa; ver "Override do rótulo de recusa" em Destrutivos. Compatível com os usos atuais. |
| `ClientDirectory` | interface (não é UI) | `list()`, `create(name)`; permite trocar a origem (AGM). |

Nenhum token novo em `tokens.css`. Nenhum tamanho novo de fonte.

---

## Dependências das decisões em aberto do time

A UI é construída contra a interface `ClientDirectory` e contra o estado local, então **o desenho acima não muda** com as decisões. O que muda é o que pode ser ligado ao backend e o que fica bloqueado.

| # | Decisão em aberto (08-CONTEXT) | O que a UI depende | Se ficar sem decisão |
|---|-------------------------------|--------------------|----------------------|
| 1 | Rotas novas da extensão: listar clientes, criar cliente, criar sessão (D-13, D-16) | Forma da lista (campos `client`, `name`), mapeamento do campo único `Nome do cliente` para `name`/`client`, limite de tamanho do nome, códigos de erro dos estados `error` | Picker, criar cliente e vincular rodam contra um `ClientDirectory` falso nos testes; **ligar ao backend fica bloqueado**. |
| 2 | Chave Gemini deixa de ser obrigatória em `ProjectCreate` (D-15) | O formulário de criar cliente tem **um campo só** (nome) | Se o time **não** remover a exigência, o formulário precisa de um segundo campo obrigatório (`Chave Gemini do projeto`, mascarado) e este contrato **deve ser revisado**. Criar cliente pela Taqciti fica bloqueado. |
| 3 | Identificador por trecho no webhook, `chunk_id` (D-19) | Botão `Continuar envio` e qualquer retentativa manual do envio em partes; garantia de não duplicar fala no reenvio automático de D-18 | O botão `Continuar envio` **não é entregue**; a falha mostra só o texto. O reenvio automático do offline (D-18) fica bloqueado para o planejamento, pois pode duplicar trecho. |

---

## UI Considerations

> Estados de conteúdo e robustez por elemento. Texto de estado vazio e de erro está em `## Copywriting Contract`; aqui só se referencia, sem repetir.

Applicable state considerations resolved: 15 covered, 1 backstop, 2 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | list-collection: lista de clientes | ✅ covered | Sem clientes cadastrados, a lista mostra o estado vazio documentado (`Nenhum cliente cadastrado ainda.`) com a ação `Criar cliente novo`; busca sem resultado mostra `Nenhum cliente com “{busca}”.` com a ação de criar. |
| loading | list-collection: lista de clientes | ✅ covered | Enquanto a lista carrega aparecem 4 linhas-esqueleto `glass-subtle` com `animate-typing` e o texto `Carregando clientes…` (`aria-live="polite"`); busca e `Criar cliente novo` ficam desabilitados. |
| error | list-collection: lista de clientes | ✅ covered | Falha ao carregar mostra a mensagem documentada, `Tentar de novo` e o campo de ID manual (plano B, D-02); o campo nunca aparece com a lista carregada. |
| populated | list-collection: lista de clientes | ✅ covered | Cada cliente é um `OptionCard` (cliente + projeto); só uma linha selecionada por vez; o CTA do rodapé só habilita com seleção. |
| partial | list-collection: lista de clientes | ✅ covered | Cliente sem nome de projeto, ou com projeto igual ao cliente, mostra só o rótulo (sem linha de dica vazia). |
| overflow | list-collection: lista de clientes | ✅ covered | Uma única `scroll-region` com `scrollbar-gutter: stable`; nome longo usa `truncate` + `title`. |
| zero-one-many | list-collection: contador da lista | ✅ covered | `1 cliente` / `{N} clientes`; com busca `Resultados · {N}`; zero cai no estado vazio. |
| long-text | interactive-control: linha de cliente | ✅ covered | Rótulo e dica truncam em uma linha com reticências e o nome completo em `title`; nunca quebram o layout do cartão. |
| empty | form: nome do cliente novo | ✅ covered | Campo vazio ou só com espaços mantém o CTA `Criar e vincular`/`Criar e enviar` desabilitado. |
| loading | form: nome do cliente novo | ✅ covered | Durante a criação o CTA vira `Criando…`, fica desabilitado, e a lista/campo ficam inertes (`aria-busy`). |
| error | form: nome do cliente novo | ✅ covered | Falha mostra a mensagem documentada abaixo do campo (`aria-live="assertive"`) e preserva o texto digitado; nome duplicado mostra a dica de duplicidade e mantém o CTA desabilitado. |
| long-text | form: nome do cliente novo | ⚠ unresolved | O limite de caracteres depende do contrato da rota nova (Decisão do time 1); o planejador assume `maxLength` de 120 até a decisão. |
| error | interactive-control: vincular / criar sessão | ✅ covered | Falha ao criar a sessão mostra `Não foi possível criar a sessão no Agente…`, o vínculo volta a `deferred` e a reunião continua guardada só na Taqciti (nada é enviado). |
| loading | interactive-control: envio em partes | ✅ covered | O envio mostra `ProgressRail` com `{x} de {y}` e `tabular-nums`; singular `1 de 1`; continua no service worker se o painel fechar. |
| error | interactive-control: envio em partes | ⚠ unresolved | A falha no meio mostra o texto de parada, mas o botão `Continuar envio` depende de `chunk_id` (Decisão do time 3); o planejador trata como suposição e não entrega o botão antes da decisão. |
| zero-one-many | static-content: contagem da fila offline | ✅ covered | `{n} fala na fila` / `{n} falas na fila`; contador some quando a fila esvazia. |
| long-text | static-content: barra de vínculo | ✅ covered | O nome do cliente na barra usa `truncate` + `title`; o botão de ação não encolhe (`shrink-0`). |
| overflow | list-collection: picker no painel compacto (320px) | 🧪 backstop | O painel sobe para `regular` ao abrir o picker; verificação visual no painel em 320px e 564px no teste manual (D-20), com pelo menos 3 linhas visíveis em 564px. |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum (shadcn não usado) | not applicable |
| terceiros | nenhum | not applicable — nenhum registro de terceiros declarado nesta fase, nada a vetar (verificado 2026-10-11) |

Nenhum bloco de registro externo entra nesta fase; todo componente novo é escrito dentro do kit da Taqciti.

---

## Decisões a confirmar com o usuário

Escolhas que este contrato fez dentro de "Claude's Discretion" ou onde o CONTEXT deixou a UI decidir. O usuário pode sobrescrever qualquer uma; nenhuma toca em contrato de API.

| # | Decisão tomada neste contrato | Alternativa | Custo de mudar depois |
|---|------------------------------|-------------|-----------------------|
| a | O aviso "!" só aparece com o envio ao Agente **ligado** (chave-mestra da Fase 7). Quem não usa o Agente não vê nada. | Avisar em toda reunião | Baixo (uma condição), mas incomoda quem não usa o Agente. |
| b | O ícone fica **dentro do Meet**, preso à cápsula/cabeçalho do painel, não na barra do Chrome. | Selo na barra do Chrome | Médio: o selo não anima e fica fora da vista. |
| c | Selecionar cliente é em **dois passos** (linha + botão do rodapé) para não criar sessão a cada clique errado. | Um clique já vincula | Baixo. |
| d | Minimizar/fechar o painel com o cartão aberto conta como "Depois". | Só ×, "Depois" e Esc contam | Baixo. |
| e | O envio em partes **não tem Cancelar** e continua com o painel fechado. | Botão Cancelar | Médio: exige definir o que fazer com o que já foi enviado. |
| f | Shadcn **não** é iniciado (Tool: none), por haver sistema próprio. | Iniciar shadcn | Alto: segundo sistema de design em paralelo. |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
