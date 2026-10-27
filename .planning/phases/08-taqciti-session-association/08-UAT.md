---
status: complete
phase: 08-taqciti-session-association
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md, 08-06-SUMMARY.md, 08-07-SUMMARY.md, 08-08-SUMMARY.md, 08-09-SUMMARY.md, 08-10-SUMMARY.md, 08-11-SUMMARY.md, 08-12-SUMMARY.md, 08-13-SUMMARY.md, 08-14-SUMMARY.md, 08-15-SUMMARY.md, 08-16-SUMMARY.md, 08-17-SUMMARY.md, 08-18-SUMMARY.md, 08-19-SUMMARY.md, 08-20-SUMMARY.md, 08-21-SUMMARY.md, 08-22-SUMMARY.md, 08-23-SUMMARY.md, 08-24-SUMMARY.md, 08-25-SUMMARY.md, 08-26-SUMMARY.md, 08-27-SUMMARY.md, 08-28-SUMMARY.md
started: 2026-10-23T01:10:57.993Z
updated: 2026-10-27T00:28:51.655Z
---

## Current Test

[testing complete]

## Tests


### 1. Cold Start Smoke Test
expected: Derrubar qualquer servidor em execução, subir backend e frontend do zero: o backend inicia sem erros e uma consulta básica (lista de projetos) devolve dados reais.
result: pass
evidence: Evidência colhida em 2026-10-22: backend subido do zero (uvicorn, porta 8001, código atual da branch) bootou sem erro e GET /projects/ devolveu 200 com os 8 projetos reais; frontend (vite) subiu e renderizou a lista.

### 2. 08-02 D5 — O aviso de reunião detectada não interrompe a reunião (sem…
expected: O aviso de reunião detectada não interrompe a reunião (sem som, sem notificação do sistema, sem foco roubado) e o pulo/aparência estão fiéis ao UI-SPEC no Meet real
result: pass
evidence: Evidência colhida em 2026-10-24 no Meet real: itens (a) a (e) conferidos pelo usuário (bolha "!" na cápsula, pulo a cada ~5 s, sem som/notificação/foco roubado, dica ao passar o mouse, clique abre o cartão). A 1ª tentativa falhou porque o Meet passou a reescrever o endereço para /meet/<código> e a Taqciti não detectava nenhuma reunião; corrigido no commit 861db11 (MEETING_CODE_PATTERN aceita o prefixo opcional meet/, com teste novo em GoogleMeetProvider.test.ts).
rationale: O aspecto visual e o 'não atrapalha a reunião' no Meet real só são conferidos com a fiação do plano 08-14 (teste manual D-20); aqui só há prova automática da ausência de foco/som.

### 3. 08-03 D7 — Aparência fiel ao UI-SPEC no painel de 320/564 px e na saída…
expected: Aparência fiel ao UI-SPEC no painel de 320/564 px e na saída larga (truncate, scroll-region, rodapé fixo, 3 linhas visíveis em 564 px)
result: pass
evidence: 2026-10-24, parte A (painel) 1ª tentativa REPROVADA no Meet real e corrigida, aguardando reteste. Defeito medido na reunião real (564 px): o seletor ao vivo recebia só 213 px (flex-[2]), a região da lista ficava com 0 px (9 linhas existentes, invisíveis) e o rodapé "Vincular reunião" transbordava 66 px por cima da transcrição. Correção: 5f20a3d (seletor toma o corpo, densidade compacta, regra :has() no panel.css; validado na tela real com 3 linhas inteiras visíveis) e 14e94cd (botão "Selecionar cliente" da barra no verde sólido da CITi). Reteste da parte A com o build novo: PASSOU (confirmado pelo usuário em 2026-10-24). Falta só a parte B (saída larga, exige reunião encerrada e não enviada com falas), a conferir na Reunião 3 do roteiro D-20; este teste só vira pass quando ela for vista. Parte B, 1ª tentativa REPROVADA em 2026-10-24 (print "Captura de tela 2026-10-24 174251.png"): na saída larga a transcrição do RecordDetail aparecia por cima das linhas do seletor. Causa: o AgenteEndSlot monta o seletor como "fixed inset-0" dentro do cabeçalho .glass do RecordDetail, e backdrop-filter faz do cabeçalho o bloco de referência do fixed (medido no Chrome: 1486x200 dentro do pai x 1526x730 no body); o AppShell interno (altura mínima 460) transbordava sob a transcrição. Correção ca1993a (createPortal no document.body). Não foi possível ver a saída larga ao vivo (páginas de extensão bloqueadas à automação), então o reteste da parte B é do usuário. Reteste da parte B: PASSOU (confirmado pelo usuário em 2026-10-24); teste 3 completo (A e B).
rationale: O seletor ainda não está montado em nenhuma tela (fiação nos planos 08-10/08-14); o aspecto visual e o overflow só são conferidos no teste manual D-20.

### 4. 08-04 D6 — Aparência fiel ao UI-SPEC no painel de 320/564 px e na saída…
expected: Aparência fiel ao UI-SPEC no painel de 320/564 px e na saída larga (uma linha da barra em 396 px, overflow do selo ao lado do StatusBadge)
result: pass
evidence: 2026-10-24, passo 1 (selo "Enviada"/"Sem cliente" no histórico do painel) PASSOU. Passo 2 (barra com nome de 97 caracteres) REPROVADO no Meet real e corrigido, aguardando reteste: o painel é um grid de 396 px com overflow-hidden e o corpo (item de grid) herdou largura mínima automática do conteúdo, alargando a coluna para 684 px; a barra ficou com 656 px (devia ser 368), o truncate nunca atuou e os botões do cabeçalho e o "Finalizar" saíram para fora do painel (print do usuário: Captura de tela 2026-10-24 164547.png). Correção 79690b8 (grid-cols-[minmax(0,1fr)] no section, validada na tela real: corpo 396, barra 368, nome truncado em uma linha, 5 botões dentro do painel). O botão "Selecionar cliente" verde sólido da barra (14e94cd) foi visto aprovado. Reteste dos passos 2 a 4 com o build novo: PASSOU (confirmado pelo usuário em 2026-10-24).
rationale: As três peças ainda não estão montadas em nenhuma tela (fiação nos planos 08-14/08-17); o aspecto visual e o overflow só são conferidos no teste manual D-20.

### 5. 08-05 D6 — Bloco de 20 e pausa de 1 s aguentam uma reunião real sem…
expected: Bloco de 20 e pausa de 1 s aguentam uma reunião real sem derrubar o backend (suposição A3)
result: pass
evidence: 2026-10-25, FECHADO POR SIMULAÇÃO DO SERVIDOR (escolha do usuário; a reunião real não passa de poucas falas sozinho, porque o Meet mantém uma única linha de legenda por voz e a Taqciti só estende o texto). Script que imita o meetingUploader (uma requisição por vez, blocos de 20, pausa de 1 s entre blocos, chunk_id bulk:{reunião}:{i}) contra o backend local e o Supabase de produção, duas rodadas de 45 partes (sessões 68e38421 e 93b18c84, nome "SIMULACAO..."): 45/45 com 202 em cada rodada, pausas medidas de 1,00 s, ordem de gravação igual à do envio, 0 duplicatas, reenvio de 3 falas com o mesmo chunk_id respondeu 202 sem criar linha (dedup real no Supabase), finish 200, backend vivo e 0 erros no log. A 1ª rodada saiu lenta (2,2 s por fala) por artefato do cliente Python no Windows (localhost tenta IPv6 primeiro; provado: fala vazia 2,1 s em localhost x 0,004 a 0,022 s em 127.0.0.1); a 2ª, em 127.0.0.1, mostra a cadência real: mediana 0,21 s por fala e 14 s no total. NÃO validado ao vivo: a extensão real enviando 21 ou mais partes (a lógica de blocos e pausas passa nos testes automáticos do 08-05; o envio real ponta a ponta foi com 2 partes). Dados de teste a limpar em produção: sessões 68e38421 e 93b18c84. Histórico da 1ª tentativa abaixo.
evidence_anterior: 2026-10-24, 1ª tentativa INCONCLUSIVA: o envio da reunião encerrada funcionou ponta a ponta (sessão fa3cd913 criada, 2 POST /webhook/extension com 202, finish 200 em 12 s, 0 erros no log do backend), mas a reunião tinha só 2 falas (cada fala = uma linha de legenda do Meet, e fala contínua de um mesmo falante vira uma linha só, no caso um podcast tocando). Com menos de 21 partes o bloco de 20 e a pausa de 1 s NÃO foram exercitados. Refazer com pelo menos 21 falas (ideal 45).
rationale: O backend nunca recebeu rajada e o motor ainda não está ligado a nenhuma tela (fiação no plano 08-10); a carga real só é validada no teste manual D-20(a).

### 6. 08-07 D4 — A Taqciti de fato lista os clientes e cria sessão contra o…
expected: A Taqciti de fato lista os clientes e cria sessão contra o backend rodando (ponta a ponta)
result: pass
evidence: 2026-10-25, confirmado pelo usuário com evidência de log e banco da reunião do cliente "vis" (2026-10-24): GET /webhook/extension/clients 200 (várias vezes, lista com os clientes reais), POST clients 201, POST sessions 201, POST /webhook/extension 202 com as falas, finish 200 sem erro; sessão c59f17f6 com source extension, projeto vis em modo discovery, 4 falas, encerrada. O usuário viu a barra verde "Enviando ao vivo" logo após criar o cliente.
rationale: Fluxo ponta a ponta com a extensão e o backend reais é o teste manual D-20 do fim da fase; este plano só prova as rotas com fakes

