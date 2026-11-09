# AiAiAiRouter

AiAiAiRouter is a production-oriented SaaS and OpenAI-compatible API gateway for Chinese AI models. It is developed by **GonidonCloud** and provides email/OAuth accounts, revocable virtual API keys, prepaid Stripe credits, streaming chat completions, token metering, a transaction ledger, usage analytics, and security activity.

The application and its content are original. AiAiAiRouter is not affiliated with OpenRouter.

## Architecture

```text
Browser / OpenAI SDK
        |
        | Supabase Auth cookies        Bearer aiaiai_sk_...
        v                              v
Next.js App Router --------------> /v1/chat/completions
  |                                      |
  |-- Server actions / Stripe Checkout   |-- HMAC key lookup + rate limits
  |-- Dashboard RSC queries              |-- provider credential resolution
  |-- Branded transactional email        |-- OpenAI-compatible adapter
  |                                      |-- SSE metering / cancellation
  v                                      v
Supabase Postgres + Prisma        DeepSeek / Alibaba / Moonshot / Zhipu
  |                                      |
  |-- RLS for direct Supabase access     |-- provider usage
  |-- transactional wallet ledger <------|-- idempotent settlement by request ID
  |-- webhook event deduplication
Stripe signed webhook ------------> /api/stripe/webhook
```

Next.js serves both the console and the Node.js gateway. Prisma is the only ORM. The browser receives only the Supabase anon key; the service role, Stripe, provider, encryption, and email credentials remain server-only. Production deployments should use the Supabase pooled connection for `DATABASE_URL` and a direct connection for migrations.

## Tech stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4 and local shadcn/ui-style Radix components
- Supabase Postgres, Supabase Auth, Row Level Security
- Prisma 6 and SQL migrations
- Stripe Checkout, Customer Portal, signed webhooks
- Resend or Postmark for application email; Supabase custom SMTP for auth email
- Zod validation
- Upstash Redis when configured, with an atomic Postgres fixed-window fallback
- Vitest for critical unit and webhook tests

## Requirements

- Node.js 22 or newer (Node.js 24 LTS recommended)
- npm 10 or newer
- Docker with Docker Compose for the local PostgreSQL container
- A Supabase project for Auth, or local Supabase Auth; a hosted Supabase database is not required
- Stripe, email, OAuth, and provider accounts only for the integrations you enable

## Installation

```bash
npm install
cp .env.example .env
```

The example database URLs point to local PostgreSQL. Replace the remaining placeholders in `.env` for the integrations you enable. The repository's local `.env` contains non-production placeholders only and is excluded by `.gitignore`. Do not commit real credentials.

## Local PostgreSQL setup

For development, the application can use ordinary local PostgreSQL instead of Supabase Postgres. `compose.yaml` starts PostgreSQL 17, creates the `aiaiairouter` database, and persists data in a named Docker volume. The database port is bound only to `127.0.0.1`. On first initialization, `docker/postgres/init/001-supabase-auth-compat.sql` creates the `anon` and `authenticated` roles plus `auth.uid()` required by the RLS migrations; it does not provide an Auth server.

```bash
npm run db:setup
npm run dev
```

`db:setup` starts the container, waits for its health check, generates Prisma Client, applies migrations, and seeds the provider/model catalog. The default connection URLs in `.env.example` are:

```dotenv
POSTGRES_PORT="5432"
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/aiaiairouter"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5432/aiaiairouter"
```

Use `npm run db:up` and `npm run db:down` to start or stop only the database container. Stopping it preserves data. If port 5432 is occupied, change `POSTGRES_PORT` and both connection URLs to the same available port before running setup. These development credentials must not be used in production.

This replaces only the database. Email/OAuth login still needs Supabase Auth configuration as described below; alternatively, run the complete local Supabase stack.

## Supabase setup

