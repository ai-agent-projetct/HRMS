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
