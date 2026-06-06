# Public Notice Management System — System Overview

## 1. Introduction

The Public Notice Management System (PNM) is a full-stack web application designed for Nepal that aggregates, manages, and delivers public notices (government, institutional, and organizational) to citizens. It provides intelligent search using RAG (Retrieval-Augmented Generation), automated web scraping of notice sources, personalized alerts, and multilingual support (English/Nepali).

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js (App Router) | 15.x | SSR/SSG React framework |
| | React | 19.x | UI library |
| | TypeScript | 5.x | Type-safe JavaScript |
| | Tailwind CSS | 4.x | Utility-first styling |
| | Radix UI | Latest | Accessible headless components |
| | Lucide React | Latest | Icon library |
| | GSAP | 3.x | Animations |
| | next-themes | 0.4.x | Dark/Light theme support |
| **Backend API** | NestJS | 11.x | Node.js REST API framework |
| | Express | 5.x | HTTP server (via NestJS platform) |
| | TypeScript | 5.x | Type safety |
| | RxJS | 7.x | Reactive programming |
| **AI/RAG Service** | Python (ASGI) | 3.x | AI microservice |
| | Uvicorn | 0.30+ | ASGI server |
| | httpx | 0.27+ | Async HTTP client |
| **Monorepo Tooling** | Turborepo | 2.x | Build orchestration |
| | pnpm | 10.x | Package manager |
| **Shared Packages** | @pnm/types | — | Domain type definitions |
| | @pnm/utils | — | Utility functions |
| | @pnm/config | — | Shared ESLint/TS configs |

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                            │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Next.js Frontend (apps/web)                 │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐  │  │
│  │  │ Public  │ │   User   │ │   Admin   │ │  RAG Chat UI   │  │  │
│  │  │ Pages   │ │Dashboard │ │   Panel   │ │                │  │  │
│  │  └─────────┘ └──────────┘ └───────────┘ └────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                          │              │
                    REST API         REST API
                          │              │
         ┌────────────────┴──┐     ┌─────┴──────────────┐
         │  NestJS Backend   │     │  Python AI Service  │
         │   (apps/api)      │     │    (apps/ai)        │
         │                   │     │                     │
         │ • Auth Module     │     │ • /query (RAG)      │
         │ • Notices Module  │     │ • /documents        │
         │ • RAG Module      │     │ • /health           │
         └────────┬──────────┘     └─────────┬───────────┘
                  │                           │
                  │                           │
         ┌───────┴────────┐        ┌─────────┴──────────┐
         │   PostgreSQL   │        │   Vector Database   │
         │   (planned)    │        │     (planned)       │
         └────────────────┘        └────────────────────-┘
