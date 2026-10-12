# Feature Flow State
feature: "Integração Agente Diagnóstico × DocuData — contexto cumulativo de Discovery e requisitos por reunião (fatia 1)"
modo: "BACK-ONLY"
tier: "COMPLEXA"
stack: "FastAPI + Supabase + LangGraph/Gemini (DocuData, repo separado: Agente-Documentador) e FastAPI (Agente). Front da aba de Requisitos: feito sem skill (pedido do usuário)."
etapa: 0
etapa_nome: "Requisitos (/brainstorm — requisitos já coletados em PLANO_INTEGRACAO_DOCUDATA.md)"
gates_reusados: ["knowledge-graph (DocuData: docudata-backend/graphify-out)", "knowledge-graph (Agente: backend/app/graphify-out, gerado agora, só AST)"]
started_at: "2026-10-12T23:50:07Z"
last_saved: "2026-10-12T23:50:07Z"
status: "em_progresso"

## Concluído
- [x] Etapa 0 — Grafo de conhecimento (DocuData reaproveitado; Agente gerado, estrutural, sem LLM)
- [ ] Etapa 1 — Requisitos ← PRÓXIMA
- [ ] Etapa 2 — Plano via /write-plan
- [ ] Etapa 3 — Execução do back-end (Onda 1)
- [ ] Etapa 12 — Verificação (gsd-verify-work, nunca pulada)

## Contexto relevante
- Plano de 7 seções (CLAUDE.md): PLANO_INTEGRACAO_DOCUDATA.md. Decisões: dois serviços/um registro; 1ª fatia = requisitos por reunião; DocuData em branch própria.
- Insight: reuniões são cumulativas (contexto da empresa, entrevista técnica...); cada agente lê o contexto todo; 1+ opções de solução.
- DocuData: AGENTS.md exige spec por vez, migrations só entregues (nunca aplicadas por mim), sem commit/push salvo pedido (branch própria = commits locais nela). Working tree dele tem alterações do usuário: não tocar nem commitar.
- Decisões em aberto (plano, seção 6): subárea produto×dados, credencial de serviço, LGPD da transcrição, papéis, aplicação da migration.
