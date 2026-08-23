# Deploying to AWS Elastic Beanstalk via GitHub Actions

> Companion to the pipeline in `.github/workflows/ci-cd.yml` and the two
> composite actions under `.github/actions/`. This is the **only** doc that
> describes that pipeline —
> `docs/AWS_DEPLOYMENT.md` is an older, unrelated EC2+Vercel design from the
> thesis appendix and `DEPLOY.md` describes the current Oracle Cloud
> docker-compose production setup. Don't mix instructions between the three.

This guide takes you from an empty AWS account to a working, auto-deploying
system: every push to `main` that touches `apps/web`, `apps/api`, or
`apps/ai` builds that service's Docker image and rolls it out to its own
Elastic Beanstalk environment — no manual `docker push`, no SSH, no long-lived
AWS credentials sitting in GitHub.

---

## Table of contents

1. [How the pipeline works](#1-how-the-pipeline-works)
2. [What you need before starting](#2-what-you-need-before-starting)
3. [Step 1 — Get AWS console access](#step-1--get-aws-console-access)
4. [Step 2 — Create the ECR repositories](#step-2--create-the-ecr-repositories)
5. [Step 3 — Stand up the database and vector store](#step-3--stand-up-the-database-and-vector-store)
6. [Step 4 — Create the Beanstalk application and environments](#step-4--create-the-beanstalk-application-and-environments)
7. [Step 5 — Set each environment's runtime configuration](#step-5--set-each-environments-runtime-configuration)
8. [Step 6 — Let GitHub Actions authenticate without access keys (OIDC)](#step-6--let-github-actions-authenticate-without-access-keys-oidc)
9. [Step 7 — Configure the GitHub repository](#step-7--configure-the-github-repository)
10. [Step 8 — Run the first deployment](#step-8--run-the-first-deployment)
11. [Step 9 — Access the deployed system](#step-9--access-the-deployed-system)
12. [Day-to-day operations](#12-day-to-day-operations)
13. [Troubleshooting](#13-troubleshooting)
14. [Full environment variable reference](#14-full-environment-variable-reference)

---

## 1. How the pipeline works

```
git push (main)                 detects which apps/* changed via path filters
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Actions runner                                          │
│                                                                   │
│  1. Assume an AWS IAM role via OIDC (no stored AWS key/secret)  │
│  2. docker build   apps/<app>/Dockerfile   (repo root context)  │
│  3. docker push    → Amazon ECR   (tagged :<git-sha> and :latest)│
│  4. Write Dockerrun.aws.json pointing at that exact image        │
│  5. Hand it to Elastic Beanstalk                                 │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
Elastic Beanstalk pulls the image from ECR and replaces the running
container — it never builds anything itself.
```

One workflow file, `ci-cd.yml`, with distinct jobs: `lint-build-web-api` and
`lint-ai` run on every PR and every push (no secrets touched — safe for
forks); `detect-changes` runs only on push to `main` and figures out which
app(s) actually changed; `deploy-web`, `deploy-api`, `deploy-ai` each run
only if their app changed (or you tick "Deploy all three apps" on a manual
run via the **Actions** tab). A change to only `apps/api` deploys only the
API — it does not rebuild the much heavier AI image. Each deploy job has its
own concurrency group, so a slow AI deploy never blocks an unrelated web-only
redeploy queued right after it.

---

## 2. What you need before starting

- An AWS account with billing enabled.
- Ability to sign in to the AWS Console (root user, or an existing IAM user/
  admin role) — needed only for the one-time setup in Steps 1–6. Nothing
  after that needs console access for routine deploys.
- Admin access to this GitHub repository (to add Secrets/Variables and
  Environments under **Settings**).
- (Optional, for the CLI commands in this guide) [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
  installed locally, or just use the AWS Console — every step below has both.

**A note on "access keys":** this pipeline is deliberately built to need
**none**, ever, in GitHub. GitHub Actions authenticates to AWS via **OIDC**
(Step 6) — a short-lived, auto-rotating credential minted per workflow run,
not a static key you paste into a Secret. The only place you'll touch an
actual AWS access key in this whole guide is briefly, locally, if you choose
to run the setup commands via the AWS CLI instead of the Console — and even
that's optional. This is meaningfully more secure than the classic
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` GitHub Secrets pattern (nothing
to leak, nothing to rotate, nothing that still works if someone reads an old
workflow log).

Pick one AWS region for everything and stick with it — this guide uses
**`ap-south-1`** (Mumbai, closest region to Nepal) as the example. Substitute
your own region everywhere if you choose differently.

---

## Step 1 — Get AWS console access

If you already have an AWS account and can sign in, skip to Step 2.

1. Go to <https://aws.amazon.com> → **Create an AWS Account**, or sign in if
   you already have one.
2. **Don't use the root user for day-to-day work.** Create an IAM user for
   yourself with administrator access for this initial setup:
   - AWS Console → **IAM** → **Users** → **Create user**.
   - Username: e.g. `ashok-admin`. Enable **console access**.
   - Attach policy: `AdministratorAccess` (only for this setup phase — you
     can create a more restricted user later).
   - Finish, and sign in as this user going forward instead of root.
3. If you want to use the AWS CLI locally for any step below instead of the
   Console:
   - IAM → Users → your user → **Security credentials** tab → **Create
     access key** → choose "Command Line Interface (CLI)".
   - Run `aws configure` locally and paste the key/secret + your region
     (`ap-south-1`) when prompted.
   - This key lives only on your machine for running one-off setup
     commands — it is never pasted into GitHub. Delete it from IAM once
     you're done with setup if you don't expect to need the CLI again.

---

## Step 2 — Create the ECR repositories

Three private container registries — one per app. These hold the images
GitHub Actions builds; nothing else pushes to them.

**Console:** ECR → **Repositories** → **Create repository** (repeat 3×,
private, no special settings needed) with these exact names:

| Repository name | App |
|---|---|
| `suchana-web` | apps/web |
| `suchana-api` | apps/api |
| `suchana-ai-service` | apps/ai |

**CLI equivalent:**

```bash
for repo in suchana-web suchana-api suchana-ai-service; do
  aws ecr create-repository --repository-name "$repo" --region ap-south-1
done
```

> Using different names? The workflows read them from GitHub repo
> **Variables** `ECR_WEB_REPO` / `ECR_API_REPO` / `ECR_AI_REPO` (Step 7) — set
> those instead of renaming your ECR repos to match this guide.

---

## Step 3 — Stand up the database and vector store

Beanstalk containers are stateless and disposable — a deploy can replace one
at any time — so Postgres and Qdrant must live **outside** Beanstalk, exactly
as they already do in the current Oracle deployment (`docker-compose.yml`).
You have two reasonable paths; pick based on budget:

### Option A — Managed (recommended, costs more)

- **Postgres → Amazon RDS.** `db.t3.micro`, Postgres 16, **not** publicly
  accessible, in the same VPC as your Beanstalk environments so they can
  reach it on port 5432 privately. `docs/AWS_DEPLOYMENT.md` §4 has the full
  `aws rds create-db-instance` command if you want the CLI form — the
  settings there apply here unchanged.
- **Qdrant → [Qdrant Cloud](https://cloud.qdrant.io)**, free 1 GB cluster,
  region `aws/ap-south-1`. Note the cluster URL + API key it gives you.

### Option B — Self-hosted on one small EC2 instance (cheaper)

Run Postgres + Qdrant as Docker containers on a single `t3.small`, the same
shape as the current Oracle box, reachable only from your Beanstalk
environments' security group (never from the public internet). This is the
lower-cost option but means you're operating the DB yourself (backups,
patching).

Whichever you choose, you'll need, before Step 5:
- A `DATABASE_URL` connection string for Postgres.
- A `QDRANT_URL` (and `QDRANT_API_KEY` if using Qdrant Cloud).

Run the Prisma migrations once, from your machine, before the API's first
deploy so the schema exists when the container boots (after that, the API
container applies new migrations itself on every boot — see
`apps/api/Dockerfile`'s `CMD`):

```bash
cd apps/api
DATABASE_URL="<your RDS/self-hosted connection string>" npx prisma migrate deploy
```

---

## Step 4 — Create the Beanstalk application and environments

One **Application** containing three **Environments** — one per service,
each running the **Docker** platform (single container).

**Console**, repeated for each row below:

1. Elastic Beanstalk → **Create application**.
   - Application name (first time only): `suchana-ai`.
   - Environment name: from the table below.
   - Platform: **Docker** → platform branch **"Docker running on 64bit
     Amazon Linux 2023"** (do **not** pick a Node.js/Python platform — the
     image itself already contains the right runtime).
   - Application code: **Sample application** for now — the very first real
     image arrives from GitHub Actions in Step 8, so what you upload here is
     immediately replaced.
   - Instance type: see the table below. **Single instance** environment
     (no load balancer) is the cheapest correct choice for a first pass; add
     a load-balanced/auto-scaling environment later if you need it.

| Environment name | App | Suggested instance | Notes |
|---|---|---|---|
| `suchana-web-prod` | web | `t3.small` | Serves Next.js on port **3535** |
| `suchana-api-prod` | api | `t3.small` | NestJS on port **3001**; needs network access to Postgres |
| `suchana-ai-service-prod` | ai | `t3.medium` or larger | Python on port **8000**; loads an embedding model into RAM — undersizing this causes OOM kills |

2. After each environment is created, open **Configuration → Instance
   traffic and scaling** and confirm the **security group** allows inbound
   on the app's port from wherever you're routing traffic (a load balancer,
   or the internet directly for a quick start). For `suchana-api-prod`,
   also open its security group to reach your database's security group on
   port 5432 (and Qdrant's port if self-hosted).

> Using different application/environment names? Set GitHub repo Variables
> `EB_APPLICATION_NAME` / `EB_WEB_ENV` / `EB_API_ENV` / `EB_AI_ENV` in Step 7
> instead of renaming things to match this guide.

---

## Step 5 — Set each environment's runtime configuration

This is where the **real secrets** live — deliberately never in GitHub. Set
these once per environment, in the Console:

**Elastic Beanstalk → (environment) → Configuration → Software → Edit →
Environment properties.**

Full variable lists are in [§14](#14-full-environment-variable-reference);
the essentials per environment:

**`suchana-web-prod`** — none required at runtime (its config is baked in at
*build* time from GitHub Variables — see Step 7). You may still set `PORT`
explicitly (`3535`) though the image already defaults to it.

**`suchana-api-prod`** (minimum to boot successfully):
```
DATABASE_URL=<from Step 3>
JWT_SECRET=<openssl rand -hex 32>
GOOGLE_CLIENT_ID=<Google OAuth client id>
WEB_ORIGIN=<your web app's public URL>
AI_SERVICE_URL=<your AI environment's URL, e.g. http://suchana-ai-service-prod.xxxx.ap-south-1.elasticbeanstalk.com>
ADMIN_EMAILS=<your email>
```

**`suchana-ai-service-prod`** (minimum to boot successfully):
```
QDRANT_URL=<from Step 3>
QDRANT_API_KEY=<from Step 3, if using Qdrant Cloud>
CORS_ORIGINS=<your web app's public URL>
```
Add `GROQ_API_KEY` and/or `GEMINI_API_KEY` once you have them — without
either, RAG answers fall back to extractive (non-LLM) mode rather than
failing.

Environment properties apply on the *next* deploy or a manual environment
restart — they don't require a code change to take effect immediately if you
just click Apply and the environment restarts.

---

## Step 6 — Let GitHub Actions authenticate without access keys (OIDC)

Two pieces: an **identity provider** AWS trusts (GitHub's), and an **IAM
role** that provider is allowed to hand out — scoped so *only workflows
running from your repo* can assume it.

### 6.1 Create the OIDC identity provider (once per AWS account)

**Console:** IAM → **Identity providers** → **Add provider**.
- Provider type: **OpenID Connect**.
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

**CLI equivalent** (skip if the provider already exists — most accounts only
need this done once, ever, regardless of how many repos use it):
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 6.2 Create the deploy role

IAM → **Roles** → **Create role** → **Web identity**.
- Identity provider: the one you just created.
- Audience: `sts.amazonaws.com`.
- After creation, edit the role's **Trust relationships** to restrict it to
  *this repository's `main` branch* — replace the auto-generated trust
  policy with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<YOUR_GITHUB_ORG_OR_USER>/<YOUR_REPO_NAME>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

Replace `<YOUR_ACCOUNT_ID>` and `<YOUR_GITHUB_ORG_OR_USER>/<YOUR_REPO_NAME>`
(e.g. `ashokabbhattaraii/public-notice-management-system-for-nepal` — check
`git remote -v` if unsure which remote GitHub Actions actually runs from).
This `sub` condition is the entire security boundary: without it, *any*
GitHub repo anywhere could assume this role.

Attach these **permissions policies** to the role (Console: managed policies
are fine to start; tighten to a custom least-privilege policy later once
things work):
- `AmazonEC2ContainerRegistryFullAccess` — push images to ECR.
- `AWSElasticBeanstalkFullAccess` — create app versions and update
  environments (this also covers the S3 bucket Beanstalk itself uses to
  store versions — you don't create that bucket yourself).

Name the role something recognizable, e.g. `github-actions-deploy-suchana-ai`,
and copy its **ARN** (`arn:aws:iam::<account>:role/github-actions-deploy-suchana-ai`)
— you need it in the next step.

---

## Step 7 — Configure the GitHub repository

**Settings → Secrets and variables → Actions.**

### Secrets tab
| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | the role ARN from Step 6.2 |

That is the **only** secret this pipeline needs. (If you scoped it to a
GitHub **Environment** named `production` instead of the repo — see below —
put it there instead; both work, since every deploy job runs under
`environment: production`.)

### Variables tab
All optional — each has a fallback default matching this guide's names, so
you only need to set the ones you changed:

| Name | Default if unset |
|---|---|
| `AWS_REGION` | `us-east-1` — **set this explicitly to `ap-south-1`** (or your chosen region); the fallback is a generic placeholder, not a recommendation |
| `ECR_WEB_REPO` | `suchana-web` |
| `ECR_API_REPO` | `suchana-api` |
| `ECR_AI_REPO` | `suchana-ai-service` |
| `EB_APPLICATION_NAME` | `suchana-ai` |
| `EB_WEB_ENV` | `suchana-web-prod` |
| `EB_API_ENV` | `suchana-api-prod` |
| `EB_AI_ENV` | `suchana-ai-service-prod` |
| `NEXT_PUBLIC_APP_URL` | *(empty)* — set to web's public URL |
| `NEXT_PUBLIC_API_URL` | *(empty)* — set to the API's public URL |
| `NEXT_PUBLIC_AI_URL` | *(empty)* — set to the AI service's public URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | *(empty)* |
| `NEXT_PUBLIC_POSTHOG_KEY` | *(empty, optional)* |
| `NEXT_PUBLIC_POSTHOG_HOST` | *(empty, optional)* |

### Create the `production` Environment (recommended)

**Settings → Environments → New environment** → name it exactly
`production` (the three workflows reference this name). Optionally add
**required reviewers** here — that turns every deploy into a manual
approval gate before it touches AWS, without changing any workflow file.

---

## Step 8 — Run the first deployment

You don't need to change any application code to trigger the first run —
`ci-cd.yml` also has a manual trigger:

1. GitHub repo → **Actions** tab → select **CI/CD** in the left sidebar.
2. **Run workflow** → branch `main` → tick **"Deploy all three apps
   regardless of what changed"** → **Run workflow**.
3. Watch the run. `deploy-web`/`deploy-api`/`deploy-ai` run in parallel once
   `detect-changes` finishes — expect `deploy-ai` to take the longest on a
   cold cache (several minutes, since it's building torch + Playwright +
   Chromium).

If a run fails at the "Configure AWS credentials" step, re-check the trust
policy's `sub` condition in Step 6.2 against your actual GitHub org/repo —
that's the most common first-run failure. If it fails at "Deploy to Elastic
Beanstalk", open that environment's **Events** tab in the Beanstalk console —
it almost always points straight at the problem (usually a missing
environment variable from Step 5, or the app crashing on boot).

---

## Step 9 — Access the deployed system

Each Beanstalk environment gets a default URL of the form
`http://<environment-name>.<random-id>.<region>.elasticbeanstalk.com` — find
the exact one on the environment's dashboard page. Confirm each service
independently before wiring them together:

```bash
curl -I http://suchana-web-prod.xxxxx.ap-south-1.elasticbeanstalk.com
curl -I http://suchana-api-prod.xxxxx.ap-south-1.elasticbeanstalk.com/api/docs
curl -I http://suchana-ai-service-prod.xxxxx.ap-south-1.elasticbeanstalk.com/health
```

Then:
1. Set the API's `AI_SERVICE_URL` env var (Step 5) to the AI environment's
   real URL, and the web app's `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_AI_URL`
   **GitHub Variables** (Step 7) to the API/AI environments' real URLs —
   then re-run **CI/CD** manually with **"Deploy all three apps"** ticked so
   web gets rebuilt with those values baked in (these are build-time values —
   changing the Beanstalk env var alone does nothing for web). Since there's
   no actual code change here, `detect-changes` would otherwise see nothing
   to deploy — the checkbox is the only way to force a rebuild with no diff.
   Redeploying api/ai alongside it is harmless (same image, brief restart).
2. For a real domain instead of the raw `elasticbeanstalk.com` URL: **Route
   53** → create a CNAME per environment (`app.yourdomain.com` →
   web's EB URL, `api.yourdomain.com` → API's, etc.), or put a CloudFront
   distribution / ALB with ACM TLS in front for HTTPS — the `.env.example`
   files' `WEB_ORIGIN`/`CORS_ORIGINS`/`NEXT_PUBLIC_*` values all need to
   match whatever the final public URLs turn out to be.
3. Update Google Cloud Console → OAuth client → **Authorized origins** to
   include the final web URL, or Google sign-in will fail with a redirect
   mismatch.

---

## 12. Day-to-day operations

- **Normal deploys are automatic.** Push to `main` touching `apps/web/**` (or
  `apps/api/**`, `apps/ai/**`) and the matching workflow runs on its own.
- **Force a redeploy with no code change:** Actions tab → pick the workflow →
  **Run workflow**.
- **Rollback:** Elastic Beanstalk → environment → **Application versions** →
  pick a previous version (named `<app>-<run-number>-<sha>`, so it's easy to
  match back to a GitHub Actions run) → **Deploy**. This is instant — no
  rebuild needed, since every past image is still sitting in ECR.
- **Logs:** Beanstalk environment → **Logs** → **Request logs** (or enable
  **CloudWatch Logs streaming** in environment configuration to see them
  without pulling a snapshot each time).
- **Costs:** ECR storage + 3 EC2 instances running continuously are the
  ongoing AWS costs here (Beanstalk itself is free — you pay only for the
  underlying resources it manages: EC2, and optionally a load balancer if
  you add one later).

---

## 13. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Workflow fails at "Configure AWS credentials" | OIDC trust policy `sub` doesn't match your actual `org/repo:ref:refs/heads/main` (Step 6.2) |
| Workflow fails at ECR login/push | Role missing `AmazonEC2ContainerRegistryFullAccess`, or the ECR repo name doesn't match the `ECR_*_REPO` Variable |
| Workflow fails at "Deploy to Elastic Beanstalk" | Role missing `AWSElasticBeanstalkFullAccess`, or `EB_APPLICATION_NAME`/`EB_*_ENV` Variables don't match what you actually named things in Step 4 |
| Deploy "succeeds" but the app 500s / won't boot | Check that environment's Environment properties (Step 5) — almost always a missing/wrong runtime env var, most commonly `DATABASE_URL` for the API |
| AI environment's instance keeps recycling / OOM | Instance too small for the embedding model — bump to at least `t3.medium` (Step 4) |
| Web loads but API calls fail from the browser (CORS) | `WEB_ORIGIN` (API) or `CORS_ORIGINS` (AI) doesn't match the web app's actual origin, or `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_AI_URL` GitHub Variables were wrong at the time web was last built (Step 9.1) |

---

## 14. Full environment variable reference

These are the same variables documented in each app's `.env.example` — this
table only clarifies **where** each one is set for this deployment path.

| Variable | App | Set where |
|---|---|---|
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AI_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | web | GitHub repo **Variables** (build-time, baked into the JS bundle) |
| `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `WEB_ORIGIN`, `PUBLIC_SITE_URL`, `AI_SERVICE_URL`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, and the rest of `apps/api/.env.example` | api | Beanstalk **environment properties** for `suchana-api-prod` |
| `QDRANT_URL`, `QDRANT_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENCODE_ZEN_API_KEY`, `HF_TOKEN`, `CORS_ORIGINS`, and the rest of `apps/ai/.env.example` | ai | Beanstalk **environment properties** for `suchana-ai-service-prod` |

None of the API/AI rows above ever appear in a GitHub Secret, workflow file,
or Actions log — by design (see `deploy-api`/`deploy-ai`'s comments in
`ci-cd.yml`). If a secret manager (AWS Secrets Manager / SSM Parameter Store)
is preferred over Beanstalk's own environment properties later, that's a
drop-in replacement for this step without touching the CI/CD pipeline at all.
