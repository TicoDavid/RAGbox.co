# Bring Your Own LLM — User Guide

> **RAGbox.co** | Intelligence Settings

---

## 1. What Is Bring Your Own LLM?

Bring Your Own LLM (BYOLLM) lets you connect a private AI model to RAGbox instead of using the built-in AEGIS engine. Your documents stay in your vault — only the AI "brain" that reads them changes. This gives you full control over which language model answers your questions while keeping all of RAGbox's security, citations, and audit logging intact.

---

## 2. Supported Providers

| Provider | How to Connect | Notes |
|----------|---------------|-------|
| **OpenRouter** (Recommended) | Paste your OpenRouter API key | Access to 100+ models from one key — Claude, GPT-4o, Llama, Gemini, and more |
| **OpenAI** | Paste your OpenAI API key | GPT-4o, GPT-4 Turbo, o1 |
| **Anthropic via OpenRouter** | Use your OpenRouter key, select an Anthropic model | Claude Sonnet, Claude Opus |
| **Google via OpenRouter** | Use your OpenRouter key, select a Google model | Gemini 2.0 Flash, Gemini Pro |
| **Any OpenAI-compatible provider** | Paste the provider's API key | Any service that follows the OpenAI API format |

**Why we recommend OpenRouter:** One API key gives you access to models from every major provider. You can switch models without re-entering credentials, and OpenRouter handles billing across providers in one place.

---

## 3. Setup Steps

1. **Open Settings** — Click the gear icon in the bottom-left corner of your dashboard.
2. **Go to Intelligence** — Select the **AI Model Settings** panel.
3. **Choose a Provider** — Pick OpenRouter (recommended) or another supported provider from the dropdown.
4. **Paste Your API Key** — Enter the API key from your provider. You can toggle visibility with the eye icon.
5. **Test the Connection** — Click **Test**. A green checkmark and latency reading confirm success.
6. **Select a Model** — Choose your preferred model from the dropdown (e.g., Claude Sonnet 4, GPT-4o).
7. **Save** — Click **Save** to store your configuration securely.

That's it. Your private LLM is now connected and ready to use.

---

## 4. Using Your LLM in Chat

Once configured, you can use your private LLM directly in the chat interface:

- **Model Picker** — A small badge next to the chat input shows which model is active. Click it to switch between AEGIS and your private LLM.
- **Per-Message Switching** — In "User's Choice" mode, you can switch models between individual messages. Ask one question with AEGIS, the next with your private model.
- **Lock Badge** — When your private LLM is active, a lock icon appears to confirm your query is routed through your own provider.

All responses — regardless of which model generated them — include the same verified citations, confidence scores, and audit log entries.

---

## 5. Routing Policies

Your administrator can set one of three routing policies to control how queries are handled:

| Policy | What It Means |
|--------|--------------|
| **AEGIS Only** | All queries use the built-in AEGIS engine. Your private LLM connection is saved but not used for chat. |
| **Private LLM Only** | All queries route exclusively through your private model. AEGIS is not used, even as a backup. |
| **User's Choice** (Default) | You decide per message. Toggle freely between AEGIS and your private LLM in the chat interface. |

You can change the policy at any time in Settings without re-entering your API key.

---

## 6. Security and Privacy

Your API key and data are protected at every step:

- **Encryption at Rest** — Your API key is encrypted using AES-256-GCM via Google Cloud Key Management Service (KMS) before it is stored. The plaintext key is never saved to disk.
- **Never Logged** — Your key never appears in application logs, error reports, or audit trails.
- **Never Visible** — After saving, the dashboard only shows a masked version of your key (e.g., `sk-or***xyz`). The full key cannot be retrieved.
- **Sovereign Vault** — Your documents remain in your encrypted RAGbox vault at all times. Only the text needed to answer a question is sent to the language model — never your entire document library.
- **No Third-Party Storage** — RAGbox does not share your API key with anyone. It is used only at the moment a query is processed, then discarded from memory.

---

## 7. What If My Provider Goes Down?

**With "User's Choice" or "AEGIS Only" policy:**
RAGbox automatically falls back to AEGIS if your private provider is unreachable, returns an error, or times out. You will still get an answer with citations — the model badge will indicate that AEGIS handled the response.

**With "Private LLM Only" policy:**
No fallback occurs. If your provider is unavailable, RAGbox will return an error message and ask you to try again later. This policy is designed for organizations that require all AI processing to go through a specific provider for compliance reasons.

---

## 8. Cost

**Your Private LLM:**
RAGbox uses a retrieval-augmented process called SelfRAG, which typically makes about 2 calls to the language model per question (one to generate, one to verify). At current market rates, this works out to approximately **$0.001 to $0.01 per question**, depending on the model you choose. Billing comes from your provider (OpenRouter, OpenAI, etc.), not from RAGbox.

**AEGIS (Built-In):**
AEGIS is included in your RAGbox subscription at no additional per-query cost. There is nothing extra to pay when using the built-in engine.

---

## 9. Frequently Asked Questions

| Question | Answer |
|----------|--------|
| **Does my API key leave RAGbox?** | No. Your key is encrypted at rest with AES-256-GCM and only decrypted in server memory for the instant a query is processed. It is never sent to any third party, logged, or exposed in any response. |
| **What happens if my key expires or my provider goes down?** | Under "User's Choice" policy, RAGbox silently falls back to AEGIS. Under "Private LLM Only", you will see an error and must fix the key or switch policies. |
| **Does BYOLLM work with Mercury voice?** | No. Voice queries always use the AEGIS engine. BYOLLM applies to text chat only. |
| **How do I switch back to AEGIS?** | Open Settings > AI Model Settings and change the policy to "AEGIS Only", or simply toggle the model picker in chat back to AEGIS. You can also delete your BYOLLM configuration entirely. |

---

## 10. Troubleshooting

| Issue | What to Do |
|-------|-----------|
| **"Connection Failed" after testing** | Double-check your API key for typos. Make sure you copied the full key from your provider's dashboard. If using OpenRouter, verify your account has credit. |
| **"Rate Limited" error during chat** | Your provider is throttling requests. Wait a minute and try again, or upgrade your plan with your provider. |
| **"Timeout" or slow responses** | Some models take longer to respond. Try switching to a faster model (e.g., GPT-4o Mini or Gemini Flash). If the issue persists, check your provider's status page. |
| **Automatic fallback to AEGIS** | This means your private provider returned an error. Check your provider's dashboard for outages or billing issues. Your query was still answered by AEGIS. |
| **"No models available" in dropdown** | Test your connection first. The model list appears after a successful connection test. |
| **Badge shows wrong model** | Refresh the page. If the issue persists, re-save your settings. |

**Still stuck?** Contact your RAGbox administrator or reach out to support at **support@ragbox.co**.

---

*Last updated: February 20, 2026*

