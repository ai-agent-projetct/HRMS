/**
 * Company & product configuration.
 *
 * LoomHR is a workforce/HRMS platform built for Indian production units —
 * textile mills, spinning, weaving/looms, dyeing houses, garment and thread
 * manufacturers. Everything visible (brand, company, statutory rates,
 * incentive & commission rules) is configured from here.
 *
 * 👉 To deploy for your own company, edit the COMPANY block below.
 */

export const COMPANY = {
  /** Legal name — appears on payslips, reports and Excel exports. */
  name: "Bharat Textile & Spinning Mills",
  /** Short name used in tight spaces. */
  shortName: "Bharat Textiles",
  /** Email domain for auto-generated staff addresses. */
  domain: "bharattex.in",
  /** Head-office / mill location. */
  location: "Tiruppur, Tamil Nadu",
  /** Industry line (shown on the sign-in screen). */
  industry: "Spinning · Weaving · Dyeing",
} as const;

export const PRODUCT = {
  /** Product / app name shown in the sidebar, login and browser title. */
  name: "LoomHR",
  /** One-line positioning. */
  tagline: "HRMS for textile, spinning, weaving & dyeing production units",
  /** Longer marketing line for the login hero. */
  blurb:
    "Workforce master, shifts & attendance, day/weekly/monthly wages, incentives, agent commission, advances, health & welfare, payroll and an agentic AI daily briefing — one people platform for Indian production units.",
} as const;
