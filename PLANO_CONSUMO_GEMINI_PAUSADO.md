# Plano — Não chamar o Gemini quando não chegou fala nova (TaqCITi pausada ou em silêncio)

> Este plano segue o template obrigatório do `CLAUDE.md` ("Regras de Planejamento de Tasks"):
> as sete seções — linguagem comum, como, riscos, prevenção, conserto, decisões do time, verificação.

**Origem:** durante o UAT da Fase 10 (2026-10-31), com a TaqCITi **pausada**, o usuário observou que o
Agente continuava consumindo IA. Registrado em `.planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md`
(seção "Deferred Follow-Ups", item de prioridade de custo).

**Estado deste plano:** **em execução desde 2026-11-17.** As decisões 1 a 4 da seção 6 foram tomadas em 2026-10-31.
Em 2026-11-17 o usuário mandou executar o conserto já, sem esperar o merge da Fase 10: o trabalho vai na branch
`fix/consumo-gemini-sem-fala-nova`, cortada da `main` (commit `5944748`) **antes** do merge da Fase 10. Isso é seguro
porque `backend/app/services/pipeline.py` é idêntico na `main` e em `feat/fase-10-agp-integracao`
(`git diff main feat/fase-10-agp-integracao -- backend/app/services/pipeline.py` vazio), então não há conflito.
As Ações 1 a 3 são feitas nesta branch; a Ação 0 (medição manual antes/depois) fica para os testes manuais no fim.
Seguem em aberto o item 5 (sinal explícito de pausa, não bloqueia) e o item 6 (a verificar pelo usuário).

**O que está provado e o que não está:**
- **Provado (leitura do código, `backend/app/services/pipeline.py`):** `_coverage_task` (a cada 30 s) e
  `_red_flag_task` (a cada 15 s) só checam `if not self.state.transcript_chunks` — ou seja, "já houve **alguma**
  fala na sessão". Não checam se chegou fala **nova** desde a última análise. Pausada a captura, o backend repete a
  análise da mesma transcrição.
- **Relato do usuário:** o consumo continua com a TaqCITi pausada.
- **NÃO provado:** a frequência real das chamadas. Os contadores do banco (red flags, snapshots de cobertura) não
  servem de prova: red flag repetido é descartado antes de gravar e a cobertura só grava quando o score sobe. Por
  isso a Ação 0 abaixo mede antes de mexer.

---

## 1. O que muda (em linguagem comum)

Hoje o Agente é como um **vigia que confere a mesma folha de papel a cada 15 segundos**, mesmo quando ninguém
escreveu nada de novo nela. Cada conferência é paga (é uma chamada ao Gemini). Se a pessoa pausa a gravação para
tomar um café, o vigia continua conferindo a mesma folha, gastando dinheiro sem descobrir nada novo.

Depois desta mudança, o vigia só confere **se a folha mudou** desde a última vez. Folha igual = não chama o Gemini.
Quando a fala volta, a análise volta sozinha no próximo ciclo (até 15 s para os alertas e até 30 s para a cobertura).

O que **não** muda:
- gerar perguntas continua manual (botão "Gerar" do site), sem relação com esta regra;
- o botão de forçar classificação continua funcionando mesmo sem fala nova;
- nada muda na tela, no contrato da API nem nos eventos WebSocket.

Esperamos economizar toda a chamada que hoje é repetida durante pausas e silêncios.

---

## 2. Como vai ser alterado

**Ação 0 — Medir antes (sem código).**
Abrir a página da sessão no site (a barra de custo atualiza sozinha), falar por 1 minuto, **pausar a TaqCITi por 2
minutos** e anotar se o custo continua subindo. Repetir depois do conserto (seção 7). É a prova do "antes e depois".
*Medição parcial já feita (UAT da Fase 10, 2026-10-31):* com a TaqCITi pausada, o usuário viu o custo da sessão subir de
US$ 0,001 para US$ 0,007 em poucos segundos. A confirmação do problema veio daí; ainda faltam a duração exata e as
leituras inicial e final para servirem de "antes" na comparação.

**Ação 1 — Commit 1: o conserto (muda comportamento).**
Arquivo: `backend/app/services/pipeline.py`, classe `SessionPipeline`.
1. No `__init__`, dois marcadores simples: `_coverage_seen_chunks = 0` e `_red_flag_seen_chunks = 0` (quantas falas já
   foram analisadas por cada tarefa). Ficam no pipeline, não no `SessionState`, porque são detalhe da cadência.
