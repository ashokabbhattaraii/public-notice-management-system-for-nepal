# Google OAuth Setup Guide

This project authenticates users with **Google Sign-In** using a server-verified
ID-token flow and stateless JWT sessions.

```
Browser                         NestJS API (apps/api)            Postgres (Prisma)
  <GoogleLogin/>  ── credential ──►  POST /auth/google
  (@react-oauth/google)              1. verify ID token (google-auth-library)
                                     2. upsert user, derive role  ───────────►  users
                                     3. sign app JWT
                  ◄── { token, user } ──
  store token  ── Authorization: Bearer <jwt> ──►  GET /auth/me  (JwtAuthGuard)
```

- **ORM:** Prisma. Schema lives in `apps/api/prisma/schema.prisma`; migrations in
  `apps/api/prisma/migrations/`.
- **Roles:** `admin` if the Google email is listed in `ADMIN_EMAILS`, otherwise `user`.
  The role is re-derived on **every login**, so changing the env var promotes/demotes
  a user on their next sign-in — no DB edit needed.

---

## 1. Create the Google OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create.
   - Fill app name, support email, developer email. Save.
   - While in **Testing** mode, add your Google account under **Test users**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**.
   - **Authorized JavaScript origins:**
     - `http://localhost:3000` (web dev server)
   - **Authorized redirect URIs:** none needed for `@react-oauth/google` ID-token flow.
   - Create → copy the **Client ID** (`xxxx.apps.googleusercontent.com`).

> The same Client ID is used by both the web app and the API (the API uses it as the
> token *audience* to verify credentials).

---

## 2. Provision Postgres

**Option A — Homebrew (macOS, matches the repo scripts):**

```bash
pnpm db:start    # brew services start postgresql@15
pnpm db:setup    # idempotently create the `postgres` role + `govnotice` db
```

**Option B — Docker:**

```bash
docker run --name pnm-postgres -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=govnotice -p 5432:5432 -d postgres:16
```

Tables are created by **Prisma migrations** (next step), not at runtime.

---

## 3. Configure environment variables

**`apps/api/.env`** (copy from `.env.example`):

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/govnotice
JWT_SECRET=<run: openssl rand -base64 32>
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
ADMIN_EMAILS=ashok.ab.bhattaraii@gmail.com   # comma-separated allowlist
WEB_ORIGIN=http://localhost:3000
```

**`apps/web/.env.local`** (copy from `.env.example`):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

> `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) and `GOOGLE_CLIENT_ID` (api) **must be identical**.

---

## 4. Install, migrate & run

```bash
pnpm install                       # installs deps; `postinstall` runs `prisma generate`
pnpm --filter @pnm/api prisma:migrate   # apply DB migrations (creates the `users` table)
pnpm dev                           # runs web (:3000) and api (:3001)
```

Prisma scripts available in `apps/api`:

| Command | Purpose |
|---|---|
| `pnpm --filter @pnm/api prisma:migrate` | Create/apply a migration in dev (`prisma migrate dev`) |
| `pnpm --filter @pnm/api prisma:deploy`  | Apply migrations in production (`prisma migrate deploy`) |
| `pnpm --filter @pnm/api prisma:generate`| Regenerate the Prisma client |
| `pnpm --filter @pnm/api prisma:studio`  | Open Prisma Studio (DB GUI) |

---

## 5. Verify the flow

1. Open `http://localhost:3000/login`.
2. Click **Continue with Google**, pick your account.
3. You are redirected to `/admin` (if your email is in `ADMIN_EMAILS`) or `/dashboard`.
4. Check the session:

```bash
# Grab the token from the browser: localStorage.getItem('pnm_token')
TOKEN=...
curl http://localhost:3001/auth/me -H "Authorization: Bearer $TOKEN"
curl http://localhost:3001/auth/admin/ping -H "Authorization: Bearer $TOKEN"  # 200 admin, 403 user
```

---

## 6. Protecting your own routes

```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { Roles } from './auth/roles.decorator';
import { CurrentUser } from './auth/current-user.decorator';
import { User } from '@prisma/client';

@UseGuards(JwtAuthGuard)                 // any signed-in user
@Get('mine')
mine(@CurrentUser() user: User) { ... }

@UseGuards(JwtAuthGuard, RolesGuard)     // admins only
@Roles('admin')
@Post('notices')
create(@CurrentUser() user: User) { ... }
```

On the web side, use `apiFetch()` from `lib/api.ts` — it automatically attaches the
bearer token.

---

## Security notes

- The ID token is verified **server-side** against the Google certs and your client ID;
  the browser never decides identity or role.
- Sessions are **stateless JWTs** signed with `JWT_SECRET` — rotate it to invalidate all
  sessions. Keep it long and random.
- `JwtStrategy.validate()` reloads the user every request, so disabling an account
  (`status = 'inactive'`) takes effect immediately.
- CORS is restricted to `WEB_ORIGIN`. Add your production domain there and to the
  Google **Authorized JavaScript origins** before deploying.
