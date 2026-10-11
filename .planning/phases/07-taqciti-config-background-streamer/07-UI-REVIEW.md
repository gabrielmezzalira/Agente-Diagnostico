# Phase 7 — UI Review

**Audited:** 2026-09-26
**Baseline:** padrões abstratos de 6 pilares (não existe UI-SPEC.md para esta fase — só a Task 1 do plano 07-03 produziu UI nova, dentro de uma fase majoritariamente de backend/service worker)
**Screenshots:** não capturadas (auditoria só de código — extensão Chrome de painel lateral, sem servidor dev na porta 3000/5173/8080 aplicável a este alvo)

**Escopo:** `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`, `taqciti/src/shared/hooks/useAgenteConfigForm.ts`, e o link adicionado em `HomeScreen.tsx`. Comparado contra as telas-irmãs já existentes (`HomeScreen.tsx`, `TranscriptView.tsx`) e os componentes de design system (`AppShell`, `Field.tsx`, `Button.tsx`).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Todo o texto é português natural, específico e consistente com o resto da Taqciti; nenhum rótulo genérico. |
| 2. Visuals | 2/4 | O toggle é um `<input type="checkbox">` nativo do navegador — quebra a linguagem visual "vidro" que rege todo o resto do design system (Button, TextField). |
| 3. Color | 4/4 | Zero cor hardcoded; usa só os tokens semânticos existentes (`text-primary-deep` via `Button`, `text-muted`, `text-foreground`); nenhum uso de accent fora do botão primário. |
| 4. Typography | 4/4 | Usa exclusivamente a escala semântica já estabelecida (`text-title`, `text-read`, `text-caption`) e um único peso extra (`font-semibold`) — igual ao padrão da HomeScreen. |
| 5. Spacing | 4/4 | Espaçamento (`gap-4`, `gap-1.5`, `px-5 py-4`, `mt-3`) segue exatamente o vocabulário já usado na HomeScreen/AppShell; nenhum valor arbitrário novo. |
| 6. Experience Design | 2/4 | `save()` não trata falha (sem `catch`/mensagem de erro); status fica em branco (`''`) antes da primeira entrega da assinatura, sem indicar "carregando". |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Checkbox nativo do navegador em vez de um toggle do design system** (`AgenteConfigScreen.tsx:53-57`) — impacto: o único controle interativo "de destaque" da tela é o único elemento que não parece pertencer ao produto (sem vidro, sem raio de borda do sistema, sem o anel de foco `focus-visible:outline-primary` que `Button`/`TextField` já padronizam) — quebra a primeira impressão de "isto é a Taqciti". Fix concreto: criar (ou reutilizar, se já existir em outro lugar do repo) um componente `Toggle`/`Switch` em `shared/ui/` no mesmo padrão glass de `Button.tsx` (estados hover/active/focus/disabled), e trocar o `<input type="checkbox">` por ele, mantendo `checked`/`onChange` como estão.

2. **`save()` engole erros silenciosamente** (`useAgenteConfigForm.ts:84-108`) — impacto: se `patchAgenteConfig` rejeitar (ex.: `chrome.storage` cheio, URL malformada rejeitada na normalização, falha de runtime da extensão), o `finally` só reseta `saving` para `false` — o botão volta a dizer "Salvar" como se nada tivesse acontecido, sem nenhuma pista de que os dados não foram gravados. Fix concreto: adicionar `catch` que seta um estado `saveError: string | null`, devolvido pelo hook, e exibir esse texto no lugar (ou ao lado) do `aria-live="polite"` de status na tela.

3. **Status em branco antes da primeira entrega da assinatura** (`AgenteConfigScreen.tsx:120-122`, combinado com `config: null` inicial em `useAgenteConfigForm.ts:43`) — impacto: no primeiro render (antes de `subscribeAgenteConfig` entregar o valor inicial do `chrome.storage.local`), a região `aria-live="polite"` fica vazia — quem depende de leitor de tela não recebe nenhum anúncio nesse intervalo, e visualmente a tela parece "incompleta" por um instante. Fix concreto: `readiness ? READINESS_LABELS[readiness] : 'Carregando configuração…'` em vez de string vazia.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Título "Agente Diagnóstico", subtítulo explicativo, textos de ajuda ("Copie o ID da sessão ativa no web app do Agente...") e os 5 rótulos de `READINESS_LABELS` (`AgenteConfigScreen.tsx:18-24`) são específicos, em português natural, e explicam a causa (não só o estado) — ex.: "A URL do backend não é válida — nada é enviado." Nenhum padrão genérico (`Submit`, `OK`, `Click Here`) encontrado nesta tela.
- Botão alterna corretamente entre "Salvar" e "Salvo!" (`justSaved`) — feedback de confirmação claro, sem depender só de um ícone.
- Link "Voltar" e link da HomeScreen ("Agente Diagnóstico · streaming ao vivo") são descritivos, não "Clique aqui".

