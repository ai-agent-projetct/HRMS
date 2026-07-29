# LoomHR — HRMS for Textile & Production Units

**LoomHR** is a modern, India-ready HRMS built for **production-based companies** — textile mills, spinning, weaving/looms, dyeing houses, and thread & garment manufacturers. It handles the reality of a factory floor: rotating shifts, migrant and hostel labour, daily/weekly/monthly wages, attendance-linked incentives, labour-agent commission, salary advances, mess bills, statutory deductions, worker health & welfare, and an **agentic AI** that runs the daily people operation for you.

> Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS and Zustand. All data is client-side and seeded with a realistic sample mill, so it runs with zero backend for demos and pilots.

---

## ✨ Features

### Workforce
- **Employee / labour master** — personal details, documents, qualifications, salary & bank history, PF/ESI/UAN, tenure & prior experience.
- **6 shifts** — 8-hour rotating (A/B/C), 12-hour continuous (D/E) and a general staff shift.
- **11 worker categories** — permanent, staff, semi-staff, apprentice, hostel boys/girls, casual gents/ladies, inter-state (Odisha) migrant, unit-change, MC & others.
- **Attendance & shifts** — monthly muster with per-week breakdown, Saturdays and overtime; edits flow straight into pay.

### Pay
- **Three wage cycles** — **Monthly** (staff), **Weekly** and **Daily** (labour), unified in one payroll register.
- **Incentives** — *Incentive 1* (₹/Saturday worked, full if every Saturday) and *Incentive 2* (flat reward for 28+ days).
- **Advances & deductions** — salary advances with automatic monthly recovery, hostel **mess bills**, and other deductions.
- **Agent commission** — labour agents earn a per-worker monthly commission, paid **only while the worker attends properly** (absconding / long leave / frequent absence stops it).
- **Payroll & payslips** — earnings, PF/ESI/PT/TDS, incentives and deductions → net pay; payslip view + WhatsApp/Email dispatch; **NEFT bank-transfer** batches.

### Welfare & compliance
- **Health check** — height/weight (BMI), blood pressure, haemoglobin and periodic checkups, plus menstrual & maternity tracking for women workers (Factories-Act welfare).
- **Leave** — two-step manager → HR approval workflow.

### 🤖 Agentic HR AI (AI Command Centre)
- A **daily briefing** on login: present / on-leave / absent, production risk, average efficiency and planned output.
- **Coverage & auto-assignment** — when a supervisor or department head is on leave, the agent nominates a deputy and reassigns the team so output holds.
- **Unit status** — production, dyeing, quality, packing, machinery, sales, stores… present vs required strength, efficiency and output, with at-risk flags.
- **Alerts** — production risk, welfare, conduct/absconders, advances.
- **AI assistant** — ask in plain English ("how many on leave today?", "who covers the supervisors?", "how is dyeing doing?").

### Everywhere
- **Excel export** on every screen — the whole HR database is viewable and downloadable.

---

## 🚀 Getting started

```bash
npm install
npm run dev      # http://localhost:3000  → opens the HRMS
```

Sign in on the HRMS portal (demo login — pick any role). Build for production with `npm run build && npm start`.

## 🏭 Make it yours

All branding, the company name and the business rules live in one place:

- **`src/lib/company.ts`** — product name, tagline, and your **company** name / location / industry (shown on payslips, reports and Excel exports).
- **`src/lib/hr-master.ts`** — shifts, worker categories, mill sections, labour agents, **incentive amounts** and **commission rates**.
- **`src/lib/payroll.ts`** — statutory rates (PF/ESI/PT/TDS) and payslip components.

## 🗄️ Database (MySQL)

LoomHR runs standalone (browser storage) out of the box, and connects to **MySQL** when configured — the app auto-detects the database on load and shows a **DB · MySQL** badge in the header.

**One-time setup**
```bash
# 1. As MySQL root — creates the loomhr database + app user
mysql -u root -p < db/setup.sql
# 2. Create tables and load the seed workforce
npm run db:reset          # = db:migrate + db:seed
```
Connection settings live in `.env.local` (see `.env.example`). The backend is Next.js Route Handlers over a `mysql2` pool:
- `GET /api/health` — connection status + row counts
- `GET /api/state` / `PUT /api/state` — load / save the full HR dataset
- `POST /api/seed` — load the seed workforce

In-app, the **Database (MySQL)** page shows connection status and Seed / Load / Save controls. Schema: `src/lib/db-schema.ts`.

## 🖥️ Desktop app (Windows & macOS)

LoomHR ships as a desktop app that launches the server and **auto-connects to MySQL** on open. Build on the matching OS (electron-builder cannot cross-build a macOS `.dmg` from Windows):

```bash
npm run dist:win     # Windows  -> dist-desktop/LoomHR Setup <version>.exe   (run on Windows)
npm run dist:mac     # macOS    -> dist-desktop/LoomHR-<version>-arm64.dmg + x64.dmg   (run on a Mac)
npm run dist:linux   # Linux    -> dist-desktop/LoomHR-<version>.AppImage
```

Install and launch **LoomHR** — a splash appears while the embedded server starts and connects to the local MySQL, then the app opens.

### Build both from CI (no Mac needed)
A GitHub Actions workflow (`.github/workflows/desktop.yml`) builds **Windows and macOS** on their own runners. From the repo: **Actions → Desktop builds → Run workflow** to get both installers as downloadable artifacts, or push a tag (`git tag v1.0.0 && git push --tags`) to publish them to a GitHub Release. macOS builds are unsigned, so on first launch use **right-click → Open** to pass Gatekeeper.

DB credentials for the desktop app come from `db-config.json` placed next to the installed `LoomHR.exe` (falls back to the defaults in `.env.example`):
```json
{ "DB_HOST": "127.0.0.1", "DB_PORT": "3306", "DB_USER": "loomhr", "DB_PASSWORD": "LoomHr#2026", "DB_NAME": "loomhr" }
```

## 🧱 Tech

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Zustand · ExcelJS · ApexCharts · lucide-react.

## 📁 Structure

```
src/
  app/
    hr/
      login/            # HRMS portal sign-in
      (portal)/         # dashboard, ai, employees, attendance, leave,
                        # advances, incentives, agents, payroll, weekly,
                        # transfer, health, masters, reports
  components/           # UI kit + KPI/cards/forms/charts
  lib/                  # company config, payroll, excel, HR data, AI engine
  stores/               # HR state (Zustand, persisted)
```

---

*Sample data is fictional. Statutory rates and incentive/commission values are configurable and should be reviewed against current regulations before payroll use.*