1. Create a Supabase project for Auth. If you also use its hosted Postgres, create a strong database password; otherwise use the local PostgreSQL setup above.
2. Copy the project URL, anon key, and service role key into the corresponding variables. Also set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the public values.
3. For hosted Postgres, set `DIRECT_URL` to the direct connection and `DATABASE_URL` to the pooler connection in production. For local PostgreSQL, keep both set to the local URL.
4. Apply the Prisma migrations as shown below. The second migration enables RLS. Server-side Prisma uses a privileged database role and therefore must also enforce ownership in code; all dashboard and gateway queries do so.
5. In **Authentication → URL Configuration**, set the site URL to `NEXT_PUBLIC_APP_URL` and allow these redirect URLs:
   - `http://localhost:3000/auth/callback` for development
   - `https://your-domain.com/auth/callback` for production
6. Enable email confirmation. Configure custom SMTP using the selected transactional email provider. Copy the branded HTML from `supabase/templates/confirm.html`, `recovery.html`, and `email_change.html` into the corresponding Supabase auth templates. Supabase preserves `{{ .ConfirmationURL }}` in those templates.
7. The application sends account-created, new-device, failed-login, password-change, and email-change notifications itself. Verification and password-recovery mail is sent by Supabase through that SMTP provider.

### Google OAuth setup

1. In Google Cloud Console, create an OAuth **Web application** client.
2. Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI. Do not use the app's callback for Google's provider setting.
3. Enable Google in Supabase Auth and save the client ID/secret there. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are provisioning references for your secret manager; Supabase performs the OAuth exchange.

### GitHub OAuth setup

1. Create a GitHub OAuth App.
2. Set the authorization callback URL to `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Enable GitHub in Supabase Auth and save its client ID/secret there. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are likewise provisioning references.

For a fully local stack, run `supabase start`, copy the local API URL and anon key shown by the CLI, and use `postgresql://postgres:postgres@localhost:54322/postgres` for both database URLs. In that setup, do not also run `npm run db:up`. Supabase's local email inbox is available on the port printed by the CLI. Continue to use `npm run db:migrate` and `npm run db:seed`, because this project's migrations are managed by Prisma.

## Stripe setup

1. Create three **one-time, fixed USD** Prices: $10, $25, and $100. Assign their IDs to `STRIPE_PRICE_SMALL`, `STRIPE_PRICE_MEDIUM`, and `STRIPE_PRICE_LARGE`.
2. Set `STRIPE_SECRET_KEY` to a test key during development. The server retrieves each Price and rejects recurring, inactive, non-USD, or variable-amount prices.
3. One paid USD adds one credit unit. Wallets and ledger entries store integer micro-USD; no floating-point money arithmetic is used.
4. A Stripe Customer is created lazily on the first checkout. Only Stripe customer/session/payment identifiers are stored, never card details.

### Stripe webhook setup

For local development with Stripe CLI:

```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded,charge.dispute.created,charge.dispute.closed \
  --forward-to localhost:3000/api/stripe/webhook
```

Copy the displayed `whsec_...` into `STRIPE_WEBHOOK_SECRET`. For production, create an endpoint for `https://your-domain.com/api/stripe/webhook`, subscribe to the same events, and use that endpoint's signing secret.

The route reads the raw body, verifies the signature, and writes the event ID and ledger mutation in one serializable transaction. Credits are added only when Checkout reports `payment_status=paid` and its amount/user/metadata match the pending transaction. Duplicate deliveries return success without another credit. Failed and expired sessions do not credit the wallet. Refunds and disputes create signed ledger entries; a won dispute restores the hold. A negative balance is permitted after a refund, dispute, or an in-flight usage settlement so consumed inference cannot become free.

To exercise a test event:

```bash
stripe trigger checkout.session.completed
```

A synthetic trigger without the app's pending session metadata is safely ignored; an end-to-end credit test must begin with a real Checkout session created by the app.

## Email provider setup

