---
phase: 07-taqciti-config-background-streamer
reviewed: 2026-10-11T01:44:50Z
depth: standard
iteration: 3
diff_base: c2570b60c3d7ac6fee60ec12ebd5ead63bff256c
files_reviewed: 25
files_reviewed_list:
  - taqciti/docs/publicar-release.md
  - taqciti/src/background/agenteStreamer.test.ts
  - taqciti/src/background/agenteStreamer.ts
  - taqciti/src/background/agenteStreamerDeps.ts
  - taqciti/src/background/agenteStreamerInstance.ts
  - taqciti/src/background/agenteStreamerSnapshot.ts
  - taqciti/src/document/baixarDocumento.ts
  - taqciti/src/features/agente/phraseBatcher.test.ts
  - taqciti/src/features/agente/phraseBatcher.ts
  - taqciti/src/features/agente/wordDelta.test.ts
  - taqciti/src/features/agente/wordDelta.ts
  - taqciti/src/shared/config/agenteConfig.test.ts
  - taqciti/src/shared/config/agenteConfig.ts
  - taqciti/src/shared/config/agenteConfigStore.test.ts
  - taqciti/src/shared/config/agenteConfigStore.ts
  - taqciti/src/shared/config/agenteStatus.test.ts
  - taqciti/src/shared/config/agenteStatus.ts
  - taqciti/src/shared/config/agenteStatusStore.ts
  - taqciti/src/shared/hooks/useAgenteConfigForm.ts
  - taqciti/src/shared/services/log.ts
  - taqciti/src/sidepanel/backNavigation.test.ts
  - taqciti/src/sidepanel/backNavigation.ts
  - taqciti/src/sidepanel/screens/AgenteConfigScreen.test.tsx
  - taqciti/src/sidepanel/screens/AgenteConfigScreen.tsx
  - taqciti/src/sidepanel/screens/AgenteConfigScreenBack.test.tsx
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Fase 7: Relatório de Code Review (3ª passada, incremental)

**Revisado em:** 2026-10-11T01:44:50Z
**Profundidade:** standard
**Arquivos revisados:** 25
**Status:** issues_found

## Resumo

Esta passada cobre só o que mudou desde `c2570b6`: as correções da 2ª revisão (WR-01..05, IN-01..04,
IN-06, CR-01 com `boundMeetingId` e WR-04 com o status `interrupted`). Respeitei o que o time já decidiu
em `07-DECISOES-REVIEW-2.md` e `07-REVIEW-DISPOSITION.md`. Não reabri o IN-05 (backend), o IN-07, o IN-08
(o `agenteStreamerInstance.ts` agora tem 271 linhas, mas esse ponto foi adiado de propósito), o IN-09, os
"limites conhecidos" do CR-01, nem a decisão 2-B do WR-04.

Rodei `npx tsc --noEmit`, `npx eslint` nos diretórios do escopo e `npx vitest run` em `taqciti/`. Typecheck
e lint passaram limpos, e os **595/595 testes passaram**.

**O que confirmei como corrigido:**

- **WR-03:** o padrão da build agora é normalizado na origem. O texto do runbook bate com o código.
- **WR-04 (2-B):** o boot troca `retrying` por `interrupted`, e isso roda antes de qualquer envio da
  instância nova, porque o `resume` é o primeiro da fila.
- **WR-05:** resolvido no caso principal. Sobrou uma borda, descrita no IN-02.
- **IN-01 e IN-04:** fala sem `backendUrl` é descartada no restore, e todo descarte vai para o log só com
  a contagem (`discarded` entrou em `SAFE_LOG_KEYS`).
- **IN-02 e IN-03:** o toggle fica travado até a config carregar, e salvar a chave só com espaços limpa o
  campo.
- **IN-06:** a regex virou escapes e o arquivo não tem mais nenhum byte de controle. O diff do commit
  `32864ad` ainda aparece como `Bin`, mas só porque o lado antigo era binário.
- **WR-01 e WR-02:** resolvem os cenários descritos na 2ª revisão.
- **CR-01:** cobre os três cenários da revisão: navegador fechado, extensão recarregada e toggle religado
  na reunião errada.

**Problema novo, criado pelas correções:** o caminho "religar o toggle" agora passa por `planStreamStep`.
Ao confirmar a reunião nova, ele manda **a reunião inteira desde o início**, inclusive o que foi dito
enquanto o envio estava **desligado**. Reproduzi isso com um teste descartável, rodado no scratchpad, sem
mexer no repositório (CR-01 abaixo). Além disso, as duas correções que passaram a gravar no storage a
partir de um segundo contexto (o service worker gravando a config e a tela gravando o status) fazem
read-modify-write de um objeto inteiro sem nenhuma coordenação entre contextos (WR-01 e WR-02).

