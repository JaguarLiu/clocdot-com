# ClocDot

[繁體中文](README.md) | [English](README.en.md)

ClocDot is a multi-tenant HR, attendance, and payroll management system designed for small and medium-sized businesses in Taiwan. It covers time tracking, shift scheduling, leave, overtime, approvals, organization permissions, payroll settlement, and payslips.

The default time zone is `Asia/Taipei`. The project includes reference data for Taiwan's 2026 public holidays, labor and health insurance, and labor pension contributions.

> **Project status: active development.** A stable 1.0 release has not yet been published, and the data model and API may change. This repository contains no demo accounts or real HR data; use the secure bootstrap flow below to create the first administrator in a new environment.

## Features

### Employee app

- Email/password authentication and password changes
- Clock-in, clock-out, and current-day attendance status
- On-site verification using GPS, workplace radius, and Wi-Fi IP/CIDR
- Offline punch queue and PWA installation
- Attendance history, exception status, and correction requests
- Leave requests, balance lookup, cancellation, and company leave calendar
- Derived overtime hours, overtime applications, and compliance notices
- Manager approval inbox
- Personal payslips
- Traditional Chinese and English interfaces

### Admin console

- Today's attendance overview, monthly reports, and annual statistics
- Attendance, correction, leave, and overtime reviews
- Excel/CSV report export
- Employee creation, editing, deactivation, unlocking, and batch import
- Department tree, department managers, roles, and module permissions
- Shift management, default shifts, and daily scheduling
- Company workdays, rest days, regular days off, and special-date settings
- Workplace locations, on-site cycles, and Wi-Fi clock-in settings
- Leave quotas, salary deduction ratios, and anniversary/calendar-year policies
- Salary profiles, monthly/hourly pay, allowances, insurance data, and voluntary pension contributions
- Payroll runs, manual adjustments, annual-leave cash-out, locking, and export
- Issue reporting

### Backend capabilities

- Company-level multi-tenant data isolation
- JWT authentication, account status checks, login rate limiting, and progressive lockout
- Department-scoped and module-level RBAC
- Multi-level approval flows derived from the department hierarchy
- Transactional approval decisions and idempotency protection
- Taiwan overtime, rest-day, regular-day-off, and one-day-off-in-seven compliance checks
- Redis caching and rate limiting, with graceful degradation when Redis is unavailable
- Request schema validation, security headers, and centralized error handling
- Resend email notifications

## Technology stack

| Layer | Technologies |
|---|---|
| Employee app | React 19, Vite 8, Tailwind CSS 4, SWR, React Router, i18next |
| PWA | vite-plugin-pwa, Workbox |
| Admin console | React 19, Vite 8, SWR, ExcelJS |
| API | Node.js 22, Fastify 5 |
| ORM / database | Prisma 7, PostgreSQL |
| Cache | Redis / ioredis |
| Authentication | Email + password, JWT, bcrypt |
| Deployment | Docker, Caddy |

## Architecture

```mermaid
flowchart LR
  Employee[Employee] --> Client[React PWA\nclient/]
  Manager[HR / Manager] --> Admin[React Admin\nadmin/]
  Client -->|REST /api| API[Fastify API\nserver/]
  Admin -->|REST /api| API
  API --> DB[(PostgreSQL)]
  API --> Redis[(Redis)]
  API --> Mail[Resend]
```

The three workspaces share one API and database:

```text
ClocDot/
├── client/                 Employee PWA
│   └── src/
│       ├── pages/          Attendance, history, corrections, leave, overtime, payslips
│       ├── components/     Shared UI and PWA components
│       ├── context/        Authentication state
│       ├── hooks/          Attendance, connectivity, and installation
│       └── services/       API, authentication, and offline queue
├── admin/                  Admin console
│   └── src/
│       ├── pages/          Reports, reviews, employees, schedules, payroll, settings
│       ├── components/     Organization, employee, shift, and payroll editors
│       └── services/       API and authentication
├── server/
│   ├── src/
│   │   ├── routes/         Fastify REST endpoints
│   │   ├── services/       Attendance, leave, approval, compliance, and payroll logic
│   │   ├── plugins/        Prisma, Redis, JWT, i18n, and email
│   │   ├── data/           Taiwan holiday and payroll reference data
│   │   └── utils/          Time zone, tenancy, IP, CSV, and other utilities
│   ├── prisma/             Schema, migrations, and data-maintenance SQL
│   └── test/               Node.js tests
├── docker-compose.yml
└── Makefile
```

## Core data model