### 7. 08-08 D4 — Formulário sem campo obrigatório e com apoio 'Opcional...';…
expected: Formulário sem campo obrigatório e com apoio 'Opcional...'; tela do projeto com 'Usando a chave do servidor' (build e testes do frontend verdes)
result: pass
evidence_2026-10-25: reconferido após o merge do redesign do Gabriel, e confirmado pelo usuário: formulário /projects/new com só Nome, Cliente, Modo e Fonte como obrigatórios e a chave Gemini com a dica "Opcional. Sem chave própria, o Agente usa a chave do servidor."; página do projeto "vis" com Chave Gemini = "Usando a chave do servidor". Testes do frontend 17/17 e build (tsc -b && vite build) verdes. (O usuário abriu a 1ª vez localhost:8000, que é o backend e devolve erro 422 em rota interna; o web app é o localhost:5173.)
rationale: A aparência e o texto na tela real são julgamento visual; o build prova só que compila
evidence: Evidência colhida em 2026-10-22: formulário "Novo projeto" mostra a dica "Opcional. Sem chave própria, o Agente usa a chave do servidor." e a página do projeto mostra o chip "Usando a chave do servidor" (visto no navegador); build e testes do frontend verdes.

### 8. 08-08 D5 — Criar projeto sem chave no web app e abrir sessão: o pipeline…
expected: Criar projeto sem chave no web app e abrir sessão: o pipeline responde com a chave do servidor (ponta a ponta)
result: pass
evidence: 2026-10-25, confirmado pelo usuário. Sessão e3295f4f do cliente ZZ-TESTE-D20 (projeto sem chave própria, modo discovery; projeto criado pela Taqciti e sessão aberta pela API da extensão, não pelo formulário do web app), 8 falas de conteúdo real e a sessão mantida aberta por 80 s: tokens_used 2117, cost_usd 0.00061095, 1 coverage_snapshot, 4 red_flags, 5 prompts gerados, sem erro no log. Como o projeto não tem chave própria, a resposta veio da GEMINI_API_KEY do ambiente do backend LOCAL. As duas simulações anteriores (conteúdo sintético sem sentido, "Simulação de carga") ficaram com 0 tokens e 0 saídas, sem erro: o pipeline engole falhas em silêncio (except Exception: pass em _coverage_task e _red_flag_task). O Railway segue sem a variável GEMINI_API_KEY (lembrete pendente).
rationale: Teste manual D-20 do fim da fase; BLOQUEADO enquanto GEMINI_API_KEY não existir no ambiente do backend (Railway ainda sem a variável)

### 9. 08-09 D4 — Migração aplicada no Supabase de produção com coluna e índice…
expected: Migração aplicada no Supabase de produção com coluna e índice conferidos, linhas antigas intactas
result: pass
evidence_2026-10-25: reconferido em modo leitura no Supabase de produção (projeto Agente-Diagnostico, ACTIVE_HEALTHY) a pedido do usuário: coluna transcript_chunks.chunk_id (text) existe; índice ux_transcript_chunks_session_chunk UNIQUE btree (session_id, chunk_id) existe; linhas antigas intactas: 1562 sem chunk_id (exatamente as mesmas 1562 de 2026-10-22, de 15 sessões, de 2026-06-21 a 2026-10-11, todas anteriores à migração) e 111 com chunk_id (as de hoje); 0 pares (session_id, chunk_id) duplicados. A deduplicação real (suposição A2) também foi vista em uso: nas duas rodadas de simulação, 3 reenvios com o mesmo chunk_id responderam 202 e não criaram linha nova.
rationale: Ação externa ao repositório, conferida pelas consultas da Task 3 (ver seção abaixo); a dedup real contra o Supabase (suposição A2) é provada no teste manual D-20 (b).
evidence: Evidência colhida em 2026-10-22 (SQL de leitura no Supabase de produção): coluna transcript_chunks.chunk_id (text) existe; índice único ux_transcript_chunks_session_chunk (session_id, chunk_id) existe; 1562 linhas antigas intactas (todas com chunk_id nulo).

### 10. 08-10 D7 — Transmissão de ponta a ponta com os botões reais (painel,…
expected: Transmissão de ponta a ponta com os botões reais (painel, seletor, saída larga)
result: pass
evidence: 2026-10-25, confirmado pelo usuário e conferido no banco: envio da reunião "Meet" (3 falas) pela saída larga (RecordDetail, "Enviar ao Agente" -> seletor -> "Enviar reunião"): sessão dcb62c06 do cliente ZZ-TESTE-D20, source extension, 3 falas com chunk_id bulk:0, bulk:1, bulk:2 na ordem, encerrada sozinha 2,3 s depois. Vínculo ao vivo pelo painel (bolha, cartão, seletor, "Vincular reunião") e envio de reunião encerrada pelo cartão do painel já tinham sido vistos. Durante este teste o usuário achou outro defeito, no painel do Meet (tela "Transcrição salva": seletor sem lista e botão "Enviar reunião" por cima de "Copiar"/"Baixar .txt", print "Captura de tela 2026-10-24 224416.png"), tratado em commit à parte abaixo.
rationale: Nenhuma tela dispara os comandos ainda (fiação nos planos 08-14, 08-17 e 08-18) e as rotas reais do backend (B1) entram no 08-12; só o teste manual D-20 prova a cadeia inteira.

### 11. 08-11 D6 — Queda do Agente, reinício do service worker e reenvio de…
expected: Queda do Agente, reinício do service worker e reenvio de ponta a ponta com a fila
result: pass
evidence: 2026-10-26, Rodada 1 / Blocos B, C e E no Chrome e Meet reais. Bloco E (fila durável): backend derrubado às 13:55:10, falas novas ficaram na fila com a faixa amarela; Stop do service worker COM falas pendentes: a faixa continuou e seguiu registrando falas novas (relato do usuário); saída da call às 13:57:57 e recarga da extensão (E5) sem problema (relato do usuário). Backend religado às 14:03:50: em 26 s as 7 falas pendentes chegaram na sessão 04dc47ee (13 para 20 falas), 0 chunk_id duplicado, nenhuma sessão nova. Detalhe: o log mostra o finish (200) ANTES das falas pendentes, porque o prazo de 5 min já tinha vencido (regra B4-b); as falas atrasadas foram aceitas na sessão já encerrada.
evidence_parcial: 2026-10-26, Bloco B: queda do Agente, faixa amarela com contagem ("2 falas na fila"), reenvio automático na volta e toast conferidos no Chrome real (ver teste 17). Bloco C: Stop do service worker (DevTools) com o vínculo em pé e a fila VAZIA: a barra seguiu "Enviando ao vivo para ZZ-TESTE-D20", sem faixa amarela; 2 falas novas entraram na MESMA sessão 04dc47ee (11 para 13, 0 duplicatas, nenhuma sessão nova). FALTA só reiniciar o service worker com falas PENDENTES na fila (fila durável): fica no Bloco E, junto com a queda do backend antes de sair da call.
rationale: Neste plano a fila e o status só existem e são testados isolados (nada os usa); o sender e a prova ponta a ponta ficam no plano 08-23 e no teste manual D-20.

### 12. 08-12 D5 — Ponta a ponta com o backend local e a extensão carregada:…
expected: Ponta a ponta com o backend local e a extensão carregada: seletor lista clientes reais, cria cliente (aparece no web app com mode discovery), vincula e a transcrição chega na sessão nova
result: pass
evidence: 2026-10-25, mesma evidência do teste 6, confirmada pelo usuário: o seletor listou clientes reais, o cliente criado pela Taqciti ("vis" e depois "ZZ-TESTE-D20 …") aparece em /projects com mode discovery (conferido pela API do backend), o vínculo criou a sessão e a transcrição chegou na sessão nova (4 falas no banco para a sessão c59f17f6; 2 em fa3cd913).
rationale: Human-check consolidado no teste manual D-20 do fim da fase; este plano prova o contrato com fetch simulado, sem backend nem Chrome reais.

### 13. 08-13 D3 — Apagar (ui/history/delete) remove também a associação
expected: Apagar (ui/history/delete) remove também a associação
result: pass
evidence: 2026-10-26, confirmado pelo usuário (relato): fez e viu funcionar no sábado 24/10 o "Apagar" de uma reunião já enviada e o "Descartar" com "Manter reunião". São ações só da interface da Taqciti, sem rastro no banco; o relato é a única evidência.
rationale: index.ts não tem harness de teste (sem teste de roteamento no repositório); coberto por grep + typecheck e pelo teste manual D-20(c)

### 14. 08-14 D5 — Experiência real no Meet: bolha pulando a cada ~5 s na…
expected: Experiência real no Meet: bolha pulando a cada ~5 s na cápsula, clique abrindo o painel com o cartão, arraste da cápsula intacto, Esc no cartão sem minimizar, seletor com ao menos 3 linhas em 564 px
result: pass
evidence: 2026-10-26, Rodada 1 / Bloco A no Meet real, confirmado pelo usuário passo a passo: cápsula arrastada para outro canto fica onde soltou sem abrir o painel; clique na bolha "!" abre o cartão e Esc fecha o cartão sem minimizar o painel e sem enviar nada; vínculo ao cliente ZZ-TESTE-D20 mostrou "Enviando o que já foi falado…" e depois "Enviando ao vivo para…" em uma linha. Banco conferido: sessão 04dc47ee, ZZ-TESTE-D20, source extension, active, 2 falas com chunk_id bulk:<reunião>:0 e :1 em ordem (13:35:15 e 13:35:17), 0 duplicatas. Os itens bolha pulando, clique abrindo o cartão e seletor com 3 linhas já tinham passado nos testes 2 e 3 (2026-10-24).
rationale: Animação, arraste (useFloating), captura de ponteiro, altura real do seletor no painel e shadow DOM não são exercitados pelo jsdom; é o human-check da Task 3 e o teste manual D-20

### 15. 08-16 D4 — O encerramento automático funcionando de ponta a ponta com o…
expected: O encerramento automático funcionando de ponta a ponta com o Chrome e o backend (agendador, fiação e permissão alarms são dos planos 08-27 e 08-25)
result: pass
evidence: 2026-10-26, confirmado pelo usuário (relato): no sábado 24/10 saiu da call no Chrome real e viu a sessão encerrar. Corroboração parcial no banco: as sessões de teste de sábado estão todas com status finished e finished_at preenchido. Os gatilhos "5 min com o envio parado" e "no boot" NÃO foram vistos; ficam no teste 22.
rationale: Este plano é só o alicerce inerte; o comportamento real depende do agendador (08-27) e é exercitado no roteiro D-20 do 08-21.

