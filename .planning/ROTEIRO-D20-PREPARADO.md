# Roteiro D-20 preparado — teste manual da Taqciti (Fase 8)

**Preparado em:** 2026-10-22 · **Branch:** `feat/fase-08-taqciti-session-association` (já com a `main` incorporada, commit `b1dcbcd`)
**Base:** os cenários (a)–(i) de `phases/08-taqciti-session-association/08-VALIDATION.md`, só que reorganizados
em **6 reuniões curtas** (uma pessoa, sala própria), mais os itens novos desta sessão. Nada aqui foi executado ainda.

> Quem testa precisa de: Chrome ≥ 116, uma sala do Google Meet que possa abrir e fechar, e acesso ao SQL Editor do Supabase.

---

## 0. Antes de começar

### 0.1 Cuidado principal: o backend local grava no banco de PRODUÇÃO
O `backend/.env` aponta para o Supabase "Agente-Diagnostico". Tudo que o teste criar vai para lá.
- Use **um cliente só de teste**, criado pela própria Taqciti (seletor → criar cliente): **`ZZ-TESTE-D20`**.
  Assim tudo é fácil de achar e apagar no fim (seção 6).
- **Nunca** vincule uma reunião de teste a um cliente real.

### 0.2 Checklist de preparação

- [ ] **Supabase ativo.** Em 2026-10-22 o projeto estava pausado (`INACTIVE`) e foi restaurado. Confirme no painel que está
      `ACTIVE_HEALTHY`. Se `GET /projects/` der 500 com `getaddrinfo failed`, o banco está pausado de novo.
- [ ] **Backend local** em `:8000`: `cd backend && python -m uvicorn app.main:app --port 8000`
- [ ] **Web app** em `:5173`: `npm --prefix frontend run dev`
- [ ] **`GEMINI_API_KEY`** no ambiente do backend local (clientes criados pela Taqciti não têm chave própria; sem ela o pipeline
      de IA falha durante a reunião, e isso suja o log). Gasta uma cota pequena de IA.
- [ ] **Build novo da extensão:** `cd taqciti && npm run build` (o `dist/` de 12/10 está velho; um build de 2026-10-22 já foi gerado
      nesta máquina, mas refaça se trocar de PC).
- [ ] **Carregar a extensão:** `chrome://extensions` → Modo desenvolvedor → "Carregar sem compactação" → pasta `taqciti/dist`.
- [ ] **Abrir o painel da Taqciti → tela "Agente Diagnóstico":** ligar *"Enviar a transcrição ao vivo para o Agente"* e conferir
      que a URL do backend é `http://localhost:8000`.
- [ ] Abrir o **DevTools do service worker** da extensão (`chrome://extensions` → "service worker") e deixar visível:
      é onde aparecem erros e onde se mede a cota (seção 5).

### 0.3 Para registrar qualquer problema
Anote: **número da reunião e cenário**, o que esperava, o que viu, e copie as linhas vermelhas do console do service worker.
Se possível, guarde o `session_id` (aparece na URL da sessão no web app).

---

## 1. Reunião 1 — vínculo no meio, reunião longa, encerramento e reentrada  *(cenários d, h, e, f-depois)*

| Passo | O que fazer | Esperado |
|-------|-------------|----------|
| 1.1 | Entrar na sala, **falar ~30 s sem escolher cliente** | Aparece a bolha "!" pedindo cliente |
| 1.2 | Escolher/criar o cliente **`ZZ-TESTE-D20`** pelo "!" ou pelo cartão | "Enviando o que já foi falado… x de y" → "Enviando ao vivo para ZZ-TESTE-D20". No web app a sessão tem o começo da fala **e** o que vem depois, na ordem **(d)** |
| 1.3 | Continuar na reunião por **mais de 5 minutos** (pode conversar com você mesmo) | A sessão **continua ativa** no web app; nada é encerrado com a reunião em andamento **(h)** |
| 1.4 | Sair da reunião / encerrar a call com o backend no ar | Sessão **ENCERRADA** no web app em poucos segundos **(e)** |
| 1.5 | Voltar à **mesma sala em até 10 min** depois do encerramento | Bolha "!" de novo; ao escolher o cliente nasce uma **sessão NOVA**, só com o que foi dito depois da volta. A antiga segue encerrada **(f, depois)** |

