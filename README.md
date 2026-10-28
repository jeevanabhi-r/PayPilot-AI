# PayPilot AI

AI-assisted shopping and payment workflow prototype for the PayPal + AI hackathon.

## Requirements
- Node.js 20 or newer
- PayPal Developer Sandbox account (optional for demo mode)
- Groq API key (optional for AI features)

## Setup
1. Extract this project and open the folder in VS Code.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in credentials you want to use. Never expose secret keys in frontend code or commit `.env`.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open the local URL printed by Vite (usually `http://localhost:5173`).

## Notes
- Use PayPal Sandbox credentials only while testing.
- Treat AI output as suggestions, not authorization. Review the amount and recipient before any payment action.
- Verify payment status server-side with PayPal; never trust the browser alone.
- This is an MVP and must be tested locally, configured with your credentials, and deployed before hackathon submission.

## Technology
React, Vite, Express, PayPal Sandbox API, and optional Groq AI integration.
