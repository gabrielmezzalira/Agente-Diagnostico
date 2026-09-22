# Phase 1: Area-Set Registry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 1-area-set-registry
**Areas discussed:** Fronteira do frontend, Modelo do registro, Régua de zero mudança, Custom areas dormentes

---

## Fronteira do frontend

| Option | Description | Selected |
|--------|-------------|----------|
| Backend só; frontend na Fase 5 | Registro backend-only agora; a cópia do frontend fica e sai só na Fase 5 (server-driven). Dívida conhecida. | ✓ |
| Server-driven já na Fase 1 | Backend envia áreas via WebSocket e frontend consome, removendo a cópia agora. Antecipa a Fase 5. | |
| Artefato compartilhado no build | Build gera JSON/TS a partir do registro Python, consumido pelos dois lados. | |

**User's choice:** Backend só; frontend na Fase 5
**Notes:** Um `.py` não pode ser importado por TS e a renderização server-driven é escopo da Fase 5 (UI-03).

---

## Modelo do registro

| Option | Description | Selected |
|--------|-------------|----------|
| Sets nomeados + absorve labels/inativas | Registro nasce com conjuntos nomeados (chave+label+ordem), gera o schema JSON, e absorve `area_labels` + `AREAS_BY_PROJECT_TYPE`. | ✓ |
| Minimalista (só as 8 chaves) | Só junta as 8 chaves+labels agora; conceito de sets vem na Fase 2. | |
| Sets nomeados, inativas separadas | Cria sets nomeados mas deixa `AREAS_BY_PROJECT_TYPE` onde está. | |

**User's choice:** Sets nomeados + absorve labels/inativas (1A)
**Notes:** Alinhado ao Success Criterion #4 (adicionar um set novo mexe só no registro); deixa a Fase 2 trivial. Usuário pediu explicação em linguagem comum da arquitetura antes de decidir e então seguiu a recomendação.

---

## Régua de zero mudança

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-a-byte + golden test | Texto gerado idêntico caractere-por-caractere; teste golden snapshot captura a saída atual como fixture antes do refactor. | ✓ |
| Funcionalmente equivalente | Mesmas chaves/ordem/semântica, sem exigir string idêntica. | |

**User's choice:** Byte-a-byte + golden test (2A)
**Notes:** A lista de áreas vai dentro do prompt da IA; qualquer diferença de caractere pode mudar a resposta do Gemini e violar o Success Criterion #1.

---

## Custom areas dormentes

| Option | Description | Selected |
|--------|-------------|----------|
| Deixar intocado | Registro coexiste com `custom_areas`; wire-up é DISCF-02 (futuro). | ✓ |
| Acomodar no registro | Registro já modela custom_areas como set dinâmico. | |

**User's choice:** Deixar intocado (3A)
**Notes:** Usuário pediu ciência do estado atual. Constatado: `generate_custom_areas` (`llm.py:220`) está **definido mas nunca chamado**; os encaixes (`session_state.py` merge, `prompt_builder` param) existem mas `custom_areas` sempre chega vazio — "cano instalado, torneira desligada". Ponto de atenção: não quebrar o merge de `custom_areas` ao introduzir o registro.

---

## Claude's Discretion

- Localização/nome exato do módulo do registro (services/ vs core/).
- Estruturas de dados internas (dataclass/dict/enum) para os area sets, desde que D-01/D-02/D-03 se sustentem.

## Deferred Ideas

- **Discovery-only (apagar vendas/CITI_PORTFOLIO):** discutido a fundo como opção estratégica. Mapeado que a "cara de vendas" está no CONTEÚDO (CITI_PORTFOLIO/SERVICE_CATALOG/TECH_REFERENCE + nomes das 8 áreas + moldura comercial), não na máquina (pipeline/WS/webhook/llm mechanics/DMS, que são neutros). Custo de apagar é baixo em esforço mas alto em risco (irreversível + discovery não validado). Contradiz decisão travada em PROJECT.md. **Decisão de time/roadmap, não de sprint** — revisitar só após validar discovery (Fases 1-5 + Taqciti). Usuário optou por manter o plano e adiar.
- Remoção do registro de áreas no frontend → Fase 5 (UI-03).
- Discovery area set (11 áreas, lentes Produto + Dados) → Fase 2.
- Tags de lente em áreas/red flags/perguntas → Fase 3.
- Wire-up de `generate_custom_areas` → DISCF-02, milestone futuro.
