# PaySec – AI Payment Security Layer (backend, milestone 1)

Every payment (from the AI agent or the API) goes through `transactionService.submitPayment` → `riskEngine.evaluate` → decision → (only if APPROVED) gateway. There is no other path to the gateway.

## Setup
1. MySQL 8+: `mysql -u root -p < database/schema.sql`
2. `cd server && cp .env.example .env` (set DB creds and a long random `JWT_SECRET`)
3. `npm install && npm run seed && npm start`  (API on :5000)
4. Demo login: `demo@paysec.dev` / `Demo@1234`
5. Tests: `npm test`

## Architecture
- `services/riskEngine.js` – pure, rule-based scorer (budget 30, merchant 30, amount 15, frequency 15, pattern 10). **No machine learning.** Mandatory violations (blocked merchant, allowlist, max/daily/monthly limit) force BLOCKED regardless of score. Add new scorers to `SCORERS` (e.g. an ML model) without touching callers.
- `services/transactionService.js` – orchestration. Row lock on the user (`FOR UPDATE`) serialises concurrent requests; `UNIQUE(user_id, idempotency_key)` stops duplicates; timestamp window stops replays; `executed_at IS NULL` guard stops double execution; approvals re-run the engine before executing.
- `services/paymentGateway.js` – simulated by default; PayPal **Sandbox** order creation if credentials are set (creates an order only, no capture).
- `utils/intentParser.js` – regex-based agent simulator parser (not an LLM).
- Policy: LOW → APPROVED, MEDIUM/HIGH → PENDING_APPROVAL, CRITICAL or mandatory violation → BLOCKED.

## API (all responses `{success, data}` or `{success:false, error}`; JWT in `Authorization: Bearer`)
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | Auth |
| GET/PUT | /api/users/me | Profile |
| GET | /api/dashboard | Totals, 14-day series, recent |
| POST | /api/payments/request | `{merchantId, amount, idempotencyKey, timestamp?, description?}` |
| POST | /api/agent/run | `{instruction}` – parse + submit |
| GET | /api/transactions (`status,q,from,to,minAmount,maxAmount,sort,dir`), /:id, /export.csv | Monitoring / history |
| GET | /api/approvals/pending | Approval center |
| POST | /api/approvals/:id/approve \| reject | Decide (owner only) |
| GET/PUT | /api/limits | Spending limits |
| GET | /api/merchants; PATCH /api/merchants/:id/status | Trust / block |
| GET | /api/notifications; /api/audit-logs (admin) | |

## Test status
`npm test` covers the engine and agent parser (scenarios 1–4, 10 and the override rule). Scenarios 5–9 (reject/approve flow, duplicates, unauthorized approval, bad auth) are implemented in code but **need a live MySQL to exercise** and have not been run yet.

## Frontend (milestone 2)
`cd client && npm install && npm run dev` → http://localhost:5173 (Vite proxies `/api` to :5000, so no secrets or API URLs in frontend code).
Pages: login/register, dashboard, AI agent, monitoring, risk analysis, approvals, merchants, spending limits, history (+CSV), settings, light/dark theme.
Status: `npm run build` succeeds; the UI has not been exercised against a live API/MySQL yet.
Not included: password change / 2FA (no backend endpoint), PDF reports (CSV only).
