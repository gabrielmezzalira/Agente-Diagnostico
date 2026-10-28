# Plano de fechamento da Fase 9 — merge sem conflito irresolvível, segurança, qualidade e testes

**Escrito em:** 2026-10-28 · **Branch:** `feat/fase-09-cutover-retire-custom-extension`
**Status:** PLANO. Nada abaixo foi executado, e nenhum item marcado DECISÃO EM ABERTO pode ser feito sem o time.
**Regra do pedido do usuário:** os testes MANUAIS ficam separados em `TESTES-MANUAIS-POS-FASE-10.md` e só rodam depois que a chave do Gemini voltar e depois que a Fase 10 terminar. Aqui entram só os testes de código.

---

## 0. O que foi levantado (só leitura, em 2026-10-28)

### Git

| Fato | Valor | Como foi medido |
|------|-------|-----------------|
| Remoto | `origin` = `gabrielmezzalira/Agente-Diagnostico`; `origin/HEAD` aponta para `origin/main` | `git remote -v` |
| `main` local vs `origin/main` | 196 à frente, 0 atrás (nada foi empurrado) | `git rev-list --left-right --count` |
| Fase 9 vs `main` local | 12 commits à frente; **merge de teste limpo** | `git merge-tree --write-tree` |
| **`origin/master` (de onde sai o deploy) vs `main`** | **`main` tem 462 commits que a `master` não tem; a `master` tem 109 que a `main` não tem.** Ancestral comum: `bb1aac0` (24/09, PR #5, Fase 5) | idem |
| **Merge de teste `main` ← `origin/master`** | **46 arquivos em conflito** | `git merge-tree --write-tree --name-only` |
| O que só a `master` tem | redesign de UI (48 arquivos em `frontend/src`), vínculo DocuData, e uma **cópia** da pasta `taqciti/` tirada em 15/10 ("estado da main" de então) | `git log main..origin/master` |
| Branch remota `origin/feat/fase-10-agp-question-panel` | 13 commits que a `main` não tem (12/10: adaptador do WebSocket do navegador, teste de fumaça do painel AGP, roteiro de UAT da fase 10). **Não foi inspecionada a fundo.** | `git log` |
| Outras branches remotas | `feat/redesign-ui-citi`, `feat/integracao-docudata`, `feat/precificador` | `git branch -a` |

Os 46 conflitos, agrupados:
- **~35 em `taqciti/`**: a `master` e a `main` adicionaram os mesmos arquivos de formas diferentes. A `master` tem a foto de 15/10; a `main` tem as Fases 7 e 8 (até 26/10).
- **5 em `.planning/`** (`ROADMAP`, `STATE`, `REQUIREMENTS`, `state.json`, um `.gitignore`).
- **2 em `backend/app/routers/`** (`projects.py`, `webhook.py`).
- **2 em `frontend/src/pages/`** (`ProjectDetailPage.tsx`, `ProjectFormPage.tsx`).

### Segurança e qualidade (achados verificados no código)

| # | Achado | Evidência | Gravidade |
|---|--------|-----------|-----------|
| S1 | `/webhook/extension*` aceita qualquer chamador enquanto `EXTENSION_SHARED_KEY` estiver vazia (D-08, T-08-10, aceito pelo time só até o login do AGM) | `backend/app/routers/webhook.py:24-26` | média |
| S2 | `/ws/{session_id}` não tem autenticação; conectar numa sessão cria o pipeline de IA, ou seja, gasto de crédito | `backend/app/routers/ws.py` (nenhuma checagem de chave/token) + HANDOFF §4.1 | média |
| S3 | CORS com `allow_origins=["*"]` (sem credenciais), combinado com S1 e S2: qualquer página web pode chamar a API | `backend/app/main.py:49-50` | baixa/média |
| S4 | Arquivos `.env` estão no `.gitignore` e nenhum está versionado | `.gitignore:2-4`, `git ls-files` | OK |
| S5 | A chave Gemini por projeto fica no banco; o `CLAUDE.md` manda usar Supabase Vault. **Não verificado se está cifrada.** | CLAUDE.md §8 | a verificar |
| S6 | Transcrições de reunião (nomes de falantes, falas de clientes) ficam no banco de produção: é dado pessoal sob a LGPD. **Sem RIPD conhecido.** | `transcript_chunks` | a verificar |
| S7 | Testes manuais e a prova da Fase 9 gravam no banco de **produção** | UAT teste 1 | média (processo) |
| Q1 | 29 blocos `except Exception` em 10 arquivos (10 só em `pipeline.py`). **Na prova, o Gemini devolveu 402 e a interface não mostrou erro nenhum**; só o log do backend revelou. | grep + log da prova | alta (observabilidade) |
| Q2 | Cobertura de testes desigual: backend 28 arquivos, Taqciti 90, **frontend só 3** | `git ls-files` | média |
| Q3 | `pipeline.py` acessa o Supabase direto (backlog B-007 / WR-03), contra a regra "services não falam com o banco" | HANDOFF / backlog | média (dívida) |
| Q4 | 22 achados do `08-REVIEW` em aberto (WR-01, 03, 06, 07 adiados por decisão do time) | `08-REVIEW-DISPOSITION.md` | variável |

---

## DECISÕES DO USUÁRIO (2026-10-28) — prevalecem sobre o texto abaixo

1. **Ordem de integração escolhida:** (1) pegar o conteúdo da `master` numa branch separada, (2) analisar, (3) mergear com as alterações que estamos fazendo (Fase 9 + `main`), (4) só então levar o resultado para a `main`, (5) por fim passar para a `master`. Isto **substitui** a Etapa 1 proposta abaixo (Fase 9 → `main` antes de tudo): a `main` só recebe o resultado já integrado.
2. **Branch de integração criada** (só a referência, sem push): `chore/integra-master-e-main`, apontando para `origin/master` (`2e67c7c`). O vínculo automático com a `origin/master` foi **removido** de propósito, para um `git push` sem argumento nunca mandar nada para a `master`.
3. **Análise do conteúdo da `master`:** em andamento, só leitura; resultado em `.planning/INTEGRACAO-MASTER-ANALISE.md`.
4. **Dados de teste:** o projeto `visus` e as suas 10 sessões foram apagados do banco (autorizado pelo usuário). O `ZZ-TESTE-D20…` e a sessão da prova SC1 continuam, aguardando decisão.
5. **Página `/extension`:** sem link de download por enquanto; a forma de distribuir a Taqciti fica para depois do deploy.

### RESULTADO DA ANÁLISE DA `master` (2026-10-28) — muda o risco da Task A

Detalhes em `.planning/INTEGRACAO-MASTER-ANALISE.md`. Conferido de forma independente (comandos `git` de leitura, refeitos pelo orquestrador, não só pelo analista):

- **A `master` não tem nada que o nosso lado não tenha.** Arquivos mudados só na `master`: **0**. Nos 45 arquivos de código em que ela difere do nosso lado, a versão dela já existe no histórico do nosso lado (**0 conteúdos únicos**). A `taqciti/` dela é byte a byte a ponta da Fase 7 (árvore `cc5dec8…`) e não tem os arquivos da Fase 8 (`agenteStreamDestination.ts`, `association.ts`).
- O redesign de UI e o vínculo DocuData (`feat/redesign-ui-citi`, `feat/integracao-docudata`) já estão no nosso lado; da branch do redesign sobra só 1 commit de documentação (`6ddb089`).
- **Consequência:** os 46 conflitos **não são resolvidos um a um**. A integração vira "registrar a história da `master` como ancestral e terminar com a árvore **exatamente igual à nossa**". Os passos A4 (triagem por arquivo) e a resolução manual de A5 **deixam de ser necessários**; no lugar entra a conferência `git diff <nosso lado> <branch de integração>` = vazio.
- **Armadilha comprovada:** o merge com `-X ours` deixa `verify_extension_key` duplicada em `webhook.py`. Por isso o método é criar o commit de merge com a árvore do nosso lado (`git commit-tree`), e não resolver conflito.
- A conferência vale enquanto a `master` continuar em `2e67c7c`; se alguém empurrar algo nela, refazer.
- **Fase 10:** a branch remota `origin/feat/fase-10-agp-question-panel` (13 commits de 12/10, só em `taqciti/` e `.planning/`) **já tem a aba AGP** (WebSocket `/ws/{session_id}`, 15 arquivos novos quase todos com teste). Foi cortada de uma Fase 8 mais antiga que a nossa; 1 conflito de texto (`associationClose.ts`); o UAT de 7 testes dela **nunca foi executado**. Pelo `CLAUDE.md` ela entra em branch/PR próprio **depois** da Fase 9.
- **Não verificado:** nenhuma suíte foi executada; se a migration `chunk_id` (`20261011000000`) já está aplicada em produção; se o backend emite `question_expired`.

Passos A0 a A7 abaixo seguem valendo, **com esta correção de ordem**: A2 (PR da Fase 9 para a `main`) só acontece **depois** de A5 (merge na branch de integração) e A6 (suítes verdes). O merge de A5 é `feat/fase-09…` → `chore/integra-master-e-main` (e não `main` → `master`); depois a branch de integração vai para a `main` por PR, e a `main` para a `master`.

## TASK A — Integrar a Fase 9 na `main` e a `main` na `master` sem conflito irresolvível

### 1. O que muda (em linguagem comum)

Hoje existem **duas versões do projeto andando em paralelo**: a `main` (com as Fases 6 a 9, só no seu computador) e a `master` (de onde o site sai, com o redesign de telas e uma cópia mais antiga da Taqciti). É como duas pessoas editando o mesmo documento em cópias separadas por um mês. Juntar as duas de uma vez dá 46 pontos em que as cópias discordam. Este plano junta em **duas etapas pequenas**, ensaiando antes e com um jeito de desfazer em cada uma, para nunca ficar preso no meio.

Etapa 1 (fácil, sem conflito): levar a Fase 9 para a `main`.
Etapa 2 (a difícil): levar a `main` para a `master`, numa branch de integração separada, resolvendo arquivo por arquivo.

### 2. Como vai ser alterado

Ordem, em passos reversíveis (ninguém faz `push --force`):

| # | Passo | Natureza |
|---|-------|----------|
| A0 | **Cópias de segurança:** `git tag backup/main-2026-10-28 main` e `git tag backup/master-2026-10-28 origin/master`. Empurrar as tags só com o OK do time. | só segurança |
| A1 | Terminar a Fase 9 (09-04 a 09-07), `code-review`, verificação. Tudo na branch da fase. | código |
| A2 | PR `feat/fase-09…` → `main` (merge de teste já provou que é limpo). | merge |
| A3 | **Inspecionar `origin/feat/fase-10-agp-question-panel`** (13 commits de 12/10) e decidir se reaproveita ou ignora, ANTES de abrir a Fase 10. | só leitura |
| A4 | **Triagem dos 46 conflitos, só leitura:** para cada arquivo, anotar numa tabela quem vence (`main`, `master` ou mistura) e por quê. Regra de partida: `taqciti/` e `.planning/` = `main` (mais novo); `backend/` = mesclar à mão; `frontend/` = mesclar à mão preservando o redesign da `master` e a lógica da `main`. | só leitura |
| A5 | Criar `chore/integra-main-na-master` **a partir da `origin/master`**, rodar `git merge main` nela e resolver conforme a tabela do A4. Nunca resolver direto na `master` nem na `main`. | merge |
| A6 | Depois de cada grupo resolvido, rodar as suítes (Task C) antes de seguir para o próximo. | teste |
| A7 | PR da branch de integração → `master`. Só então deploy. | merge |

### 3. Riscos de cada ação

- **A0:** esquecer a tag e não ter como voltar.
- **A2:** abrir PR com o merge de teste desatualizado (alguém empurra na `main` do remoto no meio).
- **A3:** reescrever trabalho que já existe pronto (ou ignorar algo útil).
- **A4:** classificar errado um arquivo e perder lógica de negócio (ex.: o gate de aprovação do PRD, ou o `chunk_id` da Taqciti).
- **A5:** a `taqciti/` da `master` é uma foto antiga; escolher o lado errado derruba as Fases 7 e 8 (envio, vínculo, encerramento). `webhook.py` e `projects.py` mexem no contrato que a Taqciti usa. Redesign de UI pode apagar a lógica da Fase 5 (lentes) em `ProjectDetailPage.tsx`.
- **A6:** suíte verde que não cobre a tela redesenhada (frontend tem 3 testes).
- **A7:** deploy automático da `master` (Railway/Vercel) com `GEMINI_API_KEY` ainda inexistente no Railway: IA e importação de PDF quebram em produção.

### 4. Como prevenir

- **A0:** tags criadas antes de qualquer merge; conferir com `git tag -l 'backup/*'`.
- **A2:** rodar `git merge-tree --write-tree main HEAD` de novo na hora de abrir o PR; PR em vez de merge local.
- **A3:** `git log -p` da branch remota e uma lista do que ela muda, antes de decidir.
- **A4:** a tabela de triagem é revisada pelo time **antes** de qualquer merge real; para `webhook.py` e `projects.py`, comparar o diff das duas versões linha a linha.
- **A5:** `taqciti/` fica com a versão da `main` (confirmar com `git diff` que ela contém as Fases 7 e 8: `agenteStreamer.ts`, `agenteStreamDestination.ts`, `association.ts`); merge só em branch descartável; `git merge --no-commit` para revisar antes de commitar.
- **A6:** suítes do backend, do frontend e da Taqciti + `tsc` + lint + build, depois de **cada** grupo de arquivos.
- **A7:** checklist "Depois do deploy" do `09-UAT.md` (itens 1 a 7) como pré-requisito; deploy só com o time presente.

### 5. Como consertar (plano de rollback)

- Conflito que não sai: `git merge --abort` (antes do commit) ou `git reset --hard backup/...` **na branch de integração descartável** (nunca na `main`/`master`).
- Merge ruim já commitado na branch de integração: apagar a branch e recriar da `origin/master`; nada foi tocado na `master`.
- PR já mergeado com problema: `git revert -m 1 <merge>` num commit à parte; a tag `backup/master-…` guarda o estado anterior.
- Deploy quebrado: voltar o deploy anterior no Railway/Vercel e reverter o merge.

### 6. Decisões que são do usuário/time

- **DECISÃO EM ABERTO:** a `master` é mesmo a branch de deploy, e o redesign dela é o oficial? (O HANDOFF diz "o deploy sai da master", mas a `origin/HEAD` aponta para `main`.)
- **DECISÃO EM ABERTO:** `taqciti/` da `master` (foto de 15/10) pode ser descartada em favor da `main`?
- **DECISÃO EM ABERTO:** o que fazer com `origin/feat/fase-10-agp-question-panel`: aproveitar, descartar ou usar como referência?
- **DECISÃO EM ABERTO:** quando fazer push (a `main` está 196 commits à frente, e nada foi enviado). Push é publicar: fica em cache/histórico mesmo se apagado.
- **DECISÃO EM ABERTO:** alguém mais está mexendo na `master`/`main` remotas hoje? (o autor dos commits da `master` é outra conta)

### 7. Verificação (ponta a ponta)

- `git merge-tree --write-tree` da branch de integração contra a `master` devolve exit 0.
- Suítes de backend, frontend e Taqciti verdes na branch de integração; `npm run build` do frontend e da Taqciti passam.
- Os 4 blobs da Fase 8 de `taqciti/` (`agenteConfig.ts`, `agenteStreamer.ts`, `agenteStreamDestination.ts`, `association.ts`) idênticos entre a branch de integração e `main:taqciti/`.
- Semente de teste: o teste do contrato `/webhook/extension` (`backend/tests/test_extension_chunk_extra_fields.py`, do 09-01) continua verde depois do merge.

---

## TASK B — Revisão de segurança e de qualidade da aplicação

### 1. O que muda (em linguagem comum)

É uma **inspeção** antes de abrir o prédio ao público. Ninguém mexe em código nesta task: ela só produz uma lista priorizada do que consertar, com o que pode esperar. Os achados S1 a S7 e Q1 a Q4 acima são o ponto de partida.

### 2. Como vai ser alterado

Só leitura e relatórios, em ordem:
1. `/gsd-secure-phase 9`: confere as ameaças do plano da Fase 9 (T-09-xx) contra o código.
2. `/seguranca`: varredura estática (código, dependências vulneráveis, licenças, segredos), com OWASP 2025.
3. `/secdados`: LGPD/ANPD sobre transcrições, chaves e retenção (S5, S6). Gera rascunho de RIPD se for o caso.
4. `/gsd-code-review 9` (revisão da fase) e triagem dos 22 achados do `08-REVIEW`.
5. Um relatório único `FECHAMENTO-SEGURANCA-QUALIDADE.md`, com cada achado: gravidade, "bloqueia o deploy?" e quem decide.

### 3. Riscos de cada ação

- 1 a 3: relatório alarmista (falso positivo) que gera trabalho sem valor; ou o contrário, a varredura passar por cima de S2 (WebSocket) por ser contrato, não código.
- 3: a skill ler dado pessoal real do banco.
- 4: misturar correção crítica com refator no mesmo commit (regra do `CLAUDE.md`).
- 5: virar uma lista tão longa que ninguém prioriza.

### 4. Como prevenir

- Cada achado exige evidência (arquivo e linha, ou saída do log); sem evidência, vira "a verificar", como S5 e S6.
- A `/secdados` só audita o repositório e os esquemas, **sem ler linhas** de `transcript_chunks`.
- Correções saem em commits à parte do refator; achados de segurança que bloqueiam o deploy ficam separados dos que podem esperar.
- O relatório marca no máximo 5 itens como "bloqueia o deploy".

### 5. Como consertar (plano de rollback)

Só gera documentos: se algo vier errado, apagar o relatório. As correções que saírem dele têm cada uma o seu próprio `git revert`.

### 6. Decisões que são do usuário/time

- **DECISÃO EM ABERTO:** fechar S1 (ativar `EXTENSION_SHARED_KEY` no Railway) e S2 (autenticar o WebSocket, decisão 10-A, que muda contrato de API) **antes** ou **depois** do deploy.
- **DECISÃO EM ABERTO:** S3, restringir CORS para as origens reais.
- **DECISÃO EM ABERTO:** Q1, fazer o pipeline avisar a interface quando o Gemini falha (muda comportamento do produto, não é refator).
- **DECISÃO EM ABERTO:** por quanto tempo guardar transcrições (S6).
- **DECISÃO EM ABERTO:** testes de ponta a ponta passam a usar banco separado de produção (S7)?

### 7. Verificação (ponta a ponta)

O `FECHAMENTO-SEGURANCA-QUALIDADE.md` existe, cada item tem evidência ou está marcado "a verificar", e o time marcou o que bloqueia o deploy.

---

## TASK C — Testes de código a fazer

### 1. O que muda (em linguagem comum)

Hoje o código tem testes (backend 28 arquivos, Taqciti 90, frontend 3), mas o frontend quase não tem rede de proteção, e as duas coisas que mais mudam agora (a página `/extension` e a retirada do PRD) mexem justamente nele. Esta task define **quais testes automáticos** rodar e quais escrever.

### 2. Como vai ser alterado

**Rodar (já existem):**

| Suíte | Quando |
|-------|--------|
| Backend completo (`pytest`) | 09-05 (depois de remover `extension/`) e a cada grupo da Task A |
| Frontend (`vitest`) + `tsc` + lint + build | 09-04 e 09-05 |
| Taqciti (`vitest`) + typecheck + lint + build | 09-05 e Task A |

**Escrever (sementes, uma por mudança):**

| # | Teste | Onde | Por quê |
|---|-------|------|---------|
| T1 | Dados da página `/extension` (`taqcitiInstall.test.ts`) | `frontend/src/lib/` | já previsto no 09-04 |
| T2 | O contrato `/webhook/extension`, `ExtensionChunk` e `source=extension` continuam válidos | `backend/tests/` | semente SC3 do 09-01, rodar de novo depois de remover `extension/` |
| T3 | `/webhook/extension*` com e sem `EXTENSION_SHARED_KEY`: 202 sem chave configurada, 401 com chave errada | `backend/tests/` | cobre S1 e o modo D-08 |
| T4 | `/ws/{session_id}`: sessão encerrada fecha com 4004 | `backend/tests/` | o painel da Fase 10 depende disso |
| T5 | Falha do Gemini (402) **não** some em silêncio: pelo menos um evento `error` ou um log estruturado | `backend/tests/` | cobre Q1; **só depois da DECISÃO sobre Q1** |
| T6 | Retirada do PRD: a tela do projeto não mostra "Gerar PRD" e a rota de relatório de discovery responde como decidido | `frontend/src/`, `backend/tests/` | **só depois da DECISÃO esconder/remover** |
| T7 | Merge de integração: os 4 blobs da Fase 8 da Taqciti não regridem | script na Task A | cobre o risco A5 |

### 3. Riscos de cada ação

- Rodar as suítes dentro do ambiente com pouca memória (o sistema já encerrou o backend em segundo plano): a máquina travar.
- T3/T4: os testes tocarem o Supabase de produção.
- T5/T6: escrever teste de um comportamento que o time ainda não decidiu (teste que consagra o que vai mudar).
- Estender um teste grande demais (o `test_extension_clients.py` tem 520 linhas) e estourar a regra de 200 linhas por arquivo.

### 4. Como prevenir

- Rodar uma suíte por vez, nunca as três em paralelo; fechar o resto antes.
- Os testes novos usam doubles do repositório, sem Supabase real.
- T5 e T6 só nascem **depois** da decisão do item 6 da Task B e da escolha esconder/remover.
- Estender testes pequenos (como foi feito no 09-01) em vez de inchar os grandes.

### 5. Como consertar (plano de rollback)

Cada teste novo é um commit à parte; teste que falha por razão errada: `git revert` do commit. Suíte vermelha por regressão real: parar a Task A, voltar à última branch verde.

### 6. Decisões que são do usuário/time

- **DECISÃO EM ABERTO:** esconder ou remover o PRD (decide o T6).
- **DECISÃO EM ABERTO:** T5, fazer a falha do Gemini aparecer para o usuário (decide o T5).
- **DECISÃO EM ABERTO:** subir a cobertura do frontend (3 arquivos) agora ou depois da Fase 10.

### 7. Verificação (ponta a ponta)

As três suítes verdes, `tsc`, lint e build sem erro na branch da fase e na branch de integração; T1 a T4 e T7 existem; T5 e T6 criados depois das decisões.

---

## Ordem sugerida (resumo)

1. Terminar 09-04 a 09-07 (o 09-04 e o 09-05 dependem da decisão do link da Taqciti; ver a resposta no chat).
2. Task C (rodar suítes) no 09-05; Task B (revisão) em paralelo, só leitura.
3. A2: PR da Fase 9 → `main`.
4. A3 e A4: inspecionar a branch da Fase 10 e a triagem dos 46 conflitos (só leitura).
5. Decisões do time (itens 6 de A, B e C).
6. A5 a A7, só depois das decisões.
7. Fase 10.
8. Testes manuais (arquivo separado), depois que o Gemini voltar e a Fase 10 acabar.
