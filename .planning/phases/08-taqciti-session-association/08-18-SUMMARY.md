---
phase: 08-taqciti-session-association
plan: 18
subsystem: taqciti-config-screen
status: complete
tags: [taqciti, chrome-extension, react, hooks, config-screen, vitest, session-association]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-14: useMeetingAssociation, useClientDirectory, sendAgenteCommand; 08-10: comando ui/agente/meeting/bind; 08-01: destino vem só da associação"
provides:
  - "Tela 'Agente Diagnóstico' com o campo de ID só no plano B (lista de clientes falhou) e texto de apoio novo"
  - "Prontidão da tela = envio ligado + URL válida (o ID saiu da conta)"
  - "useLiveMeetingManualBind: salvar um UUID vincula só a reunião ao vivo sem cliente (comando manual)"
  - "Cartão CR-01 'Continuar enviando para esta sessão' removido da tela"
affects: [08-20, 08-23]

actuals:
  tokens: 17000
  tasks: 2
  commits: 1

plan_head_before: 1ef341eb3561438c0fb5aa2bd94328f8eb3dcc43
plan_head_after: 2ee2721c63802fcc60e2dcfddd86af98dfd51fe2

tech-stack:
  added: []
  patterns:
    - "Hook de ação com ref para o estado mais recente: o vínculo roda depois de um await (o salvar) e não pode usar o estado do render do clique"
    - "Plataforma falsa (lista indisponível, assinaturas mudas) envolvendo a tela nos testes; PlatformProvider importado dinamicamente depois do vi.resetModules()"

key-files:
  created:
    - taqciti/src/shared/hooks/useLiveMeetingManualBind.ts
    - taqciti/src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx
  modified:
    - taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx
    - taqciti/src/shared/hooks/useAgenteConfigForm.ts
    - taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx
    - taqciti/src/sidepanel/screens/AgenteConfigScreenBack.test.tsx
    - taqciti/src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx

key-decisions:
  - "B5 = vincular-ao-vivo (decisão do time, 2026-10-12)"
  - "save() do useAgenteConfigForm passou a devolver o ID de sessão gravado POR AQUELA chamada (null se o campo não foi editado ou se falhou). Assim, salvar só a URL não revincula a reunião ao ID antigo"
  - "Reunião 'ao vivo' = fase captionsRequired, recording ou paused com sessão; idle e ended nunca recebem vínculo"

requirements-completed: []

coverage:
  - id: D1
    description: "Campo de ID escondido com a lista carregando e com a lista ok (só o apoio), visível com a lista falha"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Salvar um UUID vincula só a reunião ao vivo em pending/choosing/deferred; sem reunião ao vivo, associação linked, ID inválido ou só a URL editada não mandam comando (T-08-36)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Status sem exigir o ID; cartão CR-01 fora da tela; casos antigos, Voltar e rastro de falas continuam verdes"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 18: Tela do Agente como plano B do vínculo por reunião — Summary

**Com o vínculo por reunião, o ID colado na tela de configuração virou plano B: só aparece se a lista de clientes falhar, não é mais exigido para a tela ficar "pronta" e, quando salvo, vincula apenas a reunião que está acontecendo agora e ainda não tem cliente.**

## Decisão B5 (Task 1) — registrada, literal, antes de qualquer código

- **Resposta do time:** `vincular-ao-vivo` (2026-10-12), a opção recomendada.
- **Fonte:** `08-DECISOES-PENDENTES.md`, item 5 (B5).
- **Efeito:** salvar um ID válido vincula a reunião ao vivo ainda sem cliente; sem reunião ao vivo, só guarda; o cartão CR-01 sai; texto de apoio novo.
- Não houve parada nem pergunta nova: a task era um checkpoint já respondido.

## O que foi feito (Task 2, commit `2ee2721`)