### Pillar 2: Visuals (2/4)
- **Achado principal:** `<input type="checkbox">` sem nenhuma classe (`AgenteConfigScreen.tsx:53-57`) é renderizado com a aparência padrão do Chrome (quadrado azul do SO), enquanto todo o resto da tela (TextField com `glass-sunken`, Button com `glass-tint`/`glass-subtle`) segue rigorosamente a linguagem "vidro" documentada no cabeçalho de `Button.tsx`. É a maior quebra de consistência visual da tela — o elemento mais acionado (liga/desliga o streaming) é visualmente o mais deslocado.
- Hierarquia por tamanho/peso está presente e correta: `text-title font-semibold` para o H2, `text-caption font-semibold uppercase tracking-wide` para labels de campo, `text-caption` simples para texto de apoio — replica fielmente o padrão da HomeScreen.
- Foco visual: `TextField`/`Button` herdam o anel `focus-visible:outline-primary` e o `focus:shadow-[inset...]` do design system; o checkbox nativo não tem esse tratamento — outra manifestação do mesmo achado acima.
- Não há ícones isolados sem rótulo nesta tela (não se aplica o critério "ícone sem aria-label").

### Pillar 3: Color (4/4)
- Nenhuma cor hexadecimal/rgb hardcoded no arquivo (`grep` não encontrou nenhuma).
- Uso de accent (`primary`) restrito ao botão "Salvar" via `Button variant="primary"` — condizente com o padrão de "uma única coisa colorida por tela" documentado no cabeçalho de `Button.tsx`. O resto da tela é `text-muted`/`text-foreground`, mantendo a distribuição predominante neutra (compatível com 60/30/10).
- Link do header usa `text-muted` com `hover:text-foreground` — mesmo padrão do link da HomeScreen, sem introduzir uma nova cor de link.

### Pillar 4: Typography (4/4)
- Apenas 3 tokens de tamanho semântico usados: `text-title` (1x, o H2), `text-read` (2x, corpo/label do toggle), `text-caption` (7x, labels de campo, texto de apoio, status) — dentro do limite abstrato de "≤4 tamanhos".
- Apenas 1 peso extra: `font-semibold` — dentro do limite de "≤2 pesos" (peso base + semibold).
- Perfeitamente alinhado com `HomeScreen.tsx`, que usa exatamente o mesmo vocabulário (`text-title`, `text-read`, `text-caption`, `font-semibold`).

### Pillar 5: Spacing (4/4)
- Espaçamentos usados (`gap-4`, `gap-2.5`, `gap-1.5`, `px-5 py-4`, `mt-3`, `mt-1.5`) reaparecem literalmente em `HomeScreen.tsx` — não há introdução de uma escala paralela.
- Único valor "arbitrário" (`max-w-[300px]`) é copiado exatamente do mesmo padrão já usado no subtítulo da HomeScreen (`HomeScreen.tsx:70`) — reuso consistente, não uma invenção nova.
- `AppShell` é reaproveitado sem modificação, preservando o contrato de grid `auto minmax(0,1fr) auto` documentado ali.

### Pillar 6: Experience Design (2/4)
- **Loading state:** `config` começa `null` (`useAgenteConfigForm.ts:43`) até a primeira entrega de `subscribeAgenteConfig`; nesse intervalo o botão fica corretamente desabilitado (`disabled={saving || config === null}`, `AgenteConfigScreen.tsx:115`), mas o parágrafo de status (`aria-live="polite"`) renderiza string vazia (`AgenteConfigScreen.tsx:121`) em vez de qualquer indicação de "carregando" — pior para quem usa leitor de tela, que não recebe nenhum anúncio nesse meio-tempo.
- **Error state:** `save()` (`useAgenteConfigForm.ts:84-108`) não tem `catch` — uma falha de `patchAgenteConfig` (rejeição da Promise) propaga como unhandled rejection e o único efeito visível é o `finally` devolver `saving` a `false`; não existe qualquer sinalização de que o salvamento falhou. Esta é a lacuna mais séria do pilar: a pessoa pode acreditar que salvou quando não salvou.
- **Empty/disabled states:** bem cobertos — `READINESS_LABELS` mapeia 5 estados distintos (`disabled`, `invalid-url`, `missing-session`, `invalid-session`, `ready`) com texto que explica a causa, e o botão distingue `saving`/`justSaved`/desabilitado antes da primeira entrega.
- **Ações destrutivas:** não se aplica — nenhuma ação desta tela é destrutiva/irreversível (salvar e alternar toggle são idempotentes e reversíveis).
- **Anti-repetição de digitação sendo sobrescrita:** o hook implementa corretamente a proteção (rascunho por campo + `editedRef`) contra o bug conhecido G-06-1 da Fase 6, coberto por teste dedicado (`AgenteConfigScreen.test.tsx`, caso 5) — ponto positivo que evita puxar a nota mais para baixo.

---

## Registry Safety

Não aplicável — não há `components.json` (shadcn) neste projeto/pasta `taqciti/`. Auditoria de registry pulada.

---

## Files Audited
- `taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx`
- `taqciti/src/shared/hooks/useAgenteConfigForm.ts`
- `taqciti/src/sidepanel/screens/HomeScreen.tsx`
- `taqciti/src/shared/ui/AppShell.tsx`
- `taqciti/src/shared/ui/Field.tsx`
- `taqciti/src/shared/ui/Button.tsx`
- `.planning/phases/07-taqciti-config-background-streamer/07-03-SUMMARY.md`
- `.planning/phases/07-taqciti-config-background-streamer/07-03-PLAN.md`
