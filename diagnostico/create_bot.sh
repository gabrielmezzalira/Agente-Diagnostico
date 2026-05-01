#!/bin/bash
curl -X POST https://us-west-2.recall.ai/api/v1/bot/ \
  -H "Authorization: Token d8bd046ceee276b460c05ceb94aece5a83e0b101" \
  -H "Content-Type: application/json" \
  -H "accept: application/json" \
  -d '{
    "meeting_url": "https://meet.google.com/bka-fymx-eky",
    "bot_name": "CITi Diagnostico",
    "recording_config": {
      "transcript": {
        "provider": {
          "meeting_captions": {
            "language_code": "pt-BR"
          }
        }
      },
      "realtime_endpoints": [
        {
          "type": "webhook",
          "url": "https://nervy-smokeless-reliance.ngrok-free.dev/transcription",
          "events": ["transcript.data"],
          "partial_results": true
        }
      ]
    }
  }'
