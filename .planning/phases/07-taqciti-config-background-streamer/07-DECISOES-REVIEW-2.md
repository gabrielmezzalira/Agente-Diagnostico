# Fase 7 — Decisões em aberto da 2ª revisão (CR-01 e WR-04)

**Data:** 2026-10-10 · **Branch:** `feat/fase-07-taqciti-config-background-streamer`
**Origem:** `07-REVIEW.md` (iteração 2). Os códigos CR/WR/IN daqui são os **da 2ª revisão** — o `07-REVIEW-DISPOSITION.md`
ainda descreve os da 1ª, que têm os mesmos números e outro significado.

> **Status: DECISÃO EM ABERTO — nada abaixo foi implementado.** Pela regra do `CLAUDE.md`, estes itens mudam contrato
> ou aceitam perda de dado, então só o time decide. A coluna "Recomendação" é do executor e **não vale como decisão**.

## Onde a fase está agora

| Achado | Situação |
|--------|----------|
| WR-01, WR-02 | corrigidos (`ddb856b`, `2d4df95`) |
| WR-03 | corrigido (`9b564d7`) |
| WR-05 | corrigido (`4a31957`) |
| IN-01, IN-04 | corrigidos (`3e4a1dc`) |
| IN-02, IN-03 | corrigidos (`ff970d0`) |
| IN-06 | corrigido (`32864ad`) |
| IN-05 | pendência de **backend** — ver seção 6 |
| **CR-01** | **DECISÃO EM ABERTO** |
| **WR-04** | **DECISÃO EM ABERTO** |

Typecheck, lint e testes: verdes (570/570) depois desses commits.

---

# CR-01 — A reunião do dia seguinte pode ir para a sessão do cliente anterior

## 1. O que muda (em linguagem comum)

Hoje a extensão se protege de mandar uma reunião nova para a sessão errada **comparando com a reunião anterior** — mas
essa "lembrança" mora numa memória que o Chrome apaga ao fechar. O ID da sessão do Agente, ao contrário, fica salvo para
sempre. Resultado: segunda-feira você liga o envio para o cliente A; terça abre o Chrome, entra na reunião do cliente B,
e a fala do B vai para o diagnóstico do A, sem ninguém perguntar nada.

É como um carteiro que só confere o endereço se lembrar da última entrega; se esquece (porque a memória dele é
apagada toda noite), entrega na última caixa que conhece. A mudança é dar ao carteiro um **caderninho que não é
apagado** com "a última reunião que entreguei nesta sessão". Reunião diferente da anotada, ele para e pergunta.

Por que importa: é dado de um cliente aparecendo no relatório de outro (LGPD). O backend não segura isso
(`backend/app/routers/webhook.py:40-44` aceita qualquer `session_id`, até de sessão encerrada).

## 2. Como vai ser alterado (se a opção A for escolhida)

Commits atômicos, nesta ordem:

| # | Commit | Tipo | Arquivos |
|---|--------|------|----------|
| 1 | `test(07): CR-01` teste que falha primeiro | teste | `agenteStreamer.test.ts`, `wordDelta.test.ts` — cursor nulo + `boundMeetingId='M1'` + sessão `M2` ⇒ nada é enviado e aparece a espera |
| 2 | `fix(07): CR-01` campo novo na config | comportamento (**contrato**) | `shared/config/agenteConfig.ts` (`boundMeetingId`, normalização, `DEFAULT`), `agenteConfigStore.ts` (limpar ao trocar `agenteSessionId`) |
| 3 | `fix(07): CR-01` regra de espera com cursor nulo | comportamento | `features/agente/wordDelta.ts` (`planStreamStep`), `background/agenteStreamerInstance.ts` (grava o vínculo no primeiro prime e na confirmação; `applyConfigChange` também confere) |

Só o **id** da reunião é gravado — nunca texto. Nenhum arquivo do backend muda.

## 3. Riscos de cada ação