### 16. 08-17 D3 — Fiação no PanelApp/RecordDetail e frase 'A cópia que já foi…
expected: Fiação no PanelApp/RecordDetail e frase 'A cópia que já foi enviada ao Agente continua lá.' no Apagar
result: pass
evidence: 2026-10-26, confirmado pelo usuário (relato): fez e viu funcionar no sábado 24/10 o "Apagar" de reunião já enviada. Ressalva a confirmar: o relato não detalha se o ConfirmModal ficou contido dentro do painel do Meet (risco anotado na Retomada, mesmo mecanismo do ca1993a). Se não ficou, reabrir como defeito.
rationale: PanelApp e RecordDetail não têm teste de composição no repositório; coberto por typecheck, build e greps de gate. Falta a checagem visual D-20 (a, c), inclusive o ConfirmModal contido no painel do Meet (scale-100).

### 17. 08-19 D4 — Dedup real contra o Supabase (reenvio de fala já gravada não…
expected: Dedup real contra o Supabase (reenvio de fala já gravada não vira duplicata na transcrição) e comportamento com o backend local derrubado durante uma reunião
result: pass
evidence: 2026-10-26, Rodada 1 / Bloco B no Chrome e Meet reais, com o backend local derrubado de verdade (13:40:07, conexão recusada) e religado (~13:43). Duas vozes (PC e celular na mesma sala) geraram falas novas. Com o Agente fora do ar a faixa amarela apareceu com "2 falas na fila" (as 2 faladas na queda); com a volta, o banco ficou com 11 falas na sessão 04dc47ee (9 antes + 2 reenviadas às 13:43:10 e 13:43:13), em ordem e com 0 chunk_id duplicado. Confirmado pelo usuário: "deu tudo certo".
rationale: Depende do backend real e do índice único em produção; é o teste manual D-20 (b) no fim da fase.

### 18. 08-20 D7 — Retomada de ponta a ponta com o Chrome e o backend reais:…
expected: Retomada de ponta a ponta com o Chrome e o backend reais: derrubar a rede no meio do envio de uma reunião longa, voltar, clicar em 'Continuar envio' e conferir que o Agente recebe cada fala uma vez; repetir com a sessão já encerrada (envio parado há mais de 5 min) e ler o aviso da DA-2
result: pass
evidence: 2026-10-26, Rodada 2, Chrome e Meet reais, reunião de 10 falas enviada no fim ("Selecionar cliente" na tela "Transcrição salva") ao cliente ZZ-TESTE-D20. O corte foi feito com um filtro de teste na frente do backend local (embrulho ASGI numa pasta temporária, fora do repositório) que segura as falas depois de N liberadas; a fala segurada nunca chega ao backend real. Sessão f0120ad3. (1) Corte depois de 3 falas: painel "O envio parou na parte 3 de 10. O que já chegou continua no Agente." + "Continuar envio"; banco com exatamente 3 falas (bulk:…:0 a 2), 0 duplicadas, sessão ativa. (2) Retomada em tempo (19:02): "Continuar envio" mandou as partes 4 e 5 sem repetir as 3 primeiras e parou de novo em "parte 5 de 10", SEM o aviso de sessão encerrada; banco com 5 falas (0 a 4), 0 duplicadas, sessão ativa. (3) Sem clicar em nada, a Taqciti encerrou a sessão sozinha às 19:09:22 (5 min depois da parada; log: POST …/finish 200; banco: finished, 5 falas). (4) A tela de "parou" passou a mostrar também o aviso DA-2 ("A sessão no Agente já foi encerrada. O restante entra na transcrição, mas o relatório precisa ser gerado de novo."); "Continuar envio" levou a "Reunião enviada para ZZ-TESTE-D20…"; banco com 10 falas (0 a 9), 0 duplicadas e a sessão continuando encerrada (finished_at inalterado). Bônus: uma reunião de 7 falas enviada sem corte (sessão 87c8bc5f) chegou inteira, sem duplicata, e a sessão encerrou ao fim do envio. Ressalva: o "Continuar envio" cruzando o bloco de 20 falas (reunião com 24+ falas) não foi exercitado na prática; fica como extra opcional, decisão do usuário/time. Ver também a observação sobre a primeira tentativa (sessão e5bc6cd3) em "Observações para o time".
rationale: Depende do Chrome real, do backend com a dedup por chunk_id (migration do 08-19) aplicada no banco e da rota de finish (08-15); é o roteiro manual D-20 do 08-21.

### 19. 08-22 D6 — Bolha '!' e barra de vínculo aparecendo de verdade numa…
expected: Bolha '!' e barra de vínculo aparecendo de verdade numa reunião real do Meet, e o reinício do service worker no meio de um vínculo
result: pass
evidence: 2026-10-26 (18:49 a 18:55), Rodada 2, Chrome e Meet reais: reunião ao vivo SEM cliente, com falas. O backend local passou a SEGURAR só o pedido de "criar sessão" (filtro de teste fora do repositório; o pedido segurado nunca chega ao backend real, então não nasce sessão-fantasma). O usuário abriu "Selecionar cliente", escolheu ZZ-TESTE-D20, clicou em "Vincular reunião" e, em menos de 10 s, parou o service worker (DevTools, Application, Service workers, Stop). A barra mostrava "Enviando o que já foi falado…" ANTES do Stop e não mudou sozinha (o timeout de 10 s da Taqciti não ganhou, a janela estrita foi atingida). Depois do Stop e da volta ao painel a barra ficou em "Sem cliente. A transcrição fica só aqui." (não ficou presa). Banco: 0 sessão criada (41 sessões no total, 0 ativas). O log mostra 3 tentativas de criar sessão seguradas (o usuário repetiu até acertar a janela); vale a última.
evidence_parcial: 2026-10-26, Rodada 1: a bolha "!" e a barra de vínculo já foram vistas no Meet real (testes 2, 4 e 6 e Bloco A de hoje). O Stop do service worker com o vínculo JÁ EM PÉ (não no meio) passou no Bloco C: a barra seguiu "Enviando ao vivo para ZZ-TESTE-D20" e a sessão 04dc47ee recebeu mais 2 falas, sem sessão nova. (O reinício DURANTE o vínculo ficou para a Rodada 2 e foi fechado lá: ver `evidence`.)
rationale: Nenhum teste automático abre o Meet nem reinicia o service worker de verdade; só o teste manual D-20 prova a cadeia com as telas montadas.

### 20. 08-23 D7 — Reenvio automático ligado de verdade em produção,…
expected: Reenvio automático ligado de verdade em produção, deduplicação por chunk_id e o comportamento num Chrome real (reinício real do service worker, cota do storage)
result: pass
evidence: 2026-10-26, Rodada 1 / Blocos B, C e E: reenvio automático real depois de DUAS quedas do Agente (13:40 a 13:43 e 13:55 a 14:03), dedup por chunk_id em uso (0 duplicatas nas 20 falas da sessão 04dc47ee), reinícios reais do service worker (Stop com fila vazia no Bloco C, Stop com falas pendentes e recarga da extensão no Bloco E) sem perder vínculo nem fila, e cota do storage medida: getBytesInUse(null) = 573916 bytes (~560 KB), bem abaixo dos ~5 MB; unlimitedStorage NÃO é necessário.
evidence_parcial: 2026-10-26, Bloco B: reenvio automático real, dedup por chunk_id (0 duplicatas) e cota do storage medida no service worker: chrome.storage.local.getBytesInUse(null) = 573916 bytes (~560 KB, bem abaixo dos ~5 MB; não precisa de unlimitedStorage). Bloco C: Stop real do service worker com vínculo em pé e fila vazia, sem perder o vínculo nem duplicar (sessão 04dc47ee, 13 falas, 0 duplicatas). FALTA só reiniciar o service worker com falas PENDENTES na fila: fica no Bloco E.
rationale: O reenvio nasce desligado até a decisão B3 (plano 08-19) e o chunk_id ainda não vai no corpo; o reinício real e a medição de getBytesInUse ficam no teste manual D-20 (08-21).

### 21. 08-24 D6 — Voltar à mesma sala depois do encerramento no Chrome real…
expected: Voltar à mesma sala depois do encerramento no Chrome real mostra a bolha '!' de reunião nova e a escolha do cliente cria uma sessão NOVA só com o que foi dito depois da volta
result: pass
evidence: 2026-10-26, confirmado pelo usuário (relato): voltou à mesma sala depois de encerrar no sábado 24/10 e viu a bolha "!" de reunião nova e a sessão NOVA. O banco não guarda a sala da reunião, então não há como corroborar; o relato é a única evidência.
rationale: Ponta a ponta com Chrome, Meet e backend: é o roteiro manual D-20 do 08-21, depois da fiação do 08-25.

### 22. 08-25 D5 — A sessão é de fato encerrada no backend, de ponta a ponta,…
expected: A sessão é de fato encerrada no backend, de ponta a ponta, com o Chrome real: ao terminar a reunião, 5 minutos depois com o envio parado, no boot, e nunca durante a reunião ao vivo
result: pass
evidence: 2026-10-26, Rodada 1 / Bloco E, Chrome e backend reais, os quatro gatilhos vistos: (1) "ao terminar a reunião": relato do usuário (testes 15 e 24); (2) "nunca ao vivo": sessão 04dc47ee ativa por mais de 16 min ao vivo, inclusive com ~3 min de queda do Agente; (3) "5 min com o envio parado": saída da call às 13:57:57 com o backend fora do ar e falas pendentes; com o backend de volta às 14:03:50 (5 min 53 s depois da saída) a sessão foi encerrada sozinha em 26 s (finish 200, fim 14:04:16); (4) "no boot": a extensão foi recarregada (E5, ~13:59:57, o que limpa os alarmes do Chrome) e mesmo assim o encerramento aconteceu quando o backend voltou. Banco: status finished, 20 falas, 0 chunk_id duplicado. Observação para o time (não é defeito do teste): como o encerramento sai ao vencer o prazo mesmo com falas pendentes, as últimas falas chegam DEPOIS do finish e a exportação ao DocuData agendada no finish pode sair sem elas.
evidence_parcial: 2026-10-26: (a) "ao terminar a reunião": coberto pelo relato do usuário nos testes 15 e 24. (b) "nunca durante a reunião ao vivo": a sessão 04dc47ee seguiu ativa por mais de 16 min ao vivo (iniciada 13:35:14, conferida 13:51:15), inclusive com ~3 min de queda do Agente (13:40 a 13:43) e dois reinícios de fila, sem nenhum encerramento automático. FALTAM: "5 min com o envio parado" e "no boot" (Bloco E).
rationale: Depende do Chrome real (alarme que acorda o service worker, reinício do navegador) e do backend com a rota de finish (08-15) no ar; é o roteiro manual D-20 do 08-21.

