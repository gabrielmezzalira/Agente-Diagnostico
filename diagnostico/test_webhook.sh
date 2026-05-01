#!/bin/bash
curl -X POST http://127.0.0.1:8765/transcription \
  -H "Content-Type: application/json" \
  -d '{"event":"transcript.data","data":{"data":{"words":[{"text":"teste de transcricao"}],"participant":{"name":"Gabriel"}},"bot":{"id":"test"}}}'