```

### 3.2 Monorepo Structure Diagram

```
public-notice-management/
├── apps/
│   ├── web/           ← Next.js 15 Frontend (React 19, Tailwind 4)
│   ├── api/           ← NestJS 11 Backend API (TypeScript)
│   └── ai/            ← Python AI/RAG Microservice (Uvicorn ASGI)
├── packages/
│   ├── types/         ← Shared TypeScript domain types
│   ├── utils/         ← Shared utility functions
│   └── config/        ← Shared ESLint + TypeScript configs
├── turbo.json         ← Turborepo pipeline config
├── pnpm-workspace.yaml
└── package.json       ← Root workspace scripts
```

### 3.3 Frontend Module Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      apps/web                                 │
├──────────────────────────────────────────────────────────────┤
│  app/                                                        │
│  ├── page.tsx              (Landing/Home)                     │
│  ├── login/                (Auth - Login)                     │
│  ├── signup/               (Auth - Register)                  │
│  ├── about/                (About Page)                       │
│  ├── notices/              (Public Notice Browse/Detail)      │
│  ├── demo/                 (Demo Page)                        │
│  ├── rag/                  (RAG Chat Interface)               │
│  ├── dashboard/            (User Dashboard)                   │
│  │   ├── page.tsx          (Overview)                         │
│  │   ├── saved/            (Saved Notices)                    │
│  │   ├── alerts/           (Alert Management)                 │
│  │   ├── activity/         (Activity Log)                     │
│  │   └── settings/         (User Settings)                    │
│  └── admin/                (Admin Panel)                      │
│      ├── page.tsx          (Admin Dashboard)                  │
│      ├── notices/          (Notice CRUD)                      │
│      ├── categories/       (Category Management)              │
│      ├── users/            (User Management)                  │
│      ├── sources/          (Scraping Sources)                 │
│      ├── scraping/         (Scraping Monitor)                 │
│      ├── alerts/           (Alert Channels)                   │
│      └── system/           (System Settings)                  │
├──────────────────────────────────────────────────────────────┤
│  components/                                                  │
│  ├── layout/      (Header, Footer)                            │
│  ├── ui/          (Button, Card, Dialog, Badge, Tabs, etc.)  │
│  ├── dashboard/   (DashboardLayout)                           │
│  ├── admin/       (AdminLayout)                               │
│  └── *.tsx        (Feature-specific components)               │
├──────────────────────────────────────────────────────────────┤
│  lib/                                                         │
│  ├── auth-context.tsx      (Auth state provider)              │
│  ├── alerts-context.tsx    (Alert rules provider)             │
│  ├── language-context.tsx  (i18n provider - EN/NE)            │
│  ├── mock-data.ts          (Sample data for demo)             │
│  ├── types.ts              (Frontend-specific types)          │
│  └── utils.ts              (cn() tailwind merge helper)       │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 Backend API Module Architecture

```
┌──────────────────────────────────────┐
│            apps/api (NestJS)          │
├──────────────────────────────────────┤
│  src/                                │
│  ├── main.ts         (Bootstrap)     │
│  ├── app.module.ts   (Root Module)   │
│  ├── auth/                           │
│  │   ├── auth.module.ts              │
│  │   └── auth.controller.ts          │
│  │       • POST /auth/login          │
│  │       • POST /auth/register       │
│  │       • GET  /auth/me             │
│  ├── notices/                        │
│  │   ├── notices.module.ts           │
│  │   └── notices.controller.ts       │
│  │       • GET    /notices           │
│  │       • GET    /notices/:id       │
│  │       • POST   /notices           │
│  │       • PATCH  /notices/:id       │
│  │       • DELETE /notices/:id       │
│  └── rag/                            │
│      ├── rag.module.ts               │
│      └── rag.controller.ts           │
│          • POST /rag/documents       │
│          • GET  /rag/documents       │
│          • POST /rag/query           │
└──────────────────────────────────────┘
```

---

## 4. Data Flow Diagrams

### 4.1 Notice Browsing Flow

```
┌────────┐     GET /notices      ┌──────────┐     Query      ┌──────────┐
│  User  │ ──────────────────→   │  NestJS  │ ────────────→  │ Database │
│Browser │                       │   API    │                 │          │
│        │ ←──────────────────   │          │ ←────────────   │          │
└────────┘   JSON Response       └──────────┘   Results       └──────────┘
```

### 4.2 RAG Query Flow

```
┌────────┐   Question    ┌──────────┐  POST /rag/query  ┌───────────┐
│  User  │ ───────────→  │  NestJS  │ ───────────────→  │  Python   │
│Browser │               │   API    │                    │ AI Service│
│        │               │          │                    │           │
│        │ ←───────────  │          │ ←───────────────   │           │
└────────┘ Answer+Sources└──────────┘  RAG Response      └─────┬─────┘
                                                               │
                                                        ┌──────┴──────┐
                                                        │   Vector    │
                                                        │  Database   │
                                                        └─────────────┘
```

### 4.3 Web Scraping Flow

```
┌─────────────┐   Configure    ┌──────────┐    Scheduled     ┌─────────────┐
│    Admin    │ ─────────────→ │  NestJS  │ ──────────────→  │  External   │
│   Panel    │                 │   API    │                   │  Gov Sites  │
│            │                 │          │ ←──────────────   │             │
└─────────────┘                │          │   Scraped Data    └─────────────┘
                               │  Process │
                               │  + Store │
                               └──────────┘
```

### 4.4 Alert Notification Flow

```
┌──────────────┐                  ┌──────────────┐
│  New Notice  │                  │  Alert Rules │
│  Published   │                  │  Database    │
└──────┬───────┘                  └──────┬───────┘
       │                                 │
       └──────────┐    ┌─────────────────┘
                  ▼    ▼
           ┌──────────────────┐
           │   Match Engine   │
           │ (keyword/category│
           │  /organization)  │
           └────────┬─────────┘
                    │
                    ▼ Match Found
           ┌──────────────────┐
           │  Notify Users    │
           │  (in-app/email)  │
           └──────────────────┘