### 23. 08-26 D6 — No Chrome real, fechar a aba do Meet no meio da call encerra…
expected: No Chrome real, fechar a aba do Meet no meio da call encerra a sessão no web app em poucos segundos (com o 08-25 ligado) e a volta à sala mostra a bolha '!' de reunião nova
result: pass
evidence: 2026-10-26, confirmado pelo usuário (relato): fechou a aba do Meet no meio da call no sábado 24/10 e a sessão encerrou. Ação só da interface e do navegador, sem rastro específico no banco; o relato é a única evidência.
rationale: Ponta a ponta com Chrome, Meet e backend: é o roteiro manual D-20 do 08-21, passo i, depois da fiação do 08-25.

### 24. 08-27 D5 — O encerramento automático funcionando de ponta a ponta com o…
expected: O encerramento automático funcionando de ponta a ponta com o Chrome e o backend (fiação, permissão alarms e gatilhos são do plano 08-25)
result: pass
evidence: 2026-10-26, confirmado pelo usuário (relato): mesmo encerramento automático do teste 15 (sair da call e a sessão encerrar), visto de ponta a ponta no Chrome real. Gatilhos "5 min com o envio parado" e "no boot" seguem no teste 22.
rationale: Este plano entrega o agendador INERTE; o comportamento real depende da fiação do 08-25 e é exercitado no roteiro D-20 do 08-21.

### 25. 08-01 D1 — Na composição de produção nenhuma fala sai se a reunião não…
expected: Na composição de produção nenhuma fala sai se a reunião não tiver associação linked (mesmo com agenteSessionId salvo na config); linked manda sempre para association.sessionId, qualquer que seja a origem (picker ou manual-id)
result: pass
source: automated
coverage_id: 08-01/D1

### 26. 08-01 D2 — Vínculo em andamento (linking) segura o envio sem perder o…
expected: Vínculo em andamento (linking) segura o envio sem perder o cursor; a semente (inclusive {}) evita perda e duplicata, é consumida depois de adotada, e reevaluateAgenteStreamer manda uma vez o que veio depois da semente quando a reunião acabou durante o vínculo
result: pass
source: automated
coverage_id: 08-01/D2

### 27. 08-01 D3 — idle não cancela falas já endereçadas da reunião anterior;…
expected: idle não cancela falas já endereçadas da reunião anterior; disabled descarta tudo (D-09); o CR-01 da Fase 7 não bloqueia nem é regravado para uma associação manual-id
result: pass
source: automated
coverage_id: 08-01/D3

### 28. 08-01 D4 — Reducer completo da associação com fim da reunião, retomada…
expected: Reducer completo da associação com fim da reunião, retomada da mesma sala e conclusão definidos para cada um dos 9 estados; transição ilegal devolve a mesma referência
result: pass
source: automated
coverage_id: 08-01/D4

### 29. 08-01 D5 — Store de associações: escritas concorrentes serializadas,…
expected: Store de associações: escritas concorrentes serializadas, lista branca sem segredo, semente {} preservada, remoção pontual e assinatura para a UI
result: pass
source: automated
coverage_id: 08-01/D5

### 30. 08-01 D6 — A mecânica de janela, retry e vínculo CR-01 da Fase 7…
expected: A mecânica de janela, retry e vínculo CR-01 da Fase 7 continua intacta (rodando com a política configDestination explícita)
result: pass
source: automated
coverage_id: 08-01/D6

### 31. 08-02 D1 — O kit tem o ícone alert (traço 1.8, currentColor) e o…
expected: O kit tem o ícone alert (traço 1.8, currentColor) e o keyframe nudge de 5 s só com transform; o bloco do keyframe não contém opacity
result: pass
source: automated
coverage_id: 08-02/D1

### 32. 08-02 D2 — ConfirmModal aceita cancelLabel (padrão Cancelar); Esc,…
expected: ConfirmModal aceita cancelLabel (padrão Cancelar); Esc, clique no fundo e botão de recusa chamam onCancel; clique na caixa não; fechado não renderiza
result: pass
source: automated
coverage_id: 08-02/D2

### 33. 08-02 D3 — AgenteNudge: aria-label/title exatos, caixa 32 px, círculo 20…
expected: AgenteNudge: aria-label/title exatos, caixa 32 px, círculo 20 px warning, animate-nudge só com bouncing, cápsula decorativa, sem foco roubado
result: pass
source: automated
coverage_id: 08-02/D3

### 34. 08-02 D4 — AgenteDecisionCard: cópia exata do UI-SPEC; botão Depois, × e…
expected: AgenteDecisionCard: cópia exata do UI-SPEC; botão Depois, × e Esc chamam onDefer; Esc não chega ao listener de document; sem foco roubado
result: pass
source: automated
coverage_id: 08-02/D4

### 35. 08-03 D1 — A origem dos clientes fica atrás de…
expected: A origem dos clientes fica atrás de ClientDirectory/AgenteSessionGateway; as implementações de produção 'indisponível' rejeitam com ClientDirectoryUnavailableError e o seletor nunca chama API
result: pass
source: automated
coverage_id: 08-03/D1

### 36. 08-03 D2 — Busca local insensível a maiúsculas e acentos em pt-BR, por…
expected: Busca local insensível a maiúsculas e acentos em pt-BR, por cliente ou projeto; ordenação por Intl.Collator('pt-BR'); duplicidade, dica da linha e contador
result: pass
source: automated
coverage_id: 08-03/D2

### 37. 08-03 D3 — Picker: estados carregando (4 esqueletos + texto polite,…
expected: Picker: estados carregando (4 esqueletos + texto polite, busca/criar desabilitados), vazio, busca sem resultado, populado com contador, seleção em dois passos e CTA por modo (live/ended), busy e erro de carregamento
result: pass
source: automated
coverage_id: 08-03/D3

### 38. 08-03 D4 — Criar cliente inline: trim, vazio/espacos desabilita,…
expected: Criar cliente inline: trim, vazio/espacos desabilita, duplicado sem acento/caixa recusado, preenchido pela busca, 'Criando…' inerte, erro preserva o texto, Esc volta à lista sem chegar ao document
result: pass
source: automated
coverage_id: 08-03/D4

### 39. 08-03 D5 — Plano B do ID manual: campo só com status error (ausente em…
expected: Plano B do ID manual: campo só com status error (ausente em ready/loading), UUID validado antes de habilitar, ID limpo (trim) enviado, busy preserva o valor
result: pass
source: automated
coverage_id: 08-03/D5

### 40. 08-03 D6 — Nome de cliente é sempre texto: nenhum…
expected: Nome de cliente é sempre texto: nenhum dangerouslySetInnerHTML, teste com nome HTML renderizado literalmente, title com o nome completo
result: pass
source: automated
coverage_id: 08-03/D6

### 41. 08-04 D1 — Barra de vínculo mostra os 6 estados (deferred, linking,…
expected: Barra de vínculo mostra os 6 estados (deferred, linking, linked, offline, rejected, stopped) com as cópias exatas do UI-SPEC, linha única de no mínimo 40 px, e 'fala'/'falas' conforme o número
result: pass
source: automated
coverage_id: 08-04/D1

### 42. 08-04 D2 — Agente fora do ar é aviso warning (role status, aria-live…
expected: Agente fora do ar é aviso warning (role status, aria-live polite) com a contagem na fila em tabular-nums; nenhum estado de parada usa text-danger
result: pass
source: automated
coverage_id: 08-04/D2

### 43. 08-04 D3 — Envio em partes mostra ProgressRail '{x} de {y}' (singular '1…
expected: Envio em partes mostra ProgressRail '{x} de {y}' (singular '1 de 1', uma única ocorrência) e não tem botão Cancelar nem Continuar envio
result: pass
source: automated
coverage_id: 08-04/D3

### 44. 08-04 D4 — Nome do cliente (200+ caracteres) em barra, 'Enviando para',…
expected: Nome do cliente (200+ caracteres) em barra, 'Enviando para', 'Reunião enviada para' e 'Enviada para' usa truncate + title; nome com HTML aparece como texto literal
result: pass
source: automated
coverage_id: 08-04/D4

### 45. 08-04 D5 — Selo de associação mapeia no-client (warning), sending…
expected: Selo de associação mapeia no-client (warning), sending (primary com ponto animate-pulse-dot), sent (primary), stopped (warning); o estado é obrigatório (sem padrão)
result: pass
source: automated
coverage_id: 08-04/D5

### 46. 08-05 D1 — A reunião guardada vira um plano de partes ordenado, uma por…
expected: A reunião guardada vira um plano de partes ordenado, uma por segmento com texto, com índice (sem renumerar segmentos vazios), chave igual à do cursor do streamer, chunkId determinístico bulk:{meetingId}:{index} e contagem de palavras
result: pass
source: automated
coverage_id: 08-05/D1

### 47. 08-05 D2 — seedFromParts devolve, por chave de segmento, as palavras…
expected: seedFromParts devolve, por chave de segmento, as palavras cobertas pelo envio — a semente para o streamer não perder nem repetir palavras
result: pass
source: automated
coverage_id: 08-05/D2

