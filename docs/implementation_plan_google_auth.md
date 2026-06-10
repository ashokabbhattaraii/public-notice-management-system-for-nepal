# Implementation Plan

[Overview]
Implement real Google OAuth authentication for the web app and enforce server-side authorization for admin/user roles.

This plan replaces the current demo/localStorage-based auth approach with a real OAuth-based flow.
The existing frontend (`apps/web/lib/auth-context.tsx`) stores a `pnm_user` object in `localStorage` and selects roles based on mock data. This is not secure because users can manually edit `localStorage` to become `admin`.

The backend (`apps/api`) currently exposes placeholder endpoints in `apps/api/src/auth/auth.controller.ts` and does not validate credentials or issue secure tokens.

To make authentication and authorization production-safe, we will:
1) Add OAuth login with Google on the frontend.
2) Verify Google identity on the backend.
3) Issue a short-lived access token and refresh token (or a secure session) from the backend.
4) Enforce role checks in the backend on all protected routes.
5) Update the frontend to rely on backend-issued auth state rather than localStorage role data.

[Types]  
Define strict request/response types for OAuth verification and token/session handling.

- `GoogleLoginRequest`
  - `idToken: string` (required): Google ID token obtained on the frontend.
- `AuthTokensResponse`
  - `accessToken: string` (required): JWT access token.
  - `refreshToken: string` (required): JWT refresh token (or session token).
  - `expiresInSeconds: number` (required).
- `AuthMeResponse`
  - `user: { id: string; email: string; name?: string; role: 'admin' | 'user'; }`.
- `Role`
  - Union type: `'admin' | 'user'`.
- `JwtPayload`
  - `sub: string` (user id)
  - `email: string`
  - `role: Role`
  - `iat: number`
  - `exp: number`

Validation rules:
- `idToken` must be non-empty and be verified server-side with Google’s public keys.
- JWT payload must include `role` and must match `admin|user`.

[Files]
Modify the API auth module/controller and the web auth context, plus add documentation for OAuth setup.

New files:
- `apps/api/src/auth/google-auth.service.ts` : Verify Google ID token and map to user role.
- `apps/api/src/auth/strategies/google-idtoken.guard.ts` (or `jwt-auth.guard.ts`): Protect endpoints.
- `apps/api/src/auth/dto/login.dto.ts` : DTOs for incoming login/refresh.
- `docs/google-oauth-implementation.md` : Setup steps for Google Cloud OAuth consent screen and credentials.

Existing files to be modified:
- `apps/api/src/auth/auth.controller.ts`
  - Replace placeholder endpoints with:
    - `POST /auth/google/login` : accept `idToken`, verify, issue tokens.
    - `POST /auth/refresh` : accept refresh token, issue new access token.
    - `GET /auth/me` : return authenticated user profile/role.
- `apps/api/src/auth/auth.module.ts`
  - Register new service, guards, and dependencies.
- `apps/api/src/main.ts`
  - Add security middleware defaults (rate limiting, body size limits) and restrict CORS.
- `apps/web/lib/auth-context.tsx`
  - Replace mock/localStorage auth with real flow:
    - Use Google Sign-In button (Google Identity Services).
    - Send `idToken` to backend `POST /auth/google/login`.
    - Store tokens securely (prefer httpOnly cookies if chosen by backend; otherwise store in memory + refresh logic).
    - Fetch `/auth/me` to hydrate `user`.
- `apps/web/app/login/page.tsx`
  - Remove demo login buttons (or keep only as development-time behind env flag).
  - Replace “Continue with Google” with actual Google sign-in.
- `apps/web/app/providers.tsx`
  - Keep providers but ensure auth context initializes from backend on load.

Configuration updates:
- `apps/api/package.json`
  - Add dependencies for JWT and Google token verification.
- `apps/web/package.json`
  - Add dependency for Google Identity Services client (or load it via script).
- Add environment variables:
  - `GOOGLE_CLIENT_ID`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `AUTH_TOKEN_TTL`.

[Functions]
Add token issuance/verification functions and replace auth-context logic.

New functions:
- `verifyGoogleIdToken(idToken: string): Promise<{ email: string; name?: string; sub: string }>`
  - File: `apps/api/src/auth/google-auth.service.ts`
- `issueAccessAndRefreshTokens(user): AuthTokensResponse`
  - File: `apps/api/src/auth/google-auth.service.ts`
- `refreshAccessToken(refreshToken: string): Promise<AuthTokensResponse>`
  - File: `apps/api/src/auth/auth.controller.ts`

Modified functions:
- `AuthController.login()`
  - File: `apps/api/src/auth/auth.controller.ts`
  - Replace placeholder logic with Google verification + token issuance.
- `AuthContext.loginWithGoogle(role?)`
  - File: `apps/web/lib/auth-context.tsx`
  - Replace mock selection with real OAuth sign-in.
  - No longer accept `role` from the caller; role comes from backend mapping.

Removed functions:
- Demo role selection paths inside `apps/web/app/login/page.tsx` (admin/user buttons)
  - Reason: prevents role spoofing.
  - Migration strategy: optionally keep behind `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` for local development only.

[Classes]
Introduce Google auth service and JWT/identity guards.

New classes:
- `GoogleAuthService` in `apps/api/src/auth/google-auth.service.ts`
  - Methods: `verifyGoogleIdToken`, `issueAccessAndRefreshTokens`.
- `JwtAuthGuard` (Nest guard)
  - Protect `/auth/me` and any protected API routes.

Modified classes:
- `AuthController` in `apps/api/src/auth/auth.controller.ts`
  - New route handlers for Google login, refresh, and me.

[Dependencies]
Add libraries for Google token verification and JWT management.

- Backend:
  - `jsonwebtoken` (or Nest JWT module)
  - `jose` (optional alternative)
  - Google token verification library (`google-auth-library` or equivalent)
- Frontend:
  - Google Identity Services client usage (either direct script import or a lightweight wrapper)

[Testing]
Add integration tests for auth endpoints and frontend behavior.

- Backend tests:
  - Unit test `verifyGoogleIdToken` with mocked Google verification.
  - Integration test `POST /auth/google/login` returns JWTs when idToken is valid.
  - Integration test `GET /auth/me` returns role when access token is valid and 401 when invalid.
- Frontend tests:
  - Component test for login page triggers backend call and sets user state.

[Implementation Order]
1) Investigate current auth wiring and decide token storage strategy.
2) Add backend service + controller endpoints for Google login and JWT issuance.
3) Implement JWT guard and `/auth/me` route.
4) Update frontend auth-context to call backend with real Google ID token.
5) Replace login page UI to use Google sign-in.
6) Remove demo/admin role spoofing paths or gate them to dev-only env.
7) Add docs and environment variable setup.

