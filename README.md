# Goals

A daily / weekly goal tracker with streaks, live at **https://goals.claytonstallings.com**.

Create goals (each daily or weekly), check them off, and watch your streaks
grow. Built to match the sibling apps (`notes`, `chinese-characters`, `finance`):
a Vite/React SPA on S3 + CloudFront, an API Gateway + Lambda backend over
DynamoDB, and Cognito for auth.

## Architecture

```
Browser ──► CloudFront ──► S3 (static SPA)
   │
   └──► API Gateway (HTTP API, Cognito JWT authorizer)
            └──► Lambda (goals-api, Node 20 arm64)
                     └──► DynamoDB (goals table)
```

- **Auth** — Cognito email + password via a dedicated `goals-web` app client on
  the **shared** `chinese-characters-users` user pool. Any signed-in user of
  that pool may use goals (no group gate). Sign-up sends an email verification
  code (from `no-reply@verificationemail.com` — check spam the first time).
- **Data** — single DynamoDB table, partitioned by `USER#<cognitoSub>`:
  - `GOAL#<id>` — a goal (`label`, `icon`, `frequency`, `sortOrder`, `createdAt`)
  - `COMP#<date>#<goalId>` — a completed period. Only completions are stored;
    misses and streaks are computed on read.
- **Time** — the day rolls over at **3:30 AM MST**; weekly goals are keyed to
  the week-ending **Saturday** (see `backend/src/lib/time.js`).

Infrastructure lives in [`../goals-tf`](../goals-tf).

## Repo layout

```
backend/    Lambda source (Node 20 ESM, no third-party deps — aws-sdk is in the runtime)
frontend/   Vite + React SPA
.github/    Deploy workflow (OIDC -> Lambda + S3 + CloudFront)
```

## Local development

```bash
cd frontend
cp .env.local.example .env.local   # fill from `terraform output` in ../goals-tf
npm install
npm run dev                         # http://localhost:5173
```

The dev server talks to the **deployed** API (its CORS allows `localhost:5173`),
so you don't need to run the backend locally.

## Deploy

1. Provision infra once: `cd ../goals-tf && terraform apply`.
2. Copy the `github_action_vars` output into this repo's
   [Actions Variables](https://github.com/crstall4/goals/settings/variables/actions).
3. Push to `main` — the workflow updates the Lambda, builds the SPA, syncs it to
   S3, and invalidates CloudFront.

## API

All routes require `Authorization: Bearer <Cognito idToken>`.

| Method & path        | Purpose                                            |
|----------------------|----------------------------------------------------|
| `GET  /me`           | `{ userId, email }`                                |
| `GET  /goals`        | goals + current-period completion (seeds defaults) |
| `POST /goals`        | create `{ label, icon?, frequency? }`              |
| `POST /goals/delete` | delete `{ id }` (and its completions)              |
| `POST /goals/toggle` | flip completion for the current period `{ id }`    |
| `GET  /goals/stats`  | each goal with its current streak                  |
| `GET  /goals/history`| past daily/weekly periods (completed vs missed)    |
