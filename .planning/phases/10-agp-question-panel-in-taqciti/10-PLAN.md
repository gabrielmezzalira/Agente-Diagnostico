# Fase 10 — Painel de perguntas "AGP" dentro da Taqciti (plano único, TAQ-05)

> Plano no formato obrigatório do `CLAUDE.md` (7 seções). Branch: `feat/fase-10-agp-question-panel`,
> cortada da branch da Fase 8 (a 10 depende do vínculo de sessão da 8, que ainda não está na `main`).
> **O PR da Fase 10 só deve ir depois do PR da Fase 8.**

## 1. O que muda (em linguagem comum)

Hoje quem conduz a reunião precisa abrir o site do Agente para ler as perguntas que a IA sugere. Esta fase
coloca essas perguntas **dentro da própria Taqciti**, numa aba chamada "AGP" ao lado da transcrição, durante
a call. Cada pergunta mostra se veio da lente **Produto** ou **Dados**.

Analogia: é como colocar um retrovisor no painel do carro. As perguntas continuam sendo geradas pelo Agente
(a Taqciti não inventa nada); a Taqciti só as espelha, em tempo quase real.

A aba só mostra perguntas quando a reunião está **explicitamente vinculada** a uma sessão (cliente escolhido
ou ID colado, Fase 8). Sem vínculo, mostra um aviso pedindo para vincular — nunca perguntas de uma sessão
"adivinhada".

## 2. Como vai ser alterado

Commits atômicos, nesta ordem (tudo em `taqciti/src`):

1. `features/agente/agpQuestions.ts` (+teste): puro. Lê a mensagem do WebSocket (`initial_state`,
   `question_new`, `question_expired`), mantém a lista e decide quais perguntas ainda são visíveis.
   `features/agente/agpTarget.ts` (+teste): puro. Escolhe a sessão-alvo: só associação com origem explícita,
   `sessionId`, sessão não encerrada e reunião ao vivo.
2. `shared/config/agpQuestionsStore.ts` (+teste) e chave `taq:agpQuestions` em `constants.ts`: onde o service
   worker guarda o que a UI lê (`chrome.storage.local`, porque o painel do Meet não lê `storage.session`).
3. `background/agpQuestionsFeed.ts` (+teste): dono do WebSocket. Abre, fecha e reconecta (espera crescente,
   para de vez no código 4004 "sessão não ativa"). Portas injetadas (socket, timers, store), sem `chrome`.
   `background/agpQuestionsFeedInstance.ts` + 1 linha em `background/index.ts`: liga ao `chrome.storage.onChanged`
   (associações, config e estado da reunião).
4. UI: `shared/hooks/useAgpQuestions.ts`, `sidepanel/components/AgpQuestionsPanel.tsx` (+teste) e as abas
   "Transcrição | AGP" no `LiveScreen`. **Muda comportamento** (tela nova); os passos 1–3 não mudam nada visível.

Mecânico: nada. Reaproveita `subscribeNormalized` (hoje privado em `agenteDeliveryStore.ts`, passa a exportado),
`isValidAgenteBackendUrl`, `isValidAgenteSessionId` e o `onLocalChange`.

## 3. Riscos de cada ação

- **Passo 1:** lista de perguntas errada (duplicar, não remover a expirada) ou aceitar mensagem malformada.
- **Passo 2:** gravar demais no storage (a cada mensagem) e gastar quota; vazar algo sensível. O WebSocket não
  usa a chave `x-agente-key`, então nenhuma chave entra no registro.
- **Passo 3:** (a) laço de reconexão batendo no backend; (b) o service worker dormir e perder a conexão;
  (c) **conectar no WebSocket cria o pipeline da sessão no backend** e o laço de IA gasta Gemini enquanto a
  sessão estiver aberta; (d) ligar na sessão errada.
- **Passo 4:** quebrar a aba de transcrição existente; cobrir o conteúdo no painel pequeno do Meet.

## 4. Como prevenir

- **1:** testes de tabela para cada mensagem, inclusive lixo (JSON inválido, campos faltando).
- **2:** gravar só quando a lista muda; registro com lista de campos permitidos (sem texto de fala, sem chave).
- **3:** (a) espera crescente com teto de 30 s e parada no 4004; (b) o Chrome ≥ 116 (mínimo do manifesto) mantém
  o service worker vivo com o WebSocket ativo, e a reconciliação roda a cada mudança do storage e no boot;
  (c) o feed só conecta com a reunião **ao vivo e vinculada** e fecha na hora que a call acaba — a mesma janela
  em que a sessão já gasta IA; (d) o alvo vem só de associação com origem explícita (teste cobrindo plano B,
  sessão encerrada e reunião não ao vivo).
- **4:** testes do `LiveScreen` com e sem vínculo; a aba padrão continua sendo "Transcrição".

## 5. Como consertar (rollback)

Cada passo é um commit: `git revert` do commit da UI (passo 4) esconde a aba sem tocar no resto; reverter o 3
desliga o WebSocket; o 1 e o 2 são inertes sozinhos. Para desligar na emergência sem reverter: remover a linha
de registro do feed em `background/index.ts`. A chave `taq:agpQuestions` pode ser apagada do storage sem efeito
colateral (a UI cai no estado "sem vínculo").

## 6. Decisões que são do usuário/time

- **DECISÃO EM ABERTO:** a Taqciti só **mostra** as perguntas. Fixar, descartar e marcar como usada (como no site
  do Agente) ficam **fora** desta fase — exigiria a Taqciti escrever no backend. Nota: o backend atual não avisa
  por WebSocket quando alguém fixa ou descarta no site, então essas ações feitas lá não aparecem aqui (só a
  expiração por TTL aparece).
- **DECISÃO EM ABERTO:** o WebSocket do backend **não tem autenticação** (`/ws/{session_id}`); quem souber o id
  lê as perguntas. Não mudei o contrato do backend nesta fase; o time decide se protege no login do AGM.
- Contrato da API não é alterado nesta fase.

## 7. Verificação (ponta a ponta)

- Automática: `npx tsc --noEmit`, `npx eslint src`, `npx vitest run` e `npx vite build` em `taqciti/` verdes.
- Teste real (pessoa): backend local `:8000`, web app `:5173`, extensão de `taqciti/dist`, call no Meet com
  captions. Vincular um cliente, abrir a aba "AGP", clicar "Gerar agora" no site do Agente e ver a pergunta
  aparecer na Taqciti com a lente certa, e sumir quando o TTL acaba. Sem vínculo, a aba mostra o aviso.
  Ao encerrar a call, a conexão fecha (nenhuma reconexão depois).
- Sementes de teste: um teste novo por módulo (passos 1–4).
