/**
 * HR portal data model — rich employee records for a garment/textile company.
 * Covers the full role spectrum, documents, qualification, tenure/experience,
 * salary + bank history (with bank changes), leave balances and statutory ids.
 * Modelled on Zoho People / Frappe HRMS employee master.
 */

import type { WorkerCategoryId, ConductStatus, WageType } from "@/lib/hr-master";
import { IMPORTED_EMPLOYEES } from "@/lib/imported-workforce";

export const GARMENT_ROLES = [
  "Chairman", "Managing Director", "CEO", "General Manager",
  "Factory Manager", "Production Manager", "HR Manager", "HR Executive",
  "Accounts Manager", "Marketing Head", "Sales Manager", "Store Manager",
  "Purchase Manager", "Quality Manager", "Maintenance Engineer",
  "Shift Supervisor", "Line Supervisor", "Cutting Master", "Tailoring Master",
  "Machine Operator", "Tailor", "Checker", "Ironing / Pressing",
  "Packing Staff", "Helper / Labour", "Security", "Housekeeping", "Driver",
] as const;

export type EmpStatus = "Active" | "On Notice" | "Probation" | "Exited";
export type EmpType = "Fresher" | "Experienced";

/**
 * Occupational + periodic health record. Every worker carries height/weight
 * (BMI) and a last-checkup date; women workers additionally carry menstrual /
 * maternity fields so the factory nurse can track well-being and eligibility
 * for lighter duty (mandated welfare monitoring under the Factories Act).
 */
export interface HealthRecord {
  heightCm?: number;
  weightKg?: number;
  bloodPressure?: string;
  hemoglobin?: number;      // g/dL — anaemia screening
  lastCheckup?: string;
  ailments?: string;
  // Women workers only:
  lastPeriodDate?: string;
  cycleDays?: number;
  pregnant?: boolean;
  pregnancyNote?: string;
}

export function bmi(h?: HealthRecord): number | null {
  if (!h?.heightCm || !h?.weightKg) return null;
  const m = h.heightCm / 100;
  return +(h.weightKg / (m * m)).toFixed(1);
}

export function bmiBand(v: number | null): { label: string; tone: "success" | "warning" | "danger" | "info" } {
  if (v === null) return { label: "—", tone: "info" };
  if (v < 18.5) return { label: "Underweight", tone: "warning" };
  if (v < 25) return { label: "Normal", tone: "success" };
  if (v < 30) return { label: "Overweight", tone: "warning" };
  return { label: "Obese", tone: "danger" };
}

