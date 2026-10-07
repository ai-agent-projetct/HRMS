# Mill Excel → HRMS: decoded formulas & data model

Analysis of the four live workbooks the mill runs its payroll on, and how they
map into this app. Every formula below is reproduced by `src/lib/mill-wages.ts`
and verified against real rows by `scripts/check-mill-wages.ts` (27/27 pass).

## The workbooks

| File | What it is |
|---|---|
| `COTT20-2026.xls` | Master **monthly wage register**, one sheet per month SEP'20→AUG-26 (~66–80 cols each) + COMMISSION, BONUS, Inc, denomination sheets. |
| `AUG-26-SS.xlsx` | Aug-26 **salary statement** — same layout as the master's AUG-26 sheet (72 cols). Left = data table; right = printable 8-up wage slips. |
| `WEEKLY-SEP-26.xlsx` | **Weekly** wage sheets, **Friday→Thursday** windows (`25 TO 01`, `04 TO 10`, `11 TO 17`, `18 TO 24`). Day-wage / casual workers. |
| `OCT-26-ATT.xlsx` | **Daily attendance musters** per unit (`UNIT-1`, `UNIT-2`) + movement sheets (`ONROLL`, `NEW-JOIN`, `RE-JOIN`, `LEFT`, `SS&APP`, `KNITT`, `MESS`). |

## Shift marks (match the app's codes exactly)

`D` Day (07–15) · `H` Half-night (15–23) · `F` Full-night (23–07) ·
`X` Day-12h (07–19) · `Y` Night-12h (19–07) · `G` General (08–17:30) ·
`A` / blank = Absent. The muster records the shift letter worked each day (or
`A`); OT hours sit in the paired column next to each day.

## Monthly register (permanent staff) — `computeMonthly`

Columns: AG(agent) · SL · T.NO · NAME · ESI · PF · AADHAR · MOB · **D.O.J** ·
**LEFT** · **DEPT** · **W/D**(rate) · **DW**(days) · T.WAG · **OT** · OTW ·
**INCEN** · GROSS · ESI · ADV · OTH · CANT · AGENT · 15SC · R.OFF · **NETPAY** · STATUS.

```
T.WAGE    = ROUND(rate × days, 0)
OT wage   = ROUNDUP(rate/12 × OThrs, 0)          # monthly OT basis = 12h
INCENTIVE = days 26–27 → ×15 ; days 28–31 → ×30 ; else 0
GROSS     = ROUNDUP(T.WAGE + OTwage + INCENTIVE, 0)
AGENT     = days × 10                            # withheld from net
15SC      = (left ? 0 : days × 15)               # tracking column, not in net
NET       = MROUND(GROSS − ESI − ADV − OTH − CANT − AGENT, 10)
```
Verified: 19d@550 → net 10200 · 28d@550,9OT → incen 840, net 16170.

## Weekly register (day-wage / casual) — `computeWeekly`

Per row: 7 day-pairs Fri→Thu (shift letter + OT hrs), then D/H/F/G counts,
BUS FARE rate, NT(=H+F), SUN flag, INC rate, WKD, W/DAY(rate), and the money
columns. **Index 2 (Sunday) is the compulsory day.**

```
WKD      = count(D)+count(H)+count(F)+count(G)
nights   = count(H)+count(F)
T.WAGES  = rate × WKD
OT amt   = rate/8 × ΣOT                           # weekly OT basis = 8h
INCEN-1  = (Sunday≠"A" ? 1:0) × (WKD≥5 ? 30:0) × WKD   # attendance incentive
INCEN-2  = nights × 10                            # casual-ladies H/F night incentive
BUS FARE = busFarePerDay × WKD
GROSS    = T.WAGES + OTamt + INCEN-1 + INCEN-2 + BUS FARE
NET      = MROUND(GROSS − mess − adv − others, 10)
```
₹30 and ₹10 are the mill defaults and are editable. Verified: 5d+Sun → incen1
150; 6d but Sun absent → 0; 3d → 0; 5 nights → incen2 50. Net also drives a
₹500/100/50/20/10 **denomination** breakdown (`denominations()`).

## Movement / on-roll (OCT-26-ATT)

`ONROLL` is a category × unit matrix: **Closing = Opening + New-Join + Re-join −
Left** per category (SEMI STAFF, PERMANENT, APPRENTICE, HOSTEL GIRLS/BOYS, …)
across UNIT-1 / UNIT-2 / KNIT / GENERAL. `NEW-JOIN` / `RE-JOIN` / `LEFT` are the
detail lists (token, name, dept, grade, unit, date). This mirrors the app's
existing Movement ledger and On-roll report.

## Identity & master fields seen

- **T.NO** token (e.g. `F3716`, `O1025`, `D2231`) is the join key across all
  sheets → app field `employee.tokenNo`.
- **DEPT** codes: A/C, QAD, MAIN-F, MAIN, SPG-M/D/T, EMPT/EMT, CARD, SMX, CBR,
  SWP, DRG, KNIT …
- **D.O.J** / **LEFT** stored as Excel date serials.
- **Unit** 1 / 2 (+ KNIT, GENERAL).

## Status: done vs. next

- [x] Calculation engine (`mill-wages.ts`) + self-check — matches Excel to the rupee.
- [ ] Attendance **import** from the UNIT musters + weekly sheets (no manual entry).
- [ ] **Record-maintained table**: per-employee previous data (DOJ, salary-by-
      calendar, holidays, month-by-month worked/leave/incentive history).
- [ ] **Reconciliation** view: feed a month → app figures vs. the Excel, flag diffs.