### 48. 08-05 D3 — Envio serial (máximo de requisições em voo = 1), em blocos de…
expected: Envio serial (máximo de requisições em voo = 1), em blocos de 20 com pausa de 1000 ms (2 pausas em 45 partes, nenhuma depois da última) e progresso 1..45
result: pass
source: automated
coverage_id: 08-05/D3

### 49. 08-05 D4 — Falha retryable esgotadas as novas tentativas (1 + 3, espera…
expected: Falha retryable esgotadas as novas tentativas (1 + 3, espera 1000/2000/4000) ou recusa 4xx para o envio e devolve quantas partes chegaram; nada é pulado; send que lança vira erro de rede
result: pass
source: automated
coverage_id: 08-05/D4

### 50. 08-05 D5 — Retomar com startAt envia só as partes da posição >= startAt…
expected: Retomar com startAt envia só as partes da posição >= startAt (progresso começa em startAt + 1); isCancelled para antes da próxima parte com done correto
result: pass
source: automated
coverage_id: 08-05/D5

### 51. 08-06 D1 — Duas chamadas concorrentes de get_or_create para a mesma…
expected: Duas chamadas concorrentes de get_or_create para a mesma sessão devolvem o mesmo pipeline, com um único start, um único registro e uma única consulta à tabela sessions
result: pass
source: automated
coverage_id: 08-06/D1

### 52. 08-06 D2 — O lock é por session_id: com a sessão A presa no LLM, a…
expected: O lock é por session_id: com a sessão A presa no LLM, a sessão B termina sem esperar
result: pass
source: automated
coverage_id: 08-06/D2

### 53. 08-06 D3 — Sessão encerrada com allow_finished=True continua devolvendo…
expected: Sessão encerrada com allow_finished=True continua devolvendo pipeline de uso único (load_state_only), sem registrar em _pipelines e sem start; sessão inexistente devolve None sem deixar lock sobrando
result: pass
source: automated
coverage_id: 08-06/D3

### 54. 08-06 D4 — ExtensionChunk aceita e ignora um campo extra chunk_id, e…
expected: ExtensionChunk aceita e ignora um campo extra chunk_id, e extension_webhook só grava session_id, speaker e text no banco (evidência da suposição A1 para a decisão B3)
result: pass
source: automated
coverage_id: 08-06/D4

### 55. 08-07 D1 — GET /webhook/extension/clients devolve só id, client e name,…
expected: GET /webhook/extension/clients devolve só id, client e name, mesmo que o repositório traga contexto e orçamento; client em branco vira o name e name nulo vira vazio
result: pass
source: automated
coverage_id: 08-07/D1

### 56. 08-07 D2 — POST /webhook/extension/sessions cria sessão active, source…
expected: POST /webhook/extension/sessions cria sessão active, source extension, nome padrão 'Reunião pela Taqciti', e devolve 404 sem inserir nada quando o projeto não existe
result: pass
source: automated
coverage_id: 08-07/D2

### 57. 08-07 D3 — As duas rotas passam pelo mesmo gate verify_extension_key da…
expected: As duas rotas passam pelo mesmo gate verify_extension_key da Fase 6, sob o prefixo /webhook/extension, sem rota vazia; o router está registrado uma vez em routers/__init__.py e main.py
result: pass
source: automated
coverage_id: 08-07/D3

### 58. 08-08 D1 — ProjectCreate sem gemini_api_key é válido (None) e com chave…
expected: ProjectCreate sem gemini_api_key é válido (None) e com chave continua válido
result: pass
source: automated
coverage_id: 08-08/D1

### 59. 08-08 D2 — create_project sem chave (ou com string vazia) não chama o…
expected: create_project sem chave (ou com string vazia) não chama o Vault e não grava gemini_api_key_secret_id; com chave guarda no Vault uma vez
result: pass
source: automated
coverage_id: 08-08/D2

### 60. 08-08 D3 — Importação de PDF: sem chave no projeto + GEMINI_API_KEY…
expected: Importação de PDF: sem chave no projeto + GEMINI_API_KEY segue com a chave do servidor; sem nada continua 503; chave própria tem prioridade; os 3 testes antigos não mudaram
result: pass
source: automated
coverage_id: 08-08/D3

### 61. 08-09 D1 — Mesmo chunk_id duas vezes em POST /webhook/extension resulta…
expected: Mesmo chunk_id duas vezes em POST /webhook/extension resulta em uma gravação e um único push_chunk; a repetição responde 202
result: pass
source: automated
coverage_id: 08-09/D1

### 62. 08-09 D2 — insert_chunk devolve False só em 23505 e relança outros…
expected: insert_chunk devolve False só em 23505 e relança outros códigos; a chave chunk_id só vai na linha quando preenchida
result: pass
source: automated
coverage_id: 08-09/D2

### 63. 08-09 D3 — chunk_id é opcional e limitado a 200 caracteres no contrato…
expected: chunk_id é opcional e limitado a 200 caracteres no contrato do webhook
result: pass
source: automated
coverage_id: 08-09/D3

### 64. 08-10 D1 — A UI só emite comandos zod; ids com tamanho máximo, UUID por…
expected: A UI só emite comandos zod; ids com tamanho máximo, UUID por regex no ID manual, nome de cliente aparado de 1 a 120; resultado do comando tipado com erro fechado
result: pass
source: automated
coverage_id: 08-10/D1

### 65. 08-10 D2 — listClients ordena pelo cliente ou responde unavailable (cai…
expected: listClients ordena pelo cliente ou responde unavailable (cai no plano B); open/defer com transições do reducer, idempotentes e com not-found/invalid-state
result: pass
source: automated
coverage_id: 08-10/D2

### 66. 08-10 D3 — Vínculo ao vivo por ID manual: 3 falas em ordem para a sessão…
expected: Vínculo ao vivo por ID manual: 3 falas em ordem para a sessão manual, resposta antes do fim do envio, linking com progresso durante, linked com a semente, onLinked uma vez, semente {} com 0 segmentos, send-failed com progresso preservado
result: pass
source: automated
coverage_id: 08-10/D3

### 67. 08-10 D4 — Vínculo por cliente cria UMA sessão; cliente novo; duplicate…
expected: Vínculo por cliente cria UMA sessão; cliente novo; duplicate sem mudar estado; falha de criação volta a deferred sem POST; reunião encerrada durante a criação que falha termina em ended-unsent; dois bind simultâneos criam uma sessão e um cliente
result: pass
source: automated
coverage_id: 08-10/D4

### 68. 08-10 D5 — Reunião encerrada: 45 falas em 45 POSTs ordenados, 2 pausas…
expected: Reunião encerrada: 45 falas em 45 POSTs ordenados, 2 pausas de 1 s, progresso 1..45, sent com seedSent; falha na parte 7 vira send-failed 6/45 sem enviar depois; ID manual; send-failed/sent recusam; registro ausente; sala retomada no meio do envio termina linked com onLinked uma vez
result: pass
source: automated
coverage_id: 08-10/D5

### 69. 08-10 D6 — A chave x-agente-key só existe no request: o storage cru…
expected: A chave x-agente-key só existe no request: o storage cru nunca a contém depois de um vínculo completo
result: pass
source: automated
coverage_id: 08-10/D6

### 70. 08-11 D1 — Fila durável com escritor único: duas escritas concorrentes…
expected: Fila durável com escritor único: duas escritas concorrentes mantêm os itens das duas, em ordem; remoção pontual, limpeza e contagem por sessão
result: pass
source: automated
coverage_id: 08-11/D1

### 71. 08-11 D2 — Teto de 1000 que nunca descarta o mais antigo: 999 + 3 novos…
expected: Teto de 1000 que nunca descarta o mais antigo: 999 + 3 novos = 1000 com os 999 intactos e overflow 2
result: pass
source: automated
coverage_id: 08-11/D2

### 72. 08-11 D3 — Nenhum segredo na fila, no status de entrega nem no rastro: o…
expected: Nenhum segredo na fila, no status de entrega nem no rastro: o JSON cru dos três storages não contém s3cr3t, x-agente-key nem texto de fala
result: pass
source: automated
coverage_id: 08-11/D3

### 73. 08-11 D4 — Status de entrega em storage.local (nunca session), só…
expected: Status de entrega em storage.local (nunca session), só gravado quando muda; rastro intacto depois de um status 'ok', somado em quedas concorrentes e recomeçado só em outra sessão
result: pass
source: automated
coverage_id: 08-11/D4

### 74. 08-11 D5 — A tela mostra a nota do rastro junto do status (mesmo depois…
expected: A tela mostra a nota do rastro junto do status (mesmo depois de 'último envio às …'); sem rastro o texto da Fase 7 fica idêntico e AgenteConfigScreen.tsx e seu teste não foram alterados
result: pass
source: automated
coverage_id: 08-11/D5

### 75. 08-12 D1 — POST /webhook/extension/clients cria o projeto só com…
expected: POST /webhook/extension/clients cria o projeto só com name/client/mode/source, devolve {id, client, name}, 409 para nome repetido ignorando acento e caixa, 422 para vazio ou acima de 120, atrás do mesmo gate x-agente-key
result: pass
source: automated
coverage_id: 08-12/D1

### 76. 08-12 D2 — A Taqciti pede ao Agente lista, cliente novo e sessão nova só…
expected: A Taqciti pede ao Agente lista, cliente novo e sessão nova só para URL válida, com x-agente-key apenas quando há chave, timeout em todo fetch, resposta validada por zod e qualquer desvio tratado como indisponível/erro
result: pass
source: automated
coverage_id: 08-12/D2

### 77. 08-12 D3 — Nome da sessão enviado respeita o contrato: título de 300…
expected: Nome da sessão enviado respeita o contrato: título de 300 caracteres vai com os 200 primeiros e título vazio omite o campo name (nunca 422 por título longo)
result: pass
source: automated
coverage_id: 08-12/D3

### 78. 08-12 D4 — Taqciti montada como em produção: escolher um cliente cria…
expected: Taqciti montada como em produção: escolher um cliente cria UMA sessão nova e as falas vão para ela; 404 na lista cai em indisponível (plano B)
result: pass
source: automated
coverage_id: 08-12/D4

