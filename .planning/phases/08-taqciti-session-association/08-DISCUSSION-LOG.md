# Phase 8: Taqciti Session Association - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-11
**Phase:** 08-taqciti-session-association
**Areas discussed:** Vínculo sessão ↔ reunião, Fluxo agora/depois/descartar, Sessão por reunião, Proteção e falhas de envio, Chave Gemini do cliente criado, Telas novas (aviso e diálogos), Testes e validação, Vínculo na aba AGP (parcial)

---

## Vínculo: seletor ou auto-detect

| Option | Description | Selected |
|--------|-------------|----------|
| Seletor por reunião | Ao detectar a reunião, a pessoa escolhe o cliente | ✓ |
| Auto-detect + ID manual (ROADMAP) | Lê `agente_session_id` do navegador | |
| Híbrido: sugerir e confirmar | Auto-detect sugere, seletor confirma | |

**User's choice:** Seletor por reunião (recomendado).
**Notes:** Proposta do usuário (registrada na memória de 2026-10-10). A discussão confirmou o mecanismo
e verificou que o `localStorage` só existe com a tela de monitoramento aberta.

## Campo manual de ID (plano B)

| Option | Description | Selected |
|--------|-------------|----------|
| Manter escondido (plano B) | Aparece só se a lista de clientes não carregar | ✓ |
| Remover de vez | Só o seletor | |
| Você decide | | |

**User's choice:** "podemos manter escondido".
**Notes:** Pediu explicação mais clara antes de responder. Ao responder, pediu também que, ao escolher o
cliente, a sessão seja criada na hora.

## Sessão provisória quando não há cliente no início

| Option | Description | Selected |
|--------|-------------|----------|
| B: guardar e enviar no fim | "Depois" guarda local; sessão nasce ao escolher cliente | ✓ (com migração futura para A) |
| A: sessão provisória ao vivo | Sessão sem cliente recebe fala ao vivo; liga depois | |
| C: escolher antes de enviar | Sem "depois"; envio segurado até escolher | |

**User's choice:** B agora, A depois (recomendado).
**Notes:** Usuário perguntou se B pode migrar para A e qual o custo. Resposta: migração aditiva; custo é
decisão de banco (`sessions.project_id` é NOT NULL) e gasto de IA em dobro. Verificado no schema.

## Fluxo: fechar o aviso sem escolher

| Option | Description | Selected |
|--------|-------------|----------|
| Conta como "Depois" | Guarda local, nada enviado | ✓ |
| Aviso volta a aparecer | Reaparece a cada poucos minutos | |
| Segura o envio até escolher | | |

**User's choice:** Conta como "Depois" (recomendado).

## Fluxo: pedir confirmação ao descartar

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, pedir confirmação | Dois cliques | ✓ |
| Não, apagar direto | | |

**User's choice:** Sim, pedir confirmação (recomendado).

## Fluxo: envio no fim da reunião

| Option | Description | Selected |
|--------|-------------|----------|
| Em blocos, na ordem | Pedaços pequenos com pausa | ✓ |
| Tudo de uma vez | Risco não testado | |
| Testar antes e decidir | | |

**User's choice:** Em blocos, na ordem (recomendado).
**Notes:** A rajada de reunião inteira nunca foi testada no backend. Vai para validação (D-20).

## Fluxo: quando perguntar "para qual cliente enviar?"

| Option | Description | Selected |
|--------|-------------|----------|
| Ao fim da reunião | Automático | |
| Só quando clicar no painel | | |
| Os dois | Automático e botão no painel | ✓ |

**User's choice:** Os dois.

## Fluxo: criar cliente novo pela Taqciti

| Option | Description | Selected |
|--------|-------------|----------|
| Rota nova só para criar cliente | Backend ganha rota pequena | ✓ |
| Reaproveitar `/sessions/start` | CITi Flow; cria segredo no Vault a cada chamada | |
| Criar só no web app | | |

**User's choice:** Rota nova só para criar cliente (recomendado).
**Notes:** Mudança de contrato da API — DECISÃO EM ABERTO do time.

## Fluxo: cliente criado só com nome

| Option | Description | Selected |
|--------|-------------|----------|
| Aceitar e completar no web app | Perguntas genéricas até completar | ✓ |
| Pedir os campos na hora | | |

**User's choice:** "Aceitamos e depois configuramos no web app".

## Sessão por reunião

**Resolvido pela resposta do vínculo:** cada reunião cria uma sessão nova, na hora da escolha do cliente.
Não foi preciso perguntar de novo.

## Proteção da API

