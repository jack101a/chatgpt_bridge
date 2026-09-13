# Image Generation & Character Continuity Guide

This guide explains how to generate images with high consistency, maintain character continuity across multi-turn sessions, and leverage the automated 10x pencil-edit retry engine.

---

## 1. Golden Rules of Character Continuity

When generating sequential images of the same character:

1. **Turn 1 Establishes the Character**:
   - Pack the core character definition into Turn 1 (facial traits, hair color, hair style, eye color, age bracket, and clothing style).
   - Once ChatGPT generates the first image in the conversation, the character's visual identity is committed into the conversation memory.

2. **Turns 2–5 Modify Framing & Perspective Only**:
   - **Do NOT** repeat full character descriptions or repetitive body descriptors on subsequent turns. Repeating descriptions can trigger false refusals or hallucinate a different person.
   - **Do** specify camera angles, shot framing, lighting, and environmental context (e.g., *"Low-angle shot looking upward"*, *"Medium wide shot standing near doorway"*, *"Dramatic side profile"*).
   - Prepend `Generate image:` to clarify intent and avoid ChatGPT responding with conversational text.

3. **Same Conversation Thread (100% Continuity)**:
   - Always pass `conversation_id` from Turn 1 to Turns 2–5.
   - Starting a new conversation resets ChatGPT's visual memory and breaks character consistency.

---

## 2. In-Place Pencil-Edit Retry System

Modern ChatGPT maintains conversation context cleanest when retrying directly on the user prompt rather than appending multiple retry messages.

### How It Operates:
1. **Initial Submission**: The prompt is typed into the composer and submitted.
2. **Real-Time Detection**: The bridge detects generation in progress via the active Stop button (`button[data-testid="stop-button"]`). It will never prematurely abort while generation is running.
3. **Instant Return**: The millisecond the image renders in the DOM (`img[src*="backend-api/estuary/content"]`), the bridge returns the image path and advances to the next turn (0 retries burned).
4. **Pencil-Edit Retry (If Denied)**:
   - If ChatGPT returns a content policy denial, the bridge sleeps the exact interval for that retry attempt:
     ```python
     intervals = (5.0, 10.0, 15.0, 20.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0)
     ```
   - It clicks the pencil icon (`button[aria-label="Edit message"]`) on the user's turn.
   - On **Retries 1–5**, it re-submits the base prompt.
   - On **Retries 6–10**, it automatically inserts the `tweaked_prompt` (a softer phrasing preserving exact semantic intent).
   - If a rate limit message is encountered at any time, it **halts immediately** to protect account limits.

---

## 3. Code Example: Multi-Turn Sequential Continuity

```python
import asyncio
from pathlib import Path
from chatgpt_bridge import ChatGPT
from chatgpt_bridge.retry import RetryConfig

TURNS = [
    {
        "name": "Turn 1: Base Character Portrait",
        "prompt": "Generate image: Rustic auburn-haired maiden in her 20s, freckles, braided hair, wearing textured cottage attire, close-up portrait, natural lighting.",
        "tweaked": "Generate image: Detailed portrait of a young woman with auburn braided hair and rustic linen attire, soft natural light, cinematic close-up.",
    },
    {
        "name": "Turn 2: Low-Angle Perspective",
        "prompt": "Generate image: Low-angle camera shot looking upward, rustic cottage background, cinematic lighting.",
        "tweaked": "Generate image: Upward perspective view inside rustic cottage interior, dramatic soft light.",
    },
    {
        "name": "Turn 3: Medium Wide Shot Doorway",
        "prompt": "Generate image: Medium wide shot standing in the cottage doorway, soft daylight.",
        "tweaked": "Generate image: Medium distance composition standing by doorway, ambient sunlight.",
    },
]

async def run_continuity_sequence():
    gpt = ChatGPT(headless=False)
    active_cid = None

    try:
        for turn in TURNS:
            print(f"Executing: {turn['name']}")
            retry_cfg = RetryConfig(
                max_tries=10,
                intervals=(5.0, 10.0, 15.0, 20.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0),
            )

            res = await gpt.generate_image(
                turn["prompt"],
                conversation_id=active_cid,
                retry=retry_cfg,
                tweaked_prompt=turn["tweaked"],
                timeout_s=300,
            )

            # Store conversation ID to maintain continuity
            active_cid = res["conversation_id"]
            print(f"[Success] Saved image to {res['path']} (Chat: {active_cid})")
    finally:
        await gpt.aclose()

if __name__ == "__main__":
    asyncio.run(run_continuity_sequence())
```

---

## 4. Troubleshooting & Best Practices

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **"image denied after 10 retries"** | The prompt consistently triggers OpenAI safety filters across all 10 tries. | Inspect `tweaked_prompt`. Soften explicit anatomical words or clothing terms into rustic/cinematic terminology. |
| **Rate Limit Detected** | ChatGPT Plus/Free hourly image quota reached. | The bridge halts automatically. Wait for the standard OpenAI cooldown (~1 to 3 hours). |
| **Cloudflare Challenge** | Running with `headless=True` on a datacenter IP. | Keep `headless=False` with `xvfb-run` on Linux servers. |
| **Images Not Detected** | DOM structure changes on `chatgpt.com`. | Check `IMAGE_SELECTOR` in `python/chatgpt_bridge/images.py`. Ensure estuary/content URLs match. |
