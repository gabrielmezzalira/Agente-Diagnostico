---
phase: 13
name: embedded-pricing-chatbot
status: complete
completed_at: 2026-07-20
commit: 15a2b9e
---

## Entregáveis

| Req | Descrição | Status |
|-----|-----------|--------|
| PREC-12 | Chat panel em PricingEditorPage com contexto de diagnóstico, histórico e features | ✅ |
| PREC-13 | Chatbot aplica add/remove/update via tool calls; table atualiza imediatamente | ✅ |
| PREC-14 | Chatbot pode discutir conteúdo do relatório de diagnóstico | ✅ |
| PREC-15 | 4 ferramentas estruturadas: add_feature, remove_feature, update_feature, update_inputs | ✅ |

## Arquivos criados

- `backend/app/services/pricing_chatbot_service.py`
- `frontend/src/hooks/usePricingChat.ts`

## Arquivos modificados

- `backend/app/repositories/pricing_repository.py` — list_chat_messages, insert_chat_message
- `backend/app/models/pricings.py` — ChatRequest, ChatMessageResponse, ChatResponse
- `backend/app/routers/pricings.py` — GET /chat-history, POST /chat
- `frontend/src/lib/api.ts` — ChatMessage, ChatResponse, api.pricings.chat/getChatHistory
- `frontend/src/pages/PricingEditorPage.tsx` — ChatPanel component + toggle button