For **Resend**, set `EMAIL_PROVIDER=resend`, verify the sender domain, and set `RESEND_API_KEY`. For **Postmark**, set `EMAIL_PROVIDER=postmark`, configure the `outbound` message stream, and set `POSTMARK_SERVER_TOKEN`. Set `EMAIL_FROM` and `EMAIL_REPLY_TO` to verified addresses.

Application emails are recorded in `email_logs` with sent, failed, or skipped status. Placeholder/missing email credentials produce `skipped`, not a false successful delivery. Configure the same provider as Supabase SMTP for verification and recovery emails. Secrets and message contents are never included in application logs.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PORT` | Host port for the local PostgreSQL container; defaults to 5432 |
| `DATABASE_URL` | Local PostgreSQL URL in development or pooled Supabase Postgres URL in production |
| `DIRECT_URL` | Direct PostgreSQL URL used by migrations |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Server-side Supabase Auth connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only administrative client; never expose it |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase browser-safe configuration |
| `NEXT_PUBLIC_SITE_URL` | Canonical public site origin |
| `NEXT_PUBLIC_APP_URL` | Application origin used in auth and Stripe return links |
| `AUTH_SECRET` | Random 32+ byte secret for HMAC key hashing and device/IP hashes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google provisioning values stored in Supabase Auth |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub provisioning values stored in Supabase Auth |
| `STRIPE_SECRET_KEY` | Stripe server API key |
| `STRIPE_WEBHOOK_SECRET` | Per-endpoint Stripe signature secret |
| `STRIPE_PRICE_SMALL`, `STRIPE_PRICE_MEDIUM`, `STRIPE_PRICE_LARGE` | One-time USD Price IDs for $10/$25/$100 |
| `EMAIL_PROVIDER` | `resend` or `postmark` |
| `RESEND_API_KEY` / `POSTMARK_SERVER_TOKEN` | Credential for the selected provider only |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | Verified sender and support reply address |
| `PROVIDER_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256-GCM key for optional `provider_keys` records |
| `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`, `MOONSHOT_API_KEY`, `ZHIPU_API_KEY`, `OPENROUTER_API_KEY` | Optional upstream credentials; empty means not served |
| `*_BASE_URL` | OpenAI-compatible `/v1` endpoint overrides, including regional DashScope endpoints |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional distributed fixed-window limiter |
| `GATEWAY_KEY_RATE_LIMIT`, `GATEWAY_USER_RATE_LIMIT` | Requests per minute per virtual key/account |
| `PROVIDER_TIMEOUT_MS` | Timeout for upstream connection/response activity |

`NEXT_PUBLIC_SITE_URL` is the public deployment origin; `NEXT_PUBLIC_APP_URL` can differ for a separate console domain, provided all auth redirects and Stripe URLs use that same app origin. OAuth values are not read by browser code. Generate independent production secrets, for example with `openssl rand -base64 32`.

## Database migrations and seed

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Migrations live in `prisma/migrations`. The seed is idempotent and creates the provider/model catalog, not demo users or fake usage. A provider is enabled only when its non-placeholder credential exists at seed time. Re-run the seed after adding or removing a provider key.

Seed prices use DeepSeek's published peak rates and baseline Qwen/Kimi catalog values. **Verify current provider prices, model availability, region, taxes, and your desired margin before accepting production traffic.** Update the `models` table and seed source together when pricing changes. The gateway supports input, output, and cached-input rates in micro-USD per million tokens.

The catalog also includes `zhipu/glm-4.5-flash`, `zhipu/glm-4.7-flash`, and the text/image model `zhipu/glm-4.6v-flash` with zero prices based on Z.AI's published free-model pricing. They work with a zero wallet balance, while usage logging and gateway rate limits remain active. Set `ZHIPU_API_KEY`, keep `ZHIPU_BASE_URL=https://api.z.ai/api/paas/v4`, and re-run the seed to enable them. For a BigModel China account instead, use its `https://open.bigmodel.cn/api/paas/v4` endpoint and verify model availability and pricing separately.

