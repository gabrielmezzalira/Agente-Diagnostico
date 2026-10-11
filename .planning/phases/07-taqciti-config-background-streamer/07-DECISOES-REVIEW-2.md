# Fase 7 — Decisões da 2ª revisão (CR-01 e WR-04)

**Data:** 2026-10-10 · **Branch:** `feat/fase-07-taqciti-config-background-streamer`
**Origem:** `07-REVIEW.md` (iteração 2). Os códigos CR/WR/IN daqui são os **da 2ª revisão** — o `07-REVIEW-DISPOSITION.md`
ainda descreve os da 1ª, que têm os mesmos números e outro significado.

> **Status (2026-10-10): DECIDIDO E IMPLEMENTADO.** O texto das seções abaixo é o plano original, mantido para
> rastreio. As decisões e o que foi entregue estão na próxima seção. Só o IN-05 (backend) e o seletor de cliente
> (Fase 8) seguem pendentes.

## Decisões tomadas (usuário, 2026-10-10)

| Achado | Decisão |
|--------|---------|
| CR-01 | **Opção A:** guardar a última reunião vinculada em `storage.local`; reunião diferente da vinculada **espera e pergunta** (o aviso bloqueia o envio até a pessoa confirmar). |
| WR-04 | **Opção 2-B:** aceitar a perda do trecho na fila de reenvio, mas a tela deixa de dizer "tentando de novo…" quando nada está rodando. |
| IN-05 | **Task de backend**, fora da Fase 7. |
| Seletor de cliente por reunião | **Fase 8** (ver "Entregue para a Fase 8" abaixo). Na Fase 7 só a correção mínima do CR-01. |
| "Descartar" a reunião (Fase 8) | **Apaga a reunião também do histórico do Taqciti**, não só deixa de enviar ao Agente. |

## Onde a fase está agora

| Achado | Situação |
|--------|----------|
| WR-01, WR-02 | corrigidos (`ddb856b`, `2d4df95`) |
| WR-03 | corrigido (`9b564d7`) |
| WR-05 | corrigido (`4a31957`) |
| IN-01, IN-04 | corrigidos (`3e4a1dc`) |
| IN-02, IN-03 | corrigidos (`ff970d0`) |
| IN-06 | corrigido (`32864ad`) |
| **CR-01** | **corrigido** em 3 commits: `b3dfcf1` (campo `boundMeetingId` na config), `e28bdac` (regra do cursor nulo em `planStreamStep`), `a66e15d` (o streamer grava o vínculo; o religar do toggle respeita o vínculo) |
| **WR-04** | **corrigido** (`6404a73`) |
| IN-05 | pendência de **backend** — ver o fim deste documento |

Typecheck, lint e testes: verdes (595/595).

**Desvio da letra da decisão do WR-04, a favor do espírito dela:** em vez de gravar `failed`, o boot grava um valor novo,
`interrupted`, com texto próprio. O texto do `failed` diz "mesmo depois das novas tentativas", e depois de um reinício as
tentativas foram **cortadas**, não esgotadas — reusá-lo repetiria a mentira que o WR-04 quer acabar. É um valor a mais
em `storage.session` (efêmero); reverter é `git revert 6404a73`.

**Mais um achado no caminho do CR-01:** o religar do toggle (`applyConfigChange`) ancorava o cursor direto com
`primeCursor`, sem consultar nada — era o cenário 3 da revisão ("desligou, trocou de reunião, religou"). Agora passa
pelo mesmo `planStreamStep`.

**Limites conhecidos da correção do CR-01 (aceitos, não escondidos):**
- Primeiro uso de uma sessão (sem vínculo) continua livre: o envio começa na reunião em que a pessoa liga o toggle.
  É o comportamento de sempre e é a pessoa que acabou de colar o ID.
- Se a pessoa trocar o ID da sessão **para outra sessão** e a reunião seguinte for do mesmo cliente, ela é aceita sem
  aviso (o vínculo é zerado ao trocar a sessão). É de propósito: trocar o ID é um ato explícito.
- Falso positivo possível: reiniciar o Chrome no meio da **mesma** reunião NÃO gera aviso (o vínculo é igual); mas
  entrar de novo na mesma sala depois da janela de retomada gera uma reunião nova (`m2`) e o aviso aparece. Um clique em
  "Continuar enviando para esta sessão" resolve.
- `agenteStreamerInstance.ts` foi de 238 para 263 linhas (já passava de 200; é o IN-08, adiado de propósito).

## Teste manual do CR-01 (2026-10-10) — passou