```

---

## 5. User Roles & Access Control

```
┌─────────────────────────────────────────────────────────────┐
│                     Access Control Matrix                     │
├─────────────────┬──────────┬──────────────┬─────────────────┤
│   Feature       │  Guest   │    User      │     Admin       │
├─────────────────┼──────────┼──────────────┼─────────────────┤
│ Browse Notices  │    ✓     │      ✓       │       ✓         │
│ Search/Filter   │    ✓     │      ✓       │       ✓         │
│ View Details    │    ✓     │      ✓       │       ✓         │
│ Save Notices    │    ✗     │      ✓       │       ✓         │
│ Set Alerts      │    ✗     │      ✓       │       ✓         │
│ RAG Chat        │    ✗     │      ✓       │       ✓         │
│ Dashboard       │    ✗     │      ✓       │       ✓         │
│ Manage Notices  │    ✗     │      ✗       │       ✓         │
│ Manage Users    │    ✗     │      ✗       │       ✓         │
│ Upload Docs     │    ✗     │      ✗       │       ✓         │
│ Scraping Config │    ✗     │      ✗       │       ✓         │
│ System Settings │    ✗     │      ✗       │       ✓         │
└─────────────────┴──────────┴──────────────┴─────────────────┘
```

---

## 6. Domain Model (Entity Relationship)

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────┐
│    User     │       │     Notice      │       │   Category   │
├─────────────┤       ├─────────────────┤       ├──────────────┤
│ id          │       │ id              │       │ id           │
│ username    │       │ title           │◄──────│ name         │
│ email       │       │ organization    │       │ slug         │
│ role        │       │ category        │       └──────────────┘
│ status      │       │ priority        │
│ createdAt   │       │ publishedAt     │
└──────┬──────┘       │ expiresAt       │       ┌──────────────┐
       │              │ sourceUrl       │       │   Document   │
       │              │ summary         │       ├──────────────┤
       │              │ views           │◄──────│ id           │
       │              │ isOcr           │       │ noticeId     │
       │              └─────────────────┘       │ filename     │
       │                                        │ mimeType     │
       │                                        │ sizeBytes    │
       │    ┌───────────────────┐               │ isOcr        │
       │    │      Alert        │               │ uploadedAt   │
       │    ├───────────────────┤               └──────────────┘
       └───►│ id                │
            │ userId            │       ┌──────────────────────┐
            │ name              │       │   ScrapingSource     │
            │ type (keyword/    │       ├──────────────────────┤
            │       category/   │       │ id                   │
            │       org)        │       │ name                 │
            │ conditions[]      │       │ url                  │
            │ enabled           │       │ status               │
            │ matchCount        │       │ itemsScraped         │
            │ lastMatchedAt     │       │ lastScrapedAt        │
            │ createdAt         │       │ errorMessage         │
            └───────────────────┘       └──────────────────────┘
```

---

## 7. Notice Categories

| Category | Description | Example Sources |
|----------|-------------|-----------------|
| Vacancies | Government/institutional job postings | PSC, Ministry portals |
| Tenders | Procurement and bidding notices | Government e-procurement |
| Exams | Examination schedules and results | PSC, Universities |
| Policy | New policies, circulars, directives | Gazette, Ministries |
| Gazette | Official Nepal Gazette publications | Nepal Gazette |
| General | Other announcements | Various sources |

---

## 8. Key Features Summary

### 8.1 Public Notice Aggregation
- Automated scraping from Nepal government and institutional websites
- OCR support for image-based notices (PDF scan extraction)
- Categorization and priority assignment
- Deadline tracking with expiry indicators

### 8.2 RAG-Powered Search
- Upload and vectorize documents (PDF, DOCX, TXT)
- Natural language question answering over document corpus
- Source citation in responses
- Floating chat widget for quick queries from any page

### 8.3 Personalized Alerts
- Keyword-based alert rules
- Category subscription alerts
- Organization-specific tracking
- In-app notification delivery

### 8.4 Multilingual Support
- Full UI in English and Nepali (नेपाली)
- Context-based language provider
- Instant switching without page reload
- Locale-aware date/time formatting

### 8.5 Admin Capabilities
- Full CRUD for notices, categories, users
- Web scraping source configuration and monitoring
- Content moderation queue
- System analytics dashboard

---

## 9. Deployment Architecture (Planned)

