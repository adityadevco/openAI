# PayPilot

> An AI recovery operator for payment teams.

PayPilot turns failed payments into approval-gated recovery opportunities. It combines live payment data, Dodo webhook ingestion, Supabase, and an OpenAI tool-using agent to help an operator understand *why* a payment failed and choose the safest next action.

## Why it exists

Payment failures are rarely just dashboard rows. Teams need to identify the most valuable failure, inspect the customer’s history, select the appropriate recovery strategy, and keep a clear audit trail—without allowing an AI system to contact customers or retry charges on its own.

```text
Dodo payment event → Supabase payment data → OpenAI Recovery Agent
                                              ↓
                                  tool-backed recommendation
                                              ↓
                                human approval required
                                              ↓
                            auditable recovery case + event
```

## OpenAI developer-tools workflow

The Recovery Agent uses the OpenAI Responses API with strict function tools. It does **not** receive the full payments table in its prompt.

| Tool | Purpose |
| --- | --- |
| `get_recovery_queue` | Reads the highest-priority failed payments. |
| `get_customer_payment_history` | Grounds recommendations in a customer’s prior payment activity. |
| `get_recovery_policy` | Maps the failure reason to a safe, deterministic recovery policy. |

The agent can investigate and recommend. It cannot send outreach, retry a charge, issue a refund, or claim that a payment was recovered. Those actions stay approval-gated by design.

The UI exposes the agent’s completed tool calls so an operator can see how the recommendation was grounded.

## Features

- Live payment, revenue, failure, and recovery metrics
- Dodo webhook verification and raw event persistence
- OpenAI tool-backed recovery analysis
- Customer-history-aware recovery recommendations
- Deterministic strategies for declined cards, authentication requirements, expired cards, and insufficient funds
- Approval-pending recovery cases with a recovery score and draft message
- Payment-event audit trail
- Searchable payment and customer views

## Stack

- Next.js 16 + React 19 + TypeScript
- OpenAI Responses API (`gpt-5.6-luna`)
- Supabase (Postgres)
- Dodo Payments webhooks
- Tailwind CSS

## Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local`:

```bash
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
DODO_WEBHOOK_SECRET=
```

Optional variables:

```bash
DODO_PAYMENTS_API_KEY=
DODO_ALLOW_UNSIGNED_LOCAL_TEST=false
```

Never commit `.env.local` or any service-role/API key.

### 3. Create and seed the database

In the Supabase SQL Editor, run these in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql` (demo data only)

`schema.sql` includes the `recovery_cases` and `agent_runs` tables required by the new workflow.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo flow

1. Open **PayPilot AI**.
2. Ask: `What should I recover first?`
3. Watch the agent invoke payment-data tools.
4. Review its evidence-based recommendation and the tool activity timeline.
5. Open **Recovery** and select **Create approval case**.
6. Show that the case is marked `approval_pending`: no retry or customer contact occurs automatically.

## Deployment

Deploy as a Node.js Next.js application (for example, on Vercel). Configure these server-side environment variables in the deployment environment:

```text
OPENAI_API_KEY
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SECRET_KEY
DODO_WEBHOOK_SECRET
DODO_PAYMENTS_API_KEY              # optional, when the Dodo API is used
DODO_ALLOW_UNSIGNED_LOCAL_TEST=false
```

Run the Supabase schema migration before enabling recovery actions. For production, keep unsigned webhook test mode disabled and configure Dodo to send signed events to:

```text
https://YOUR_DOMAIN/api/webhooks/dodo
```

## Validation

```bash
npm run lint
npx next build --webpack
```

The webpack build command is used as a local fallback where Turbopack cannot create its CSS worker. Deployments can use the normal Next.js build command on an environment that supports it.

## Safety boundaries

PayPilot is a recovery-assistance prototype, not a payment processor.

- Recommendations are based only on tool-returned payment data.
- Recovery cases begin in `approval_pending`.
- The current application does not automatically message customers, retry payments, or issue refunds.
- Production use requires authentication, tenant isolation, rate limiting, and proper role-based approval controls.

## Hackathon pitch

**PayPilot is the AI recovery operator for payment teams: it investigates failed transactions using live financial context, recommends the safest recovery path, and only acts after human approval.**