### 79. 08-13 D1 — Evicção do histórico protege reuniões não enviadas e limpa a…
expected: Evicção do histórico protege reuniões não enviadas e limpa a associação das removidas
result: pass
source: automated
coverage_id: 08-13/D1

### 80. 08-13 D2 — Comando de descarte validado por estado (só ended-unsent fora…
expected: Comando de descarte validado por estado (só ended-unsent fora do ar), local, com zod no meetingId
result: pass
source: automated
coverage_id: 08-13/D2

### 81. 08-14 D1 — Tradução pura associação + entrega -> barra, fim da reunião,…
expected: Tradução pura associação + entrega -> barra, fim da reunião, selo, bolha e toast, com os três estados da sala retomada ao vivo e nenhum estado ao vivo sem tela
result: pass
source: automated
coverage_id: 08-14/D1

### 82. 08-14 D2 — Cartão -> Depois -> barra; seletor -> vincular com comando…
expected: Cartão -> Depois -> barra; seletor -> vincular com comando único; plano B por ID; minimizar = Depois; cápsula abre com cartão; compacto sobe para regular uma vez; toast de volta do Agente
result: pass
source: automated
coverage_id: 08-14/D2

### 83. 08-14 D3 — Bolha '!' só em pending; botão no cabeçalho manda um open;…
expected: Bolha '!' só em pending; botão no cabeçalho manda um open; círculo decorativo na cápsula sem comando ao montar
result: pass
source: automated
coverage_id: 08-14/D3

### 84. 08-14 D4 — Painel sem storage.session nem fetch; PanelApp com no máximo…
expected: Painel sem storage.session nem fetch; PanelApp com no máximo 25 linhas novas e sem hook novo
result: pass
source: automated
coverage_id: 08-14/D4

### 85. 08-15 D1 — POST /webhook/extension/sessions/{id}/finish grava finished…
expected: POST /webhook/extension/sessions/{id}/finish grava finished só em sessão extension active, é idempotente, 404/409 sem efeito colateral, atrás do gate x-agente-key, sem acesso direto ao banco no router
result: pass
source: automated
coverage_id: 08-15/D1

### 86. 08-15 D2 — stop_session espera a criação do pipeline em andamento;…
expected: stop_session espera a criação do pipeline em andamento; sessões diferentes não se bloqueiam; stop idempotente; sem recriar pipeline depois do stop
result: pass
source: automated
coverage_id: 08-15/D2

### 87. 08-16 D1 — Os tempos da B4-b ficam em constantes nomeadas fixadas por…
expected: Os tempos da B4-b ficam em constantes nomeadas fixadas por teste, com backoff limitado (a 11ª falha desiste) e nextCheckAt
result: pass
source: automated
coverage_id: 08-16/D1

### 88. 08-16 D2 — A associação guarda sessionFinished, finishBy (só o primeiro…
expected: A associação guarda sessionFinished, finishBy (só o primeiro prazo), finishTries e finishGaveUp; carryIdentity os leva entre estados; a lista branca do store os mantém num reinício; desistida ou esgotada deixa de ser elegível
result: pass
source: automated
coverage_id: 08-16/D2

### 89. 08-16 D3 — A porta HTTP do finish distingue o que repetir (rede,…
expected: A porta HTTP do finish distingue o que repetir (rede, timeout, 408/429/5xx, corpo inválido) do que não repetir (401/403 e demais 4xx), trata 404/409 como gone e valida o UUID antes de montar a URL
result: pass
source: automated
coverage_id: 08-16/D3

### 90. 08-17 D1 — Selo de associação no histórico, com uma única assinatura do…
expected: Selo de associação no histórico, com uma única assinatura do storage para todos os cartões
result: pass
source: automated
coverage_id: 08-17/D1

### 91. 08-17 D2 — Fim da reunião: cartão/botão, seletor encerrado, progresso '3…
expected: Fim da reunião: cartão/botão, seletor encerrado, progresso '3 de 30', 'Reunião enviada para {cliente}.' e descarte confirmado
result: pass
source: automated
coverage_id: 08-17/D2

### 92. 08-18 D1 — Campo de ID escondido com a lista carregando e com a lista ok…
expected: Campo de ID escondido com a lista carregando e com a lista ok (só o apoio), visível com a lista falha
result: pass
source: automated
coverage_id: 08-18/D1

### 93. 08-18 D2 — Salvar um UUID vincula só a reunião ao vivo em…
expected: Salvar um UUID vincula só a reunião ao vivo em pending/choosing/deferred; sem reunião ao vivo, associação linked, ID inválido ou só a URL editada não mandam comando (T-08-36)
result: pass
source: automated
coverage_id: 08-18/D2

### 94. 08-18 D3 — Status sem exigir o ID; cartão CR-01 fora da tela; casos…
expected: Status sem exigir o ID; cartão CR-01 fora da tela; casos antigos, Voltar e rastro de falas continuam verdes
result: pass
source: automated
coverage_id: 08-18/D3

### 95. 08-19 D1 — buildExtensionChunkRequest aceita chunkId opcional: com ele o…
expected: buildExtensionChunkRequest aceita chunkId opcional: com ele o corpo tem chunk_id; sem ele (ou vazio) o corpo é o de sempre
result: pass
source: automated
coverage_id: 08-19/D1

### 96. 08-19 D2 — Fala ao vivo sai com o chunk_id da fila (UUID, estável entre…
expected: Fala ao vivo sai com o chunk_id da fila (UUID, estável entre tentativas); parte do envio em partes sai com bulk:{meetingId}:{index} na ordem, na reunião ao vivo e na encerrada
result: pass
source: automated
coverage_id: 08-19/D2

### 97. 08-19 D3 — Reenvio automático ligado no padrão de produção: Agente cai…
expected: Reenvio automático ligado no padrão de produção: Agente cai -> offline com contagem -> reinício -> volta -> reenvio na ordem com os mesmos chunk_id
result: pass
source: automated
coverage_id: 08-19/D3

### 98. 08-20 D1 — send-resumed leva send-failed com sessão a sending…
expected: send-resumed leva send-failed com sessão a sending preservando sessão e progresso, sem finishBy/finishTries/erro e com sessionFinished mantido; outros estados e send-failed sem sessão devolvem a mesma referência
result: pass
source: automated
coverage_id: 08-20/D1

### 99. 08-20 D2 — Retomar envia só as partes depois da última confirmada…
expected: Retomar envia só as partes depois da última confirmada (posições 6..29 de 30), para a mesma sessão, sem criar outra, com chunk_id bulk:m2:6..29 e termina em sent com a semente inteira
result: pass
source: automated
coverage_id: 08-20/D2

### 100. 08-20 D3 — Recusas: ao vivo, pending e sent -> invalid-state; sem…
expected: Recusas: ao vivo, pending e sent -> invalid-state; sem associação ou sem registro -> not-found; dois comandos simultâneos -> um ok e um invalid-state, cada parte uma vez; nova falha volta a send-failed com o novo progresso
result: pass
source: automated
coverage_id: 08-20/D3

### 101. 08-20 D4 — Retomar cancela o prazo de 5 min da B4-b; com a sessão já…
expected: Retomar cancela o prazo de 5 min da B4-b; com a sessão já encerrada o envio continua, sessionFinished fica, a associação nunca vira elegível a novo encerramento e a volta à sala durante o envio devolve pending limpo
result: pass
source: automated
coverage_id: 08-20/D4

### 102. 08-20 D5 — O comando ui/agente/meeting/resume-send é validado pelo…
expected: O comando ui/agente/meeting/resume-send é validado pelo schema, roteado pelo case de uma linha e atendido pelo fluxo; o hook expõe resumeSend()
result: pass
source: automated
coverage_id: 08-20/D5

### 103. 08-20 D6 — O cartão de fim mostra 'Continuar envio' na falha (um clique…
expected: O cartão de fim mostra 'Continuar envio' na falha (um clique = um comando, mesmo com clique duplo), a linha exata da DA-2 só com sessionClosed e nada extra sem ela
result: pass
source: automated
coverage_id: 08-20/D6

### 104. 08-22 D1 — Reunião detectada com o envio ligado ganha UMA pending; 5…
expected: Reunião detectada com o envio ligado ganha UMA pending; 5 polls repetidos não criam nem regravam (1 gravação da chave); com o envio desligado nada nasce e ligar no meio cria no próximo dispatch
result: pass
source: automated
coverage_id: 08-22/D1

### 105. 08-22 D2 — Fim e preempção: pending/choosing/deferred -> ended-unsent; 0…
expected: Fim e preempção: pending/choosing/deferred -> ended-unsent; 0 falas remove; linking e linked não mudam; outra sala preemptando cria m2 pending e deixa m1 ended-unsent
result: pass
source: automated
coverage_id: 08-22/D2

### 106. 08-22 D3 — Retomada só da MESMA sala: ended-unsent volta a pending sem…
expected: Retomada só da MESMA sala: ended-unsent volta a pending sem associação nova; sent volta a linked com a mesma sessão e a semente; sala diferente cria associação nova sem mexer na anterior (T-08-41)
result: pass
source: automated
coverage_id: 08-22/D3

### 107. 08-22 D4 — Falha na gravação da associação não impede o dispatch de…
expected: Falha na gravação da associação não impede o dispatch de devolver o estado novo; o erro vai para o log (T-08-42)
result: pass
source: automated
coverage_id: 08-22/D4

### 108. 08-22 D5 — Recuperação no boot: linking/sending com e sem sessionId,…
expected: Recuperação no boot: linking/sending com e sem sessionId, pendentes de reunião encerrada, ended-unsent e sent da reunião ao vivo, estados que não mudam
result: pass
source: automated
coverage_id: 08-22/D5

