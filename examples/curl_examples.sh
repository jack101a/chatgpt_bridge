#!/usr/bin/env bash
# Quick curl snippets for testing ChatGPT Bridge REST API

PORT="${PORT:-8465}"
BASE_URL="http://localhost:${PORT}"

echo "=== 1. Health Check ==="
curl -s "${BASE_URL}/health" | jq .

echo -e "\n=== 2. Status Check ==="
curl -s "${BASE_URL}/status" | jq .

echo -e "\n=== 3. Text Prompt (/ask) ==="
curl -s -X POST "${BASE_URL}/ask" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2? Answer in one word."}' | jq .

echo -e "\n=== 4. Image Prompt (/image) ==="
curl -s -X POST "${BASE_URL}/image" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cute red panda wearing a detective hat", "max_tries": 4}' | jq .

echo -e "\n=== 5. Reset Conversation (/conversations/new) ==="
curl -s -X POST "${BASE_URL}/conversations/new" | jq .
