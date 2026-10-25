# laya-test

Local lab for [Laya](https://ollama.com/library/laya) — an Ollama decision model — focused on **SMS classification and spam detection**.

Uses [ollama-js](https://github.com/ollama/ollama-js) `systemone` (not chat). Laya returns typed answers with calibrated probabilities; it does not generate text.

## Prerequisites

- [Bun](https://bun.com)
- [Ollama](https://ollama.com) **0.40+** running locally
- Model pulled: `ollama pull laya`

## Run

```bash
bun install
bun start
```

Open [http://localhost:3000](http://localhost:3000).

Paste an SMS (optional sender), or pick a sample, then classify.

## What it classifies

Each request asks Laya several questions in one forward pass:

| Question | Type | Meaning |
| --- | --- | --- |
| `is_spam` | noul | Unsolicited junk / promo |
| `is_phishing` | noul | Scam / credential theft intent |
| `asks_credentials` | noul | Asks for OTP, PIN, password, bank details, or a “verify” link |
| `category` | choice | `otp` · `transactional` · `promotional` · `personal` · `scam` · `other` |
| `risk` | score | Safe → caution → dangerous |

## API

`POST /api/classify`

```json
{
  "text": "URGENT: Your bank account will be locked. Verify at http://secure-update.example",
  "sender": "BANK-ALERT"
}
```

`text` is required (max 2000 chars). `sender` is optional.

Response includes `answers`, `usage`, and `elapsedMs`.

## Stack

- Bun (`Bun.serve` + HTML imports)
- React UI
- `ollama` JS client → local `laya` via `/v1/systemone`
