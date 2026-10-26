# Phase 08 — UI Review

**Auditado em:** 2026-10-26
**Baseline:** `08-UI-SPEC.md` (aprovado em 2026-10-11)
**Screenshots:** não capturadas. A UI desta fase mora na extensão (shadow DOM do painel no Meet e página do side panel), que o Playwright não alcança pela porta do web app (5173). Auditoria só de código.
**Interaction captures:** off (`workflow.ui_interaction_capture: false`). O `08-UAT.md` foi citado só como contexto, não como nota.

## Notas por pilar

| Pilar | Nota | Achado principal |
|-------|------|------------------|
| 1. Copywriting | 3/4 | Textos fiéis ao contrato. Desvios: "Vinculando…" no lugar de "Criando…/Enviando…", e o ID manual recusado usa a mensagem "Não foi possível criar a sessão". |
| 2. Visuals | 3/4 | Hierarquia clara e ícones com `aria-label`. Riscos: cabeçalho de 396 px apertado com a bolha, trilho de progresso com 36 px de espaço morto, dois verdes cheios na mesma tela. |
| 3. Color | 3/4 | Sem token novo e sem hex fora do contrato. Mas o selo "warning" usa `amber` do Tailwind (não o `#F2C94C` do contrato), e a variante `solid` é um verde cheio que o contrato não prevê. |
| 4. Typography | 4/4 | Só `text-caption`/`text-read`/`text-title` e `font-semibold`/400. Nenhum tamanho ou peso novo. |
| 5. Spacing | 3/4 | Quase tudo na escala de 4 px. Fugas em componente novo: `p-1.5` (rodapé compacto), `gap-1.5`, `-ml-2`. |
| 6. Experience Design | 3/4 | Estados de carregando/vazio/erro/ocupado cobertos. Falhas: a barra mostra "Enviando ao vivo" em verde com a entrega em `failed`, o botão destrutivo do modal já nasce focado, e o seletor de tela cheia não tem semântica de diálogo. |

**Total: 19/24.** Nenhum pilar ficou em 1, então não há BLOCKER. Todos os achados abaixo são WARNING.

## Top 3 correções prioritárias

1. **A barra de vínculo afirma "Enviando ao vivo para {cliente}" em verde mesmo com a entrega em `failed`.** (WARNING)
   - **Impacto:** a pessoa acredita que as falas estão chegando ao Agente quando estão sendo descartadas.
   - **Evidência:** `taqciti/src/features/agente/bindingView.ts` (`linkedBarView`) trata só `offline` e `rejected`. O comentário diz que `failed` "não muda a barra" porque o reenvio estaria desligado, mas isso ficou velho: o 08-19 ligou o reenvio. Hoje `agenteDeliveryTracker.ts` (linhas ~71-78) emite `status: 'failed'` quando desiste (`agenteSendSettle.ts:55`).
   - **Correção:** adicionar o caso `failed` em `linkedBarView` e um `kind` warning em `AgenteBindingBar`. Texto sugerido: "Algumas falas não chegaram ao Agente. Ficam guardadas aqui." Usar warning, não danger, igual ao contrato.
2. **O modal de descarte e o seletor de tela cheia têm acessibilidade de teclado frágil num fluxo irreversível.** (WARNING)
   - `taqciti/src/shared/ui/ConfirmModal.tsx:65`: o botão de confirmar tem `autoFocus`. No "Descartar" (D-11, sem volta), Enter ou Espaço logo depois de abrir já apaga a transcrição. Com `danger`, o foco inicial deveria ir para o botão de recusa ("Manter reunião").
   - O modal também não prende o Tab.
   - `AgenteEndSlot.tsx:127-135`: o portal `fixed inset-0 z-40` não tem `role="dialog"`, `aria-modal` nem `aria-label`. O Tab continua alcançando a página por baixo, e o Esc só funciona com o foco dentro do seletor.
3. **A bolha "!" aperta o cabeçalho do painel de 396 px, e o cronômetro pode ser cortado.** (WARNING, a confirmar no Meet)
   - **Conta sobre o código:** a área útil é de 368 px, e o Wordmark de 24 px de altura ocupa ~83. Sobram ~285 px para a bolha (32), seis botões de 28 px com gaps (~184) e o chip de status. O chip fica com ~57 px, mas "00:12:34" em `text-micro` com `px-2.5` pede ~70 px, então truncaria (`truncate` em `PanelApp.tsx:1003`).
   - O UAT não registra essa checagem; medir no Meet real.
   - **Correção possível:** tirar um botão (por exemplo, esconder Comprimir/Expandir enquanto a bolha existe), ou dar `min-w` ao chip e deixar os botões cederem.

## Achados detalhados

### Pilar 1: Copywriting (3/4)

