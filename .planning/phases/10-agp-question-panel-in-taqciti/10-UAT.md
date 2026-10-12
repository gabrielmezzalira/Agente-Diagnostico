---
status: testing
phase: 10-agp-question-panel-in-taqciti
source: 10-PLAN.md (seção 7), PENDENCIAS-FASE-10.md, PENDENCIAS-FASE-08.md (sem SUMMARY.md: a fase não passou pelo gsd-execute-phase)
started: 2026-10-12T23:23:07Z
updated: 2026-10-12T23:23:07Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Aba AGP sem cliente vinculado
expected: |
  Preparo: backend local em :8000, web app em :5173, extensão carregada de taqciti/dist (cd taqciti && npm install && npm run build).
  Entre numa call do Meet com as legendas ligadas, SEM vincular cliente. No painel da Taqciti aparecem as abas "Transcrição" e "AGP".
  A aba Transcrição está selecionada por padrão e a transcrição rola normalmente. Ao clicar em "AGP" aparece o aviso
  "Vincule esta reunião a um cliente para ver aqui as perguntas do Agente." e nenhuma pergunta.
awaiting: user response

## Tests

### 1. Aba AGP sem cliente vinculado
expected: Abas Transcrição e AGP no painel; Transcrição por padrão; AGP sem vínculo mostra só o aviso de vincular cliente, sem pergunta.
result: [pending]

### 2. Perguntas do Agente aparecem na AGP com a lente
expected: Vincule um cliente (ou cole um ID de sessão). No site do Agente (:5173) clique "Gerar agora". Em poucos segundos a pergunta aparece na aba AGP da Taqciti com o selo da lente certa (Produto ou Dados), e o contador da aba AGP sobe.
result: [pending]

### 3. A pergunta some quando o tempo dela acaba
expected: Sem fazer nada, depois do TTL (padrão 30 s) a pergunta some da AGP (o backend manda o aviso de expirada). Uma pergunta fixada no site não some por tempo.
result: [pending]

### 4. Backend cai e volta
expected: Derrube o backend por alguns segundos com a AGP aberta: aparece "Reconectando ao Agente…" e as perguntas já recebidas continuam na tela. Ao subir o backend de novo, volta sozinho ao normal (sem aviso), sem precisar recarregar.
result: [pending]

### 5. Fim da call fecha a conexão
expected: Encerre a call. A AGP volta ao aviso (sem perguntas) e não fica "Reconectando…" para sempre. Nada de reconexão depois do fim.
result: [pending]

### 6. Navegar para outro site no meio da call encerra a reunião (DA-4)
expected: Com a reunião gravando, navegue a MESMA aba para outro site (ex.: um site qualquer). A reunião passa a "encerrada" e o envio ao Agente fecha a sessão. Contra-prova: recarregar a mesma sala, ou mudar só o ?query da URL, NÃO encerra.
result: [pending]

### 7. As duas telas ao vivo têm a aba AGP
expected: A aba AGP existe tanto no painel injetado dentro do Meet quanto na tela larga da Taqciti (abrir numa aba). Em ambas a transcrição continua rolando normalmente e o painel pequeno não corta a aba.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet]