Não achei vazamento da chave de API. A chave só aparece em memória, em `syncDestination`, e não vai para
log, snapshot, status nem DOM.

## Critical Issues

### CR-01: Religar o toggle numa reunião nova e confirmar manda o que foi dito com o envio DESLIGADO

**Arquivos:** `taqciti/src/features/agente/wordDelta.ts:126-131`, `taqciti/src/features/agente/wordDelta.ts:149-158`, `taqciti/src/background/agenteStreamerInstance.ts:221-226`

**Problema:** quando o cursor é nulo e a sessão está vinculada a outra reunião, `planStreamStep` espera
com `cursor: null`. Na confirmação, `releaseOrWait` monta `{ sent: {} }` e
`computeSegmentDeltas` devolve **todas as palavras de todos os segmentos** da reunião. Isso fazia sentido
no CR-01 da 1ª revisão, porque lá o envio estava ligado o tempo todo e "desde o início" queria dizer
"o período de espera". Só que agora `applyConfigChange` manda o religar do toggle pelo mesmo caminho. O
comentário das linhas 222-225 ainda promete "WR-02: religar (cursor nulo) começa a contar DESTE instante",
e no ramo da espera isso não acontece.

Um fluxo bem comum basta: o toggle vem desligado por padrão (D-09) e a sessão já recebeu uma reunião
antes (`boundMeetingId = m1`). A pessoa entra na reunião m2 com o envio desligado e conversa um tempo
(conversa informal, um assunto confidencial do cliente, o que for). Liga o toggle no meio da reunião, vê
"Reunião nova detectada" e clica em "Continuar enviando para esta sessão". Tudo o que foi dito **antes**
de ligar o envio vai para o backend e é processado pelo Gemini. Isso desrespeita a escolha explícita de
"desligado = nada sai" (D-09), num projeto com exigência de LGPD.

Reproduzido com a mesma sequência do teste existente "desligar, trocar de reunião e religar"
(`agenteStreamer.test.ts`), acrescentando a confirmação no fim. Os corpos enviados foram
`["cliente A","segredo dito com envio desligado"]`. A segunda fala foi capturada **com o toggle
desligado**. O teste atual só confere que aparece `waitingMeetingId`, não o que sai depois da confirmação,
e por isso passa.

**Correção:** quando a espera nasce de um cursor nulo, ancorar o cursor no estado atual (prime) e
**estacionar** esse cursor marcado como "aguardando confirmação". Na confirmação, calcular o delta a
partir dessa âncora, e não de `sent: {}`. No caso "navegador fechado com o envio ligado", o primeiro flush
da m2 acontece no começo da reunião, então a âncora fica praticamente vazia e a decisão do time
("confirmar libera o que foi dito durante a espera") continua valendo. No caso do toggle, só sai o que
foi dito depois de ligar.

```ts
// wordDelta.ts
export interface StreamCursor {
  meetingId: string;
  sessionId: string;
  sent: Readonly<Record<string, number>>;
  /** CR-01: cursor ancorado numa reunião diferente da vinculada, esperando a pessoa confirmar. */
  awaitingConfirmation?: boolean;
}

if (prev === null) {
  const anchor = primeCursor(session, binding.sessionId);
  const bound = binding.boundMeetingId;
  if (bound && bound !== session.meetingId && binding.confirmedMeetingId !== session.meetingId) {
    return { cursor: { ...anchor, awaitingConfirmation: true }, deltas: [], waitingForNewMeeting: true };
  }
  return { cursor: anchor, deltas: [] };
}
if (prev.awaitingConfirmation && prev.meetingId === session.meetingId) {
  if (binding.confirmedMeetingId !== session.meetingId) {
    return { cursor: prev, deltas: [], waitingForNewMeeting: true };
  }
  const { awaitingConfirmation: _released, ...anchor } = prev;
  return computeSegmentDeltas({ ...anchor, sessionId: binding.sessionId }, session.segments);
}
```

Também é preciso ajustar `recordBinding` para **não** gravar o vínculo enquanto
`cursor.awaitingConfirmation` for verdadeiro (hoje ele confere só `cursor === null`). O snapshot já
persiste o cursor, então a âncora sobrevive ao reinício do service worker. Teste semente: a sequência
acima termina com `fetch` contendo só o que foi dito depois de religar. Como isso muda **o que sai** depois
da confirmação, a regra exata ("desde a âncora" ou "desde o início") é **DECISÃO EM ABERTO** do time.
Mesmo assim, o envio retroativo do que foi dito com o toggle desligado precisa ser fechado antes do merge.

