# Fase 8 — Decisões pendentes do time (para retomar a execução)

**Registrado em:** 2026-10-12 · **Branch:** `feat/fase-08-taqciti-session-association`
**Comando para retomar:** `/gsd-execute-phase 8` (os planos com SUMMARY são pulados sozinhos)

> Este arquivo existe porque a execução parou num checkpoint de decisão. O executor **não pode** escolher
> por conta própria (CLAUDE.md, "Decisões que são do usuário/time"). Preencha as respostas abaixo e,
> ao retomar, cole-as na conversa (ou diga "as respostas estão em `08-DECISOES-PENDENTES.md`").
> Nada aqui foi decidido por mim: todos os campos de resposta estão em branco de propósito.

---

## Onde a execução parou

| Item | Situação |
|------|----------|
| Planos concluídos | **6 de 23** — 08-01 a 08-06 (SUMMARY presente, commits conferidos, sem `Self-Check: FAILED`) |
| Próximo plano | **08-07** (onda 1) — abre com checkpoint de decisão B1 |
| Restante da onda 1 | 08-08 (checkpoint B2) |
| Modo de execução | **Sequencial na árvore principal, sem worktrees.** Motivo: o `HEAD` local (`b11504d` na época) estava à frente do `origin/HEAD` (`5ca499e`), então o `worktree.base-check` mandou degradar. O aviso da própria ferramenta diz que o paralelo volta quando o `origin/HEAD` (a `main`) alcançar o `HEAD`, ou com a opção `worktree.baseRef:"head"` — isso é decisão de configuração do time, não foi alterado. |
| Arquivo alterado e não relacionado | `.planning/config.json` está modificado e **não** deve entrar em commit nenhum (os executores foram instruídos a não tocá-lo). |

### Aviso importante sobre a Taqciti
Depois do commit `4dfe299` (plano 08-01), colar o ID na tela de configuração **deixou de enviar sozinho**:
sem associação `linked` nada sai, até os planos 08-10 e 08-14. **Não distribuir build da Taqciti entre o 08-01 e o 08-14.**
Reverter, se preciso: `git revert 4dfe299`.

---

## Bloqueiam AGORA (onda 1)

### 1. B1 — Rotas novas da extensão (plano 08-07)

Contrato proposto: `GET /webhook/extension/clients` → `[{id, client, name}]`; `POST /webhook/extension/clients`
(`name` 1–120, 409 se duplicado ignorando acento/caixa, **sem** índice único, `mode='discovery'`,
`source='extension'`, sem chave Gemini); `POST /webhook/extension/sessions {project_id, name?}` → 201 `{id}`,
404 se o projeto não existe. Gate: o mesmo `verify_extension_key` da Fase 6 (opt-in).

Opções (responder com **uma**):
- `aprovar-recomendado` — aceita o contrato como está **e aceita o risco residual T-08-10 (alto)**.
- `aprovar-com-ajustes` — diga quais (ex.: mode `sales`, exigir a env var nas escritas, outro limite de nome, permitir duplicado). O executor para e os planos 08-07 (Tasks 2–3) e 08-12 são replanejados.
- `rejeitar` — Tasks 2–3 do 08-07 e o plano 08-12 não executam; a Taqciti fica só com o plano B (ID manual) e o critério 1 do ROADMAP fica não atendido.

**Risco T-08-10 (só vale para `aprovar-recomendado`):** enquanto `EXTENSION_SHARED_KEY` não estiver ativa no Railway,
qualquer pessoa com a URL cria clientes e sessões, e a chave Gemini do **servidor** paga o pipeline dessas sessões.
Sem dono nomeado, o executor **não escreve rota nenhuma**.

- **Resposta B1:** `aprovar-recomendado` (contrato como proposto: mode `discovery`, 409 sem índice único, gate opt-in)
- **Dono do risco T-08-10 (nome de quem do time):** Time Antonio (resposta literal do usuário; entendido como Antonio)
- **Condição de revisão / até quando vale (ex.: "até ativar `EXTENSION_SHARED_KEY` no Railway"):** até o login do AGM. Contexto informado pelo usuário: o deploy ainda **não foi feito**; os merges vão para a `main` e o deploy sai da `master`, então as rotas ainda não estão expostas em produção.
- **Data:** 2026-10-12

### 2. B2 — Chave Gemini opcional na criação de projeto (plano 08-08)

O pipeline já usa `GEMINI_API_KEY` do servidor quando o projeto não tem chave. A mudança é no contrato (`ProjectCreate`) e no formulário do web app.
Efeito colateral: a importação de PDF (`routers/sessions.py`, `upload_pdf_transcript`) só lê a chave do projeto no Vault e devolve **503** sem ela.

Opções (responder com **uma**):
- `aprovar` — e confirmar que `GEMINI_API_KEY` **está** configurada no Railway.
- `aprovar-sem-env` — `GEMINI_API_KEY` **ainda não** está no servidor; vira pendência bloqueante do teste manual D-20.
- `rejeitar` — Tasks 2–3 do 08-08 e o plano 08-12 não executam; criar cliente pela Taqciti exigiria revisar o UI-SPEC.