| Ação | Risco concreto |
|------|----------------|
| Campo novo `boundMeetingId` | Config já salva não tem o campo: precisa assumir "sem vínculo" (e então o primeiro envio é livre, como hoje). Mudar o formato pode quebrar quem lê a config (tela, auto-detect da Fase 8). |
| Esperar com cursor nulo | **Falso positivo:** a pessoa muda de aba/reinicia o Chrome no meio da *mesma* reunião e vê o aviso "reunião nova" sem motivo — ou, pior, fica sem enviar sem perceber. |
| Limpar o vínculo ao trocar o ID da sessão | Esquecer de limpar deixa a regra travada contra a reunião certa da sessão nova. |
| Gravar o vínculo no prime | Gravar cedo demais (antes de enviar algo) trava a reunião se a pessoa só abriu a tela. |

## 4. Como prevenir

- Teste de config antiga (sem o campo) ⇒ comportamento idêntico ao de hoje.
- Teste do falso positivo: mesma reunião, cursor nulo, `boundMeetingId` igual ⇒ **envia normalmente**.
- Teste de troca de `agenteSessionId` ⇒ vínculo zerado e a reunião atual é aceita.
- Gravar o vínculo só no instante do prime/confirmação (já um ponto único), nunca na tela.
- Rodar a extensão de verdade (seção 7, passo 3) antes do merge.

## 5. Como consertar (rollback)

Cada commit é reversível sozinho: `git revert <hash do commit 3>` volta à regra atual; reverter o 2 remove o campo.
Config já gravada com `boundMeetingId` continua válida (o normalizador ignora campo desconhecido), então reverter **não
exige limpar storage**. Se der falso positivo em campo, a saída imediata é a pessoa clicar em "Continuar enviando para
esta sessão" — já existe.

## 6. Decisões que são do usuário/time — **DECISÃO EM ABERTO**

| Opção | O que faz | Prós | Contras |
|-------|-----------|------|---------|
| **A (recomendada pelo executor)** | Guarda a última reunião vinculada em `storage.local`; reunião diferente ⇒ espera e pergunta. | Fecha o buraco nos 3 cenários (fechar o Chrome, atualizar a extensão, desligar/religar). Só guarda um id. | Muda o contrato da config; pode gerar aviso desnecessário. |
| B | Desliga o envio sozinho quando o Chrome abre. | Sem campo novo. | A pessoa que queria continuar tem que religar; não cobre "atualizar a extensão" nem "desligar/religar o toggle". |
| C | Aceitar o risco e documentar no runbook. | Zero código. | Mistura de dados entre clientes (LGPD) segue possível. **A revisão classificou como crítico.** |

Perguntas para o time: (1) qual opção? (2) o aviso deve bloquear até confirmação (como no CR-01 da 1ª revisão) ou só
mostrar o aviso e enviar? A recomendação mantém "bloquear", coerente com a decisão de 2026-09-27.

## 7. Verificação (ponta a ponta)

1. Automático: o teste novo do passo 1 passa; suíte inteira verde.
2. Manual, com o Chrome: ligar o envio na sessão S1 durante a reunião M1 → **fechar o Chrome por completo** → abrir,
   entrar numa reunião M2 → o painel mostra "Reunião nova detectada" e **nada chega** em `transcript_chunks` de S1.
3. Clicar em "Continuar enviando para esta sessão" ⇒ passa a enviar.
4. Repetir na **mesma** reunião M1 (reabrir o Chrome e voltar nela) ⇒ **sem** aviso, envia normal.

---

# WR-04 — Trechos já na fila de reenvio se perdem se o service worker reiniciar

## 1. O que muda (em linguagem comum)

Quando a rede falha, os trechos esperam alguns segundos para tentar de novo, guardados só na memória. O Chrome pode
"adormecer" a extensão nesse intervalo — e aí os trechos somem e a tela fica dizendo "tentando de novo…" para sempre,
sem tentativa nenhuma rodando. É o mesmo tipo de perda que os WR-01/WR-02 da 1ª revisão quiseram eliminar, só que
agora no pedaço entre "saiu da janela" e "foi entregue". Acontece justamente no fim da reunião.