## Warnings

### WR-01: Gravar o vínculo dentro do objeto da config cria corrida entre o service worker e a tela, e uma gravação pode apagar a outra

**Arquivos:** `taqciti/src/background/agenteStreamer.ts:38-40`, `taqciti/src/shared/config/agenteConfigStore.ts:38-54`, `taqciti/src/background/agenteStreamerInstance.ts:176-188`

**Problema:** até `c2570b6`, só a tela gravava `taq:agenteConfig`. Agora o service worker também grava
(`bindMeeting` chama `patchAgenteConfig`). A fila de `patchAgenteConfig` é uma variável de módulo, então
**cada contexto tem a sua**: a do service worker não serializa nada com a da tela. As duas fazem
`loadAgenteConfig()` seguido de `writeLocal` do objeto **inteiro**, e uma gravação concorrente perde a
atualização da outra, nos dois sentidos:

1. **O service worker desfaz o que a pessoa salvou.** No primeiro flush de uma reunião, ou logo depois da
   confirmação, o service worker lê a config (S1, ligado). A tela grava `streamingEnabled: false`, ou um
   `agenteSessionId` novo. Aí o service worker grava `{ S1, ligado, boundMeetingId: m }` por cima. O
   desligar volta a ficar ligado, ou o ID novo volta a ser o do cliente anterior, e a fala segue para lá.
2. **A tela apaga o vínculo.** A tela lê (vínculo vazio), o service worker grava `boundMeetingId: m1`, e
   a tela grava a URL ou a chave nova com o vínculo vazio da leitura antiga. No dia seguinte não existe
   vínculo, e a reunião do outro cliente faz o prime direto. É exatamente o buraco do CR-01 da 2ª revisão
   reaberto, em silêncio.

A janela é de milissegundos, mas cai justamente no começo da reunião, que é quando a pessoa está mexendo
na tela. Tem ainda um efeito colateral: a gravação do vínculo dispara o `onChanged` do próprio service
worker, e isso roda `applyConfigChange` → `status.resetSendOutcome()` (ver IN-01).

**Correção:** tirar o vínculo do objeto da config. Usar uma chave própria em `storage.local`, que só o
service worker grava, com escrita direta, sem leitura antes:

```ts
// constants.ts: STORAGE_KEYS.agenteBinding = 'taq:agenteBinding'
// valor: { sessionId: string; meetingId: string }

// agenteStreamer.ts
async function bindMeeting(sessionId: string, meetingId: string): Promise<void> {
  await writeLocal(STORAGE_KEYS.agenteBinding, { sessionId, meetingId });
}

// agenteStreamerInstance.ts — advance()
const bound = storedBinding?.sessionId === config.agenteSessionId ? storedBinding.meetingId : '';
```

O vínculo só vale se o `sessionId` gravado for igual ao da config atual. Com isso, a regra especial de
`patchAgenteConfig` ("trocou a sessão, zera o vínculo") deixa de ser necessária, a tela não consegue mais
apagar o vínculo, e o `onAgenteConfigChange` (que só olha `taq:agenteConfig`) deixa de ser disparado
pela gravação do vínculo. Muda o lugar do campo no storage, então é **DECISÃO EM ABERTO** do time. Os
dados e o comportamento continuam os mesmos.

### WR-02: Zerar o status pela tela é read-modify-write entre contextos e pode ressuscitar o aviso "Reunião nova detectada" enquanto o envio já está acontecendo

**Arquivos:** `taqciti/src/shared/hooks/useAgenteConfigForm.ts:139-141`, `taqciti/src/shared/config/agenteStatusStore.ts:26-38`, `taqciti/src/background/agenteStatusReporter.ts:152-156`

**Problema:** a correção do WR-02 faz a tela chamar `patchAgenteStatus(NO_SEND_OUTCOME)`. Essa função lê
o status inteiro e grava `{ ...lido, ...patch }`. Ela usa uma fila de módulo, e a fila da tela não é a
mesma do service worker. O cenário mais provável é o que o próprio aviso pede: "se for outra sessão, cole
o ID novo e salve".

1. A tela grava `agenteSessionId: S2`. O service worker recebe o `onChanged`, faz o prime e grava
   `waitingMeetingId: null`.
2. Ao mesmo tempo, a tela lê o status, ainda com `waitingMeetingId: 'm2'`, e grava
   `{ waitingMeetingId: 'm2', lastOutcome: null, ... }` **depois** do service worker.

