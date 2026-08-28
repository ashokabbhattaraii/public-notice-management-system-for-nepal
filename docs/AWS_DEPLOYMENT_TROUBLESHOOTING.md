# AWS Elastic Beanstalk Deployment — Troubleshooting Runbook

> Companion to `docs/AWS_ELASTIC_BEANSTALK_DEPLOYMENT.md` (the setup guide).
> That doc tells you how to set this pipeline up from zero. **This doc
> records every error actually hit getting `suchanaai`'s three environments
> (web/api/ai) live on AWS account `679777944150`, in the order they
> happened, with root cause and fix** — so a future re-deploy (new AWS
> account, new project cloned from this one, or a teammate repeating this)
> doesn't have to rediscover each of these one at a time. It also doubles as
> a "known-good current state" reference for this specific account.

---

## Table of contents

1. [How to use this doc](#1-how-to-use-this-doc)
2. [The error chain, in the order it was actually hit](#2-the-error-chain-in-the-order-it-was-actually-hit)
   - [2.1 OIDC role didn't exist](#21-oidc-role-didnt-exist)
   - [2.2 OIDC trust policy `sub` was the wrong shape](#22-oidc-trust-policy-sub-was-the-wrong-shape)
   - [2.3 ECR/Beanstalk resource-name typos in the workflow](#23-ecrbeanstalk-resource-name-typos-in-the-workflow)
   - [2.4 beanstalk-deploy action: "AWS Access Key not specified!"](#24-beanstalk-deploy-action-aws-access-key-not-specified)
   - [2.5 "The ECR service failed to authenticate your private repository"](#25-the-ecr-service-failed-to-authenticate-your-private-repository)
   - [2.6 "Version ... already exists" on retry](#26-version--already-exists-on-retry)
   - [2.7 API container: "Docker container unexpectedly ended after it was started"](#27-api-container-docker-container-unexpectedly-ended-after-it-was-started)
   - [2.8 Site unreachable — `ERR_CONNECTION_TIMED_OUT`](#28-site-unreachable--err_connection_timed_out)
   - [2.9 Web loads, but API calls 404 with "not valid JSON"](#29-web-loads-but-api-calls-404-with-not-valid-json)
   - [2.10 AI deploy times out after ~14 minutes](#210-ai-deploy-times-out-after-14-minutes)
3. [Fast checklist for a fresh deployment](#3-fast-checklist-for-a-fresh-deployment)
4. [Known-good current state (this account)](#4-known-good-current-state-this-account)
5. [Two separate IAM identities — don't conflate them](#5-two-separate-iam-identities--dont-conflate-them)
6. [General lessons](#6-general-lessons)

---

## 1. How to use this doc

Each entry below follows: **Symptom → Root cause → Fix → Lesson**. If a
deploy fails, find the matching symptom first — most of these look similar
on the surface (a red ❌ on some GitHub Actions step) but have unrelated root
causes across three different systems: GitHub's OIDC token format, this
specific AWS account's IAM setup, and Beanstalk's own runtime environment.
Diagnosing by symptom text alone without checking *which* of the three
layers is involved is how you end up re-applying the wrong fix.

---

## 2. The error chain, in the order it was actually hit

### 2.1 OIDC role didn't exist

**Symptom** (`Configure AWS credentials (OIDC)` step):
```
Error: Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity
```

**Root cause**: `docs/AWS_ELASTIC_BEANSTALK_DEPLOYMENT.md` Step 6.2 (create
the deploy role) had never actually been done. `AWS_DEPLOY_ROLE_ARN`
pointed at nothing real. Confirmed by listing IAM roles in the account —
only an unrelated project's role (`socialmind-github-actions`) existed.

**Fix**: created `github-actions-deploy-suchanaai`, trusted the account's
existing OIDC provider (`token.actions.githubusercontent.com`), attached
`AmazonEC2ContainerRegistryFullAccess` + `AdministratorAccess-AWSElasticBeanstalk`
(see §2.3 note on why not `AWSElasticBeanstalkFullAccess`), and set the repo
secret `AWS_DEPLOY_ROLE_ARN` to its ARN.

**Lesson**: a "not authorized" `AssumeRoleWithWebIdentity` error, before
anything else, means *check whether the role exists at all* — AWS returns
the same generic `AccessDenied` whether the role is missing, the ARN has a
typo, or the trust policy just doesn't match. It never tells you which.

---

### 2.2 OIDC trust policy `sub` was the wrong shape

**Symptom**: identical error as §2.1, persisting *after* the role above was
created and the secret was confirmed correct.

**Root cause**: the trust policy (copied from the setup doc) matched
`repo:<org>/<repo>:ref:refs/heads/main` — but every deploy job in
`ci-cd.yml` declares `environment: production`. GitHub Actions changes the
OIDC token's `sub` claim shape entirely whenever a job has an `environment:`
key — it stops being ref-based and becomes
`repo:<owner>@<owner_id>/<repo>@<repo_id>:environment:<env name>` instead
(current GitHub tokens also embed numeric owner/repo database IDs, not just
names).

**Diagnosis method that actually worked**: guessing the `sub` format is not
reliable — pull the *exact* value AWS received, from CloudTrail:
```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --max-results 5 --query 'Events[].Username' --output text
```
The denied event's `userIdentity.userName` is the literal `sub` GitHub sent.

**Fix**: updated the trust policy's `StringEquals` condition to the exact
observed value:
```
repo:ashokabbhattarai-byte@228275133/suchanaai@1343324102:environment:production
```

**Lesson**: if a job uses `environment:`, its OIDC `sub` is
environment-shaped, not ref-shaped — this is true regardless of what branch
triggered the run. Don't hand-copy the `ref:refs/heads/main` pattern from
generic docs/tutorials without checking whether your job sets `environment:`.

---

### 2.3 ECR/Beanstalk resource-name typos in the workflow

**Symptom**: would have surfaced as an ECR-login or Beanstalk-not-found
failure right after OIDC started working — caught proactively before it
happened, by diffing the workflow's fallback defaults against real AWS
resource names.

**Root cause**: `ci-cd.yml`'s `vars.ECR_WEB_REPO || 'suchana-web'` (and five
siblings — API/AI ECR repos, EB application name, EB environment names) were
all missing an "ai" — actual resources are `suchanaai-web`, `suchanaai`,
`suchanaai-web-prod`, etc. This didn't match either AWS reality *or* the
setup doc's own documented-default table — a plain typo in the workflow
file that the doc's Variables table (§7) had correct all along.

**Fix**: corrected all six fallback string literals in `ci-cd.yml` to
`suchanaai-*`.

**Aside — `AWSElasticBeanstalkFullAccess` doesn't exist anymore**: AWS
retired this managed policy name. Its replacement is
`AdministratorAccess-AWSElasticBeanstalk`. Both the role's attached policy
and the setup doc's Step 6.2 text were updated to match.

**Lesson**: when a workflow has fallback defaults for resource names, verify
them against the actual provisioned resources — `aws ecr describe-repositories` /
`aws elasticbeanstalk describe-applications` — don't assume a hardcoded
string in CI config is correct just because it looks plausible.

---

### 2.4 beanstalk-deploy action: "AWS Access Key not specified!"

**Symptom** (`Deploy to Elastic Beanstalk` step, after ECR push succeeded):
```
Error: Deployment failed: AWS Access Key not specified!
```

**Root cause**: `.github/actions/deploy-beanstalk/action.yml` deliberately
passed no `aws_access_key`/`aws_secret_key` to `einaregilsson/beanstalk-deploy@v22`,
on the assumption it would fall back to the ambient
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars that
`aws-actions/configure-aws-credentials` had already exported earlier in the
same job. **That assumption was wrong for this action.** Checked its actual
source: it has two completely separate code paths — CLI mode (run outside
GitHub Actions) reads `process.env.AWS_ACCESS_KEY_ID` directly; GitHub
Action mode reads *only* `core.getInput('aws_access_key')`
(→ `INPUT_AWS_ACCESS_KEY`), with **no fallback to the ambient env vars at
all** when run as an Action.

**Fix**: explicitly forward them in the `with:` block:
```yaml
aws_access_key: ${{ env.AWS_ACCESS_KEY_ID }}
aws_secret_key: ${{ env.AWS_SECRET_ACCESS_KEY }}
aws_session_token: ${{ env.AWS_SESSION_TOKEN }}
```
(These env vars exist in the job because `configure-aws-credentials`
exported them via `GITHUB_ENV` in an earlier step of the same job — reading
them via the `env.` expression context works across steps within one job.)

**Lesson**: "this action falls back to ambient credentials" is a claim to
verify against the action's actual source, not assume from how *other*
AWS actions behave (many do support ambient/OIDC credentials natively —
this one doesn't, in its GitHub Action code path).

---

### 2.5 "The ECR service failed to authenticate your private repository"

**Symptom** (inside the Beanstalk deployment itself, in `eb-engine.log` /
environment events, *after* the beanstalk-deploy action successfully
started the deployment):
```
ERROR: Instance deployment: The ECR service failed to authenticate your private repository. The deployment failed.
```

**Root cause**: a *third*, different IAM identity than the previous two
errors. The GitHub Actions deploy role can push images fine — but the
actual EC2 instance Beanstalk provisions pulls the image back down from ECR
at boot/update time using its own **instance profile role**,
`aws-elasticbeanstalk-ec2-role`. That role had `AWSElasticBeanstalkMulticontainerDocker`,
`AWSElasticBeanstalkWebTier`, `AWSElasticBeanstalkWorkerTier`, and
`AmazonS3FullAccess` attached — **none of which grant any ECR permission.**

**Fix**:
```bash
aws iam attach-role-policy --role-name aws-elasticbeanstalk-ec2-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```
This one role is shared by all three environments (web/api/ai) — fixing it
once fixed all three.

**Lesson**: pushing an image and pulling it back down authenticate as two
completely different principals. "OIDC credentials work" only covers the
push side; the pull side needs its own, separate IAM grant. See §5.

---

### 2.6 "Version ... already exists" on retry

**Symptom** (on a *re-run* of a previously-failed deploy job, same commit):
```
Error: Deployment failed: Version ai-11-<sha> already exists. Either remove the "deployment_package" parameter to deploy existing version, or set the "use_existing_version_if_available" parameter to "true"...
```

**Root cause**: `version-label: ${{ ... }}-${{ github.run_number }}-${{ github.sha }}`
is identical across retries of the same run — and the *previous* failed
attempt (from §2.5) had already gotten far enough to upload that exact
version to S3 and register it in Beanstalk before failing later in the
pipeline. The retry then tried to create the same version again.

**Fix**: added to the beanstalk-deploy `with:` block:
```yaml
use_existing_version_if_available: true
```

**Lesson**: any CI retry logic whose version/artifact identifier is derived
from immutable run metadata (run number + commit SHA) needs to be
idempotent against partial-success-then-failure — the identifier doesn't
change just because the previous attempt didn't fully succeed.

---

### 2.7 API container: "Docker container unexpectedly ended after it was started"

**Symptom**: ECR pull now succeeds (§2.5 fixed), but the API environment
still fails deployment:
```
ERROR: Instance deployment: The Docker container unexpectedly ended after it was started.
```

**Root cause**: `suchanaai-api-prod` had **zero environment properties
set** — confirmed via
`aws elasticbeanstalk describe-configuration-settings ... application:environment`
returning nothing. `apps/api` is NestJS + Prisma; without `DATABASE_URL` (at
minimum), the process throws on startup and exits, which Docker/Beanstalk
reports exactly as "container unexpectedly ended." `web` didn't hit this
because its config is baked in at *build* time, not read at runtime; `ai`
didn't crash outright because its optional integrations degrade gracefully
if unset rather than throwing.

**Fix**: set the runtime environment properties on `suchanaai-api-prod`
(`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`,
`ADMIN_EMAILS`, `WEB_ORIGIN`, `PUBLIC_SITE_URL`, `AI_SERVICE_URL`,
`SCRAPING_*`) and on `suchanaai-ai-service-prod` (`QDRANT_URL`,
`QDRANT_COLLECTION`, `EMBEDDING_MODEL`, `EMBEDDING_DIM`, `GEMINI_API_KEY`,
`GROQ_API_KEY`/`GROQ_API_KEYS`, `OPENCODE_ZEN_*`, `CORS_ORIGINS`,
`RAG_SCORE_THRESHOLD`, etc.) via
`aws elasticbeanstalk update-environment --option-settings file://...json`.

**One deviation worth flagging explicitly**: the local `apps/api/.env` had
`JWT_SECRET=change-me-in-production` — a literal placeholder, not a real
secret. It was **not** copied verbatim; a fresh `openssl rand -hex 32`
secret was generated for the AWS deployment instead. Using the placeholder
string in production would mean anyone could forge auth tokens.

**Lesson**: "the deploy succeeded" (green checkmark in Actions) and "the app
actually works" are different claims — Beanstalk environment properties are
entirely separate from anything the CI pipeline sets, and are easy to leave
at zero when standing up a new environment for the first time. Check
`describe-configuration-settings` before assuming they're populated.

---

### 2.8 Site unreachable — `ERR_CONNECTION_TIMED_OUT`

**Symptom**: browser hangs, then times out, hitting
`http://suchanaai-web-prod...elasticbeanstalk.com` directly — not
"connection refused," a full timeout (no response at all, not even a
rejection).

**Root cause**: **not** a security group problem — the SG already allowed
inbound TCP 80 from `0.0.0.0/0`. The actual cause: the EC2 instance sat in
subnet `suchanaai-private-a` — literally named "private" — whose route
table sends `0.0.0.0/0` egress through a **NAT Gateway**, not an Internet
Gateway. The instance had a public IP assigned, but that's irrelevant
without an Internet Gateway route in the subnet's route table to deliver
*inbound* traffic to it. A NAT Gateway only ever enables outbound-initiated
traffic (which is exactly why ECR pulls worked fine from this same
instance) — it does nothing for unsolicited inbound connections.

Confirmed by checking every subnet in the VPC and its `0.0.0.0/0` route
target — `suchanaai-private-a`/`-b` → NAT Gateway; `suchanaai-public-a`/`-b`
→ Internet Gateway (`igw-...`), sitting unused.

All three environments (web/api/ai) were provisioned into the same two
private subnets — same fix needed on all three.

**Fix**: Beanstalk console → environment → **Configuration → Instance
traffic and scaling** (or **Network**) → **Edit** → change **Instance
subnets** from `suchanaai-private-a`/`-b` to `suchanaai-public-a`/`-b` →
confirm **Public IP address** is enabled → **Apply**. Repeated for all
three environments.

**Is this a security downgrade? Addressed explicitly, worth keeping the
reasoning**: these are **single-instance environments with no load
balancer** (per the setup doc's own "cheapest correct choice for a first
pass" note) — there is no LB to shield a private-subnet instance in this
architecture, so the instance itself *must* be directly reachable to serve
traffic at all. Public-subnet placement here isn't a downgrade from some
more-secure baseline; it's what a single-instance environment requires to
function. The security groups still only expose the one app port (80),
nothing else (no SSH). The genuinely more hardened pattern — ALB in the
public subnet, instances in private subnets, only the ALB internet-facing —
is a real upgrade path, but requires first converting these to
load-balanced environments; worth doing later, not mid-firefight.

**Lesson**: a public IP address on an instance guarantees nothing about
inbound reachability by itself — the subnet's route table (IGW vs. NAT) is
what actually determines whether inbound internet traffic can reach it.
"Private" and "public" subnet naming in a VPC is a convention, not an
enforced property — always confirm via the actual route table, not the
subnet's name/tag.

---

### 2.9 Web loads, but API calls 404 with "not valid JSON"

**Symptom**: after §2.8's fix, the site loads, but every API call fails —
DevTools shows requests going to
`http://suchanaai-web-prod...elasticbeanstalk.com/notices/meta/category-counts`
(the **web** domain, not the API domain), returning Beanstalk's default
`404` HTML page, which the frontend then fails to `JSON.parse()`
("Unexpected token '<', "<!DOCTYPE"...").

**Root cause**: `apps/web/lib/api.ts` (and `landing-data.ts`) resolve their
API base URL as:
```js
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
```
`??` only falls back on `null`/`undefined` — but `ci-cd.yml` passes
`NEXT_PUBLIC_API_URL` as a Docker build-arg sourced from a GitHub repo
**Variable** that had never been set. An unset GitHub Actions Variable
interpolates to an **empty string**, not an absent one — so Next.js baked
`""` into the client bundle at build time. `"" ?? fallback` never triggers
the fallback. Every API call became a relative path, which the browser
resolves against whatever origin loaded the page (the web app itself).

**Fix**: set four GitHub repo **Variables** (Settings → Secrets and
variables → Actions → Variables tab) to the real Beanstalk endpoint URLs:
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AI_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` — then **re-run the CI/CD workflow with
"Deploy all three apps" ticked**, because these are build-time values;
setting the Variable alone changes nothing until `web`'s Docker image is
actually rebuilt.

**Lesson**: `envVar ?? fallback` is not the same guard as
`envVar || fallback` or `envVar ? envVar : fallback` — an empty string
passes the nullish check. If a build pipeline can ever produce an empty
string for a variable (unset GitHub Variables do exactly this), the code's
fallback logic needs to treat empty-string as absent too, or the CI
variable needs to be guaranteed non-empty.

---

### 2.10 AI deploy times out after ~14 minutes

**Symptom**: deployment command runs far longer than usual (instance
`Health: Green` the whole time — the EC2 host itself was fine), then:
```
WARN: The following instances have not responded in the allowed command timeout time...
ERROR: Unsuccessful command execution on instance id(s) ... Aborting the operation.
```
Beanstalk rolls back to the previous working version automatically — no
production outage, just a blocked new deploy.

**Root cause, two compounding issues**:
1. **Instance type was `t3.micro`** (1 GiB RAM) — the setup doc's own sizing
   table (§4) specifies `t3.medium` **or larger** for `ai` specifically,
   warning "undersizing this causes OOM kills." The actual provisioned
   instance didn't match the documented requirement. `apps/ai`'s image
   bundles torch + Playwright/Chromium + OCR dependencies and loads an
   embedding model into RAM — a `t3.micro`'s limited RAM and throttled CPU
   credits make pulling/extracting that image and starting the process
   extremely slow, plausibly explaining why it never finished in time.
2. **Deployment command timeout (`aws:elasticbeanstalk:command` →
   `Timeout`) was the default 600 seconds** — too short even on a
   correctly-sized instance for an image this heavy.

**Fix**:
```bash
aws elasticbeanstalk update-environment \
  --application-name suchanaai --environment-name suchanaai-ai-service-prod \
  --option-settings \
    Namespace=aws:autoscaling:launchconfiguration,OptionName=InstanceType,Value=t3.medium \
    Namespace=aws:elasticbeanstalk:command,OptionName=Timeout,Value=1800
```
(Cost tradeoff, stated explicitly at the time: `t3.medium` is not
free-tier-eligible, roughly $30/mo on-demand in `us-east-1` vs. ~$7-8/mo for
`t3.micro` — accepted because the doc had already specified this size as
correct for the workload.)

**Lesson**: a deployment "timing out" after a long, uneventful wait (host
health green throughout) is a strong signal to check instance sizing
against the workload's actual resource needs *before* just raising the
timeout — raising the timeout alone on an undersized instance can mean
waiting even longer for the same eventual failure (or a post-start OOM
kill instead of a timeout).

---

## 3. Fast checklist for a fresh deployment

If setting this up again (new AWS account, or a project cloned from this
one), do these **in order** — most map directly to an error above that
would otherwise be hit organically:

- [ ] OIDC identity provider exists (`token.actions.githubusercontent.com`) — §2.1
- [ ] Deploy role exists, trust policy `sub` matches your **actual** job
      shape — if your jobs use `environment:`, it's
      `repo:owner@ownerID/repo@repoID:environment:<name>`, not
      `ref:refs/heads/main`. **Don't guess it — trigger one deploy, let it
      fail, read the exact `sub` from CloudTrail, then set the trust
      policy.** — §2.1, §2.2
- [ ] Deploy role has `AmazonEC2ContainerRegistryFullAccess` +
      `AdministratorAccess-AWSElasticBeanstalk` (not the retired
      `AWSElasticBeanstalkFullAccess`) — §2.3
- [ ] Workflow's fallback resource-name defaults match real ECR repo names
      and Beanstalk application/environment names exactly — §2.3
- [ ] If using `einaregilsson/beanstalk-deploy`, explicitly pass
      `aws_access_key`/`aws_secret_key`/`aws_session_token` from
      `${{ env.AWS_* }}` — it does not read ambient credentials in Action
      mode — §2.4
- [ ] The Beanstalk **EC2 instance profile role**
      (`aws-elasticbeanstalk-ec2-role` by default) has
      `AmazonEC2ContainerRegistryReadOnly` — separate from the deploy role
      entirely — §2.5
- [ ] `use_existing_version_if_available: true` set on the beanstalk-deploy
      step, so retries of the same run don't fail on a duplicate version —
      §2.6
- [ ] Every Beanstalk environment's **runtime environment properties** are
      populated (`DATABASE_URL`, secrets, service URLs, etc.) — a
      successful *build/push* says nothing about whether the app can
      actually boot — §2.7
- [ ] Each environment's **instance subnets** route `0.0.0.0/0` through an
      **Internet Gateway**, not just have a public IP — verify via the
      subnet's actual route table, not its name — §2.8
- [ ] Every `NEXT_PUBLIC_*` (or equivalent build-time) GitHub Variable is
      **set to a real value**, not left blank — check the app's fallback
      logic doesn't silently accept an empty string as "unset" — §2.9
- [ ] Instance type matches the workload (check the doc's sizing table, not
      just whatever was fastest/cheapest to click through), and deployment
      command timeout is generous enough for the heaviest image being
      deployed — §2.10

---

## 4. Known-good current state (this account)

Account `679777944150`, region `us-east-1`, repo
`ashokabbhattarai-byte/suchanaai` (the `upstream` remote — **not** `origin`,
see `docs/AWS_ELASTIC_BEANSTALK_DEPLOYMENT.md` §6.2).

| Resource | Value |
|---|---|
| OIDC provider | `arn:aws:iam::679777944150:oidc-provider/token.actions.githubusercontent.com` |
| Deploy role | `arn:aws:iam::679777944150:role/github-actions-deploy-suchanaai` |
| Deploy role trust `sub` | `repo:ashokabbhattarai-byte@228275133/suchanaai@1343324102:environment:production` |
| Deploy role policies | `AmazonEC2ContainerRegistryFullAccess`, `AdministratorAccess-AWSElasticBeanstalk` |
| EC2 instance profile role | `aws-elasticbeanstalk-ec2-role` (shared by all 3 environments) |
| EC2 instance profile policies | `AWSElasticBeanstalkMulticontainerDocker`, `AWSElasticBeanstalkWebTier`, `AWSElasticBeanstalkWorkerTier`, `AmazonS3FullAccess`, `AmazonEC2ContainerRegistryReadOnly` |
| ECR repos | `suchanaai-web`, `suchanaai-api`, `suchanaai-ai-service` |
| Beanstalk application | `suchanaai` |
| VPC | `vpc-08eb8dda9834aad6f` (`suchanaai-vpc`) |
| Public subnets (use these) | `suchanaai-public-a`, `suchanaai-public-b` → `igw-08f7f33fe58338c94` |
| Private subnets (don't use for single-instance envs) | `suchanaai-private-a`, `suchanaai-private-b` → NAT `nat-08aeae67c0e7ec7d2` |
| `suchanaai-web-prod` | instance in public subnet; no runtime env vars needed (build-time only) |
| `suchanaai-api-prod` | instance in public subnet; env properties set (`DATABASE_URL`, `JWT_SECRET`, etc. — see §2.7) |
| `suchanaai-ai-service-prod` | instance in public subnet, resized to `t3.medium`, command timeout `1800`; env properties set (`QDRANT_URL`, `GEMINI_API_KEY`, etc.) |
| GitHub repo Variables (build-time) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AI_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → real `*.elasticbeanstalk.com` URLs |

Actual secret *values* (DB connection strings, API keys, the deploy role's
generated JWT secret) are intentionally not repeated here — they live in
Beanstalk environment properties and GitHub repo Secrets, not in this repo.

---

## 5. Two separate IAM identities — don't conflate them

The single most repeated confusion across §2.1, §2.2, and §2.5 above: this
pipeline involves **two entirely different AWS identities**, and an error
message rarely says which one is at fault.

1. **The GitHub Actions deploy role** (`github-actions-deploy-suchanaai`) —
   assumed via OIDC by the CI runner. Used to **push** images to ECR and
   call the Beanstalk API to register/deploy a version. Its permissions
   (§2.1–§2.3) only ever matter during the GitHub Actions run itself.
2. **The Beanstalk EC2 instance profile** (`aws-elasticbeanstalk-ec2-role`)
   — assumed by the actual EC2 instance, entirely inside AWS, with no
   GitHub involvement at all. Used to **pull** the image back down from ECR
   at boot/update time (§2.5), and by anything else the running application
   itself does against AWS APIs.

"OIDC/credentials work" fixes only ever cover identity #1. A failure
appearing *inside* the Beanstalk deployment logs (`eb-engine.log`,
environment events) rather than in the GitHub Actions log itself is a strong
signal you're looking at identity #2 instead.

---

## 6. General lessons

- **An AWS "AccessDenied" or "not authorized" message never tells you
  which of several possible causes it is** (missing resource, wrong ARN,
  mismatched trust policy condition) — when in doubt, go to the ground
  truth (CloudTrail) rather than iterating on guesses.
- **A green checkmark on a CI step means that step succeeded, not that the
  system it configured is healthy.** Multiple failures here (§2.7, §2.9)
  only appeared once the *previous* layer's failure was fixed — each fix
  peeled back one layer to reveal the next.
- **Read a third-party GitHub Action's actual source before assuming how it
  sources credentials, resolves inputs, or falls back.** Two separate
  incidents here (§2.4, and the general OIDC/`sub` shape in §2.2) were
  caused by an assumption that turned out to be false for this specific
  tool's actual behavior.
- **Cross-check hardcoded fallback values in workflow files against the
  real infrastructure**, not against what looks plausible or what a setup
  doc's example happened to use.