### 109. 08-23 D1 — Fila durável no envio ao vivo: Agente fora do ar -> status…
expected: Fila durável no envio ao vivo: Agente fora do ar -> status offline com a contagem, JSON cru de taq:agenteOutbox sem a chave nem headers; reinício do service worker mantém as 2 falas (mesmos chunkIds) e, com o Agente de volta, saem na ordem original, a fila esvazia e o status volta a ok com recoveredAt
result: pass
source: automated
coverage_id: 08-23/D1

### 110. 08-23 D2 — Nenhuma fala antiga é descartada por teto: acima de 1000 só o…
expected: Nenhuma fala antiga é descartada por teto: acima de 1000 só o excedente novo é recusado e contado (overflow no status e no rastro)
result: pass
source: automated
coverage_id: 08-23/D2

### 111. 08-23 D3 — Retirada por HTTP 500 só como a B3-b mandou: valor de…
expected: Retirada por HTTP 500 só como a B3-b mandou: valor de produção null fixado por teste; com limite numérico injetado só retira quando TODAS as tentativas do ciclo são 500 e o item passa do limite; 429/502/503/504/rede e ciclo misto nunca retiram
result: pass
source: automated
coverage_id: 08-23/D3

### 112. 08-23 D4 — Rastro de falas descartadas: failed, 4xx, 500 da B3-b,…
expected: Rastro de falas descartadas: failed, 4xx, 500 da B3-b, overflow e falha de gravação chamam onDropped; cancelAll e request null não; o rastro persistente sobrevive ao próximo 'ok' e ao reinício, sem chave nem texto
result: pass
source: automated
coverage_id: 08-23/D4

### 113. 08-23 D5 — D-09 da Fase 7 preservado: desligar o toggle limpa a fila…
expected: D-09 da Fase 7 preservado: desligar o toggle limpa a fila durável sem somar no rastro; reunião nova sem vínculo (idle) e o descarte da instância (dispose) NÃO limpam; reinício com o envio desligado ou a config não pronta não envia nada, limpa a fila e deixa o rastro igual
result: pass
source: automated
coverage_id: 08-23/D5

### 114. 08-23 D6 — Mecânica da Fase 7 (janela por fala, retry, vínculo CR-01,…
expected: Mecânica da Fase 7 (janela por fala, retry, vínculo CR-01, boot WR-02/WR-04) e o tracer da Fase 8 intactos, sem alterar agenteStreamer.test.ts nem agenteStreamerAssociation.test.ts
result: pass
source: automated
coverage_id: 08-23/D6

### 115. 08-24 D1 — Associação cuja sessão do Agente foi encerrada nunca volta a…
expected: Associação cuja sessão do Agente foi encerrada nunca volta a ficar linking, linked ou sending ligada a ela: a volta à sala devolve pending limpo em qualquer estado com sessão
result: pass
source: automated
coverage_id: 08-24/D1

### 116. 08-24 D2 — Reentrar antes do encerramento continua como o 08-22 entregou…
expected: Reentrar antes do encerramento continua como o 08-22 entregou e cancela o prazo; ended-unsent e linking ficam como estavam
result: pass
source: automated
coverage_id: 08-24/D2

### 117. 08-24 D3 — Depois de um reinício do service worker nenhuma associação…
expected: Depois de um reinício do service worker nenhuma associação encerrada fica ligada a uma reunião ao vivo e nenhum prazo velho sobrevive; a associação encerrada de reunião que não está ao vivo não muda
result: pass
source: automated
coverage_id: 08-24/D3

### 118. 08-24 D4 — A máquina trata a volta como reunião nova só com startFresh;…
expected: A máquina trata a volta como reunião nova só com startFresh; sem o campo a máquina da Fase 7 é idêntica (machine.test.ts sem alteração)
result: pass
source: automated
coverage_id: 08-24/D4

### 119. 08-24 D5 — shouldStartFreshMeeting só lê o storage em fase ended com a…
expected: shouldStartFreshMeeting só lê o storage em fase ended com a mesma sala; sessionFinished ou finish em voo valem como encerrada; ended-unsent não
result: pass
source: automated
coverage_id: 08-24/D5

### 120. 08-25 D1 — A permissão alarms está no manifesto e o build gera o…
expected: A permissão alarms está no manifesto e o build gera o manifesto com ela
result: pass
source: automated
coverage_id: 08-25/D1

### 121. 08-25 D2 — isMeetingLive é puro e correto: mesma reunião e fase ao vivo;…
expected: isMeetingLive é puro e correto: mesma reunião e fase ao vivo; falso para ended, idle, outra reunião e sessão nula
result: pass
source: automated
coverage_id: 08-25/D2

### 122. 08-25 D3 — Fim da reunião vinculada, preempção, ended-unsent e aba…
expected: Fim da reunião vinculada, preempção, ended-unsent e aba fechada (08-26) avisam o agendador uma vez; 0 falas e sem associação não avisam; o aviso não espera nem derruba (evaluate que nunca resolve ou rejeita)
result: pass
source: automated
coverage_id: 08-25/D3

### 123. 08-25 D4 — O envio em partes avisa o encerramento nos três desfechos…
expected: O envio em partes avisa o encerramento nos três desfechos (concluído, parado, vínculo ao vivo pronto, este depois de onLinked) e nunca falha por causa do aviso
result: pass
source: automated
coverage_id: 08-25/D4

### 124. 08-26 D1 — Fechar a aba da reunião em captionsRequired, recording ou…
expected: Fechar a aba da reunião em captionsRequired, recording ou paused dispara MEETING_FINISHED uma vez, com o relógio injetado, e nenhum RESET
result: pass
source: automated
coverage_id: 08-26/D1

### 125. 08-26 D2 — Com a máquina real: recording com falas e associação linked…
expected: Com a máquina real: recording com falas e associação linked termina em ended com endedAt, registro ready no histórico e associação ainda linked; pending com falas vira ended-unsent; pending sem falas é removida; linking continua e o vínculo ainda termina em linked
result: pass
source: automated
coverage_id: 08-26/D2

### 126. 08-26 D3 — paused termina em ended; captionsRequired sem falas termina…
expected: paused termina em ended; captionsRequired sem falas termina em ended com a sessão vazia e sem registro novo no histórico
result: pass
source: automated
coverage_id: 08-26/D3

### 127. 08-26 D4 — O comportamento antigo não mudou: aba fechada DEPOIS do fim…
expected: O comportamento antigo não mudou: aba fechada DEPOIS do fim continua em RESET; outra aba, tabId nulo e fase idle não fazem nada
result: pass
source: automated
coverage_id: 08-26/D4

### 128. 08-26 D5 — Reabrir a mesma sala depois do fim por aba fechada: sem…
expected: Reabrir a mesma sala depois do fim por aba fechada: sem sessionFinished retoma o mesmo meetingId (08-22); com sessionFinished é reunião nova com outro meetingId (08-24)
result: pass
source: automated
coverage_id: 08-26/D5

### 129. 08-27 D1 — O kick dedicado do envio alcança a fila durável com outra…
expected: O kick dedicado do envio alcança a fila durável com outra reunião ao vivo (pending) e com a última reunião em sent/send-failed, respeita o portão canDrain e não mexe em status, cursor nem janela
result: pass
source: automated
coverage_id: 08-27/D1

### 130. 08-27 D2 — Encerra na hora com a fila vazia, espera a última fala em voo…
expected: Encerra na hora com a fila vazia, espera a última fala em voo (graça de 10 s), arma o prazo de 5 min com a fila parada ou send-failed e encerra antes do prazo quando a fila esvazia
result: pass
source: automated
coverage_id: 08-27/D2

### 131. 08-27 D3 — Falha do finish repete com a tabela de espera e, na 11ª falha…
expected: Falha do finish repete com a tabela de espera e, na 11ª falha ou recusa definitiva, desiste sem laço: nenhuma avaliação posterior nem a varredura do boot chama o finish de novo
result: pass
source: automated
coverage_id: 08-27/D3

### 132. 08-27 D4 — Nunca encerra com a reunião ao vivo, nem sessão do plano B,…
expected: Nunca encerra com a reunião ao vivo, nem sessão do plano B, nem duas vezes ao mesmo tempo; a composição de produção assume 'ao vivo' até o index.ts configurar
result: pass
source: automated
coverage_id: 08-27/D4

