# Phase 6: Opt-In Webhook Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-24
**Phase:** 6-Opt-In Webhook Auth
**Areas discussed:** Atualizar a extensão Chrome atual, Escopo do gate, Ativação em produção

---

## Atualizar a extensão Chrome atual

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, atualizar já | Adiciona campo opcional de chave no popup (mesmo padrão de "URL do backend"); vazio = comportamento idêntico ao de hoje | ✓ |
| Não, só o backend nesta fase | Atualizar a extensão fica para uma fase/task separada, decidida depois | |

**User's choice:** Sim, atualizar já.
**Notes:** Motivo: se `EXTENSION_SHARED_KEY` for setada em produção sem a extensão saber enviar o header, todo o tráfego real dela seria rejeitado. Atualizar já evita um segundo deploy coordenado depois.

---

## Escopo do gate — só extension ou também recall?

| Option | Description | Selected |
|--------|-------------|----------|
| Só `/webhook/extension` | Segue exatamente TAQ-03/roadmap; `/webhook/recall` fica de fora (Recall.ai já autentica via própria API key) | ✓ |
| Os dois endpoints, mesma chave | Amplia o escopo desta fase para proteger também `/webhook/recall` | |

**User's choice:** Só `/webhook/extension`.
**Notes:** Nenhuma nota adicional além da descrição da opção.

---

## Ativação em produção ou só entregar a capacidade?

| Option | Description | Selected |
|--------|-------------|----------|
| Só entregar a capacidade | Código pronto, comportamento inalterado; ativar a env var em produção fica como decisão do time, depois | ✓ |
| Já ativar em produção nesta fase | Gerar a chave e configurar no Railway como parte da entrega, ligando o gate de verdade ao final da fase | |

**User's choice:** Só entregar a capacidade.
**Notes:** Usuário pediu explicação adicional antes de decidir (analogia da "caixa de correio" / "fechadura destrancada de fábrica") — depois da explicação, confirmou a opção recomendada. Ativar a chave real em produção fica registrada como DECISÃO EM ABERTO do time em CONTEXT.md (D-03), pois é uma ação irreversível de configuração fora do repositório que pode quebrar tráfego real de quem ainda não atualizou a extensão.

---

## Claude's Discretion

- Formato do erro de rejeição (código HTTP, corpo da resposta) quando a chave está ausente/errada.
- Mecanismo de comparação da chave (ex.: comparação de tempo constante).
- Nome exato do campo na UI da extensão.

## Deferred Ideas

- Proteger `/webhook/recall` com o mesmo mecanismo — descartado para esta fase, revisitar em fase/task separada se necessário.
- Ativar a chave em produção (Railway) + distribuir para quem usa a extensão hoje — decisão operacional do time, fora desta fase.
