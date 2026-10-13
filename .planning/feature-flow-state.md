# Feature Flow State
feature: "Integração Agente Diagnóstico × DocuData — contexto cumulativo de Discovery e requisitos por reunião (fatia 1)"
modo: "BACK-ONLY"
tier: "COMPLEXA"
stack: "FastAPI + Supabase + LangGraph/Gemini (DocuData, repo separado: Agente-Documentador) e FastAPI (Agente). Front da aba de Requisitos: feito sem skill (pedido do usuário)."
etapa: 2
etapa_nome: "Execução do back-end (Onda 1) — plano pronto; escolher: subagent-driven (recomendado), inline (executing-plans) ou gsd-execute-phase"
gates_reusados: ["knowledge-graph (DocuData: docudata-backend/graphify-out)", "knowledge-graph (Agente: backend/app/graphify-out, gerado agora, só AST)"]
started_at: "2026-10-12T23:50:07Z"
last_saved: "2026-10-12T23:57:03Z"
status: "em_progresso"

## Concluído
- [x] Etapa 0 — Grafo de conhecimento (DocuData reaproveitado; Agente gerado, estrutural, sem LLM)
- [x] Etapa 1 — Requisitos (brainstorm; desenho aprovado, abordagem C; specs 11 e 12 escritas no DocuData, aguardando revisão do usuário)
- [x] Etapa 2 — Plano via /write-plan (CONCLUÍDA: 4124 linhas, partes A (Spec 11), B (Spec 12) e C (Agente), sem placeholders; arquivo em Agente-Documentador/docs/superpowers/plans/2026-10-12-discovery-requisitos-subarea-produto.md, NÃO commitado por regra do AGENTS.md dele) (specs aprovadas pelo usuário com 'comece a executar' + a regra de bifurcação)
- [ ] Etapa 3 — Execução da Onda 1 (back-end) ← PRÓXIMA via gsd-execute-phase, ou subagent-driven/inline se o formato do plano não for aceito pelo GSD
- [ ] Etapa 3 — Execução do back-end (Onda 1)
- [ ] Etapa 12 — Verificação (gsd-verify-work, nunca pulada)

## Contexto relevante
- Plano de 7 seções (CLAUDE.md): PLANO_INTEGRACAO_DOCUDATA.md. Decisões: dois serviços/um registro; 1ª fatia = requisitos por reunião; DocuData em branch própria.
- Insight: reuniões são cumulativas (contexto da empresa, entrevista técnica...); cada agente lê o contexto todo; 1+ opções de solução.
- DocuData: AGENTS.md exige spec por vez, migrations só entregues (nunca aplicadas por mim), sem commit/push salvo pedido (branch própria = commits locais nela). Working tree dele tem alterações do usuário: não tocar nem commitar.
- Decisões em aberto (plano, seção 6): subárea produto×dados, credencial de serviço, LGPD da transcrição, papéis, aplicação da migration.

## Como retomar (sessão nova)
1. Abrir o Claude Code em /Users/gabrielmezzalira/Agente-Diagnostico (branch feat/integracao-docudata) e ler este arquivo + PLANO_INTEGRACAO_DOCUDATA.md + a memória (integracao-docudata-fatia1, produto-bifurca-para-dados-ou-dev).
2. Ler o plano do DocuData (caminho acima) e as specs 11 e 12 (docs/superpowers/specs/ do DocuData; não commitadas).
3. DocuData: branch feat/discovery-requisitos JÁ EXISTE (sem commits). Antes de qualquer commit lá: git status; NUNCA git add -A (o usuário tem alterações não commitadas em metricas.py, testes, .planning/*, RELATORIO-DOCUDATA.md).
4. Executar Parte A -> B -> C do plano, tarefa a tarefa (TDD, commits atômicos), depois Etapa 12: gsd-verify-work (nunca pulada).
5. Ações humanas externas (SQL v8/v9, envs Google/Railway, chave DOCUDATA_DISCOVERY_KEY, retenção) estão no fim do plano.