With `OPENROUTER_API_KEY`, the seed also enables `openrouter/free`, OpenRouter's zero-price router. It selects a currently available free model that supports each request, potentially including Qwen or DeepSeek, but does not guarantee a specific model family. Free availability and upstream limits change frequently; use it for development and low-volume prototypes, not as an availability guarantee for production. Kimi is not advertised as free by the direct Moonshot API, and Alibaba's direct Qwen free quota is time-limited, so neither is seeded as permanently zero-priced.

Provider environment keys take precedence at runtime. Alternatively, operations code can populate `provider_keys` with `encryptProviderKey()`; values are AES-256-GCM encrypted and decrypted only on the server. Do not seed plaintext provider credentials into the database.

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`. Auth and dashboard routes return a configuration message rather than an anonymous authenticated session when Supabase is missing. Real end-to-end account and payment flows require running services and non-placeholder credentials.

## Build and checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm run build` generates Prisma Client before compiling Next.js. Tests cover virtual-key hashing, provider-key encryption, usage/cached-token pricing, request validation, provider error sanitization, SSE metering, email escaping, the signed Stripe webhook route, partial refunds, confirmed credits, expired Checkout, and webhook idempotency.

The database integration suite is skipped unless `TEST_DATABASE_URL` is set. Point it only at a disposable test database after migrations and seed, then run:

```bash
export TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/postgres'
export DATABASE_URL="$TEST_DATABASE_URL"
export DIRECT_URL="$TEST_DATABASE_URL"
npx vitest run tests/database.integration.test.ts
```

It creates and cleans up an isolated test account while verifying real transactional credit and usage idempotency.

## Deployment notes

- Deploy the Node.js Next.js server to Vercel, a container, or a Node host. Do not deploy gateway routes to an edge runtime that lacks Node crypto.
- Allow up to 300 seconds for `/v1/chat/completions`, subject to your hosting plan. Streaming responses must not be buffered by a proxy; the app sets `X-Accel-Buffering: no`.
- Use HTTPS, a production `NEXT_PUBLIC_APP_URL`, secure Supabase cookies, pooled Postgres, and strong independent secrets. HSTS is enabled by the app and assumes HTTPS in production.
- Apply migrations during release, before the new code receives traffic. Run seed as a controlled catalog update, not on every serverless instance.
- Configure all Stripe webhook events and verify delivery. Use Stripe test mode before live keys.
- The gateway deliberately does **not** automatically retry or fail over a completion after dispatch, because doing so can duplicate inference. Settlement is idempotent by request UUID. Clients may make a deliberate new request after a sanitized error.
- Rate limiting uses Upstash when available and atomically falls back to Postgres. Keep either Postgres or Redis reachable; limiter failures fail closed rather than granting unlimited traffic.
- Provider usage is used whenever returned. If a stream is cancelled or an upstream omits usage, an explicitly marked byte-based estimate is billed and displayed as `estimated`. Prefer models/providers that support final usage chunks for exact accounting.

## API usage

Create a virtual key in **Dashboard → API Keys**. The plaintext is shown once. The examples below assume `https://your-domain.com`; use `http://localhost:3000` locally.

### cURL

```bash
export AIAIAIROUTER_API_KEY='aiaiai_sk_...'

curl https://your-domain.com/v1/models \
  -H "Authorization: Bearer $AIAIAIROUTER_API_KEY"

curl https://your-domain.com/v1/chat/completions \
  -H "Authorization: Bearer $AIAIAIROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-flash",
    "messages": [{"role": "user", "content": "Explain idempotency briefly."}],
    "stream": false
  }'

curl -N https://your-domain.com/v1/chat/completions \
  -H "Authorization: Bearer $AIAIAIROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"alibaba/qwen-plus","messages":[{"role":"user","content":"Hello"}],"stream":true}'

curl 'https://your-domain.com/v1/usage?limit=20' \
  -H "Authorization: Bearer $AIAIAIROUTER_API_KEY"
```

