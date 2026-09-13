"""Python client example for ChatGPT Bridge REST API."""

import requests
import json
import time

BASE_URL = "http://localhost:8465"


def check_status():
    print("Checking /status...")
    resp = requests.get(f"{BASE_URL}/status")
    print("Status:", json.dumps(resp.json(), indent=2))


def ask_question(prompt: str, conversation_id: str = None):
    print(f"\nAsking: {prompt}")
    payload = {"prompt": prompt}
    if conversation_id:
        payload["conversation_id"] = conversation_id
    resp = requests.post(f"{BASE_URL}/ask", json=payload)
    data = resp.json()
    print("Response:", data.get("text"))
    return data.get("conversation_id")


def generate_image(prompt: str, conversation_id: str = None):
    print(f"\nGenerating image: {prompt}")
    payload = {
        "prompt": prompt,
        "max_tries": 4,
        "timeout_s": 180,
    }
    if conversation_id:
        payload["conversation_id"] = conversation_id
    resp = requests.post(f"{BASE_URL}/image", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        print("Image saved at:", data.get("path"))
        print(f"Direct image URL: {BASE_URL}{data.get('image_url')}")
        return data.get("conversation_id")
    else:
        print("Error:", resp.status_code, resp.text)
        return None


if __name__ == "__main__":
    check_status()
    # 1. Ask a question
    cid = ask_question("Hello! Tell me one interesting fact about space in 1 sentence.")
    # 2. Generate an image in the same conversation thread
    if cid:
        generate_image("A futuristic telescope in the desert", conversation_id=cid)