- Quase todo texto bate literalmente com o contrato: título e corpo do cartão (`AgenteDecisionCard.tsx:20-22`), subtítulos do seletor (`ClientPicker.tsx:29-32`), estados vazio/busca/carregando (`ClientPickerList.tsx`), `SESSION_CLOSED_TEXT`, `Manter reunião` e `Manter no histórico`.
- **Desvio:** o contrato diz que o CTA vira "Criando…/Enviando…" (`ClientPicker.tsx:37-40`, `BUSY_LABEL.live`), mas o código usa "Vinculando…". Contradiz o contrato no modo ao vivo, embora seja coerente com o CTA "Vincular reunião". Decidir e atualizar o UI-SPEC.
- **Lacuna do contrato que ficou com texto inadequado:** `AgenteLiveSlot.tsx:40-43` e `AgenteEndSlot.tsx:40-43` mapeiam qualquer falha do ID manual para `create-session`. Quem cola um UUID recusado lê "Não foi possível criar a sessão no Agente…", mas nenhuma sessão é criada nesse caminho. É o item "E5 error" que o UI-SPEC deixou em aberto.
- `AgenteConfigScreen.tsx:267`: o texto de apoio "A associação é feita a cada reunião, pelo ícone “!”…" aparece mesmo com o toggle desligado, mas o ícone só surge com o envio ligado (decisão (a) do contrato).
- **Aspas inconsistentes:** o modal de descarte usa aspas curvas (`AgenteEndSlot.tsx:163`) e o de apagar usa aspas retas (`RecordDetail.tsx:222`).
- Verbos de uma palavra ("Depois", "Voltar", "Descartar") foram marcados pelo checker e seguem como estão.

### Pilar 2: Visuals (3/4)

- Cada tela tem um ponto focal claro: cartão `glass-raised` com um único `primary`, barra de uma linha, bolha amarela de 20 px com alvo de 32 px (`AgenteNudge.tsx`).
- Todo botão só de ícone tem `aria-label` (bolha do cabeçalho, × do cartão "Fechar aviso").
- **Espaço morto no trilho de progresso:** `ProgressRail.tsx:19-27` sempre desenha o botão "Voltar" (invisível, `disabled`, `opacity-0`) mais `gap-3`. Isso toma ~36 px à esquerda na barra `linking` e no cartão `sending`, mesmo sem `onBack`. O botão desabilitado também fica na árvore de acessibilidade.
- **Dois verdes cheios na mesma tela ao vivo:** com a barra "Sem cliente", o botão `solid` "Selecionar cliente" (`AgenteBindingBar.tsx:72`) convive com o `primary` "Finalizar" (`ControlsBar.tsx:56`). O contrato pedia `ghost compact` e "um único primary por tela". O verde cheio foi aprovado no UAT (14e94cd), mas o UI-SPEC não foi atualizado.
- Enquanto o seletor está aberto no painel, a regra `:has(> [data-picker-takeover])` (`panel.css:97`) esconde a transcrição e o `ControlsBar` (Pausar/Finalizar). Isso resolve o defeito de altura, mas a pessoa fica sem os controles da reunião durante a escolha.
- A bolha da cápsula é `aria-hidden` (`AgenteNudge.tsx:38`). Quem usa leitor de tela, ao focar a cápsula, não ouve que há reunião pendente. O contrato pedia nome acessível ("Reunião detectada…").

### Pilar 3: Color (3/4)

- Todo literal de cor é um dos três previstos: `#F2C94C`, `#f2c94c` com 25%/10%, e `#f7dd8f`. Nenhuma cor nova em `tokens.css`.
- O uso de accent confere com a lista do contrato:
  - `text-glow` e o ponto `bg-primary` só em `linked` (`AgenteBindingBar.tsx:95-97`).
  - `Icon check text-primary` só no sucesso (`AgenteEndPrompt.tsx:132`).
  - O ponto do selo "Enviando" (`AssociationBadge.tsx:24`).
- **Dois amarelos diferentes:** `Badge tone="warning"` usa `amber-400/12` e `text-amber-200/90` (`Badge.tsx:14`), que não são o `#F2C94C`/`#F7DD8F` do contrato. Na mesma tela convivem o selo "Sem cliente" e o aviso warning com o hex real.
- O literal do warning está copiado em `AgenteBindingBar.tsx:41`, `AgenteEndPrompt.tsx:52` e em `PanelApp`. Exportar uma constante única.
- **Variante `solid` nova** (`Button.tsx:97`, `bg-primary` chapado): é um uso de accent fora das 7 permissões do contrato. Foi aceita pelo usuário, mas a regra "10% accent" já não descreve o código.

### Pilar 4: Typography (4/4)

- Tamanhos nos arquivos novos da fase: `text-caption` ×26, `text-read` ×8, `text-title` ×5. Nenhum literal em `[px]`.
- Pesos: só `font-semibold` ×13, mais o 400 padrão. `tabular-nums` está nos contadores ("x de y", "n falas na fila", contador da lista).
- **Nit:** o "x de y" do `ProgressRail` usa `text-micro` (`ProgressRail.tsx:36`). O contrato restringe `micro` a Badge e à meta de OptionCard, mas também exige esse componente. É herança do kit, não defeito da fase.

