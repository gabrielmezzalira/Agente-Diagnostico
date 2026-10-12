# Pendências da Fase 10 — o que fazer, testar e o que foi adiado

**Atualizado:** 2026-10-12 · **Branch:** `feat/fase-10-agp-question-panel` (cortada da branch da Fase 8)
Plano: `.planning/phases/10-agp-question-panel-in-taqciti/10-PLAN.md`. Marque `[x]` ao fechar.

## 1. Para testar à mão (ninguém viu isso no Chrome real ainda)

Preparo: backend local `:8000`, web app `:5173`, extensão de `taqciti/dist` (`cd taqciti && npm install && npm run build`).

- [ ] Call no Meet com legendas, **sem** vincular cliente: a aba **AGP** mostra "Vincule esta reunião a um cliente…".
- [ ] Vincular um cliente (ou colar um ID) e, no site do Agente, clicar **"Gerar agora"**: a pergunta aparece na AGP
      com a lente certa (**Produto** ou **Dados**), em poucos segundos.
- [ ] Esperar o TTL (padrão 30 s): a pergunta some da AGP quando o backend manda `question_expired` (não há relógio local).
- [ ] Derrubar o backend por um instante: a AGP mostra "Reconectando ao Agente…" e, quando volta, reconecta sozinha.
- [ ] Encerrar a call: a conexão fecha e a AGP volta ao aviso (nenhuma reconexão depois — conferir no `chrome://serviceworker-internals`
      ou na aba de rede do service worker).
- [ ] As duas superfícies: o painel injetado **dentro do Meet** e a saída larga (`?view=...`/janela). Conferir que a transcrição
      continua rolando e que o painel pequeno (compact) não corta a aba.

## 2. Limitações conhecidas (decisão do time)

- [ ] **Só mostra, não age.** Fixar, descartar e marcar como usada continuam no site do Agente. Fazer isso na Taqciti exigiria a
      Taqciti escrever no backend.
- [ ] **Fixar/descartar no site não aparece na Taqciti:** o backend não avisa por WebSocket quando alguém fixa ou descarta
      (só `question_expired` por TTL). Para espelhar isso, o backend precisaria emitir um evento novo.
- [ ] **O WebSocket do backend não tem autenticação** (`/ws/{session_id}`): quem souber o id lê as perguntas.
      Não mudei o contrato; o time decide se protege no login do AGM.
- [ ] **Conectar no WebSocket cria o pipeline da sessão no backend** (laço de IA de 15/30 s). Por isso o feed só conecta com a
      reunião ao vivo e vinculada, e fecha quando a call acaba.

## 3. Adiado por decisão sua (a tirar depois)

- [ ] **Fase 9 (cutover):** a Taqciti virar a única fonte e remover `extension/`. Enquanto isso, as duas fontes convivem —
      **não ligar a extensão antiga e a Taqciti na mesma reunião e na mesma sessão** (a transcrição entra duplicada).
- [ ] **Limpeza do código da Fase 7** (`confirmNewMeeting`, `confirmedMeetingId`, `configDestination`, texto "confirme abaixo"):
      remoção de código que mexe na config guardada no navegador — decisão do time, plano próprio.
- [ ] Pendências da Fase 8 continuam valendo (`.planning/PENDENCIAS-FASE-08.md`): `GEMINI_API_KEY` no Railway, teste D-20,
      code review, PR. **O PR da Fase 10 só vai depois do PR da Fase 8** (a 10 depende do vínculo de sessão da 8).

## 4. Resultado do code review do back (`10-REVIEW.md`) — o que foi corrigido e o que ficou

Corrigidos (commits `a4bc2a4` e `4160d98`): **CR-01** (o prazo da pergunta se perdia a cada gravação; agora não há prazo local),
**CR-02** (a DA-5 chamava o backend sem limite; agora só no `onStartup`), **WR-01** (backoff zera só no `initial_state`),
**WR-02** (o teto não derruba as fixadas primeiro), **WR-03** (tetos de tamanho por campo), **WR-07** (relógio do cliente), **WR-08**
(documentação desatualizada) e os informativos de `isFollowing` sem uso, comentário impreciso e rejeição não tratada no boot.

**Não corrigidos, de propósito (decisão do time ou código de outra pessoa):**
- [ ] **WR-04 — o feed conecta mesmo com a reunião em `paused`/`captionsRequired` e ignora `streamingEnabled`.** Hoje só existe
      associação se o envio estava ligado quando a reunião começou, então na prática o toggle já vale; decidir se o AGP deve
      exigir `recording`.
- [ ] **WR-05 — "Continuar envio" não confere `isClosing`** (um encerramento em voo pode marcar a sessão como encerrada
      enquanto o upload retomado ainda manda partes). Código da Fase 8 (plano 08-20, de outra pessoa); corrigir é mudar comportamento.
- [ ] **WR-06 — ir para `chrome://` (ex.: Nova Guia) no meio da call não dispara a DA-4**, porque sem a permissão `tabs` o
      `changeInfo.url` vem vazio. Adicionar `tabs` ao manifesto muda o aviso de instalação ("ler o histórico de navegação"): decisão do time.
- [ ] **Mesma call aberta em duas abas** ("Participar também"): fechar ou navegar a segunda aba pode encerrar a reunião da primeira
      (vale para a DA-3 e a DA-4).
- [ ] `index.ts` está com mais de 200 linhas (regra do `CLAUDE.md`); dividir é refator à parte, em commit separado.