2. Em `_coverage_task` e `_red_flag_task`, além das checagens atuais, pular o ciclo se
   `len(self.state.transcript_chunks) <= marcador`. Quando decide rodar, atualiza o marcador para o total atual.
3. **Não** mexer em `_run_coverage_classifier` nem em `_run_red_flag_detector`: o caminho manual
   (`force_classify` em `routers/ws.py`) chama o classificador direto e continua rodando sem fala nova.
Mudança pequena (cerca de 10 linhas), um único arquivo.

**Ação 2 — Commit 2: teste.**
Arquivo novo `backend/tests/test_pipeline_idle_gating.py`, seguindo o padrão de `test_two_agent_lens.py`
(`SessionState` + `SessionPipeline` + `monkeypatch` no `llm_service`). Justificativa para arquivo novo: nenhum teste
existente cobre a cadência dos laços (os existentes cobrem lentes, encerramento e idempotência). Casos:
1. sem fala nova, o laço **não** chama o LLM (contar as chamadas do falso);
2. uma fala nova, o laço chama **exatamente uma vez** e, no ciclo seguinte sem fala, não chama;
3. `force_classify` (classificador direto) roda mesmo sem fala nova;
4. sessão com falas já existentes na primeira rodada roda **uma** vez (marcador começa em 0).
Para não esperar 15/30 s de verdade, o teste troca o `asyncio.sleep` do módulo por um falso.

**Ação 3 — Commit 3: documentação (só se o time aprovar a mudança).**
`CLAUDE.md` (o SDD), tabela da seção 2.2: "A cada 15s (timer fixo)" e "A cada 30s ou 250 tokens novos" passam a dizer
"…**e só se houver fala nova**". Commit separado, para poder reverter só a doc.

**Ordem:** 0 → 1 → 2 → (rodar a suíte do backend) → 3. Cada commit reverte sozinho.
**Regra de conduta:** commit 1 é mudança de comportamento; não vai junto com nenhum refator.
**Onde fica:** não é uma fase do roadmap. Branch `fix/consumo-gemini-sem-fala-nova`, cortada da `main` (commit
`5944748`) em 2026-11-17, **antes** do merge da Fase 10, por ordem do usuário: `pipeline.py` é idêntico na `main` e em
`feat/fase-10-agp-integracao`, então não há conflito (não misturar com `feat/fase-10-agp-integracao`).

---

## 3. Riscos de cada ação

| Ação | Risco concreto |
|------|----------------|
| 0 — Medir | Gasta centavos de Gemini; gravar dados de teste no Supabase de produção. Sem risco de código. |
| 1 — Conserto | (a) **Alertas e cobertura pararem de atualizar** quando ainda deviam, se o total de falas não crescer em algum caso. (b) Fala que chega **durante** uma análise em andamento ficar sem análise até a próxima fala. (c) Sessão recriada a partir do banco rodar uma análise a mais na primeira rodada. (d) Uma chamada que falhe (cota, chave) não ser repetida até haver fala nova, escondendo o erro por mais tempo. |
| 2 — Teste | Teste depender de tempo real e ficar lento ou instável; teste que passa mas não exercita o laço de verdade. |
| 3 — Doc | Documento dizer algo que o time não aprovou. |

---

## 4. Como prevenir

| Risco | Prevenção |
|-------|-----------|
| (a) Parar de atualizar | `push_chunk` só descarta duplicata exata; qualquer outra fala é acrescentada e aumenta o total. O teste 2 prova "uma fala nova → uma chamada". Na verificação manual, falar de novo e conferir que o alerta/cobertura volta. |
| (b) Fala durante a análise | Atualizar o marcador **antes** da chamada ao Gemini: falas que chegam durante a chamada já contam como "novas" no ciclo seguinte. |
| (c) Primeira rodada a mais | Aceitável (uma chamada). Conferir no código de `get_or_create` se a transcrição é recarregada; se for, documentar. |
| (d) Erro escondido | Decisão do time (seção 6, item 3). Como padrão, o marcador avança antes da chamada para evitar tempestade de chamadas pagas que falham. |
| Teste lento ou falso | Trocar `asyncio.sleep` por um falso no módulo; contar chamadas do LLM falso; ver o teste **falhar** antes do conserto (rodar o teste contra o código antigo). |
| Doc não aprovada | Commit 3 só depois da resposta do time (item 1 da seção 6). |

