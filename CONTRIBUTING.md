# Contributing to ClocDot

Thank you for helping improve ClocDot. By submitting a contribution, you agree
that it is provided under the project's Apache License 2.0.

## Development setup

1. Install Node.js 22.9 or newer and npm 11.
2. Run `npm ci` from the repository root.
3. Copy `.env.example` to `server/.env` and configure local services.
4. Run `npm run db:generate --workspace @clocdot/server`.
5. Use `npm run dev` for the employee app and API, and `npm run dev:admin` for
   the admin console.

Never commit `.env` files, credentials, employee records, attendance records,
payroll data, or production database exports.

## Pull requests

- Keep each pull request focused on one change.
- Explain the motivation, behavior change, and verification performed.
- Add or update tests for behavior changes.
- Update both `README.md` and `README.en.md` when public usage changes.
- Run `npm run lint`, `npm test`, `npm run build`, and `npm audit` before opening
  the pull request.
- Do not commit generated `dist/`, coverage, editor, or dependency directories.

Use clear commit messages. A DCO sign-off or separate CLA is not currently
required; the Apache-2.0 contribution terms apply to submitted changes.

## Database changes

Use Prisma migrations for schema changes. Migrations must work on both a new
database and a supported existing database. Never place personal data, real
credentials, shared passwords, or organization-specific seed data in a
migration.
