#!/bin/bash
# Uso: RECALL_TOKEN=... MEET_URL=... NGROK_URL=... bash create_bot.sh
# Ou exporte as variáveis no .env antes de rodar.

RECALL_TOKEN="${RECALL_TOKEN:?Defina RECALL_TOKEN}"
MEET_URL="${MEET_URL:?Defina MEET_URL}"
NGROK_URL="${NGROK_URL:?Defina NGROK_URL}"

curl -X POST https://us-west-2.recall.ai/api/v1/bot/ \
  -H "Authorization: Token ${RECALL_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "accept: application/json" \
  -d "{
    \"meeting_url\": \"${MEET_URL}\",
    \"bot_name\": \"CITi Diagnostico\",
    \"recording_config\": {
      \"transcript\": {
        \"provider\": {
          \"meeting_captions\": {
            \"language_code\": \"pt-BR\"
          }
        }
      },
      \"realtime_endpoints\": [
        {
          \"type\": \"webhook\",
          \"url\": \"${NGROK_URL}/transcription\",
          \"events\": [\"transcript.data\"],
          \"partial_results\": true
        }
      ]
    }
  }"
