/**
 * Node.js / JavaScript client example for ChatGPT Bridge REST API.
 * Works with native fetch in Node 18+ or browsers.
 */

const BASE_URL = process.env.CHATGPT_BRIDGE_URL || "http://localhost:8465";

async function main() {
  console.log(`Connecting to ${BASE_URL}...`);

  // 1. Check health
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  console.log("Health:", health);

  // 2. Ask a text question
  console.log("\nSending prompt: 'Give me a 5-word motto for an engineer'...");
  const askRes = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Give me a 5-word motto for an engineer" }),
  });
  const askData = await askRes.json();
  console.log("ChatGPT Response:", askData.text);
  const conversationId = askData.conversation_id;
  console.log("Conversation ID:", conversationId);

  // 3. Generate an image in the same conversation continuity
  console.log("\nRequesting Image: 'Cyberpunk coffee shop at night'...");
  const imgRes = await fetch(`${BASE_URL}/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Cyberpunk coffee shop at night",
      max_tries: 4,
      conversation_id: conversationId,
    }),
  });

  if (imgRes.ok) {
    const imgData = await imgRes.json();
    console.log("Generated image file:", imgData.path);
    console.log(`Direct Image URL: ${BASE_URL}${imgData.image_url}`);
  } else {
    console.error("Image generation failed:", imgRes.status, await imgRes.text());
  }
}

main().catch(console.error);