| Option | Description | Selected |
|--------|-------------|----------|
| Rotas próprias da extensão, com a chave | Listar e criar clientes sob `/webhook/extension` | ✓ |
| Proteger o GET /projects atual | Exigiria a chave no site público | |
| Aceitar e registrar | | |

**User's choice:** Rotas próprias da extensão, com a chave (recomendado).
**Notes:** Mudança de contrato da API — DECISÃO EM ABERTO do time.

## GET /projects atual

| Option | Description | Selected |
|--------|-------------|----------|
| Deixar aberto e registrar | Risco de LGPD registrado | ✓ |
| Fechar agora | | |
| Você decide | | |

**User's choice:** "deixar o sistema como está e ficar registrado". Usuário mencionou que o artefato vai
para o AGM, plataforma com login para DEV, dados e produto.

## Falhas de envio (Agente fora do ar)

| Option | Description | Selected |
|--------|-------------|----------|
| Guardar e reenviar depois | Nenhuma fala se perde | ✓ |
| Esperar mais, com limite | | |
| Só avisar na tela | | |

**User's choice:** "guardar e reenviar depois. Porém deve ser avisado a pessoa que está usando, para que
ela saiba que está fora do ar".
**Notes:** Reabre a decisão 2-B do WR-04 (Fase 7). Reenvio pode duplicar trecho — exige id por trecho no
backend (DECISÃO EM ABERTO do time).

## Chave Gemini do cliente criado

| Option | Description | Selected |
|--------|-------------|----------|
| Chave do servidor | | (ajustado) |
| Chave própria digitada na Taqciti | | |
| Você decide | | |

**User's choice:** Usuário propôs tirar a exigência da chave Gemini na criação e usar a chave do servidor
para todos. Verificado: `ProjectCreate.gemini_api_key` é obrigatório; o Precificador usa `pricing_api_key`
separada.

## Escopo da remoção da chave Gemini

| Option | Description | Selected |
|--------|-------------|----------|
| Cadastro inteiro, web app incluso | | ✓ |
| Só a rota nova da Taqciti | | |

**User's choice:** Cadastro inteiro, web app incluso (recomendado).
**Notes:** Mudança de contrato — DECISÃO EM ABERTO do time.

## Telas novas: aviso de detecção

**User's choice (texto livre):** "Aparece no próprio pop-up do Taqciti. Podemos fazer o Taqciti subindo e
descendo levemente, a cada 5 segundos e com uma exclamação pequena, como se tivesse uma notificação".
**Notes:** Rejeitou o painel discreto e o diálogo bloqueante que eu tinha sugerido.

## Ícone: quando para de piscar

| Option | Description | Selected |
|--------|-------------|----------|
| Continua até abrir | | ✓ |
| Para depois de um tempo | | |
| Você decide | | |

**User's choice:** Continua até abrir (recomendado).

## Vínculo na aba AGP (Fase 10)

| Option | Description | Selected |
|--------|-------------|----------|
| Convite para escolher o cliente | | |
| Esconder a aba até ter cliente | | |
| Você decide | | |

**User's choice (texto livre):** "AGP é o nome da solução atual e a que vamos integrar é AGM. Sobre essa
conexão podemos detalhar depois, ainda não pensei como fazer."
**Notes:** Não respondeu à pergunta. Ficou em aberto, junto com a conexão com o AGM.

## Fala antes da escolha do cliente (meio da reunião)

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, a reunião inteira | | ✓ |
| Só o que for dito depois | | |

**User's choice:** Sim, a reunião inteira (recomendado).

## Testes e validação

| Option | Description | Selected |
|--------|-------------|----------|
| Automáticos + reunião real no Meet | | ✓ |
| Só testes automáticos | | |
| Você decide | | |

**User's choice:** Automáticos + reunião real no Meet (recomendado).

---

## Claude's Discretion

- Nomes e textos da UI, tamanho dos blocos do envio, pausa entre eles, número de tentativas antes de
  "fora do ar", formato de erro das rotas novas, localização exata do ícone (dentro do Meet ou na barra
  do Chrome).

## Deferred Ideas

- Migração B → A (sessão provisória ao vivo).
- Perguntas geradas só por clique, sem ciclo automático (Fase 10).
- Banco de perguntas sem filtro por `project_types` (`pipeline.py`).
- Tipo de projeto não usado no prompt do discovery.
- Conexão com a plataforma AGM (ainda não definida).
- Aba AGP numa reunião "Depois" sem cliente.
- Login (TAQF-02 ou AGM) para fechar `GET /projects`.
