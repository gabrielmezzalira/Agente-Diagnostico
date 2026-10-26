---
phase: "08"
slug: "taqciti-session-association"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-26"
---

# Phase 08 — Security

> Contrato de segurança da fase: fronteiras de confiança, registro de ameaças, riscos aceitos e trilha de auditoria.
> Montado pelo `/gsd-secure-phase 08` (estado B, a partir dos `<threat_model>` dos 27 planos), dentro do `/gsd-execute-phase 08`.
> Profundidade L1 (ASVS 1, bloqueio a partir de `high`): cada mitigação foi conferida pela linha verde correspondente no
> mapa de verificação do `08-VALIDATION.md` (reconferido em 2026-10-26: Taqciti 87 arquivos / 1340 testes, backend 85 passed).
> Como `threats_open` deu 0 com o registro escrito no planejamento, o auditor (`gsd-security-auditor`) não foi acionado.

---

## Trust Boundaries

| Boundary | Description | Plano(s) |
|----------|-------------|----------|
| service worker → backend do Agente | A política de destino decide se e para qual sessão a transcrição sai | 08-01, 08-05, 08-10, 08-23 |
| `chrome.storage.local` (associações) → service worker e painéis | Estado do vínculo lido por vários contextos; só o service worker grava | 08-01 |
| Usuário → painel no Meet | Cliques e teclas dentro do shadow DOM da página do Meet | 08-02 |
| Backend (lista de clientes) → painel no Meet | Nomes de clientes vindos do banco são exibidos na página do Meet | 08-03 |
| Usuário → formulário de ID manual | Texto livre que vira destino de envio | 08-03 |
| Backend/diretório → painel | Nome do cliente exibido na barra, no cartão e no selo | 08-04 |
| Webhook da extensão → pipeline em memória | Chunks concorrentes disparam a criação do pipeline e as chamadas ao Gemini | 08-06 |
| Internet → rotas /webhook/extension/* | Qualquer cliente HTTP com a URL do backend (e a chave, se o gate estiver ativo) | 08-07 |
| Router → Supabase | Leitura de projects e escrita de sessions no banco de produção | 08-07 |
| Web app/Taqciti → POST /projects | Criação de projeto pode vir sem chave própria | 08-08 |
| Projeto sem chave → chave do servidor | O custo de IA passa para a chave compartilhada | 08-08 |
| Taqciti → POST /webhook/extension | Trechos reenviados após falha de rede podem chegar repetidos | 08-09, 08-19 |
| Repositório → banco de produção | Migração e índice único na tabela de transcrição | 08-09 |
| UI (painel no Meet / saída larga) → service worker | Comandos `ui/agente/*` atravessam contextos da extensão | 08-10 |
| service worker → `chrome.storage.local` (fila e status) | Transcrição temporária persistida no perfil do Chrome | 08-11, 08-23 |
| Taqciti (service worker) → rotas /webhook/extension/* | Pedidos com a chave opcional; respostas do servidor entram na extensão | 08-12 |
| Rota de criar cliente → tabela projects | Escrita no banco de produção a partir da extensão | 08-12 |
| UI → service worker (comando de descarte) | Ação destrutiva pedida por um contexto da extensão | 08-13 |
| service worker → histórico local | Remoção de registros do `chrome.storage.local` | 08-13 |
| Página do Meet (content script, shadow DOM) → service worker | O painel só lê `storage.local` e emite comandos zod | 08-14 |
| `chrome.storage.local` → content script | Associação e status de entrega lidos pelo painel | 08-14 |
| Internet → POST /webhook/extension/sessions/{id}/finish | Chamada que encerra sessão no banco de produção | 08-15 |
| Backend (rota de finish) → PipelineManager | Encerramento concorrente com a criação de pipeline | 08-15 |
| service worker → POST /webhook/extension/sessions/{id}/finish | Encerramento automático de sessão no backend | 08-16, 08-27 |
| `chrome.storage.local` (associações) → agendador | Prazo, tentativas e marca de encerrada persistidos entre reinícios | 08-16 |
| Usuário → ação destrutiva local | Descartar/apagar a única cópia de uma reunião | 08-17 |
| Título da reunião / nome do cliente → modal e cartões | Texto livre exibido na UI | 08-17 |
| Usuário (tela de config) → comando de vínculo manual | Um ID colado pode virar destino de uma reunião ao vivo | 08-18 |
| UI → service worker (retomar envio) | Comando que reenvia partes de uma reunião | 08-20 |
| Pessoa do time → ambiente local com segredos | O backend local usa o `.env` da própria pessoa | 08-21 |
| Máquina da reunião → associação | Transições da reunião decidem se uma sala vira "nova" ou "retomada" — e, portanto, para qual sessão a fala nova vai | 08-22, 08-24 |
| `chrome.storage.local` (associações) → service worker no boot | Estado reidratado depois de reinício | 08-22, 08-24 |
| Manifesto → Chrome | Permissão nova distribuída com a extensão | 08-25 |
| Chrome (alarme) → service worker | Evento que acorda o encerramento depois de o service worker dormir | 08-25 |
| Chrome (`tabs.onRemoved`) → service worker | O evento de aba fechada decide o fim de uma reunião e, com o 08-25, o encerramento de uma sessão no backend | 08-26 |
| `chrome.storage.local` (associações e fila) → agendador | Prazo, tentativas e fila persistidos entre reinícios | 08-27 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Tampering / Repudiation | Destino do streamer (transcrição atribuída ao cliente errado) | high | mitigate | Destino só por associação `linked` (`createAssociationDestination`); config global não é destino em produção; o CR-01 antigo não redireciona nem bloqueia destinos de associação; testes "sem linked nada sai", "linked de qualquer origem = destino" e "CR-01 não bloqueia manual-id" (Task 1); retomada só leva a `linked` quando a associação já tem `sessionId` (Task 2) (08-01; teste verde: 08-01-T1, 08-01-T2) | closed |
| T-08-02 | Information Disclosure | `taq:agenteAssociations` | medium | mitigate | `normalizeAssociations` com lista branca de campos; teste que lê o JSON cru e prova ausência da chave `s3cr3t` (Task 1) e teste de normalização com `headers`/`apiKey` (Task 2) (08-01; teste verde: 08-01-T1) | closed |
| T-08-03 | Tampering | Escritas concorrentes no mapa de associações | medium | mitigate | Fila serializada única + valor inteiro + cache atualizado na mesma operação; teste de duas escritas concorrentes em `agenteAssociationStore.test.ts` (Task 2) (08-01; teste verde: 08-01-T2) | closed |
| T-08-04 | Tampering | ConfirmModal (confirmação destrutiva acidental) | low | mitigate | `Esc` e clique no fundo continuam = cancelar; botão de recusa com rótulo explícito (`cancelLabel`); teste dos três caminhos (Task 1) (08-02; teste verde: 08-02-T1) | closed |
| T-08-05 | Tampering (XSS) | Linha de cliente / formulário | medium | mitigate | Render como texto JSX, `title` como atributo de texto, grep negativo de `dangerouslySetInnerHTML`, teste com nome contendo HTML (Tasks 2-3) (08-03; teste verde: 08-03-T2/T3) | closed |
| T-08-06 | Tampering | ID manual (destino arbitrário) | medium | mitigate | Validação UUID com `isValidAgenteSessionId` antes de habilitar; campo só no estado de erro (D-02); teste (Task 3) (08-03; teste verde: 08-03-T2/T3) | closed |
| T-08-07 | Tampering (XSS) | Nome do cliente em AgenteBindingBar/AgenteEndPrompt | medium | mitigate | Render como texto JSX e `title` como atributo; nenhum `dangerouslySetInnerHTML` (React escapa) (08-04; teste verde: 08-04-T1/T2) | closed |
| T-08-08 | Denial of Service | Envio em partes (rajada no backend, event loop bloqueado pelo insert síncrono) | medium | mitigate | Serial (1 em voo), blocos de 20 com pausa de 1 s, novas tentativas com espera crescente; teste de concorrência máxima = 1 (Task 2); validação de carga no D-20(a) (08-05; teste verde: 08-05-T1/T2) | closed |
| T-08-09 | Denial of Service (custo) | `PipelineManager.get_or_create` (pipelines duplicados com tarefas órfãs) | medium | mitigate | `asyncio.Lock` por `session_id` + nova checagem dentro do lock; teste de concorrência (Task 1) (08-06; teste verde: 08-06-T1) | closed |
| T-08-10 | Spoofing / Elevation / DoS (custo) | Rotas de escrita sem `EXTENSION_SHARED_KEY` (com a B2, a chave Gemini do servidor paga o pipeline das sessões criadas) | high | mitigate | Gate `verify_extension_key` em todas as rotas; comportamento sem env var decidido pelo time na Task 1: na opção recomendada (opt-in), o risco residual é ACEITO por um dono nomeado com condição de revisão, registrado no 08-07-SUMMARY antes de qualquer rota (pré-condição das Tasks 2-3); o 08-21 confere o registro (ou a env var ativa) no fechamento; exigir a env var nas escritas é a alternativa (aprovar-com-ajustes) Risco residual enquanto `EXTENSION_SHARED_KEY` não existir no Railway: ver Accepted Risks Log. (08-07; teste verde: 08-07-T2/T3, 08-21-T1) | closed |
| T-08-11 | Information Disclosure (LGPD) | GET `/webhook/extension/clients` | medium | mitigate | Schema próprio `{id, client, name}` + `select` mínimo no repositório + teste de chaves; minimização de dados é canon → revisar também em `/gsd-secure-phase` (08-07; teste verde: 08-07-T2/T3) | closed |
| T-08-12 | Denial of Service | POST `/webhook/extension/sessions` com projeto inexistente | low | mitigate | 404 explícito (não 500), que a extensão trata como definitivo (sem novas tentativas); teste (Task 3) (08-07; teste verde: 08-07-T2/T3) | closed |
| T-08-13 | Elevation / DoS (custo) | Projetos sem chave usando `GEMINI_API_KEY` do servidor | medium | accept | Decisão explícita do time (D-15, Task 1); o orçamento por projeto (`budget_usd`) continua valendo; encerramento das sessões criadas pela Taqciti é tratado na decisão B4-b (plano 08-15) (08-08; risco aceito (Accepted Risks Log)) | closed |
| T-08-14 | Information Disclosure | Chave Gemini | low | mitigate | Nenhuma mudança na regra "chave nunca volta ao front" (`_VAULT_EXCLUDED`, `has_api_key`); só o envio fica opcional (08-08; teste verde: 08-08-T2) | closed |
| T-08-15 | Tampering | Transcrição duplicada no reenvio | high | mitigate | Índice único `(session_id, chunk_id)` + `insert_chunk` → `False` em 23505 + 202 sem `push_chunk`; teste (Task 2) e conferência real no D-20 (b) (08-09; teste verde: 08-09-T2) | closed |
| T-08-16 | Denial of Service / Tampering | Migração em produção e ordem de deploy | high | mitigate | Migração aditiva/idempotente aplicada por humano antes do deploy (Task 3); campo só gravado quando enviado; rollback SQL documentado (08-09; teste verde: 08-09-T2) | closed |
| T-08-17 | Tampering / Spoofing | Comandos `ui/agente/*` | medium | mitigate | Validação zod em `messageSchema` (ids com tamanho, UUID, nome trim 1–120); `externally_connectable` não declarado → só contextos da extensão enviam (08-10; teste verde: 08-10-T1) | closed |
| T-08-18 | Tampering / DoS | Vínculo duplo (sessões órfãs) | medium | mitigate | `link-started`/`send-started` gravados pela fila serializada antes do POST; segundo comando → `invalid-state`; teste de concorrência (Task 2) (08-10; teste verde: 08-10-T2/T3) | closed |
| T-08-19 | Tampering / Repudiation | Envio para sessão errada | high | mitigate | `sessionId` da porta ou do ID manual validado, gravado na associação e usado em cada request; teste confere `session_id` de cada POST (Tasks 2-3) (08-10; teste verde: 08-10-T2/T3) | closed |
| T-08-20 | Information Disclosure | `taq:agenteOutbox` / `taq:agenteDelivery` / `taq:agenteDropTrace` | high | mitigate | Lista branca de campos (`normalizeOutbox`, `normalizeDelivery`, `normalizeDropTrace` — o rastro não tem campo para texto de fala nem chave), request remontado na hora do envio com a chave atual; testes que leem o JSON cru e provam ausência da chave (Tasks 1 e 2); prova ponta a ponta no 08-23 (08-11; teste verde: 08-11-T1, 08-11-T2) | closed |
| T-08-21 | Tampering | Perda ou duplicação de fala no reenvio | high | mitigate | Fila durável ordenada, sem descarte do mais antigo; reenvio desligado até a B3 (dedup por `chunk_id` no 08-09/08-19); `chunkId` estável persistido; testes de ordem e de identidade entre reinícios (Tasks 2-3) (08-23; teste verde: 08-23-T2, 08-23-T3) | closed |
| T-08-22 | Denial of Service (local) | Cota de 10 MB do `storage.local` | medium | mitigate | Teto de 1000 itens com overflow explícito (`appendItems`, Task 1); escrita rejeitada vai para o log; medição de `getBytesInUse` no D-20 (08-21) (08-11; teste verde: 08-11-T1) | closed |
| T-08-23 | Tampering | POST `/webhook/extension/clients` (nome malicioso/duplicado) | medium | mitigate | Pydantic `min_length=1, max_length=120` + strip; duplicidade sem acento/caixa → 409; render como texto na UI (08-03) (08-12; teste verde: 08-12-T1) | closed |
| T-08-24 | Information Disclosure | Chave `x-agente-key` em trânsito | high | mitigate | `buildAgenteJsonRequest` só monta request para URL válida (https fora de loopback, WR-06); header só com chave; teste (Task 2) (08-12; teste verde: 08-12-T2/T3) | closed |
| T-08-25 | Tampering | Resposta inesperada do servidor | medium | mitigate | Validação zod das respostas; desvio → indisponível/erro; nada do corpo é logado (08-12; teste verde: 08-12-T2/T3) | closed |
| T-08-26 | Tampering | Comando `ui/agente/meeting/discard` (acidental/forjado) | medium | mitigate | zod no `meetingId`; regra de estado no service worker (só `ended-unsent`, nunca ao vivo); confirmação na UI (08-17); só contextos da extensão enviam mensagens (08-13; teste verde: 08-13-T3) | closed |
| T-08-27 | Denial of Service / perda de dado | Evicção do histórico | high | mitigate | `selectRecordsToKeep` nunca remove não enviadas (teto suave); medição de cota no D-20 (08-13; teste verde: 08-13-T1) | closed |
| T-08-28 | Information Disclosure | Leitura de estado pelo content script | medium | mitigate | Só chaves próprias de `storage.local` (associação, entrega — sem transcrição nem segredo); nunca `setAccessLevel` em `storage.session` (que abriria `taq:state`); grep negativo (Task 1) (08-14; teste verde: 08-14-T1) | closed |
| T-08-29 | Tampering | Ações do painel | low | mitigate | Nenhuma chamada direta à API; só `platform.send` com comandos validados no service worker; resposta validada por zod (08-14; teste verde: 08-14-T2, 08-14-T3) | closed |
| T-08-30 | Tampering / DoS | Encerrar sessão alheia | medium | mitigate | Gate `verify_extension_key`; só `source == 'extension'` e status active/finished; 404/409 nos demais; compare-and-set na gravação; testes (Task 2). Limite aceito e registrado: o web app também usa source 'extension', e o finish do web app já é aberto — a rota nova não amplia a superfície (08-15; teste verde: 08-15-T2) | closed |
| T-08-31 | Denial of Service (custo) | Pipeline sem encerramento | high | mitigate | Decisão B4-b + rota que chama `stop_session` (também em chamada repetida) + `stop_session` que espera a criação em andamento (Task 3); gatilhos nos planos 08-27/08-25 (e 08-26 para a aba fechada) (08-15; teste verde: 08-15-T2, 08-15-T3) | closed |
| T-08-32 | Denial of Service | Encerrar cedo demais (últimas falas perdem a análise ao vivo) ou nunca encerrar (envio parado) | medium | mitigate | Tempos fixados por teste (Task 1); prazo de 5 min gravado e preservado entre estados (Task 2); as falas tardias continuam no banco e o relatório de sessão encerrada lê o banco. O comportamento é do agendador (08-27) O lado do agendador é do 08-27 (citado lá abaixo da tabela). (08-16; teste verde: 08-16-T1, 08-16-T2, 08-27-T1, 08-27-T2) | closed |
| T-08-33 | Elevation of Privilege | Permissão `alarms` | low | accept | Permissão sem aviso de instalação e sem acesso a dados; único uso documentado no manifesto (B4-b) (08-25; risco aceito (Accepted Risks Log)) | closed |
| T-08-34 | Tampering / perda de dado | Descartar sem confirmação | high | mitigate | Comando só sai do botão de confirmar do `ConfirmModal`; `Esc`/fundo/"Manter reunião" cancelam; teste (Task 2); regra de estado no service worker (08-13) (08-17; teste verde: 08-17-T1/T2) | closed |
| T-08-35 | Tampering (XSS) | Título da reunião no modal | low | mitigate | Texto JSX (React escapa); nenhum `dangerouslySetInnerHTML` (08-17; teste verde: 08-17-T1/T2) | closed |
| T-08-36 | Tampering / Repudiation | ID manual como destino silencioso | high | mitigate | O ID só vincula a reunião AO VIVO sem cliente, pelo comando validado (UUID, estado); nunca reuniões futuras; teste "sem reunião ao vivo, nada é enviado" (08-18; teste verde: 08-18-T2) | closed |
| T-08-37 | Tampering | Duplicata no reenvio automático | high | mitigate | `chunk_id` estável + índice único no backend (B3 = aprovar-chunk-id); com reenvio-sem-chunk-id, risco aceito pelo time e registrado (08-19; teste verde: 08-19-T1/T2) | closed |
| T-08-38 | Denial of Service | Corpo com `chunk_id` antes da migração | high | mitigate | Pré-condição: migração confirmada (08-09 Task 3); ordem de rollout documentada (08-19; teste verde: 08-19-T1/T2) | closed |
| T-08-39 | Tampering | Retomada duplicando partes | medium | mitigate | `startAt = sendProgress.done` + `chunk_id` determinístico (B3); só `send-failed` com sessão; testes (Task 1) (08-20; teste verde: 08-20-T1/T3) | closed |
| T-08-40 | Information Disclosure | Arquivos `.env` durante a verificação | high | mitigate | O executor nunca lê `.env`; só testes puros do backend; quem sobe o ambiente local é a pessoa do time (CLAUDE.md §Segredos) (08-21; teste verde: 08-21-T1) | closed |
| T-08-41 | Tampering / Repudiation | Retomada da sala (fala nova atribuída à sessão da reunião errada) | high | mitigate | `meeting-resumed` só para o MESMO `meetingId` saindo de `ended` (caso exato da máquina); sala diferente = associação nova `pending`; `linked` na retomada só com `sessionId` já gravado (reducer do 08-01); testes "mesma sala" × "sala diferente" (Task 1) (08-22; teste verde: 08-22-T1/T2) | closed |
| T-08-42 | Denial of Service | `runSideEffects`/boot travados pela escrita da associação | low | mitigate | Fire-and-forget com log no `sessionController`; teste de falha simulada sem efeito no `dispatch` (Task 1); recuperação no boot encadeada depois do `recoverInterruptedMeetings` (Task 2) (08-22; teste verde: 08-22-T1/T2) | closed |
| T-08-43 | Denial of Service | Fila travada por trecho que o backend sempre recusa (500 por FK de sessão inexistente/apagada, ID colado no plano B) | medium | mitigate | 4xx sai na hora; retirada por 500 só como o time decidiu na B3-b (checkpoint do 08-09, `gate="blocking-human"`, efeito da queda de banco mostrado no contexto); com `retirada-nunca`, risco de fila parada aceito pelo time e a saída é desligar o envio (ou `404-agora` na B3-c); 429/502/503/504/rede seguem "fora do ar"; testes dos dois lados por injeção + teste que fixa o valor de produção (Task 2) (08-23; teste verde: 08-23-T2) | closed |
| T-08-44 | Repudiation | Fala descartada sem a pessoa saber (status "ok" seguinte apaga o "recusado") | medium | mitigate | Rastro em chave própria (`taq:agenteDropTrace`) que nenhuma gravação de status toca, escrita serializada, mostrado na tela "Agente Diagnóstico" (Tasks 2 e 3); gravação pelo sender no 08-23 (08-11; teste verde: 08-11-T2, 08-11-T3) | closed |
| T-08-45 | Information Disclosure | `taq:agenteOutbox` / `taq:agenteDelivery` / `taq:agenteDropTrace` | high | mitigate | Item sem headers (lista branca do 08-11); rastro só com sessão, contagem, hora, motivo e HTTP; request remontado na hora do envio com a chave atual; teste ponta a ponta lê o JSON cru e prova ausência da chave (Task 3) (08-23; teste verde: 08-23-T3) | closed |
| T-08-46 | Repudiation | Fala descartada sem a pessoa saber | medium | mitigate | `onDropped` em toda saída sem entrega não pedida pela pessoa (failed, 4xx, 500 da B3-b, overflow e falha ao gravar a fila — esta contada como overflow) → rastro `taq:agenteDropTrace` (08-11) em chave própria, que o próximo "ok" e o reinício não apagam; as saídas pedidas pela pessoa (desligar o envio, troca de URL/chave e o item de outro backend que ela deixa) ficam fora, declaradas na truth 7 e na seção 6; `dispose` não apaga a fila durável; testes (Tasks 2 e 3); a tela "Agente Diagnóstico" mostra (08-11 Task 3) (08-23; teste verde: 08-23-T2, 08-23-T3) | closed |
| T-08-47 | Denial of Service | `stop_session` pendurado numa criação travada | low | mitigate | O status `finished` é gravado antes da espera; o finish é idempotente e a Taqciti repete com backoff; teste de sessões diferentes (uma não espera a outra) (08-15; teste verde: 08-15-T3) | closed |
| T-08-48 | Tampering | URL do finish montada com id não validado | medium | mitigate | `isValidAgenteSessionId` antes de montar a URL; teste de id inválido sem fetch (Task 3) (08-16; teste verde: 08-16-T3) | closed |
| T-08-49 | Denial of Service | Laço de finish contra um backend/chave que nunca aceita | medium | mitigate | Backoff limitado (11 tentativas, ≈ 16 h), 401/403/4xx não repetem, `finishGaveUp` torna a associação inelegível (Tasks 1-3) O lado do agendador é do 08-27, inclusive a varredura do boot (citado lá abaixo da tabela). (08-16; teste verde: 08-16-T1, 08-16-T2, 08-16-T3, 08-27-T2) | closed |
| T-08-50 | Tampering / Repudiation | Fala da reunião nova atribuída à sessão já encerrada (ou à de outra reunião) | high | mitigate | Regra do reducer (`sessionFinished` + sala de volta → `pending` limpo em qualquer estado com sessão), `startFresh` na máquina (DA-1), recuperação no boot, finish em voo conta como encerrada; testes por estado e com a máquina real (Tasks 1 e 3) (08-24; teste verde: 08-24-T1, 08-24-T3) | closed |
| T-08-51 | Denial of Service | Captura atrasada ou perdida ao reentrar (leitura do storage na detecção) | medium | mitigate | O hook só lê quando a fase é `ended` e a sala é a mesma, usa o cache do store e `isClosing` em memória; `machine.test.ts` da Fase 7 roda sem alteração (Task 3) (08-24; teste verde: 08-24-T3) | closed |
| T-08-52 | Denial of Service (custo) | Encerramento que nunca dispara: listener fora do topo do módulo, alarme perdido num reinício, estado da reunião não configurado | high | mitigate | Listener no nível de topo (grep no `<verify>`); reavaliação no boot (Task 1); `configureAgenteSessionFinisher` chamado no topo (grep); `isMeetingLive` testado; gatilhos testados (Task 2) (08-25; teste verde: 08-25-T1, 08-25-T2) | closed |
| T-08-53 | Denial of Service | Gatilho que atrasa a reunião seguinte ou derruba o envio em partes | medium | mitigate | Avisos sem esperar e com erro só no log; testes com `evaluate` que nunca resolve e com `onSettled` que rejeita (Task 2) (08-25; teste verde: 08-25-T2) | closed |
| T-08-54 | Denial of Service (custo) | Sessão ao vivo encerrada por engano por falta de configuração | high | mitigate | Padrão de produção de `isMeetingLive` é "ao vivo" até o `index.ts` configurar; checagem síncrona logo antes da chamada; testes (Tasks 2-3) (08-27; teste verde: 08-27-T3) | closed |
| T-08-55 | Denial of Service (custo) | Aba fechada no meio da call sem aviso de fim: sessão aberta e laço de IA correndo | high | mitigate | Fechar a aba da reunião ao vivo dispara `MEETING_FINISHED` (Task 2); a aba navegando para outro site é a DA-4, em aberto, e não é tratada como aceita (08-26; teste verde: 08-26-T2) | closed |
| T-08-56 | Tampering | Aba errada encerrar a reunião errada | medium | mitigate | Só reage quando `session.tabId === tabId` (aba nula nunca casa); testes de outra aba e de tabId nulo (Tasks 1-2) (08-26; teste verde: 08-26-T1, 08-26-T2) | closed |
| T-08-SC | Tampering | npm/pip installs (linha reservada, repetida em todo plano) | high | mitigate | Nenhum pacote novo na fase: `git diff --stat main...HEAD` dos manifestos (`taqciti/package*.json`, `backend/requirements.txt`, `frontend/package*.json`) vazio em 2026-10-26 (08-21-T1) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-10 | Risco residual: as rotas de escrita da extensão (`POST /webhook/extension/clients` e `/sessions`) ficam abertas enquanto `EXTENSION_SHARED_KEY` não existir no Railway (gate opt-in, decisão B1 `aprovar-recomendado`); com a B2, a `GEMINI_API_KEY` do servidor paga o pipeline dessas sessões. Vale **até o login do AGM**; revisar antes de qualquer deploy. O deploy ainda não foi feito, então as rotas não estão expostas em produção. | Time Antonio (08-07-SUMMARY; 08-DECISOES-PENDENTES) | 2026-10-12 |
| AR-08-02 | T-08-13 | Projetos sem chave Gemini própria (criados pela Taqciti) usam a `GEMINI_API_KEY` do servidor; o `budget_usd` por projeto continua valendo e o encerramento automático (B4-b) limita o custo ocioso. **Pendência:** a variável ainda não existe no Railway. | Usuário/time, decisão B2 `aprovar-sem-env` (08-08-SUMMARY) | 2026-10-12 |
| AR-08-03 | T-08-33 | Permissão `alarms` no manifesto da Taqciti: não mostra aviso de instalação, não dá acesso a dados e tem um único uso (acordar o agendador do encerramento). Conferido no UAT (D-20 g). | Usuário/time, decisão B4-b (08-DECISOES-PENDENTES) | 2026-10-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-26 | 57 | 57 | 0 | `/gsd-secure-phase 08` (orquestrador, L1; sem auditor) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-26