## 2. Reunião 2 — queda do Agente e reenvio  *(cenários b, e com backend caído)*

| Passo | O que fazer | Esperado |
|-------|-------------|----------|
| 2.1 | Nova reunião, vincular a `ZZ-TESTE-D20`, falar ~30 s | Streaming normal |
| 2.2 | **Parar o backend** (Ctrl+C) e continuar falando ~1 min | Faixa amarela "O Agente está fora do ar…" com a contagem de falas pendentes |
| 2.3 | **Religar o backend** | Toast "Agente de volta. Falas reenviadas." |
| 2.4 | No SQL Editor: duplicatas (query abaixo) | **0 linhas** **(b)** |
| 2.5 | Repetir 2.2, mas **só religar depois de encerrar a call** | A sessão encerra assim que a fila esvazia, ou ~5 min depois do fim se a fila não andar **(e)** |

```sql
-- duplicatas de falas na sessão (troque o id)
SELECT session_id, chunk_id, count(*)
FROM transcript_chunks
WHERE session_id = '<session_id>'
GROUP BY 1, 2
HAVING count(*) > 1;
```

## 3. Reunião 3 — envio no fim, sem vínculo ao vivo  *(cenário a)*

| Passo | O que fazer | Esperado |
|-------|-------------|----------|
| 3.1 | Entrar, falar ~1 min, clicar **"Depois"** na bolha | Nada é enviado durante a call |
| 3.2 | Encerrar a call → "Enviar esta reunião ao Agente?" → escolher `ZZ-TESTE-D20` | A barra vai até "Reunião enviada…". No web app a sessão nova tem a **transcrição completa, na ordem** (valida o envio em blocos de 20 com pausa de 1 s) **(a)** |

## 4. Reuniões 4 a 6 — descarte, aba fechada, navegação

| Reunião | O que fazer | Esperado |
|---------|-------------|----------|
| **4 — descarte (c)** | Reunião curta, **terminar sem cliente** → "Descartar" | Modal com "Manter reunião" (desistir mantém). "Descartar" some do histórico da Taqciti. **Nada muda no web app** |
| **5 — aba fechada (i)** | Reunião vinculada a `ZZ-TESTE-D20`, **fechar a aba** do Meet no meio da call, depois reabrir a mesma sala | Reunião aparece **encerrada** no histórico da Taqciti; sessão **ENCERRADA** no web app em poucos segundos; reabrir a sala = reunião nova (DA-3) |
| **6 — navegar (DA-4)** | Reunião vinculada gravando; na **mesma aba**, navegar para outro site (ex.: google.com) | Reunião vira "encerrada" e a sessão fecha (na hora com a fila vazia, senão em até 5 min). **Contra-prova:** recarregar a mesma sala, ou mudar só o `?query` da URL, **não** encerra |

**Também nesta rodada:**
- **(e, plano B)** Numa reunião, colar um **ID manual de sessão** (campo "cole aqui o ID (UUID) da sessão ativa") em vez de usar o seletor, e terminá-la. A sessão colada **nunca** deve ser encerrada pela Taqciti.
- **(f, antes)** Sair e voltar à sala **antes** do encerramento (fila ainda esvaziando) → continua na **mesma** sessão.
- **(g)** Ao carregar/recarregar a extensão, o Chrome **não** mostra aviso de instalação/atualização por causa da permissão `alarms`.

---

## 5. Itens novos desta sessão (não estavam no roteiro original)

### 5.1 Envio ao DocuData no encerramento pela Taqciti  *(correção `b1dcbcd`)*
Antes, só o encerramento pelo web app e pelo WebSocket agendavam o envio. Agora o da Taqciti também.
Os testes automáticos provam o agendamento; **a entrega real depende de variáveis que só você tem**.