`Company` is the tenant boundary. The main relationships are:

```mermaid
erDiagram
  Company ||--o{ User : employs
  Company ||--o{ Department : contains
  Company ||--o{ Role : defines
  Company ||--o{ Shift : defines
  Company ||--o{ CompanyLocation : owns
  Company ||--o{ LeavePolicy : configures
  User ||--o{ AttendanceRecord : records
  User ||--o{ LeaveRequest : requests
  User ||--o{ OvertimeRequest : requests
  User ||--o{ ShiftAssignment : receives
  User ||--o| SalaryProfile : has
  AttendanceRecord ||--o{ CorrectionRequest : corrects
  PayrollRun ||--o{ PayrollItem : contains
```

See [`server/prisma/schema.prisma`](server/prisma/schema.prisma) for the complete fields and constraints.

## Local development

### Prerequisites

- Node.js 22.9 or newer
- npm 11
- PostgreSQL
- Redis (optional; caching and Redis-backed rate limiting are disabled when it is not configured)

### Installation and configuration

```bash
npm ci
cp .env.example server/.env
```

At minimum, configure a valid PostgreSQL connection and a random JWT secret in `server/.env`:

```env
DATABASE_URL="postgresql://clocdot:clocdot_dev_only@localhost:5433/clocdot?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=3000
```

The server refuses to start when `JWT_SECRET` is missing or still uses an unsafe development default.

Generate Prisma Client and apply migrations:

```bash
npm run db:generate --workspace @clocdot/server
npm run db:migrate --workspace @clocdot/server
```

After applying migrations to a new database, configure the first company and administrator:

```env
# server/.env
BOOTSTRAP_COMPANY_NAME="Example Company"
BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
BOOTSTRAP_ADMIN_NAME="System Administrator"
```

Run the one-time bootstrap command. It securely prompts for a password of at least 12 characters without displaying the input, and asks you to confirm it to guard against typos:

```bash
npm run bootstrap:admin
```

The command creates the Company, Admin Role, and first administrator in one transaction. Re-running it for the same administrator makes no changes. It is rejected when the company already has another administrator, or when the existing company matched by `BOOTSTRAP_COMPANY_NAME` already has users — the latter prevents a mistyped company name from granting administrative access to another tenant's attendance and payroll data. Non-interactive deployments may temporarily provide `BOOTSTRAP_ADMIN_PASSWORD` (which skips the prompt and confirmation); remove it from the environment and secret store immediately afterward.

### Starting the services

```bash
# Employee app (localhost:5173) and API (localhost:3000)
npm run dev

# Admin console (localhost:5174)
npm run dev:admin
```

You can also start each service separately:

```bash
npm run dev:client
npm run dev:server
npm run dev:admin
```

The Vite development servers proxy `/api` to `http://localhost:3000`.

## Environment variables

The complete example is available in [`.env.example`](.env.example).

### Server

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret; use a long random value in production |
| `PORT` | No | API port; defaults to `3000` |
| `REDIS_URL` | No | Redis connection string |
| `CORS_ORIGINS` | Production | Comma-separated allowed origins containing the public client and admin URLs. Falls back to `CLIENT_URL`, then `http://localhost:5173,http://localhost:5174` |
| `TRUST_PROXY` | Behind a proxy | Whether to trust `X-Forwarded-For`. Unset = not trusted (socket address only); a number = reverse-proxy hop count; or a comma-separated list of proxy IPs/CIDRs. `request.ip` drives Wi-Fi check-in, so `true` lets clients forge their source IP |
| `GOOGLE_MAPS_API_KEY` | No | Address geocoding |
| `RESEND_API_KEY` | No | Resend API key; email is disabled when omitted |
| `NOTIFY_FROM` | No | Notification sender address |
| `NOTIFY_TO` | No | Waiting-list/application notification recipient |
| `APPLY_DAILY_CAP_PER_IP` | No | Daily per-IP limit for the public application form |
| `APPLY_GLOBAL_DAILY_CAP` | No | Global daily limit for the public application form |
| `BOOTSTRAP_COMPANY_NAME` | For bootstrap | Name of the first company; used only by `npm run bootstrap:admin` |
| `BOOTSTRAP_ADMIN_EMAIL` | For bootstrap | Email of the first administrator |
| `BOOTSTRAP_ADMIN_NAME` | For bootstrap | Name of the first administrator |
| `BOOTSTRAP_ADMIN_PASSWORD` | No | Non-interactive automation only; skips the terminal prompt and should be removed straight after use |

### Client/admin build-time variables