- **Tela** (`AgenteConfigScreen.tsx`, 174 linhas): `useClientDirectory(true)` decide a visibilidade. `loading` não mostra nada; `ready` mostra só "A associação é feita a cada reunião, pelo ícone “!” no painel do Meet."; `error` mostra o campo com o rótulo e o placeholder de hoje, mais o apoio "Copie o ID da sessão ativa… ela passa a ser enviada para essa sessão." O botão CR-01 e o `confirmError` saíram da renderização.
- **Formulário** (`useAgenteConfigForm.ts`, 196 linhas): `readiness` virou `disabled` / `invalid-url` / `ready` (função local `screenReadiness`; `getStreamingReadiness(` não é mais usado ali). `save()` devolve o ID gravado por aquela chamada.
- **Hook novo** (`useLiveMeetingManualBind.ts`): usa `useMeetingState` + `useMeetingAssociation` e só manda `ui/agente/meeting/bind { kind: 'manual', sessionId }` para reunião ao vivo em pending/choosing/deferred e com UUID válido.
- **Testes:** `AgenteConfigScreenPlanB.test.tsx` novo (10 casos); `AgenteConfigScreen.test.tsx` com harness de plataforma falsa e os casos (6), (13) e (14) trocados de propósito (comentário cita a B5); `Back` e `DropTrace` mudaram só a montagem (nenhum `expect` no diff).

## Verificação

- `npx vitest run` dos 4 arquivos da tela: **4 arquivos, 43 testes, todos passando** (Back 4, DropTrace 4, PlanB 10, tela 25).
- Portão do plano: `npm test` -> **69 arquivos, 983 testes passando**; `npm run typecheck` sem erro; `npm run lint` sem erro.
- Greps: "Continuar enviando para esta sessão" fora de comentário = 0; nenhuma linha 201 em `AgenteConfigScreen.tsx` nem em `useAgenteConfigForm.ts`; nenhum uso de `getStreamingReadiness(` no formulário; nenhum manifesto de pacote alterado (T-08-SC).
- Não houve verificação visual no Chrome real: fica para o teste manual D-20.

## Red -> Green

O `AgenteConfigScreenPlanB.test.tsx` foi escrito primeiro e falhou em 5 dos 10 casos (campo visível com a lista carregando, apoio ausente, sem vínculo, etc.); depois da implementação, os 10 passam.

## Deviations from Plan

Nenhuma de Regras 1-3 além do que o plano já previa. Dois ajustes de desenho, sem decisão do time envolvida:

1. **`save()` devolve o ID gravado** (em vez de `void`). Necessário para a tela saber que o ID foi salvo agora, e não revincular a reunião ao ID antigo quando só a URL muda (coberto por teste). O contrato antigo (`Promise<void>`) não era usado por nenhum outro chamador.
2. **Harness de `AgenteConfigScreen.test.tsx`** espera também o campo `#agente-session-id` aparecer (a lista falha de forma assíncrona na plataforma falsa) — só harness, nenhum caso antigo mudou de expectativa além de (6)/(13)/(14).

## Pontos de atenção para o time (não bloqueantes)

- `agenteStatus.ts` (fora dos arquivos do plano) ainda tem o texto do aviso de reunião nova: "…confirme abaixo; se for outra sessão, cole o ID novo e salve". Sem o botão CR-01, o "confirme abaixo" ficou sem referente. O aviso só aparece se alguém ainda gravar `agenteWaiting`; remover esse texto, a `confirmNewMeeting`, `confirmedMeetingId` e `configDestination` continua sendo a decisão de remoção de código já registrada no 08-01.
- `confirmNewMeeting` permanece em `useAgenteStreamingStatus` (código sem uso na tela), conforme o plano.
- `.planning/config.json` (fim de linha) e `08-DECISOES-PENDENTES.md` ficaram de fora dos commits, como orientado. TAQ-02 **não** foi marcado como concluído.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-08-36 mitigado: o ID só vincula reunião ao vivo sem cliente, pelo comando validado; testes "sem reunião ao vivo", "linked", "ID inválido" e "só a URL" não mandam comando.

## Rollback

`git revert 2ee2721` devolve a tela da Fase 7 (campo fixo, CR-01) e as montagens antigas dos três testes, juntos.

## Self-Check: PASSED

- Arquivos criados presentes: `useLiveMeetingManualBind.ts`, `AgenteConfigScreenPlanB.test.tsx`.
- Commit `2ee2721` é ancestral de HEAD.