---

## 5. Como consertar (plano de rollback)

- **Conserto quebrou o comportamento:** `git revert <commit 1>`. Volta ao laço antigo (gasta mais, mas funciona como
  hoje). Reiniciar o backend.
- **Só o teste atrapalha:** `git revert <commit 2>`; o conserto continua.
- **Só a doc está errada:** `git revert <commit 3>`.
- Nenhuma migration, nenhum dado e nenhuma configuração mudam, então não há nada além do código para restaurar.
- Se produção já tiver o conserto e os alertas parecerem "mudos", reverter o commit 1 é a saída de emergência
  (um comando, um arquivo).

---

## 6. Decisões que são do usuário/time

**Decididas pelo usuário em 2026-10-31 (itens 1 a 4; o item 4 foi revisto em 2026-11-17). Continuam EM ABERTO os
itens 5 e 6; o item 5 não bloqueia o conserto. Em 2026-11-17 o usuário mandou executar já, antes do merge da Fase 10
(ver item 4).**

1. **[DECIDIDO: aprovado] Mudar o desenho do SDD?** O SDD define o red flag como "timer fixo de 15s" e a cobertura como "a cada 30s ou
   250 tokens novos". Passar a exigir "fala nova" altera essa regra. Aprovar ou não, e quem aprova.
2. **[DECIDIDO: Opção A, qualquer fala nova] O que conta como "fala nova"?** Opção A (proposta): qualquer fala nova desde a última análise. Opção B: um
   mínimo de texto novo (por exemplo, o "250 tokens novos" do SDD). A B economiza mais, mas pode atrasar alertas.
3. **[DECIDIDO: avançar o marcador antes da chamada, não repetir até haver fala nova] Chamada que falha:** avançar o marcador antes da chamada (não repete a chamada paga que falhou; padrão proposto)
   ou só depois do sucesso (repete até acertar, mas pode gastar à toa quando a cota acabou).
4. **[DECIDIDO em 2026-10-31: branch `fix/consumo-gemini-sem-fala-nova` cortada da `main` depois do merge da Fase 10.
   REVISTO em 2026-11-17: o usuário mandou executar já, com a branch cortada da `main` (commit `5944748`) antes do merge
   da Fase 10, porque `backend/app/services/pipeline.py` é idêntico na `main` e em `feat/fase-10-agp-integracao` e
   não há conflito] Onde entra esse trabalho:** branch `fix/…` fora do roadmap ou uma fase nova? E depois de quê (Fase 10 mergeada
   na `main`, conforme a regra de branch por fase)?
5. **Pausa explícita:** hoje a TaqCITi não avisa "pausei" ao backend; o plano usa "não chegou fala" como sinal.
   Se o time quiser um sinal explícito de pausa (evento novo), isso é mudança de contrato e outra tarefa.
6. **[A VERIFICAR PELO USUÁRIO] Lembrete de deploy:** o usuário acredita que já criou a `GEMINI_API_KEY` no Railway;
   conferir antes de qualquer merge ou deploy (ver memória do projeto).

---

## 7. Verificação (ponta a ponta)

**Automática (semente de teste):** `test_pipeline_idle_gating.py` com os 4 casos da Ação 2, e a suíte do backend
inteira passando (`cd backend && python -m pytest`). Conferir que o caso 1 **falha no código antigo**.

**Manual, antes e depois (a mesma sequência nas duas vezes):**
1. Subir backend e site; fazer uma reunião vinculada a um cliente `ZZ-TESTE-…` e abrir a sessão no site (barra de
   custo visível).
2. Falar 1 minuto. Anotar o custo.
3. **Pausar** a TaqCITi por 2 minutos sem falar. Anotar o custo no fim.
4. Retomar e falar de novo. Conferir que cobertura e alertas voltam a atualizar em até 30 s.

**Resultado esperado:**
- **Antes do conserto:** o custo continua subindo durante a pausa (confirma o problema).
- **Depois do conserto:** o custo fica **parado** durante a pausa e volta a subir depois que a fala retorna.
- O botão "Forçar classificação" continua funcionando com a TaqCITi pausada.
- Apagar os dados de teste no fim (sessões primeiro, cliente depois).