### 133. 08-28 CR-02 — Mudar a URL no meio da call (/meet/<código>) não tira o painel da reunião ao vivo nem encerra a sessão
expected: Depois de cada mudança de URL sem sair da sala (#teste, ?authuser=1, troca de formato): o painel da Taqciti segue na tela da reunião ao vivo (não vai para "Transcrição salva"), a barra segue "Enviando ao vivo para ...", uma frase nova aparece na Taqciti e no web app, e depois de 1 minuto a sessão no web app continua ativa.
result: pass
evidence: 2026-10-26, confirmado pelo usuário (relato "passou") no Meet real, com a build nova da Taqciti (npm run build) e o backend local em 127.0.0.1:8000. Sem detalhe adicional de log ou banco.

### 134. 08-28 DA-4 — Sair de verdade da sala continua encerrando a reunião e a sessão
expected: Na mesma aba da call, digitar https://example.com e Enter: a reunião termina (aparece no histórico da Taqciti) e a sessão no web app é encerrada em poucos segundos.
result: pass
evidence: 2026-10-26, confirmado pelo usuário no Meet real: ao sair da sala a transcrição ficou salva na Taqciti. Log do backend local: POST /webhook/extension/sessions/ce75b9af-d3d9-40de-b6e5-00ae38553f91/finish 200 e POST /webhook/extension/sessions/6cd362ad-cdc1-425f-8aca-d23d6a451d03/finish 200 (as duas sessões criadas nesta rodada foram encerradas).

### 135. 08-28 Limpeza — Sessão de teste da rodada registrada para remoção
expected: O id da sessão criada nos testes 133/134 fica anotado na lista "Dados de teste em produção" deste arquivo.
result: pass
evidence: 2026-10-26, as duas sessões da rodada do 08-28 (log do backend local) foram anotadas na lista "Dados de teste em produção" abaixo: ce75b9af-d3d9-40de-b6e5-00ae38553f91 e 6cd362ad-cdc1-425f-8aca-d23d6a451d03.

## Summary

total: 135
passed: 135
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

## Defeitos achados e corrigidos durante o UAT (2026-10-24/25)

Corrigidos na hora, cada um em commit atômico na branch `feat/fase-08-taqciti-session-association` (nenhum foi empurrado ao remoto). Não viraram gaps abertos.

| Commit | O que era |
|--------|-----------|
| `861db11` | O Meet passou a reescrever o endereço para `/meet/<código>`; a Taqciti só aceitava `/<código>` e não detectava NENHUMA reunião (nem cápsula, nem "!", nem captura). |
| `5f20a3d` | Seletor de clientes no painel ao vivo: caixa de 213 px, lista com 0 px, rodapé por cima da transcrição. Agora toma o corpo, com densidade compacta. |
| `14e94cd` | Botão "Selecionar cliente" da barra "Sem cliente" no verde sólido da CITi (variante `solid` do Button). |
| `79690b8` | Nome de cliente comprido alargava a coluna do grid do painel para 684 px e empurrava os botões do cabeçalho e o "Finalizar" para fora. |
| `ca1993a` | Seletor da saída larga preso ao cabeçalho de vidro (backdrop-filter prende `fixed`): a transcrição aparecia por cima da lista. Agora num portal no `<body>`. |
| `0a9c23e` | Seletor da tela "Transcrição salva" do painel: mesmo defeito do `5f20a3d`, no `AgenteEndSlot`. Reteste ao vivo feito em 2026-10-26 (Rodada 2), com o relato do usuário: a lista veio inteira (3 ou mais linhas de cliente), rodapé pequeno e nada cobrindo. |

## Observações para o time (não são gaps; decisão do time se viram gap)

**1. Segunda parada que ficou presa em "Enviando…" (não reproduzida).** Na primeira tentativa do teste 18 (sessão `e5bc6cd3`, 9 falas), depois de "Continuar envio" o envio parou de novo na parte 5, mas o painel continuou em "Enviando para ZZ-TESTE-D20… 5 de 9", sem "O envio parou…" e sem "Continuar envio". O backend só recebeu 3 tentativas da parte 6 (a última às 15:59:12) e nenhum pedido de encerramento por mais de 2 h 45 min: a sessão ficou ATIVA (o laço de IA de uma sessão aberta gasta dinheiro à toa). Só às 18:46 chegaram as 4 falas que faltavam e a sessão foi encerrada (log: 4 POSTs e `…/finish` 200), o que bate com um "Continuar envio" feito depois de o painel voltar à tela de "parou" (o usuário não confirmou o clique). Hipótese NÃO confirmada: o Chrome desligou o service worker no meio da rodada (as tentativas seguradas duram ~35 s sem eventos de extensão); o estado `sending` ficou gravado sem trabalho rodando, o prazo de 5 min nunca foi armado (quem arma é o `onSettled`, que não rodou) e a recuperação `recoverAssociationsAfterRestart` (`sending` com sessão vira `send-failed`) só roda quando o service worker acorda. Na segunda tentativa (sessão `f0120ad3`, DevTools do service worker fechado) as duas paradas chegaram à tela de "parou" (com 3 e 4 tentativas seguradas) e a sessão foi encerrada aos 5 min, então não houve reprodução. Se acontecer em produção, o efeito é uma sessão aberta e uma tela "Enviando…" sem fim até o service worker acordar (um backend que PENDURA, em vez de recusar, é o cenário que o provoca). Sugestão ao time: decidir se vale uma guarda (alarme que reavalie `sending` parado) ou se aceita como risco.

**2. Falas finais depois do encerramento no prazo (do teste 22).** Já registrado no teste 22: no encerramento pelo prazo as últimas falas chegam depois do `finish` e o envio ao DocuData agendado no encerramento pode deixá-las de fora.

**3. Como os cortes foram feitos (para repetir).** Um embrulho ASGI do `app` do backend, em pasta temporária fora do repositório, lia um arquivo de controle (`pass`, `cut:N`, `hang`, `hold-create`) e segurava as falas depois de N liberadas (ou só o pedido de criar sessão). Congelar o processo logo depois de N falas NÃO funciona: a Taqciti manda cada fala em poucos milissegundos e o envio de 7 falas terminou antes do congelamento chegar.

**4. "Selecionar cliente" só aparece depois de clicar na bolha "!" (relato do usuário, 2026-10-26, no teste 134).** Ao entrar numa reunião, a bolha amarela aparece na cápsula como esperado, mas a escolha de cliente só abre quando o usuário clica nela. É o comportamento desenhado (a bolha é um aviso que não interrompe a reunião; o clique abre o cartão com "Selecionar cliente"), então não é gap. Se o time achar pouco visível, vira follow-up de UX (parente do backlog 999.2).

## Retomada (pausado em 2026-10-25 com 119 de 132 passados e 13 pendentes)

*Histórico: todos os pendentes abaixo foram fechados até 2026-10-26 (Rodadas 1 e 2). Fica só como registro do plano original.*

**Pendentes:** testes 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23 e 24. Todos exigem Chrome + Meet reais. Agrupar em rodadas:
- **Reteste do `0a9c23e` (primeiro):** recarregar a extensão (↻), terminar uma reunião com falas e, em "Transcrição salva", clicar em "Selecionar cliente": 3 linhas inteiras de cliente, rodapé pequeno, sem sobreposição; "Voltar" devolve Copiar/Baixar/transcrição.
- **Rodada A (uma reunião, ~10 min):** vínculo, ficar mais de 5 min (a sessão NÃO pode encerrar ao vivo), arrastar a cápsula e Esc no cartão (14), sair da chamada (sessão encerra em segundos), voltar à mesma sala (bolha "!" e sessão NOVA). Cobre 14, 15, 19, 21, 22, 24.
- **Rodada B (uma reunião, ~8 min):** queda do Agente (o assistente desliga e religa o backend), faixa amarela com a contagem, toast "Agente de volta. Falas reenviadas.", reinício do service worker (DevTools do SW, Application, Service workers, Stop), query de duplicatas = 0 e `chrome.storage.local.getBytesInUse(null)`. Cobre 11, 17, 20.
- **Rodada C (reuniões curtas):** "Descartar" (modal, "Manter reunião" desiste), "Apagar" de reunião já enviada (frase "A cópia que já foi enviada ao Agente continua lá."), aba do Meet fechada no meio da call. Cobre 13, 16, 23. Risco anotado: o `ConfirmModal` usa `fixed` dentro do cabeçalho de vidro da saída larga (mesmo mecanismo do `ca1993a`).
- **Teste 18 (retomar envio no meio):** precisa de uma reunião com 21 ou mais falas, o que sozinho não sai (ver Armadilhas); fazer com um colega ou adiar.

**Armadilhas já aprendidas:**
- Com uma voz só o Meet mantém UMA linha de legenda e a Taqciti só estende o texto: sozinho saem 2 a 3 falas, mesmo em 5 minutos. Falas novas nascem quando OUTRA pessoa fala. Pausar/Retomar da Taqciti não ajuda (põe as linhas em quarentena).
- `meet.google.com/new` entra DIRETO na chamada (sem pré-entrada) e o microfone pode entrar ligado: silenciar logo.
- Web app = `http://localhost:5173`. `localhost:8000` é o backend: só a raiz serve o app compilado, rota interna dá 422 em página preta.
- Python no Windows: usar `127.0.0.1`, não `localhost` (perde ~2 s por chamada tentando IPv6).
- A automação do Chrome do assistente NÃO abre páginas `chrome-extension://` (saída larga): quem confere essa tela é o usuário.
- O pipeline de IA engole falhas em silêncio (`except Exception: pass`): sem saída não significa sem erro.
- Servidores locais: backend `python -m uvicorn app.main:app --port 8000` (pasta `backend`) e `npm --prefix frontend run dev`. O sistema já os encerrou uma vez por falta de memória.

**Lembretes:** a `GEMINI_API_KEY` ainda NÃO existe no Railway (criar antes de qualquer deploy ou merge na `main`). A página "Instalar extensão" do web app aponta para o zip da extensão ANTIGA v1.0.0. Recarregar uma rota interna em `localhost:8000` quebra (rotas da API engolem as do app). O build da Taqciti (`taqciti/dist`) já está com todos os commits acima; depois de qualquer rebuild é preciso o ↻ em `chrome://extensions`.

## Dados de teste em produção (Supabase `Agente-Diagnostico`) — limpar no fim

Apagar primeiro as sessões e depois os projetos. NÃO apagar o cliente real `visus` (`a86ee034`).

- Projetos: `vis` (`bb3b10d7-e15a-4947-a7cc-ec86a5b278a8`) e `ZZ-TESTE-D20 cliente de teste com um nome propositalmente bem comprido para conferir o truncamento` (`4e542168-78e4-4b26-9328-3c64af0d5789`).
- Sessões (todas encerradas): `c59f17f6-222d-4a59-a325-5f95ac4f785b` (vis), `1d4c19c9-2145-4f73-bf8d-f6b96145340d`, `ecd48b0f-e9b8-4bb3-a03f-b5efb04e70e7`, `fa3cd913-1cc4-47a0-b312-ce347497c78d`, `dcb62c06-15e2-4694-84f4-3b9bfa3f3455`, `e4ef42f4-859b-4074-9810-b6fc67e5d800`, `ef759a4c-b592-42af-a627-571362e82387`, e as de simulação `68e38421-8e3a-4c60-8514-0cdce91dc744`, `93b18c84-df39-4a63-9a06-e0e4ed321e1c`, `e3295f4f-f2dc-4d8b-8baa-4fae83497b53`.
- Rodada do 08-28 (2026-10-26, ambas encerradas): `ce75b9af-d3d9-40de-b6e5-00ae38553f91`, `6cd362ad-cdc1-425f-8aca-d23d6a451d03`.
- Para achar tudo (inclusive o que as próximas rodadas criarem): sessões e projetos cujo cliente começa com `ZZ-TESTE` ou é `vis`, e sessões com nome `SIMULACAO%`.