Em `aprovar` e `aprovar-sem-env`, responder também **`pdf-fallback: sim`** (a importação de PDF passa a usar `GEMINI_API_KEY`; commit separado, muda rota existente) **ou `pdf-fallback: não`** (fica a limitação "projeto sem chave não importa PDF", registrada). Sem essa resposta o executor pergunta de novo.

- **Resposta B2:** `aprovar-sem-env` (2026-10-12, decisão do usuário: a chave do projeto pode ser retirada)
- **`GEMINI_API_KEY` no Railway? (sim/não — nunca cole o valor aqui):** **NÃO** — ainda não existe no Railway.
  > ⚠️ **OBRIGATÓRIO: TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`, merge na `main` ou junção com o AGM. Sem ela, projetos sem chave própria não rodam o pipeline de IA.
- **pdf-fallback (sim/não):** **sim** (2026-10-12) — a importação de PDF passa a usar `GEMINI_API_KEY` do servidor quando o projeto não tem chave própria; commit separado (muda rota existente).

---

## Vão aparecer mais adiante (responder agora evita novas paradas)

### 3. B3 — `chunk_id` e reenvio automático (plano 08-09) — três respostas, uma de cada grupo

- **B3-a:** `aprovar-chunk-id` (migração aditiva no Supabase de produção + índice único + reenvio + "Continuar envio") · `reenvio-sem-chunk-id` (aceita risco de duplicata; Tasks 2–3 do 08-09 não executam) · `adiar` (reenvio automático fica desligado; critério 4 do ROADMAP não é atendido e a fase não fecha — escalar).
- **B3-b (desistir de fala recusada com HTTP 500):** `retirada-500-2min` · `retirada-500-ajustada` (informe os minutos, 1 a 60) · `retirada-nunca` (padrão, D-18 literal). Atenção: com o banco fora por mais que o limite e o backend no ar, falas ao vivo seriam descartadas (ficam no rastro `taq:agenteDropTrace`).
- **B3-c (opcional, 404 para `session_id` inexistente):** `404-agora` (o executor para e o 08-09 é replanejado com commit próprio) · `404-depois` (padrão) · `nao-fazer`.
- Sem resposta: B3-b = `retirada-nunca`, B3-c = `404-depois`, registrado como "sem resposta do time".

- **Resposta B3-a:** `aprovar-chunk-id` (2026-10-12). Palavras do usuário: "aprovar-chunk-id e te autorizo explicitamente para fazer o migration".
- **Resposta B3-b:** sem resposta → padrão `retirada-nunca` (registrado como "sem resposta do time")
- **Resposta B3-c:** sem resposta → padrão `404-depois` (registrado como "sem resposta do time")

**Ação humana associada (plano 08-09, Task 3, só com `aprovar-chunk-id`):** uma pessoa do time com acesso ao Supabase de produção precisa aplicar
`supabase/migrations/20261011000000_add_chunk_id_to_transcript_chunks.sql` (SQL Editor, como na Fase 2; ou `supabase db push` com `SUPABASE_ACCESS_TOKEN` definido por ela mesma — o executor nunca lê `.env` nem pede o token)
e colar o resultado das três consultas de conferência (coluna `chunk_id` tipo `text`; índice `ux_transcript_chunks_session_chunk`; contagem de linhas antigas com `chunk_id is null`).
O código do webhook que depende da migração **não pode ir para produção antes disso**.

- **Quem aplica a migração e quando:** o usuário autorizou explicitamente o Claude a aplicar a migração (2026-10-12), via conector do Supabase (o executor nunca lê `.env` nem pede token). Aplicar antes do deploy da `master`; o deploy ainda não foi feito.

### 4. B4-b — Quem encerra a sessão criada pela Taqciti (plano 08-15)

- `sw-com-alarms` (recomendada) — a Taqciti encerra pela rota da extensão 10 min após o fim e com a fila vazia, via `chrome.alarms` (permissão nova no manifesto, sem aviso de instalação). Responder também se aceitam o **resíduo**: sessão cujo envio em partes PAROU ("Envio parou") e ninguém clicou em "Continuar envio" não é encerrada automaticamente (o laço de IA segue até o web app encerrar ou o processo reiniciar). **sim/não.**
- `timeout-backend` — o backend para sessões `source='extension'` sem chunk há N minutos; mexe no pipeline compartilhado; 08-15 e 08-16 são replanejados.
- `manual` — ninguém encerra automaticamente; risco de custo de IA aceito explicitamente; Task 2 do 08-15 e o 08-16 não executam.

- **Resposta B4-b:** AJUSTE da opção `sw-com-alarms` (2026-10-12), palavras do usuário: "encerra a sessão na hora que a call acaba" (sem a espera de 10 minutos; motivo: custo de IA ocioso depois da call). Replaneja 08-15 (Task 1/2) e 08-16 (gatilho) e exige decidir o que acontece ao reentrar na mesma sala depois do encerramento (08-22 hoje retoma a MESMA sessão dentro de 10 min).
- **Aceita o resíduo "Envio parou"? (sim/não):** **NÃO** (2026-10-12). Palavras do usuário: "não aceito. espera de 5 minutos." Ou seja: se o envio em partes parar (fila não esvazia) a Taqciti encerra a sessão mesmo assim depois de 5 minutos parado (limite de segurança contra o custo de IA ocioso).
- **Reentrar na mesma sala depois do encerramento (2026-10-12):** `sim` — vira reunião nova (nova associação pendente e nova sessão), em vez de retomar a sessão encerrada. Ajusta o 08-22 (hoje retoma a mesma sessão dentro de 10 min).
- **DA-1 (08-24, o que a sessão da reunião nova leva):** `reuniao-nova-de-verdade` (2026-10-12): novo registro no histórico, nova associação e sessão só com o que for dito depois da volta.
- **DA-2 (08-20, "Continuar envio" depois do encerramento):** `continuar-com-aviso` (2026-10-12): mostra "A sessão no Agente já foi encerrada. O restante entra na transcrição, mas o relatório precisa ser gerado de novo."
- **DA-3 (aba fechada no meio da call):** `fechar-aba-encerra` (2026-10-12): fechar a aba conta como fim da reunião e dispara o encerramento. Muda a máquina da Fase 7; vira o plano novo 08-26 (a planejar).
- **B4-b consolidada:** `sw-com-alarms` AJUSTADA: (1) encerrar na hora que a call acaba, com a fila de envio vazia; (2) com envio parado/fila não vazia, encerrar após 5 min; (3) reentrada na mesma sala depois de encerrada = reunião nova. Replanejamento em andamento (08-15, 08-16, novo plano de ajuste do 08-22, e referências a "10 min" nos 08-19/20/21).

### 5. B5 — Papel do campo de ID na tela "Agente Diagnóstico" (plano 08-18)

- `vincular-ao-vivo` (recomendada) — salvar um ID válido vincula a reunião ao vivo ainda sem cliente; sem reunião ao vivo, só guarda; cartão CR-01 sai; texto de apoio novo.
- `so-informativo` — o campo só guarda o ID; o vínculo manual é só pelo painel do Meet; CR-01 sai.
- `manter-fase-7` — o ID da config continua sendo destino quando não há associação (contradiz D-04 e o critério 3; exige replanejar o 08-01; Task 2 do 08-18 não executa; **não recomendado**).

- **Resposta B5:** `vincular-ao-vivo` (2026-10-12)

### 6. D-11 — Porta sem volta: "Descartar" (plano 08-13)

"Descartar" apaga **de vez** a cópia local de uma reunião encerrada e não enviada, após confirmação na UI (nada é apagado no backend). Um descarte por engano perde a transcrição.
- `confirmar-d11` (decidido pelo usuário em D-11) · `lixeira` (apagar só depois de N dias; fora do UI-SPEC; replaneja o 08-13 e o 08-17).
O modo automático está desligado, então o executor **não** auto-seleciona; ele vai perguntar.

- **Resposta D-11:** `confirmar-d11` (2026-10-12). Palavras do usuário: "pode confirmar d11". A lixeira local fica como evolução futura (custo baixo a médio, contido atrás de `deleteRecord`).

---

## Decisões já registradas no código (não precisam de resposta, só de atenção)

- `agenteStreamerInstance.ts` ficou com só **7 linhas de folga** (293/300) para o plano 08-23, que também mexe nele. Se faltar espaço, mover `settleTarget` e a adoção da semente para `agenteStreamDestination.ts` num commit mecânico.
- `TAQ-02` só será marcado como completo quando o último plano que o declara terminar (o gate de ID compartilhado devolve 0/1 até lá). Comportamento esperado.
- `stopped` e `rejected` na barra de vínculo ao vivo são avisos *warning* (suposição do planejador, reversível).
- Bloco de 20 e pausa de 1 s no envio em partes (suposição A3) devem ser validados no teste manual D-20(a).
- Várias peças visuais (`AgenteNudge`, `AgenteDecisionCard`, `ClientPicker`, `AgenteBindingBar`, `AgenteEndPrompt`, `AssociationBadge`) ainda não estão montadas em tela nenhuma — a fiação é dos planos 08-10, 08-14 e 08-17. A conferência visual fica para o teste manual D-20.

---

## Como retomar

1. Preencha as respostas acima (no mínimo **B1 e B2**, que bloqueiam a onda 1; as demais evitam novas paradas).
2. Abra uma sessão nova e rode `/gsd-execute-phase 8`.
3. Cole as respostas na conversa. O executor registra cada uma, literal, no SUMMARY do plano correspondente (08-07, 08-08, 08-09, 08-13, 08-15, 08-18).
4. Opcional: se o time quiser a execução em paralelo por worktrees, é preciso resolver a divergência com o `origin/HEAD` ou configurar `worktree.baseRef:"head"`. Sem isso, a fase continua sequencial (mais lenta, mas segura).