## 2. Como vai ser alterado

**Opção 2-A (guardar a fila):** `agenteStreamerSnapshot.ts` passa a gravar também os trechos não entregues — só
`{ backendUrl, sessionId, text, speaker }`, **nunca** o cabeçalho com a chave. `agenteStreamerInstance.ts` os remonta no
boot com `buildPhraseRequests` e a chave atual, com o mesmo descarte do IN-11. `agenteSender.ts` informa o que ainda
está pendente.
**Opção 2-B (status honesto):** só `resume()` em `agenteStreamerInstance.ts`: se o status restaurado for `retrying`,
grava `failed`.

## 3. Riscos de cada ação

| Ação | Risco concreto |
|------|----------------|
| 2-A: persistir a fila | **Duplicata:** o trecho pode já ter sido entregue quando o service worker morreu; o restore o reenvia, e o backend não tem idempotência (WR-01 da 1ª revisão aceitou esse risco, mas só para retry de rede). Também grava texto de reunião em `storage.session` (já acontece com as falas pendentes). |
| 2-A: gravar a cada envio | Mais escritas no storage durante a reunião (custo que o D-09 quer evitar). |
| 2-B: marcar `failed` | A perda continua; só a mensagem deixa de mentir. |

## 4. Como prevenir

2-A: gravar o snapshot **depois** da confirmação de entrega (remove o trecho entregue) e teste "entregue ⇒ não volta";
medir escritas no teste do D-09. 2-B: teste do boot com status `retrying` ⇒ vira `failed`.

## 5. Como consertar (rollback)

Cada opção é um commit só: `git revert` volta ao comportamento atual. Não há dado a migrar: o snapshot fica em
`storage.session` e some ao fechar o Chrome.

## 6. Decisões que são do usuário/time — **DECISÃO EM ABERTO**

| Opção | Recomendação do executor |
|-------|--------------------------|
| **2-B primeiro** (aceitar a perda, status honesto) | **Recomendada agora:** pequena, não cria risco de duplicata e acaba com a mentira na tela. |
| 2-A (persistir a fila) | Só se o time quiser garantir entrega no fim da reunião; custa complexidade e aceita duplicata. Faz mais sentido depois de medir quanto se perde na prática. |

Seja qual for a escolha, **registrar a decisão no plano** (a revisão pede isso).

## 7. Verificação (ponta a ponta)

1. Automático: teste do boot com status `retrying` (2-B) ou "fila restaurada e entregue uma única vez" (2-A).
2. Manual: derrubar o backend, falar, **forçar a parada do service worker** em `chrome://serviceworker-internals`,
   reabrir o painel ⇒ a tela não fica em "tentando de novo…" sem tentativa (2-B) / o trecho chega ao subir o backend (2-A).

---

# IN-05 — Sessão inexistente vira HTTP 500 no backend (pendência de backend)

A revisão afirma que um `session_id` com formato de UUID válido mas inexistente "provavelmente" quebra a chave
estrangeira e volta 500, que o cliente trata como falha temporária (4 envios) e mostra uma mensagem enganosa. **Isso não
foi confirmado** — falta reproduzir contra o backend. A correção (responder **404** para sessão desconhecida em
`backend/app/routers/webhook.py`) muda contrato de API, então é **DECISÃO EM ABERTO** do time e vai para uma task de
backend, **fora** da branch da Fase 7. Do lado da extensão, nada a mudar.

---

# Ordem sugerida para fechar a Fase 7

1. Time decide CR-01 e WR-04 (seções 6 acima).
2. Implementar a decisão (commits atômicos, seção 2), cada um com teste.
3. Rodar `typecheck`, `lint` e `test`; fazer o passo manual do CR-01 com o Chrome.
4. Atualizar `07-REVIEW-FIX.md` e `07-REVIEW-DISPOSITION.md` com a disposição desta 2ª revisão.
5. `/gsd-code-review --fix` → PR → merge na `main`. Só então cortar a branch da Fase 8.
