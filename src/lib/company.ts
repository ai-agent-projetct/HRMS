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
  name: "Mehala Carona Textiles (P) Ltd.",
  /** Short name used in tight spaces. */
  shortName: "Mehala Carona",
  /** Email domain for auto-generated staff addresses. */
  domain: "mehalacarona.in",
  /** Head-office / mill location. */
  location: "Sathy Pirivu, Gobichettipalayam - 638453, Tamil Nadu",
  /** Industry line (shown on the sign-in screen). */
  industry: "Spinning · Knitting · Weaving",
} as const;

export const PRODUCT = {
  /** Product / app name shown in the sidebar, login and browser title. */
  name: "Mehala Carona HRMS",
  /** One-line positioning. */
  tagline: "HRMS for Mehala Carona Textiles — spinning, knitting & production units",
  /** Longer marketing line for the login hero. */
  blurb:
    "Workforce master, shifts & attendance, day/weekly/monthly wages, incentives, agent commission, advances, health & welfare, payroll and an agentic AI daily briefing — one people platform for Indian production units.",
} as const;