export const DOC_TYPES = [
  "Aadhaar", "PAN", "Degree Certificate", "Experience Certificate", "Bank Passbook", "Photo", "Offer Letter",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export interface EmpDocument {
  type: DocType;
  number: string;
  submitted: boolean;
  verified: boolean;
  fileName?: string;  // uploaded file name
  dataUrl?: string;   // base64 data URL for preview / download (client-side upload)
}

/** A saved monthly wage-statement snapshot (from the payroll workbook / run). */
export interface EmpStatement {
  dw?: number; wagePerDay?: number;
  basic?: number; hra?: number; ma?: number; fda?: number; vda?: number; spl?: number; nfh?: number;
  otAmt?: number; incentive?: number; gross?: number;
  pf?: number; esi?: number; mess?: number; adv?: number; others?: number; lic?: number; pmDiff?: number; roundOff?: number; comm?: number;
  net?: number;
}

export interface SalaryYear {
  fy: string;
  monthlyGross: number;
  annualPaid: number;
  bank: string;
  account: string;
  creditedDay: string; // e.g. "1st of month"
}

export interface BankChange {
  bank: string;
  account: string;
  ifsc: string;
  from: string;
  to: string; // "Current" or a date
}

export interface HrEmployee {
  id: string;
  salutation: string;
  name: string;
  gender: "Male" | "Female";
  dob: string;
  bloodGroup: string;
  photo?: string;

  role: string;                 // GARMENT_ROLES value or a custom role
  department: string;
  section?: string;             // sub-section within the department
  grade: string;
  reportsTo: string;
  employmentType: EmpType;
  status: EmpStatus;
  doj: string;
  prevExpYears: number;
  prevExpDetail: string;

  phone: string;
  altPhone: string;
  email: string;
  address: string;              // permanent address
  temporaryAddress?: string;    // current / local address
  accommodation?: string;       // Company Bus / Hosteller / Hosteller + Mess / Own
  emergencyContact: string;
  emergencyPhone?: string;

  qualification: string;
  institution: string;
  passYear: number;

  aadhaar: string;
  pan: string;
  uan: string; // PF UAN
  esiNo: string;

  monthlyGross: number;
  ctc: number;

  // --- Textile-mill workforce fields (from the company wage workbook) -------
  wageType: WageType;
  category: WorkerCategoryId;      // Permanent / Hostel / Casual / Odisha …
  categoryOther?: string;          // custom label when category = MC_OTHERS
  shiftId: string;                 // SH-A … SH-G
  salaryPerDay?: number;           // day-wage rate (Daily / Weekly workers)
  agentId?: string;                // labour agent who supplied the worker
  conduct: ConductStatus;          // attendance conduct → agent commission
  pfApplicable?: boolean;          // PF/ESI deducted (default from category)
  tdsApplicable?: boolean;         // TDS deducted
  salaryStatus?: "Paid" | "Pending" | "On Hold";  // current salary status
  salaryStatusReason?: string;     // reason when Pending / On Hold
  tokenNo?: string;                // T.No / punch token on the wage statement
  deptCode?: string;               // short section code (A/C, QAD, SMX…)
  pfCode?: string;                 // [TN/SL/35086/xxxx] wage-statement code
  statement?: EmpStatement;        // saved statement figures (imported / last run)
  health?: HealthRecord;

  documents: EmpDocument[];
  salaryHistory: SalaryYear[];
  bankHistory: BankChange[];

  leave: { el: number; cl: number; sl: number; lopThisMonth: number };
}

const doc = (type: EmpDocument["type"], number: string, submitted = true, verified = true): EmpDocument =>
  ({ type, number, submitted, verified });

/** Full salary history for a tenured employee across 3 FYs. */
function history3(base: number, bankA: string, accA: string, bankB?: string, accB?: string): SalaryYear[] {
  return [
    { fy: "2023-24", monthlyGross: Math.round(base * 0.86), annualPaid: Math.round(base * 0.86 * 12), bank: bankA, account: accA, creditedDay: "1st of month" },
    { fy: "2024-25", monthlyGross: Math.round(base * 0.93), annualPaid: Math.round(base * 0.93 * 12), bank: bankB ?? bankA, account: accB ?? accA, creditedDay: "1st of month" },
    { fy: "2025-26", monthlyGross: base, annualPaid: base * 12, bank: bankB ?? bankA, account: accB ?? accA, creditedDay: "1st of month" },
  ];
}

/** The existing monthly-staff records, minus the mill-workforce fields which
 *  are filled in by `enrichStaff()` below. */
type StaffSeed = Omit<HrEmployee, "wageType" | "category" | "shiftId" | "salaryPerDay" | "agentId" | "conduct" | "health">;

const STAFF_SEED: StaffSeed[] = [
  {
    id: "EMP-0234", salutation: "Mr.", name: "E. Manoj", gender: "Male", dob: "1988-05-14", bloodGroup: "B+",
    role: "Maintenance Engineer", department: "Engineering", grade: "E2", reportsTo: "Factory Manager",
    employmentType: "Experienced", status: "Active", doj: "2019-03-11", prevExpYears: 6,
    prevExpDetail: "6 yrs — Lakshmi Machine Works (textile machinery service)",
    phone: "+91 98431 20034", altPhone: "+91 90470 11220", email: "manoj.e@bharattex.in",
    address: "24 Gandhi Nagar, Tiruppur 641603, Tamil Nadu", emergencyContact: "Wife — Latha +91 90470 11220",
    qualification: "B.E. Mechanical", institution: "Anna University", passYear: 2010,
    aadhaar: "4471 2234 8890", pan: "AKMPM2234K", uan: "100234567890", esiNo: "5001234567",
    monthlyGross: 45600, ctc: 612000,
    documents: [doc("Aadhaar", "4471 2234 8890"), doc("PAN", "AKMPM2234K"), doc("Degree Certificate", "AU/ME/2010/8841"), doc("Experience Certificate", "LMW/EXP/2019"), doc("Bank Passbook", "HDFC ...4471"), doc("Photo", "IMG-0234")],
    salaryHistory: history3(45600, "HDFC Bank", "50100...4471"),
    bankHistory: [{ bank: "HDFC Bank", account: "50100...4471", ifsc: "HDFC0001234", from: "2019-03-11", to: "Current" }],
    leave: { el: 9, cl: 4, sl: 5, lopThisMonth: 0 },
  },
  {
    id: "EMP-0388", salutation: "Mr.", name: "V. Prakash", gender: "Male", dob: "1985-11-02", bloodGroup: "O+",
    role: "Shift Supervisor", department: "Preparatory", grade: "S1", reportsTo: "Production Manager",
    employmentType: "Experienced", status: "Active", doj: "2015-06-01", prevExpYears: 8,
    prevExpDetail: "8 yrs — KPR Mill (spinning supervision)",
    phone: "+91 98942 33110", altPhone: "—", email: "prakash.v@bharattex.in",
    address: "8 Mangalam Rd, Tiruppur 641604, Tamil Nadu", emergencyContact: "Brother — Suresh +91 98942 44220",
    qualification: "Diploma — Textile Technology", institution: "PSG Polytechnic", passYear: 2005,
    aadhaar: "7781 5566 1122", pan: "AQPPP5566L", uan: "100388112233", esiNo: "5003881122",
    monthlyGross: 38200, ctc: 512000,
    documents: [doc("Aadhaar", "7781 5566 1122"), doc("PAN", "AQPPP5566L"), doc("Degree Certificate", "PSG/DTT/2005"), doc("Experience Certificate", "KPR/EXP/2015"), doc("Bank Passbook", "ICICI ...3388"), doc("Photo", "IMG-0388")],
    salaryHistory: history3(38200, "SBI", "3011...9911", "ICICI Bank", "6023...3388"),
    bankHistory: [
      { bank: "SBI", account: "3011...9911", ifsc: "SBIN0004411", from: "2015-06-01", to: "2024-03-31" },
      { bank: "ICICI Bank", account: "6023...3388", ifsc: "ICIC0006023", from: "2024-04-01", to: "Current" },
    ],
    leave: { el: 11, cl: 6, sl: 5, lopThisMonth: 0 },
  },
  {
    id: "EMP-0412", salutation: "Mr.", name: "R. Muthukumar", gender: "Male", dob: "1992-07-19", bloodGroup: "A+",
    role: "Machine Operator", department: "Ring Frame", grade: "W2", reportsTo: "Shift Supervisor",
    employmentType: "Experienced", status: "Active", doj: "2021-08-16", prevExpYears: 3,
    prevExpDetail: "3 yrs — Bannari Amman Spinning (ring frame tenter)",
    phone: "+91 98430 11234", altPhone: "—", email: "muthu.r@bharattex.in",
    address: "15 Perumal Koil St, Tiruppur 641601, Tamil Nadu", emergencyContact: "Wife — Deepa +91 98430 55667",
    qualification: "10th Std", institution: "Govt Higher Sec School", passYear: 2008,
    aadhaar: "2210 8834 5567", pan: "BXMPM8834P", uan: "100412334455", esiNo: "5004123344",
    monthlyGross: 26500, ctc: 342000,
    documents: [doc("Aadhaar", "2210 8834 5567"), doc("PAN", "BXMPM8834P"), doc("Experience Certificate", "BASM/EXP/2021"), doc("Bank Passbook", "HDFC ...1122"), doc("Photo", "IMG-0412"), doc("Degree Certificate", "—", false, false)],
    salaryHistory: history3(26500, "HDFC Bank", "50100...1122"),
    bankHistory: [{ bank: "HDFC Bank", account: "50100...1122", ifsc: "HDFC0001234", from: "2021-08-16", to: "Current" }],
    leave: { el: 8, cl: 5, sl: 4, lopThisMonth: 0 },
  },
  {
    id: "EMP-0521", salutation: "Ms.", name: "A. Devi", gender: "Female", dob: "1994-02-28", bloodGroup: "B+",
    role: "Quality Manager", department: "Quality", grade: "E2", reportsTo: "Factory Manager",
    employmentType: "Experienced", status: "Active", doj: "2020-01-06", prevExpYears: 4,
    prevExpDetail: "4 yrs — SICO Labs (yarn testing)",
    phone: "+91 90031 22110", altPhone: "—", email: "devi.a@bharattex.in",
    address: "42 Kamaraj Rd, Tiruppur 641602, Tamil Nadu", emergencyContact: "Father — Arumugam +91 90031 33220",
    qualification: "M.Sc. Textile Chemistry", institution: "Bharathiar University", passYear: 2016,
    aadhaar: "9911 2233 4455", pan: "CDLPA2233M", uan: "100521445566", esiNo: "—",
    monthlyGross: 41000, ctc: 552000,
    documents: [doc("Aadhaar", "9911 2233 4455"), doc("PAN", "CDLPA2233M"), doc("Degree Certificate", "BU/MSC/2016"), doc("Experience Certificate", "SICO/EXP/2020"), doc("Bank Passbook", "HDFC ...5521"), doc("Photo", "IMG-0521")],
    salaryHistory: history3(41000, "HDFC Bank", "50100...5521"),
    bankHistory: [{ bank: "HDFC Bank", account: "50100...5521", ifsc: "HDFC0001234", from: "2020-01-06", to: "Current" }],
    leave: { el: 12, cl: 6, sl: 6, lopThisMonth: 0 },
  },
  {
    id: "EMP-0467", salutation: "Ms.", name: "S. Kavitha", gender: "Female", dob: "1996-09-10", bloodGroup: "O-",
    role: "Checker", department: "Auto Coner", grade: "W1", reportsTo: "Line Supervisor",
    employmentType: "Experienced", status: "Active", doj: "2022-11-21", prevExpYears: 2,
    prevExpDetail: "2 yrs — Eastman Exports (garment checking)",
    phone: "+91 90470 33221", altPhone: "—", email: "kavitha.s@bharattex.in",
    address: "3 Anna Nagar, Tiruppur 641603, Tamil Nadu", emergencyContact: "Mother — Selvi +91 90470 44330",
    qualification: "12th Std", institution: "Govt Girls Hr Sec School", passYear: 2013,
    aadhaar: "5566 7788 9900", pan: "DKMPK7788Q", uan: "100467556677", esiNo: "5004675566",
    monthlyGross: 24800, ctc: 318000,
    documents: [doc("Aadhaar", "5566 7788 9900"), doc("PAN", "DKMPK7788Q"), doc("Experience Certificate", "EE/EXP/2022"), doc("Bank Passbook", "Canara ...4467"), doc("Photo", "IMG-0467"), doc("Degree Certificate", "—", false, false)],
    salaryHistory: [
      { fy: "2024-25", monthlyGross: 22800, annualPaid: 273600, bank: "Canara Bank", account: "1109...4467", creditedDay: "1st of month" },
      { fy: "2025-26", monthlyGross: 24800, annualPaid: 297600, bank: "Canara Bank", account: "1109...4467", creditedDay: "1st of month" },
    ],
    bankHistory: [{ bank: "Canara Bank", account: "1109...4467", ifsc: "CNRB0001109", from: "2022-11-21", to: "Current" }],
    leave: { el: 6, cl: 4, sl: 3, lopThisMonth: 1 },
  },
  {
    id: "EMP-0501", salutation: "Mr.", name: "M. Ibrahim", gender: "Male", dob: "1990-12-05", bloodGroup: "AB+",
    role: "Store Manager", department: "Stores", grade: "E1", reportsTo: "Factory Manager",
    employmentType: "Experienced", status: "Active", doj: "2018-05-14", prevExpYears: 5,
    prevExpDetail: "5 yrs — Precot Meridian (raw material stores)",
    phone: "+91 98652 11009", altPhone: "—", email: "ibrahim.m@bharattex.in",
    address: "19 Khaderpet, Tiruppur 641601, Tamil Nadu", emergencyContact: "Wife — Fathima +91 98652 22118",
    qualification: "B.Com", institution: "Bharathiar University", passYear: 2011,
    aadhaar: "3344 5566 7788", pan: "EFMPI5566R", uan: "100501667788", esiNo: "—",
    monthlyGross: 27400, ctc: 358000,
    documents: [doc("Aadhaar", "3344 5566 7788"), doc("PAN", "EFMPI5566R"), doc("Degree Certificate", "BU/BCOM/2011"), doc("Experience Certificate", "PM/EXP/2018"), doc("Bank Passbook", "Axis ...5501"), doc("Photo", "IMG-0501")],
    salaryHistory: history3(27400, "Axis Bank", "9110...5501"),
    bankHistory: [{ bank: "Axis Bank", account: "9110...5501", ifsc: "UTIB0009110", from: "2018-05-14", to: "Current" }],
    leave: { el: 10, cl: 5, sl: 5, lopThisMonth: 0 },
  },
  {
    id: "EMP-0299", salutation: "Ms.", name: "P. Lakshmi", gender: "Female", dob: "1998-04-22", bloodGroup: "A-",
    role: "Packing Staff", department: "Packing", grade: "W1", reportsTo: "Line Supervisor",
    employmentType: "Fresher", status: "Probation", doj: "2025-11-03", prevExpYears: 0,
    prevExpDetail: "Fresher — first job",
    phone: "+91 90032 44551", altPhone: "—", email: "lakshmi.p@bharattex.in",
    address: "7 Kumaran Nagar, Tiruppur 641604, Tamil Nadu", emergencyContact: "Father — Palani +91 90032 55662",
    qualification: "12th Std", institution: "Govt Hr Sec School", passYear: 2016,
    aadhaar: "8899 0011 2233", pan: "GHMPL0011S", uan: "100299001122", esiNo: "5002990011",
    monthlyGross: 22100, ctc: 282000,
    documents: [doc("Aadhaar", "8899 0011 2233"), doc("PAN", "GHMPL0011S"), doc("Bank Passbook", "IOB ...2299"), doc("Photo", "IMG-0299"), doc("Degree Certificate", "—", false, false), doc("Experience Certificate", "—", false, false)],
    salaryHistory: [
      { fy: "2025-26", monthlyGross: 22100, annualPaid: 176800, bank: "Indian Overseas Bank", account: "0044...2299", creditedDay: "1st of month" },
    ],
    bankHistory: [{ bank: "Indian Overseas Bank", account: "0044...2299", ifsc: "IOBA0000044", from: "2025-11-03", to: "Current" }],
    leave: { el: 2, cl: 3, sl: 2, lopThisMonth: 1 },
  },
  {
    id: "EMP-0102", salutation: "Mr.", name: "K. Srinivas", gender: "Male", dob: "1982-03-18", bloodGroup: "B+",
    role: "Marketing Head", department: "Sales & Marketing", grade: "M1", reportsTo: "CEO",
    employmentType: "Experienced", status: "Active", doj: "2014-02-10", prevExpYears: 10,
    prevExpDetail: "10 yrs — Arvind Ltd (yarn marketing, export)",
    phone: "+91 98400 55112", altPhone: "—", email: "srinivas.k@bharattex.in",
    address: "56 Avinashi Rd, Tiruppur 641602, Tamil Nadu", emergencyContact: "Wife — Radha +91 98400 66223",
    qualification: "MBA — Marketing", institution: "PSG Institute of Management", passYear: 2006,
    aadhaar: "1122 3344 5566", pan: "IJMPS3344T", uan: "100102334455", esiNo: "—",
    monthlyGross: 92000, ctc: 1280000,
    documents: [doc("Aadhaar", "1122 3344 5566"), doc("PAN", "IJMPS3344T"), doc("Degree Certificate", "PSG/MBA/2006"), doc("Experience Certificate", "ARV/EXP/2014"), doc("Bank Passbook", "HDFC ...0102"), doc("Photo", "IMG-0102")],
    salaryHistory: history3(92000, "HDFC Bank", "50100...0102"),
    bankHistory: [{ bank: "HDFC Bank", account: "50100...0102", ifsc: "HDFC0001234", from: "2014-02-10", to: "Current" }],
    leave: { el: 14, cl: 6, sl: 6, lopThisMonth: 0 },
  },
  {
    id: "EMP-0055", salutation: "Ms.", name: "R. Anitha", gender: "Female", dob: "1987-06-30", bloodGroup: "O+",
    role: "HR Manager", department: "Human Resources", grade: "M1", reportsTo: "CEO",
    employmentType: "Experienced", status: "Active", doj: "2016-09-05", prevExpYears: 7,
    prevExpDetail: "7 yrs — SCM Garments (HR & IR)",
    phone: "+91 98941 00551", altPhone: "—", email: "anitha.r@bharattex.in",
    address: "11 Nehru St, Tiruppur 641601, Tamil Nadu", emergencyContact: "Husband — Karthik +91 98941 11662",
    qualification: "MBA — HR", institution: "Bharathiar University", passYear: 2009,
    aadhaar: "6677 8899 0011", pan: "KLMPA8899U", uan: "100055889900", esiNo: "—",
    monthlyGross: 68000, ctc: 920000,
    documents: [doc("Aadhaar", "6677 8899 0011"), doc("PAN", "KLMPA8899U"), doc("Degree Certificate", "BU/MBA/2009"), doc("Experience Certificate", "SCM/EXP/2016"), doc("Bank Passbook", "ICICI ...0055"), doc("Photo", "IMG-0055")],
    salaryHistory: history3(68000, "ICICI Bank", "6023...0055"),
    bankHistory: [{ bank: "ICICI Bank", account: "6023...0055", ifsc: "ICIC0006023", from: "2016-09-05", to: "Current" }],
    leave: { el: 13, cl: 6, sl: 6, lopThisMonth: 0 },
  },
  {
    id: "EMP-0601", salutation: "Mr.", name: "T. Ilango", gender: "Male", dob: "1983-08-08", bloodGroup: "A+",
    role: "Production Manager", department: "Production", grade: "M2", reportsTo: "Factory Manager",
    employmentType: "Experienced", status: "Active", doj: "2013-07-22", prevExpYears: 9,
    prevExpDetail: "9 yrs — Super Spinning Mills (production)",
    phone: "+91 98652 66010", altPhone: "—", email: "ilango.t@bharattex.in",
    address: "27 Kongu Nagar, Tiruppur 641607, Tamil Nadu", emergencyContact: "Wife — Kala +91 98652 77121",
    qualification: "B.Tech Textile Technology", institution: "Anna University", passYear: 2004,
    aadhaar: "2233 4455 6677", pan: "MNMPI4455V", uan: "100601445566", esiNo: "—",
    monthlyGross: 78000, ctc: 1050000,
    documents: [doc("Aadhaar", "2233 4455 6677"), doc("PAN", "MNMPI4455V"), doc("Degree Certificate", "AU/BT/2004"), doc("Experience Certificate", "SSM/EXP/2013"), doc("Bank Passbook", "HDFC ...0601"), doc("Photo", "IMG-0601")],
    salaryHistory: history3(78000, "HDFC Bank", "50100...0601"),
    bankHistory: [{ bank: "HDFC Bank", account: "50100...0601", ifsc: "HDFC0001234", from: "2013-07-22", to: "Current" }],
    leave: { el: 12, cl: 5, sl: 6, lopThisMonth: 0 },
  },
  {
    id: "EMP-0733", salutation: "Mr.", name: "S. Bharath", gender: "Male", dob: "2001-01-15", bloodGroup: "B-",
    role: "Tailor", department: "Stitching", grade: "W1", reportsTo: "Tailoring Master",
    employmentType: "Fresher", status: "Probation", doj: "2026-06-01", prevExpYears: 0,
    prevExpDetail: "Fresher — ITI trade certificate",
    phone: "+91 90475 88770", altPhone: "—", email: "bharath.s@bharattex.in",
    address: "9 Velampalayam, Tiruppur 641652, Tamil Nadu", emergencyContact: "Father — Selvam +91 90475 99881",
    qualification: "ITI — Sewing Technology", institution: "Govt ITI Tiruppur", passYear: 2020,
    aadhaar: "9900 1122 3344", pan: "OPMPB1122W", uan: "100733112233", esiNo: "5007331122",
    monthlyGross: 20500, ctc: 262000,
    documents: [doc("Aadhaar", "9900 1122 3344"), doc("PAN", "OPMPB1122W"), doc("Degree Certificate", "ITI/ST/2020"), doc("Bank Passbook", "TMB ...0733"), doc("Photo", "IMG-0733"), doc("Experience Certificate", "—", false, false)],
    salaryHistory: [
      { fy: "2025-26", monthlyGross: 20500, annualPaid: 41000, bank: "Tamilnad Mercantile Bank", account: "5522...0733", creditedDay: "1st of month" },
    ],
    bankHistory: [{ bank: "Tamilnad Mercantile Bank", account: "5522...0733", ifsc: "TMBL0000552", from: "2026-06-01", to: "Current" }],
    leave: { el: 1, cl: 2, sl: 1, lopThisMonth: 0 },
  },
  {
    id: "EMP-0808", salutation: "Mr.", name: "D. Rajesh", gender: "Male", dob: "1979-10-25", bloodGroup: "O+",
    role: "Accounts Manager", department: "Accounts & Finance", grade: "M1", reportsTo: "CEO",
    employmentType: "Experienced", status: "Active", doj: "2012-04-02", prevExpYears: 12,
    prevExpDetail: "12 yrs — CA firm + Loyal Textiles (finance)",
    phone: "+91 98430 80080", altPhone: "—", email: "rajesh.d@bharattex.in",
    address: "34 RKV Rd, Tiruppur 641604, Tamil Nadu", emergencyContact: "Wife — Meena +91 98430 90091",
    qualification: "M.Com, CA (Inter)", institution: "ICAI / Bharathiar University", passYear: 2003,
    aadhaar: "4455 6677 8899", pan: "QRMPR6677X", uan: "100808667788", esiNo: "—",
    monthlyGross: 85000, ctc: 1150000,
    documents: [doc("Aadhaar", "4455 6677 8899"), doc("PAN", "QRMPR6677X"), doc("Degree Certificate", "ICAI/2003"), doc("Experience Certificate", "LT/EXP/2012"), doc("Bank Passbook", "SBI ...0808"), doc("Photo", "IMG-0808")],
    salaryHistory: history3(85000, "SBI", "3011...0808"),
    bankHistory: [{ bank: "SBI", account: "3011...0808", ifsc: "SBIN0004411", from: "2012-04-02", to: "Current" }],
    leave: { el: 13, cl: 6, sl: 6, lopThisMonth: 0 },
  },
];

// ---- Enrich monthly staff with mill-workforce defaults ---------------------

function staffCategory(role: string): WorkerCategoryId {
  const g = roleGroup(role);
  if (g === "Management" || g === "Staff") return "STAFF";
  if (g === "Supervisor") return "SEMISTAFF";
  return "PERMANENT";
}

const STAFF: HrEmployee[] = STAFF_SEED.map((e) => ({
  ...e,
  wageType: "Monthly" as const,
  category: e.status === "Probation" && e.employmentType === "Fresher" ? ("APPRENTICE" as WorkerCategoryId) : staffCategory(e.role),
  shiftId: roleGroup(e.role) === "Worker" ? "SH-A" : "SH-G",
  conduct: "Proper" as ConductStatus,
  health:
    e.gender === "Female"
      ? { heightCm: 158, weightKg: 55, bloodPressure: "118/78", hemoglobin: 12.4, lastCheckup: "2026-06-10", lastPeriodDate: "2026-07-05", cycleDays: 29, pregnant: false }
      : { heightCm: 170, weightKg: 68, bloodPressure: "122/80", hemoglobin: 14.1, lastCheckup: "2026-06-10" },
}));

// ---- Daily-wage mill workforce (labour) ------------------------------------
// Doffers, tenters, siders, cleaners, hostel & casual labour and Odisha
// migrants supplied by agents — the population the wage sheet is really about.

function dayWorker(o: {
  id: string; name: string; gender: "Male" | "Female"; dob: string;
  role: HrEmployee["role"]; department: string; category: WorkerCategoryId;
  shiftId: string; rate: number; doj: string; agentId?: string;
  conduct?: ConductStatus; status?: EmpStatus; phone: string; place: string;
  aadhaar: string; bank: string; acct: string; ifsc: string;
  health?: HealthRecord; wageType?: WageType;
}): HrEmployee {
  const monthly = o.rate * 26; // ~26 working days
  return {
    id: o.id, salutation: o.gender === "Female" ? "Ms." : "Mr.", name: o.name, gender: o.gender,
    dob: o.dob, bloodGroup: "O+",
    role: o.role, department: o.department, grade: "W1", reportsTo: "Line Supervisor",
    employmentType: "Experienced", status: o.status ?? "Active", doj: o.doj, prevExpYears: 1,
    prevExpDetail: "Prior mill labour", phone: o.phone, altPhone: "—",
    email: "—", address: `${o.place}`, emergencyContact: "—",
    qualification: "—", institution: "—", passYear: 0,
    aadhaar: o.aadhaar, pan: "—", uan: "—", esiNo: "—",
    monthlyGross: monthly, ctc: monthly * 12,
    wageType: o.wageType ?? "Daily", category: o.category, shiftId: o.shiftId, salaryPerDay: o.rate,
    agentId: o.agentId, conduct: o.conduct ?? "Proper",
    health: o.health ?? (o.gender === "Female"
      ? { heightCm: 156, weightKg: 52, bloodPressure: "116/76", hemoglobin: 11.8, lastCheckup: "2026-06-15", lastPeriodDate: "2026-07-02", cycleDays: 28, pregnant: false }
      : { heightCm: 168, weightKg: 63, bloodPressure: "120/80", hemoglobin: 13.6, lastCheckup: "2026-06-15" }),
    documents: [{ type: "Aadhaar", number: o.aadhaar, submitted: true, verified: true }, { type: "Bank Passbook", number: `${o.bank} …${o.acct.slice(-4)}`, submitted: true, verified: true }, { type: "Photo", number: `IMG-${o.id.slice(-4)}`, submitted: true, verified: false }],
    salaryHistory: [{ fy: "2025-26", monthlyGross: monthly, annualPaid: monthly * 8, bank: o.bank, account: o.acct, creditedDay: "7th of month" }],
    bankHistory: [{ bank: o.bank, account: o.acct, ifsc: o.ifsc, from: o.doj, to: "Current" }],
    leave: { el: 0, cl: 2, sl: 2, lopThisMonth: 0 },
  };
}

const LABOUR: HrEmployee[] = [
  dayWorker({ id: "EMP-1001", name: "B. Santosh Behera", gender: "Male", dob: "1998-03-12", role: "Helper / Labour", department: "Doffing Contract", category: "ODISHA", shiftId: "SH-A", rate: 620, doj: "2024-02-01", agentId: "AGT-01", phone: "+91 90409 22001", place: "Hostel Block A, Bharat Mill", aadhaar: "6201 1122 3344", bank: "SBI", acct: "3011...1001", ifsc: "SBIN0004411" }),
  dayWorker({ id: "EMP-1002", name: "P. Rajkishore Nayak", gender: "Male", dob: "1996-07-08", role: "Machine Operator", department: "Ring Frame", category: "ODISHA", shiftId: "SH-B", rate: 680, doj: "2023-11-15", agentId: "AGT-03", phone: "+91 90738 22002", place: "Hostel Block A, Bharat Mill", aadhaar: "6202 2233 4455", bank: "SBI", acct: "3011...1002", ifsc: "SBIN0004411" }),
  dayWorker({ id: "EMP-1003", name: "L. Sunita Pradhan", gender: "Female", dob: "2000-01-20", role: "Checker", department: "Auto Coner", category: "ODISHA", shiftId: "SH-A", rate: 600, doj: "2024-05-10", agentId: "AGT-01", phone: "+91 90409 22003", place: "Hostel Block B (Ladies), Bharat Mill", aadhaar: "6203 3344 5566", bank: "SBI", acct: "3011...1003", ifsc: "SBIN0004411", health: { heightCm: 154, weightKg: 48, bloodPressure: "110/72", hemoglobin: 10.9, lastCheckup: "2026-07-01", lastPeriodDate: "2026-06-28", cycleDays: 30, pregnant: false, ailments: "Mild anaemia — iron supplements" } }),
  dayWorker({ id: "EMP-1004", name: "K. Manas Sahoo", gender: "Male", dob: "1995-09-30", role: "Helper / Labour", department: "Bale Contract", category: "ODISHA", shiftId: "SH-D", rate: 700, doj: "2023-06-01", agentId: "AGT-03", conduct: "Absconded", status: "Exited", phone: "+91 90738 22004", place: "Hostel Block A, Bharat Mill", aadhaar: "6204 4455 6677", bank: "SBI", acct: "3011...1004", ifsc: "SBIN0004411" }),
  dayWorker({ id: "EMP-1005", name: "M. Arjun", gender: "Male", dob: "1999-04-18", role: "Machine Operator", department: "Ring Frame", category: "HOSTEL_BOYS", shiftId: "SH-C", rate: 640, doj: "2024-08-20", agentId: "AGT-02", phone: "+91 98942 22005", place: "Hostel Block A, Bharat Mill", aadhaar: "6205 5566 7788", bank: "TMB", acct: "5522...1005", ifsc: "TMBL0000552" }),
  dayWorker({ id: "EMP-1006", name: "S. Vetrivel", gender: "Male", dob: "1997-12-02", role: "Machine Operator", department: "Carding", category: "HOSTEL_BOYS", shiftId: "SH-B", rate: 630, doj: "2024-03-05", agentId: "AGT-02", conduct: "Long Leave", phone: "+91 98942 22006", place: "Hostel Block A, Bharat Mill", aadhaar: "6206 6677 8899", bank: "TMB", acct: "5522...1006", ifsc: "TMBL0000552" }),
  dayWorker({ id: "EMP-1007", name: "R. Malliga", gender: "Female", dob: "2001-06-14", role: "Checker", department: "Auto Coner", category: "HOSTEL_GIRLS", shiftId: "SH-A", rate: 590, doj: "2024-07-11", agentId: "AGT-04", phone: "+91 90031 22007", place: "Hostel Block B (Ladies), Bharat Mill", aadhaar: "6207 7788 9900", bank: "Canara Bank", acct: "1109...1007", ifsc: "CNRB0001109", health: { heightCm: 157, weightKg: 50, bloodPressure: "112/74", hemoglobin: 11.2, lastCheckup: "2026-07-05", lastPeriodDate: "2026-07-10", cycleDays: 27, pregnant: false } }),
  dayWorker({ id: "EMP-1008", name: "T. Kalaiselvi", gender: "Female", dob: "1993-02-25", role: "Packing Staff", department: "Packing", category: "HOSTEL_GIRLS", shiftId: "SH-G", rate: 610, doj: "2022-09-01", agentId: "AGT-04", phone: "+91 90031 22008", place: "Hostel Block B (Ladies), Bharat Mill", aadhaar: "6208 8899 0011", bank: "Canara Bank", acct: "1109...1008", ifsc: "CNRB0001109", health: { heightCm: 160, weightKg: 64, bloodPressure: "124/82", hemoglobin: 12.1, lastCheckup: "2026-06-20", lastPeriodDate: "2026-06-15", cycleDays: 31, pregnant: true, pregnancyNote: "2nd trimester — assigned lighter packing duty; maternity leave planned Oct 2026" } }),
  dayWorker({ id: "EMP-1009", name: "G. Murugesan", gender: "Male", dob: "1988-08-08", role: "Helper / Labour", department: "Cleaning (CLG)", category: "CASUAL_GENTS", shiftId: "SH-G", rate: 550, doj: "2025-01-10", wageType: "Weekly", phone: "+91 90475 22009", place: "34 Kamaraj Nagar, Tiruppur", aadhaar: "6209 9900 1122", bank: "IOB", acct: "0044...1009", ifsc: "IOBA0000044" }),
  dayWorker({ id: "EMP-1010", name: "V. Bhuvana", gender: "Female", dob: "1990-11-19", role: "Helper / Labour", department: "General Workers", category: "CASUAL_LADIES", shiftId: "SH-G", rate: 530, doj: "2025-02-15", wageType: "Weekly", conduct: "Frequent Absent", phone: "+91 90475 22010", place: "12 Anna Nagar, Tiruppur", aadhaar: "6210 0011 2233", bank: "IOB", acct: "0044...1010", ifsc: "IOBA0000044", health: { heightCm: 152, weightKg: 58, bloodPressure: "128/84", hemoglobin: 11.5, lastCheckup: "2026-05-30", lastPeriodDate: "2026-07-08", cycleDays: 26, pregnant: false } }),
  dayWorker({ id: "EMP-1011", name: "A. Karthik", gender: "Male", dob: "2003-05-05", role: "Tailor", department: "Preparatory", category: "APPRENTICE", shiftId: "SH-A", rate: 480, doj: "2026-01-05", wageType: "Weekly", status: "Probation", phone: "+91 90475 22011", place: "Govt ITI Hostel, Tiruppur", aadhaar: "6211 1122 3344", bank: "TMB", acct: "5522...1011", ifsc: "TMBL0000552" }),
  dayWorker({ id: "EMP-1012", name: "N. Selvakumar", gender: "Male", dob: "1985-10-22", role: "Driver", department: "Driver", category: "UNIT_CHANGE", shiftId: "SH-G", rate: 720, doj: "2020-04-01", phone: "+91 98430 22012", place: "Transferred from Unit-2, Palladam", aadhaar: "6212 2233 4455", bank: "HDFC Bank", acct: "50100...1012", ifsc: "HDFC0001234" }),
];

/** Combined workforce master — curated demo staff + labour + the real
 *  workforce imported from the company payroll workbook. */
export const HR_EMPLOYEES: HrEmployee[] = [...STAFF, ...LABOUR, ...IMPORTED_EMPLOYEES];

// ---- Derived helpers -------------------------------------------------------

const TODAY = new Date("2026-07-19");

export function tenure(doj: string): { years: number; months: number; days: number; totalDays: number; label: string } {
  const start = new Date(doj);
  const totalDays = Math.floor((TODAY.getTime() - start.getTime()) / 86400000);
  let years = TODAY.getFullYear() - start.getFullYear();
  let months = TODAY.getMonth() - start.getMonth();
  let days = TODAY.getDate() - start.getDate();
  if (days < 0) { months -= 1; days += 30; }
  if (months < 0) { years -= 1; months += 12; }
  const label = years > 0 ? `${years}y ${months}m` : `${months}m ${days}d`;
  return { years, months, days, totalDays, label };
}

export function totalExperience(emp: HrEmployee): number {
  return +(tenure(emp.doj).totalDays / 365 + emp.prevExpYears).toFixed(1);
}

export function roleGroup(role: string): "Management" | "Staff" | "Supervisor" | "Worker" | "Support" {
  if (["Chairman", "Managing Director", "CEO", "General Manager", "Factory Manager", "Production Manager", "HR Manager", "Accounts Manager", "Marketing Head", "Sales Manager", "Store Manager", "Purchase Manager", "Quality Manager"].includes(role)) return "Management";
  if (["HR Executive", "Maintenance Engineer"].includes(role)) return "Staff";
  if (["Shift Supervisor", "Line Supervisor", "Cutting Master", "Tailoring Master"].includes(role)) return "Supervisor";
  if (["Machine Operator", "Tailor", "Checker", "Ironing / Pressing", "Packing Staff", "Helper / Labour"].includes(role)) return "Worker";
  return "Support";
}