```
┌──────────────────────────────────────────────────────────────┐
│                        Cloud Infrastructure                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐   ┌────────────┐   ┌────────────────────┐  │
│  │  Vercel    │   │  EC2 /     │   │  EC2 / Lambda      │  │
│  │            │   │  Container │   │  (Python)          │  │
│  │  Next.js   │   │  NestJS    │   │  AI/RAG Service    │  │
│  │  Frontend  │   │  API       │   │                    │  │
│  └──────┬─────┘   └─────┬──────┘   └────────┬───────────┘  │
│         │                │                    │              │
│         │         ┌──────┴──────┐    ┌───────┴──────────┐   │
│         │         │ PostgreSQL  │    │ Vector DB        │   │
│         │         │ (RDS/Neon)  │    │ (Pinecone/       │   │
│         │         └─────────────┘    │  pgvector)       │   │
│         │                            └──────────────────┘   │
│         │         ┌─────────────┐                           │
│         └────────►│ S3 / CDN    │                           │
│                   │ (Static +   │                           │
│                   │  Uploads)   │                           │
│                   └─────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Development Workflow

### Running the System

```bash
# Install dependencies
pnpm install

# Run all services in parallel
pnpm dev

# Run individual services
pnpm dev:web    # Next.js frontend → http://localhost:3000
pnpm dev:api    # NestJS backend  → http://localhost:3001
pnpm dev:ai     # Python AI       → http://localhost:8000
```

### Build Pipeline (Turborepo)

```
          ┌──────────────┐
          │  turbo build  │
          └──────┬───────┘
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌──────────┐
│ apps/web │ │apps/api│ │ apps/ai  │
│(next     │ │(nest   │ │(no build)│
│ build)   │ │ build) │ │          │
└──────────┘ └────────┘ └──────────┘
      ▲          ▲
      │          │
┌─────┴──────────┴─────┐
│   packages/types     │  ← shared dependency
│   packages/utils     │
│   packages/config    │
└──────────────────────┘
```

---

## 11. API Endpoints Summary

### Authentication (`/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login and get token |
| GET | `/auth/me` | Get current user profile |

### Notices (`/notices`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notices` | List notices (paginated, filterable) |
| GET | `/notices/:id` | Get single notice details |
| POST | `/notices` | Create notice (Admin only) |
| PATCH | `/notices/:id` | Update notice (Admin only) |
| DELETE | `/notices/:id` | Delete notice (Admin only) |

### RAG (`/rag`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rag/documents` | Upload document for vectorization |
| GET | `/rag/documents` | List uploaded documents |
| POST | `/rag/query` | Ask question against document corpus |

### AI Service (Python — port 8000)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service status info |
| GET | `/health` | Health check |
| GET | `/documents` | List indexed documents |
| POST | `/documents` | Receive document for processing |
| POST | `/query` | Process RAG query |

---

## 12. Design System

| Token | Value |
|-------|-------|
| Primary Color | `#0C5CAB` |
| Surface (Dark) | `#09090b` |
| Text | `#fafafa` |
| Success | `#10b981` |
| Warning | `#f59e0b` |
| Danger | `#ef4444` |
| Font Family | IBM Plex Sans |
| Border Radius (sm/md) | 4px / 8px |
| Spacing Grid | 8pt baseline |
| Theme | Dark (cloud-platform aesthetic) |

---

## 13. Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend UI | ✅ Complete | All pages and components built |
| Auth (client-side) | ✅ Complete | localStorage-based |
| Notice browsing/search | ✅ Complete | Mock data, full filtering |
| User dashboard | ✅ Complete | Stats, saved, alerts, activity |
| Admin panel | ✅ Complete | All management pages |
| RAG chat UI | ✅ Complete | Interface ready |
| NestJS API scaffold | ⏳ Scaffold | Controllers exist, no DB |
| Python AI service | ⏳ Scaffold | ASGI app with stub endpoints |
| Database (PostgreSQL) | ❌ Not started | Planned |
| Vector DB integration | ❌ Not started | Planned |
| Real authentication | ❌ Not started | JWT + bcrypt planned |
| Email notifications | ❌ Not started | Planned |
| Actual web scraping | ❌ Not started | Planned |

---

## 14. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Page load time | < 2 seconds |
| Concurrent users | 100+ |
| Uptime | 99.5% |
| Languages | English, Nepali |
| Accessibility | WCAG 2.1 AA |
| Browser support | Chrome, Firefox, Safari, Edge (latest 2) |
| Mobile responsive | Yes (320px+) |
| Default theme | Dark mode |

---

## 15. Security Considerations

- Role-based access control (Guest / User / Admin)
- Password hashing with bcrypt (planned)
- JWT token-based session management (planned)
- Input sanitization and validation
- CORS configuration on API
- Rate limiting on endpoints (planned)
- XSS protection via React's built-in escaping
- CSRF protection (planned)

---

*Document prepared for: Public Notice Management System for Nepal*
*Last updated: 2026-06-06*