### Pilar 5: Spacing (3/4)

- Distribuição nos novos componentes: `mb-2` ×9, `p-4` ×6, `gap-2` ×6, `gap-3` ×4, `mt-2` ×4 etc. Tudo múltiplo de 4, exceto o que vem abaixo.
- **Fora da escala em componente novo:** `p-1.5` (6 px) no rodapé do seletor compacto (`ClientPicker.tsx:51`) e `gap-1.5` ×3 (`ClientCreateForm.tsx:81`, `ManualSessionIdForm.tsx:36` e o rótulo do campo). O checker pediu que as exceções de 6/10/14/34 px não fossem usadas em componente novo. Trocar por `p-2` e `gap-2`.
- `-ml-2` no botão Voltar do seletor (`ClientPicker.tsx:104`) é uma margem negativa de compensação: funciona, mas é frágil.
- O único valor arbitrário é `min-h-[40px]` (`AgenteBindingBar.tsx:37`), que está previsto no contrato. `h-7 w-7` do × e `h-8 w-8` da bolha também estão no contrato.
- No painel de 564 px, a densidade `compact` só reduz o gap e o rodapé. Busca (~46 px), "Criar cliente novo" (34 px) e cabeçalho continuam inteiros. O UAT confirmou 3 linhas visíveis, mas a margem é pequena.

### Pilar 6: Experience Design (3/4)

- **Cobertos:**
  - carregando (4 linhas-esqueleto + `aria-live`);
  - vazio;
  - busca sem resultado, com opção de criar cliente a partir da busca;
  - erro com plano B;
  - `busy` com lista inerte (`aria-busy`);
  - CTA desabilitado sem seleção;
  - nome duplicado local;
  - `Esc` contido (`containEscape.ts`);
  - `prefers-reduced-motion` global;
  - confirmação antes de descartar e antes de apagar.
- **Defeitos:**
  1. A barra não reflete `delivery.failed` (Top 3, item 1).
  2. Foco inicial no botão destrutivo e falta de semântica de diálogo (Top 3, item 2).
  3. O erro de nome duplicado é `aria-live="assertive"` e dispara a cada tecla enquanto a pessoa digita um nome repetido (`ClientCreateForm.tsx:107`). O contrato reserva `assertive` para erro de ação concluída.
  4. `AgenteEndPrompt`, nos estados `sending` e `sent`, não tem região `aria-live`, então o progresso do envio em partes não é anunciado.
  5. O `ConfirmModal` dentro do painel do Meet depende do `scale-100` da seção para ficar contido. O próprio UAT (08-UAT.md:112) deixa isso como ressalva a confirmar.
- Sem problema: mesmo sem existir "Cancelar" (decisão do time), a falha mostra `Continuar envio` corretamente.
- **Web app** (`ProjectFormPage.tsx:219-236`, `ProjectDetailPage.tsx:174-175`): a chave Gemini virou opcional, com a dica "Sem chave própria, o Agente usa a chave do servidor" e o chip "Usando a chave do servidor". Está coerente e sem achados.

## Recomendações menores

- Criar uma constante única para o warning (hex) e alinhar o `Badge warning` a ela.
- Documentar a variante `solid` e o texto "Vinculando…" no UI-SPEC, ou reverter para o contrato.
- Dar `maxLength` e `aria-label` consistentes ao campo do ID manual, e uma mensagem de erro própria para ID recusado.
- `PanelApp.tsx` tem 1381 linhas (a regra do CLAUDE.md diz que mais de 200 é sinal de excesso). O arquivo não é desta fase, mas a fase empurrou mais lógica para lá.

## Arquivos auditados

- `taqciti/src/sidepanel/components/`: AgenteNudge, AgenteNudgeAnchor, AgenteDecisionCard, AgenteBindingBar, AgenteLiveSlot, AgenteEndSlot, AgenteEndPrompt, ClientPicker, ClientPickerList, ClientCreateForm, ManualSessionIdForm, AssociationBadge, AssociationBadgeFor, HistoryCard, RecordDetail, containEscape.
- `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`.
- `taqciti/src/content/ui/PanelApp.tsx` (cápsula, janela, cabeçalho, MeetingScreen) e `panel.css`.
- `taqciti/src/shared/ui/`: Button, Badge, ProgressRail, ConfirmModal, OptionCard, Field, Surface, Icon, AppShell.
- `taqciti/src/features/agente/bindingView.ts`, `taqciti/src/background/agenteDeliveryTracker.ts`, `taqciti/tailwind.config.ts`.
- `frontend/src/pages/ProjectFormPage.tsx` e `ProjectDetailPage.tsx`.
- `08-UI-SPEC.md`, `08-CONTEXT.md`, `08-UAT.md`.

Registry audit: `components.json` não existe, então foi pulado, conforme o UI-SPEC ("shadcn não usado").