Resultado: a tela mostra "Reunião nova detectada — nada está sendo enviado" enquanto as falas já estão
indo para S2. E o problema não se corrige sozinho: `createStatusReporter.waitingForMeeting` só grava
quando o valor muda (`reportedWaiting === null`), então o service worker nunca regrava o `null`. Os
próximos `sendOutcome` também fazem read-modify-write e preservam o `'m2'` errado. Como o aviso tem
prioridade em `describeAgenteStreaming`, ele fica na tela até o service worker reiniciar. O sentido
inverso também existe: um patch do service worker que leu antes do reset da tela grava por cima dele e o
"401" antigo volta, que é o sintoma original do WR-02.

**Correção:** separar o status em duas chaves de `storage.session`, cada uma com um único dono. O
resultado do envio (`taq:agenteSendOutcome`) é gravado pelo sender e zerado pela tela **com escrita direta,
sem ler antes**. A espera (`taq:agenteWaiting`) é gravada só pelo service worker.

```ts
// agenteStatusStore.ts
export function resetSendOutcome(): Promise<void> {
  return writeSession(STORAGE_KEYS.agenteSendOutcome, NO_SEND_OUTCOME); // sem leitura: nada a perder
}
```

O `subscribeAgenteStatus` junta as duas chaves para a tela, e o `markInterruptedSend` passa a mexer só na
chave do resultado. Teste semente: com status `{ waitingMeetingId: 'm2' }` e um `patchAgenteStatus` da tela
intercalado entre a leitura e a escrita do service worker, o valor final de `waitingMeetingId` é `null`.

## Info

### IN-01: A gravação do vínculo zera, sem motivo, o resultado do envio que acabou de sair

**Arquivo:** `taqciti/src/background/agenteStreamerInstance.ts:167`, `taqciti/src/background/agenteStreamerInstance.ts:211-220`

**Problema:** depois da confirmação, `advance` libera a reunião (`sender.submit`) e então chama
`recordBinding`, que grava a config. Essa gravação volta como `onChanged` para o próprio service worker,
que roda `applyConfigChange` → `status.resetSendOutcome()`, embora o destino não tenha mudado. Se o
primeiro trecho já tiver voltado como `rejected` (401), a tela passa a mostrar "Ligado — pronto para
enviar" até o próximo envio.

**Correção:** isso some sozinho com a correção do WR-01, porque o vínculo sai da chave da config. Se ela
não for adotada, chamar `resetSendOutcome()` só quando a `destinationKey` de fato mudar (`syncDestination`
pode devolver um booleano).

### IN-02: "← Voltar" ainda fica sem efeito quando a aba tem só entradas para frente no histórico

**Arquivo:** `taqciti/src/sidepanel/backNavigation.ts:30-38`

**Problema:** `history.length` conta também as entradas **à frente**. Exemplo: a pessoa abre a tela numa
aba nova, clica em "← Voltar" (o `href="?"` navega, e o tamanho do histórico vira 2), usa o botão Voltar
do navegador para retornar à tela do Agente e clica em "← Voltar" de novo. A condição `length > 1` passa,
o referrer continua sendo da extensão, o `history.back()` roda na primeira entrada e o clique não faz
nada.

**Correção:** no Chrome da extensão já existe a Navigation API, então dá para usar
`window.navigation?.canGoBack` no lugar de `history.length`, com fallback para `history.length` se
`navigation` não existir. A função pura pode receber `canGoBack: boolean`.

### IN-03: Trocar só o ID da sessão descarta os trechos já liberados para a sessão antiga, mas manda os que ainda estão na janela

**Arquivos:** `taqciti/src/background/agenteStreamerInstance.ts:116-122`, `taqciti/src/features/agente/phraseBatcher.ts:160-171`

**Problema:** a `destinationKey` do WR-01 inclui o `agenteSessionId`. Trocar só a sessão cancela a fila do
sender, mas `buildPhraseRequests` filtra só por `backendUrl`, então as falas pendentes da sessão antiga
continuam saindo para ela (regra D-04). Ficam duas regras opostas para o mesmo caso: fala "liberada"
para S1 se perde e fala "pendente" para S1 é entregue. Em backend saudável a fila costuma estar vazia,
então o efeito é pequeno, mas o resultado depende do momento exato do clique.

**Correção:** escolher uma regra só. Uma opção é tirar o `agenteSessionId` da `destinationKey` e usar só
URL + chave. Os trechos liberados já levam o `session_id` certo no corpo e o backend certo na URL, o que
é coerente com o D-04. A outra é passar a descartar também as falas pendentes de outra sessão. Registrar
a escolha no plano.

---

_Revisado: 2026-10-11T01:44:50Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
