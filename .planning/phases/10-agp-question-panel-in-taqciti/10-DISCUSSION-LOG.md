# Phase 10: AGP Question Panel in Taqciti - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 10-AGP Question Panel in Taqciti
**Areas discussed:** Aproveitar o código do Gabriel; O que a aba faz (só mostra ou age); Segurança e custo do WebSocket; Como provar que funciona

**Pré-pergunta (plano existente):** a fase já tinha 1 plano (`10-PLAN.md` do Gabriel). Escolhido "Continuar e replanejar depois" (alternativas: ver o plano antes; cancelar).

---

## Aproveitar o código do Gabriel

### Como a fase trata o código

| Option | Description | Selected |
|--------|-------------|----------|
| Adotar e fechar as lacunas | Código fica; planos só para decisões, correções e validação real | ✓ |
| Só verificar, sem planejar | `/gsd-verify-work 10` com os 7 testes do Gabriel | |
| Refazer pelo nosso fluxo | Replanejar do zero e reescrever onde divergir | |

**User's choice:** Adotar e fechar as lacunas (recomendada).

### Achados herdados (multi-seleção)

| Option | Description | Selected |
|--------|-------------|----------|
| WR-05: Continuar envio vs encerramento | Checar `isClosing` antes de retomar | ✓ |
| Reunião em duas abas | Fechar a 2ª aba não pode encerrar a 1ª | ✓ |
| WR-06: ir para chrome:// | Permissão `tabs` no manifesto | ✓ |
| Dividir o index.ts (>200 linhas) | Refator puro, commit à parte | ✓ |

**User's choice:** os quatro. **Notes:** eu recomendava deixar WR-06 e o `index.ts` de fora; o usuário os incluiu.

### Confirmação do WR-06 (permissão `tabs`)

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, adicionar a permissão 'tabs' | DA-4 vale também em chrome://; quem já instalou reaceita | ✓ |
| Não, só documentar a limitação | Nada muda no manifesto | |
| Decidir depois, com o time | DECISÃO EM ABERTO | |

**User's choice:** Sim. **Notes:** avisado de que o Chrome desativa a extensão em quem já a tem até reaceitar a permissão.

### Documentos velhos

| Option | Description | Selected |
|--------|-------------|----------|
| Marcar como superados | Aviso no topo, sem apagar | ✓ |
| Apagar (git rm) | Remove os 3 arquivos | |
| Deixar como estão | Não mexe | |

**User's choice:** Marcar como superados (recomendada).

---

## O que a aba faz: só mostra ou age

### Ações na aba

| Option | Description | Selected |
|--------|-------------|----------|
| Só mostrar | Como roadmap e código do Gabriel | |
| Mostrar + 'Gerar agora' | Rota nova sob /webhook/extension | |
| Mostrar + gerar, fixar e descartar | Paridade com o site, com evento novo no WebSocket | ✓ |

**User's choice:** Mostrar + gerar, fixar e descartar. **Notes:** fora do roadmap da Fase 10 (TAQ-05 é "mostrar"); aplicada a regra de escopo.

### Onde as ações moram

| Option | Description | Selected |
|--------|-------------|----------|
| Fase 10 em duas partes | 10 só mostra; nova 10.1 entrega as ações | ✓ |
| Tudo na Fase 10 | Emendar roadmap e TAQ-05 | |
| Só as ações mais simples agora | 'Gerar agora' na 10; o resto depois | |

**User's choice:** Fase 10 em duas partes (recomendada).

### Divergência de pin/dismiss até a 10.1

| Option | Description | Selected |
|--------|-------------|----------|
| Aceitar e documentar | Sem código novo | ✓ |
| Aviso discreto na própria aba | Linha 'Fixar e descartar: use o site' | |

**User's choice:** Aceitar e documentar (recomendada).

---

## Segurança e custo do WebSocket

**Fato levantado durante a discussão:** `backend/app/routers/ws.py` aceita comandos do cliente (`generate_questions`, `pin_question`, `dismiss_question`, `use_question`, `finish_session`) sem autenticação, e o web app usa o mesmo endpoint.

### Autenticação

| Option | Description | Selected |
|--------|-------------|----------|
| Aceitar até o login do AGM | Sem mudança no backend; risco de LGPD registrado | ✓ |
| Rota nova só de leitura para a Taqciti | `/ws/extension/{session_id}` com `x-agente-key` opcional | |
| Proteger o /ws atual | Quebraria o web app sem login | |

**User's choice:** Aceitar até o login do AGM (recomendada).

### Quando conectar (WR-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Só gravando e com envio ligado | Fecha em pausa/sem legendas/envio desligado; mantém perguntas na tela | ✓ |
| Vinculada e ao vivo, mesmo pausada | Como está hoje | |
| Só enquanto a aba AGP estiver aberta | Ganho pequeno, contador não sobe | |

**User's choice:** Só gravando e com envio ligado (recomendada).

---

## Como provar que funciona

### Prova com o Gemini sem crédito

| Option | Description | Selected |
|--------|-------------|----------|
| Recarregar o crédito e testar de verdade | Testes 2 e 3 com pergunta real e lente | ✓ |
| Usar o backend falso para a prova | Lacuna aceita na VERIFICATION | |
| Os dois: falso agora, real depois | Etapa 'Depois do crédito' fora do bloqueio | |

**User's choice:** Recarregar o crédito e testar de verdade (recomendada).

### Visual

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, gerar o UI-SPEC antes de planejar | `/gsd-ui-phase 10` | ✓ |
| Não, o visual do Gabriel serve | Conferir a olho nos testes 1 e 7 | |
| Pular agora, auditar depois | Só `/gsd-ui-review 10` | |

**User's choice:** Sim (recomendada).

---

## Claude's Discretion

Nomes de arquivos/funções dos ajustes, textos exatos do painel (dentro do UI-SPEC), forma de testar WR-05 e duas abas, divisão dos planos em ondas e ordem dos commits.

## Deferred Ideas

- Fase 10.1: ações na aba AGP (gerar, fixar, descartar, usar) e evento de pin/dismiss/use no WebSocket.
- Login do AGM / proteção do `/ws`.
- Retirada da geração de PRD.
- Distribuição da Taqciti e comunicação da permissão `tabs`.