### JavaScript / OpenAI SDK

```bash
npm install openai
```

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AIAIAIROUTER_API_KEY,
  baseURL: "https://your-domain.com/v1",
});

const completion = await client.chat.completions.create({
  model: "moonshot/kimi-k2.6",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(completion.choices[0]?.message.content);

const stream = await client.chat.completions.create({
  model: "deepseek/deepseek-flash",
  messages: [{ role: "user", content: "Write a haiku about networks" }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

### Python / OpenAI SDK

```bash
pip install openai
```

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["AIAIAIROUTER_API_KEY"],
    base_url="https://your-domain.com/v1",
)
response = client.chat.completions.create(
    model="alibaba/qwen-plus",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)
```

`/v1/usage` supports RFC 3339 `start` and `end`, `limit=1..200`, and cursor pagination with `cursor` equal to a prior event ID. Errors use an OpenAI-style `error` object and include a safe request ID.

## Troubleshooting

- **Authentication is not configured:** set both public Supabase values and restart Next.js after editing `.env`.
- **OAuth redirects to an error:** use the Supabase callback in the Google/GitHub provider console and the app `/auth/callback` in Supabase's allowed redirect list.
- **No verification/reset email:** check Supabase SMTP, verified sender domain, auth template, and Supabase auth logs. Application delivery status is in `email_logs`.
- **Model says not configured:** add the matching provider key, verify its regional base URL, then run `npm run db:seed` to enable it.
- **Provider rejects a request:** model capabilities and regional access differ. The adapter never invents a proprietary protocol; check the provider account and current model documentation.
- **Payment succeeded but balance did not change:** inspect Stripe webhook delivery/signature, pending transaction metadata, and `webhook_events`. Do not manually replay an untrusted success URL; only signed webhooks credit funds.
- **Migration cannot connect:** use `DIRECT_URL` for migrations and confirm the database password/host. Do not substitute the Supabase service role key for a Postgres URL.
- **Prisma pooler errors:** use Supabase's transaction pooler for runtime and the direct URL for migrations; follow Supabase's current pooler guidance for prepared statements.

## Security notes

- Virtual API keys are random 256-bit values stored as HMAC-SHA-256 hashes. Only a prefix is retained for display; plaintext appears once.
- Auth, key, billing, and gateway operations are rate limited. Protected routes use middleware plus server-side `getUser()` checks, and every resource query is owner-scoped.
- RLS covers user-owned rows. Provider keys, webhook events, and rate-limit rows have no anon/authenticated write policies.
- Supabase Auth uses HTTP-only server-managed cookies with production secure cookie behavior. Next.js Server Actions provide origin/CSRF checks; cookie-less gateway endpoints require Bearer credentials and the Stripe endpoint requires its signature.
- New-device detection combines a keyed fingerprint of IP and user agent. Raw IP addresses are not persisted. Login, key, account, and payment operations create audit events.
- Prompts, completions, access tokens, virtual secrets, provider secrets, and payment details are not written to logs. Provider errors are normalized before returning to clients.
- Security headers include HSTS, frame denial, MIME sniffing protection, a restrictive permissions policy, and referrer controls. Dashboard/auth/account pages are `noindex`; no marketing SEO surface is generated.
- Keep the service role key out of every `NEXT_PUBLIC_` variable and rotate credentials if exposed.

## License and attribution

This original project is licensed under the [MIT License](LICENSE), copyright GonidonCloud.

During implementation selection, the MIT-licensed [Portkey Gateway](https://github.com/Portkey-AI/gateway) and the MIT-licensed non-enterprise portion of [LiteLLM](https://github.com/BerriAI/litellm) were evaluated. No source code, design, text, or assets were copied from those projects or from OpenRouter, so there is no adapted third-party source notice to include. Runtime dependencies retain their own package licenses. Provider names and trademarks belong to their respective owners.