| Variable | App | Description |
|---|---|---|
| `VITE_API_BASE` | Both | API base URL; usually `/api` in development |
| `VITE_ADMIN_URL` | Client | Admin console URL |
| `VITE_CLIENT_URL` | Admin | Employee app URL |

## Common commands

```bash
# Build
npm run build

# Lint
npm run lint

# Test
npm test

# Prisma
npm run db:migrate
npm run db:push
npm run db:studio
```

Tests use the built-in Node.js test runner. Core coverage includes approval concurrency, tenant and organization scopes, schedule compliance, leave, overtime, payroll calculations, login lockout, i18n, and route schemas.

## Docker

The root Compose file provides PostgreSQL, Redis, the API, the employee app, and the admin console:

```bash
export JWT_SECRET="replace-with-a-long-random-secret"
docker compose up -d --build
```

Default exposed ports:

- Client: `http://localhost:80`
- Admin: `http://localhost:8080`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

You can also use shortcuts such as `make up-build`, `make logs`, and `make ps`.

When deploying client, admin, and server on separate domains, configure the server's `CORS_ORIGINS` with the actual public domains. Otherwise, browser requests will be rejected by CORS.

## Security and data considerations

- The API restricts access by tenant, department scope, and module permissions.
- Passwords are hashed with bcrypt; JWTs currently expire after one day.
- Existing JWTs are rejected after an employee is deactivated.
- Production deployments must use a unique, unpredictable `JWT_SECRET`.
- Attendance and payroll are sensitive data. Establish PostgreSQL backup, restoration testing, monitoring, and audit-log policies before production deployment.
- `server/src/data/twHolidays` and `server/src/data/twPayroll` contain annual reference data and must be updated and verified before each new year.
- Taiwan labor and payroll reference data is provided for convenience and does not constitute legal advice.

## API overview

All API routes use the `/api` prefix. Main resources include:

- `/api/auth`: sign-in, current user, and password changes
- `/api/attendance`, `/api/punch-in`, `/api/punch-out`: attendance and time punches
- `/api/correction-requests`: attendance corrections
- `/api/leave-requests`, `/api/leave-balances`: leave requests and balances
- `/api/overtime-requests`: overtime
- `/api/approvals`: manager approvals
- `/api/payroll/me`: personal payslips
- `/api/admin/*`: reports, employees, organization, settings, and payroll management
- `/api/admin/shifts`, `/api/admin/schedule`: shifts and scheduling
- `/api/health`: service health

See [`server/src/routes`](server/src/routes) for the actual request schemas and authorization requirements.

## Project status and maintenance

| Item | Status |
|---|---|
| Maturity | **Pre-1.0, under active development.** Data model and API may change between minor versions |
| Maintainer | [@JaguarLiu](https://github.com/JaguarLiu) |
| Issues | [GitHub Issues](https://github.com/JaguarLiu/clocdot-com/issues) (security reports go through [SECURITY.md](SECURITY.md)) |
| Changelog | [CHANGELOG.md](CHANGELOG.md); breaking changes are marked **BREAKING** |
| Production use | No public production deployments yet. Evaluate and test before adopting |

This is a personally maintained project, not a commercial product. There is no service-level guarantee or dedicated support.

### Known limitations

- No built-in audit log (who viewed or changed which payroll record, and when).
- No data-retention or automatic deletion mechanism; erasing personal data requires direct database work. See [PRIVACY.md](PRIVACY.md).
- Automated tests concentrate on backend business logic; there is no browser-based end-to-end coverage yet.
- Taiwan holidays and insurance brackets are annual data and must be updated manually. See [`server/src/data/README.md`](server/src/data/README.md).
- Single timezone (`Asia/Taipei`) and two locales (Traditional Chinese, English) only.
- This repository ships **no** demo accounts, seed data, or screenshots. Build your environment with your own test data.

### Roadmap

No committed timeline; priorities shift with real demand.

- Audit logging and data-retention tooling
- Browser integration tests for login, API, and the main admin flows
- Automated refresh and validation of annual holiday and bracket data
- Multi-timezone and additional locale support

## Privacy and data handling

The system processes location, IP, attendance, and payroll data. **The deployer is the data controller.**
Read [PRIVACY.md](PRIVACY.md) for exactly what is collected, cached, and retained before writing your own privacy policy.

## Contributing and security

Before contributing, read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately according to [SECURITY.md](SECURITY.md); do not post exploit details or sensitive data in a public issue.

## License

ClocDot, including its original visual assets, is licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution information.