Feito pelo usuário no Chrome, com o `dist/` gerado por `npm run build` (typecheck, lint e 595 testes verdes antes), backend
local em `:8000` e web app em `:5173`, extensão em modo "carregar sem compactação".

| Passo | Resultado |
|-------|-----------|
| Reunião 1 (sessão A configurada, toggle ligado) | as falas chegaram à coluna de transcrição da sessão A |
| Recarregar a extensão (simula o "dia seguinte": apaga `storage.session`, a config salva fica) e abrir a reunião 2 em outra sala | a tela mostrou "Reunião nova detectada — nada está sendo enviado" com o botão "Continuar enviando para esta sessão"; **nenhuma fala da reunião 2 entrou na sessão A** |
| Clicar em "Continuar enviando para esta sessão" | tudo o que foi dito na reunião 2 durante a espera chegou à sessão A (comportamento projetado: a confirmação libera a reunião desde o início) |
| Recarregar a extensão e desligar/religar o toggle **na mesma reunião** | sem aviso; as falas seguiram chegando |

**Observação do teste (não é defeito do CR-01):** em algum momento a tela mostrou "Último envio falhou mesmo depois das
novas tentativas (sem conexão com o backend)". A causa foi o backend local ter sido derrubado (outra sessão de trabalho
o desligou); subir o backend de novo resolveu. O status honesto do WR-07 se comportou como projetado. Mas o episódio
mostra o limite da política de envio — ver a decisão 6 abaixo.

## Entregue para a Fase 8 (seletor de cliente por reunião) — proposta aprovada, ainda sem plano

A ideia do usuário, que substitui a "auto-detecção por `localStorage` + ID manual" do ROADMAP:

1. Ao detectar a reunião, o Taqciti oferece **"Selecionar cliente agora"** ou **"Depois"**.
2. Em "agora": lista pesquisável de clientes, com opção de **criar cliente novo**.
3. Em "depois": o Taqciti só grava a reunião localmente. No **fim**, pergunta para qual projeto enviar — ou **descartar**
   (apaga a reunião também do Taqciti).

O que já existe no backend: `GET /projects`, `POST /sessions` (precisa de `project_id`), `POST /sessions/start` (cria
projeto + sessão só com nome e cliente; usa a chave do servidor). `POST /projects` **não** serve para criar cliente na
extensão: exige `gemini_api_key`. O histórico do Taqciti guarda até 100 reuniões com todos os trechos.

**DECISÕES EM ABERTO para a Fase 8 (ninguém decidiu ainda):**
1. Trocar o mecanismo da Fase 8 no ROADMAP (auto-detect por `localStorage` → seletor)?
2. Proteger `GET /projects` e `/sessions` com a chave? Hoje **não têm autenticação** e o CORS é `*`: qualquer pessoa com a
   URL do Railway já lista todos os clientes. A extensão passaria a depender disso.
3. Cada reunião cria uma sessão nova, ou reaproveita a ativa do projeto?
4. O "depois" envia a reunião inteira de uma vez ao Agente? **Não foi verificado** como o pipeline reage a uma rajada de
   trechos (custo de Gemini, ordem). Precisa de teste antes de prometer.
5. Duas telas novas (aviso ao detectar, diálogo de fim de reunião): passam pelo `/gsd-ui-phase`.
6. **Resiliência do envio (surgiu no teste manual; sem plano ainda).** Hoje o `agenteSender` tenta 1 vez + 3 novas
   (espera de 1, 2 e 4 s, `AGENTE_SEND_MAX_RETRIES = 3`) e depois **descarta** o trecho; o `fetch` não tem limite de
   espera. Um backend fora do ar por mais de ~7 s perde fala. Em reunião real o backend fica no Railway, onde reinício e
   instabilidade acontecem. Opções, da mais barata à mais cara: (a) esperar mais antes de desistir e pôr limite de
   espera no `fetch`; (b) guardar os trechos que falharam e reenviar quando o backend voltar — **reabre a decisão 2-B
   do WR-04** (aceitar a perda); (c) aviso mais claro na tela e no painel do Meet ("Agente fora do ar — guardando as
   falas"); (d) no backend, 404 para sessão desconhecida (IN-05) e proteção contra fala repetida no reenvio (WR-01,
   ver memória `taqciti-retry-duplicates`). Qualquer uma muda comportamento: plano nas 7 seções, fora da Fase 7.

O `boundMeetingId` do CR-01 é a versão simples do que o seletor vai generalizar ("reunião → sessão"), então o trabalho
da Fase 7 não é descartado.

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
