# Agent Messenger

Open-source wallet-to-wallet and wallet-to-agent messaging on Base Sepolia, using XMTP for transport and Groq (Llama 3.3 70B) for agent replies.

## What's in here

- **`web/`** — Next.js app. Wallet connect (RainbowKit) + XMTP chat UI. Deployed to Vercel.
- **`agent/`** — Node.js service. Listens on XMTP, replies via Groq. Deployed to Railway.

Both halves can be deployed independently. Multiple agent instances with different wallets/personalities can run side-by-side and DM each other.

## Stack

- TypeScript everywhere
- XMTP V3 (MLS): `@xmtp/browser-sdk` (web), `@xmtp/agent-sdk` + `@xmtp/node-sdk` (agent)
- viem for wallet ops
- RainbowKit + wagmi for connect
- Tailwind v4 (web)
- Groq SDK for LLM (free tier, Llama 3.3 70B)

---

## Deploy: Web (Vercel)

1. **Get a WalletConnect project ID** (free) — sign up at https://cloud.reown.com, create a project, copy the Project ID.

2. **Push this repo to GitHub.**

3. **Import in Vercel**:
   - New Project → pick the repo
   - **Root Directory**: set to `web`
   - Framework: Next.js (auto-detected)
   - Environment Variables:
     - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` = (your Reown project ID)
   - Deploy

4. **Test**: open the URL, connect wallet (it'll prompt to switch to Base Sepolia), click **Enable XMTP messaging**, sign the request. You're ready.

---

## Deploy: Agent (Railway)

### 1. Get a Groq API key
- Sign up free at https://console.groq.com
- Create an API key, copy it.

### 2. Create the Railway service
- New Project → **Deploy from GitHub repo** → pick this repo
- After import, open the service → **Settings**:
  - **Root Directory**: set to `agent`
  - **Build Command**: leave blank (nixpacks default — `npm install`)
  - **Start Command**: leave blank (uses `npm start` from `package.json`)

### 3. Generate the agent's wallet
- In the Railway service, open the **Shell** (top-right "..." → Open Shell, or the terminal tab in the service view).
- Run:
  ```
  npm run generate-wallet
  ```
- Copy the printed `XMTP_WALLET_KEY`, `XMTP_DB_ENCRYPTION_KEY`, and the **public address**. Save the address somewhere — you'll DM it from the web app.

### 4. Set environment variables (Railway → Variables)

| Name | Value |
|---|---|
| `XMTP_WALLET_KEY` | (from the generate-wallet output, starts with `0x`) |
| `XMTP_DB_ENCRYPTION_KEY` | (from the generate-wallet output, 64 hex chars) |
| `XMTP_ENV` | `dev` |
| `XMTP_DB_DIRECTORY` | `/data` |
| `GROQ_API_KEY` | (from console.groq.com) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `AGENT_NAME` | `Vee` (or whatever) |
| `AGENT_SYSTEM_PROMPT` | (see `agent/.env.example` for a sample — make it conversational) |

### 5. Add a persistent volume (recommended)
- Service → **Volumes** → New Volume
- **Mount Path**: `/data`
- Size: 1 GB is plenty.

Without a volume, the XMTP local DB resets on every redeploy. Agent identity (tied to the wallet) is preserved, but per-conversation MLS state is lost. With the volume, the agent has full continuity.

### 6. Redeploy
- After setting env vars and adding the volume, trigger a redeploy (or it auto-redeploys when you push to GitHub).
- Open the service **Logs** — you should see:
  ```
  Agent address:  0x...
  Inbox ID:       ...
  XMTP env:       dev
  Agent online. Listening for messages…
  ```

### 7. Test end-to-end
- Open the web app, connect a wallet, enable XMTP, paste the **agent's public address**, click **Open**, type a message, hit **Send**.
- Within a few seconds you should see the agent's reply in the chat. The Railway logs will show the in/out lines.

---

## Step 6: Two agents talking to each other

Run a **second** agent with a different wallet and personality. Approach:

1. **In Railway, add a second service** in the same project:
   - **New** → **GitHub Repo** → pick the same repo
   - Settings → **Root Directory**: `agent`
2. **Generate a fresh wallet** for the second agent:
   - Open the new service's Shell, run `npm run generate-wallet`.
   - Save the new address (e.g. agent B's address).
3. **Set env vars on the second service** — same shape, different values:
   - `XMTP_WALLET_KEY` and `XMTP_DB_ENCRYPTION_KEY`: from the new generate-wallet output
   - `XMTP_ENV`: `dev` (same as agent A)
   - `XMTP_DB_DIRECTORY`: `/data` (and add a **separate** volume for this service)
   - `GROQ_API_KEY`: same key is fine
   - `AGENT_NAME`: e.g. `Zee`
   - `AGENT_SYSTEM_PROMPT`: write a different personality (e.g. "You are Zee, a witty cynical agent who replies in short snarky one-liners. Never use exclamation marks.")
4. **Kick off the conversation**: on **agent A's** service, add these two env vars:
   - `STARTUP_GREET_ADDRESS` = agent B's public address
   - `STARTUP_GREET_MESSAGE` = e.g. `yo Zee, you online?`
5. Redeploy agent A. ~8 seconds after it comes up, it'll send the greeting to agent B. B's text handler will reply via Groq, A will reply, and they'll keep going.
6. Watch both services' Logs side by side — you'll see the back-and-forth.

To stop the auto-loop, just remove `STARTUP_GREET_ADDRESS` from agent A's env vars and redeploy. (Both agents will still respond when humans message them, but won't reignite each other.)

---

## Environment variables — quick reference

### Web (Vercel)
| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | yes | From https://cloud.reown.com |

### Agent (Railway)
| Name | Required | Notes |
|---|---|---|
| `XMTP_WALLET_KEY` | yes | 0x-prefixed 64-hex private key — agent's identity |
| `XMTP_DB_ENCRYPTION_KEY` | yes | 64 hex chars (32 bytes) |
| `XMTP_ENV` | yes | `dev` (must match the web app) |
| `XMTP_DB_DIRECTORY` | recommended | `/data` if using a Railway volume |
| `GROQ_API_KEY` | yes | From https://console.groq.com |
| `GROQ_MODEL` | no | Default: `llama-3.3-70b-versatile` |
| `AGENT_NAME` | no | Default: `Agent` |
| `AGENT_SYSTEM_PROMPT` | no | Steers personality. Default is a generic friendly one. |
| `STARTUP_GREET_ADDRESS` | no | If set, agent DMs this address on startup |
| `STARTUP_GREET_MESSAGE` | no | Default: `hey, you up?` |

---

## Security notes

- The `.gitignore` blocks `.env*` files — never commit them.
- `XMTP_WALLET_KEY` is the agent's whole identity. If it leaks, anyone can impersonate the agent.
- Use a fresh wallet per agent. Don't reuse a personal wallet.
- Both XMTP `dev` and `production` are public networks — anything sent is end-to-end encrypted, but metadata (who messages whom, when) is visible to relayers.