**Teste do agendamento (sem precisar do DocuData de verdade):**
1. No terminal que sobe o backend, exporte antes de iniciar: `DOCUDATA_URL=http://localhost:9999` e `DOCUDATA_DISCOVERY_KEY=qualquer-coisa`.
2. No web app, abra o projeto `ZZ-TESTE-D20` → "Editar projeto" → preencha o vínculo com o DocuData com um ID qualquer.
3. Faça uma reunião curta vinculada a esse projeto e encerre pela Taqciti.
4. **Esperado:** no log do backend aparece uma linha `exportacao_docudata_falhou sessao=<id> exc=...`
   (falhou porque `:9999` não existe, e isso prova que o envio **foi agendado**). O encerramento **continua dando 200**.
   A linha costuma sair em poucos segundos (porta fechada recusa na hora; são 3 tentativas com espera crescente). O pior caso do
   código é cerca de 1 min 30 s, então espere um pouco antes de concluir que não saiu.
   O envio só acontece se o projeto for do modo `discovery` (os clientes criados pela Taqciti já são) **e** tiver o vínculo preenchido.
5. **Controle:** repita encerrando pelo botão do web app. Deve aparecer a mesma linha.

**Sem o vínculo ou sem as variáveis, o envio é um no-op silencioso** (nenhuma linha no log). Isso é o comportamento certo, não um defeito.

**Para o teste de ponta a ponta de verdade** (chegar no DocuData), faltam `DOCUDATA_URL`, `DOCUDATA_DISCOVERY_KEY`, as migrations v8/v9 no banco
do DocuData e a do vínculo no banco do Agente. Combine com o Gabriel antes.

### 5.2 DA-5 — nova rodada no boot  *(commit `32c029b`)*
Com uma associação `picker` marcada `finishGaveUp: true` no `chrome.storage`, recarregar a extensão.
Esperado: **uma única** tentativa de encerrar; se falhar de novo, desiste e não repete até o próximo boot.
*(Exige editar o `chrome.storage` pelo DevTools; é o mais trabalhoso. Pode ficar por último ou ser coberto só pelos testes automáticos.)*

### 5.3 Retomar envio limpa `finishGaveUp`  *(commit `a717b64`)*
Reunião com envio parado e desistência marcada → "Continuar envio" → concluir.
Esperado: a sessão passa a ser encerrada normalmente depois.

### 5.4 Backstops visuais (conferir no painel real)
| Checagem | Esperado |
|----------|----------|
| Cartão de decisão em 320 px e 564 px | Sem corte e sem rolagem horizontal |
| Selo de associação ao lado do StatusBadge no HistoryCard com título longo | Selo e badge legíveis, sem estourar o card |
| Modal de descarte com título longo | Texto não estoura o modal |
| Seletor de clientes em 320 px e 564 px | Painel sobe ao abrir; em 564 px, pelo menos 3 linhas de cliente visíveis |

### 5.5 Cota do storage
No DevTools do service worker, depois de uma reunião longa (a da seção 1):
`chrome.storage.local.getBytesInUse(null)` → anote: ______ bytes. Só pedir `unlimitedStorage` ao time se passar de ~5 MB.

---

## 6. Depois do teste

1. **Registrar** os resultados na tabela de `08-VALIDATION.md` (seção "Roteiro manual D-20") e no UAT (`/gsd-verify-work 8`).
2. **Limpar a produção:** no web app, apague primeiro as **sessões** de `ZZ-TESTE-D20` e depois o **projeto**
   (a sessão tem de sair antes do projeto). Se sobrar algo, procure por `ZZ-TESTE` no SQL Editor.
3. Se algo falhou: abrir plano de correção. Nada de PR para a `main` antes do D-20 passar.
4. **Não distribuir** o build da Taqciti antes do D-20 passar.

## 7. Decisões que continuam do time (o teste não resolve)

- Confirmar **DA-4** e **DA-5** (implementadas na opção recomendada; cada uma se desfaz com `git revert`: DA-4 = `566a005`, DA-5 = `32c029b`).
- Remoção do código da Fase 7 (`confirmNewMeeting`, `confirmedMeetingId`, `configDestination`, texto "confirme abaixo").
- Aviso de histórico cheio de reuniões não enviadas.
- **`GEMINI_API_KEY` no Railway** e a **ativação do Supabase em produção** (o projeto pausado mostra que isso precisa de dono).
- Ativar `EXTENSION_SHARED_KEY` em produção (T-08-10, risco aceito até o login do AGM).
