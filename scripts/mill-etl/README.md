# Mill register import (ETL)

Turns the mill's own Excel/PDF files into the app's data, keyed by roll number
(O1025, F3716, SS30, A028, G01 …), with no duplicates.

| Source | What it holds | Parser |
|---|---|---|
| `JULY/AUG/SEP-26-ATT.xlsx` | daily muster — shift code (D/H/F/G 8h, X/Y 12h, A absent, N not on roll) + OT per day | `etl_muster.py` |
| `ORISSA_SALARY.xls` (APR-26…SEP-26) | Odisha wage register as paid | `etl_reg.py` |
| `HOSETL_GIRLS.xlsx` (APR-26…SEP-26) | hostel-girls wage register as paid | `etl_reg.py` |
| `APR…SEP2026.rar` → `APP/PAR/SS*.pdf` | mwages statements — apprentice, permanent, semi-staff | `etl_pdf.py` |
| `MONTHLY.xls` | security (SEC-1/2), driver, mess, casual, semi-staff sheets (month blocks) | `etl_all.py` |
| `employee-directory.xlsx` | Odisha personal master (father, DOB, DOJ, Aadhaar, phone, address) | `etl_all.py` |

## Run (from a work folder; files in `C:/Users/aakas/Downloads/`)

```
python -I etl_muster.py out/muster.json
python -I etl_reg.py out/registers.json
python -I etl_pdf.py <folder with extracted RARs> out/pdf.json
python -I etl_all.py                       # → out/import.json
```
Extract RARs with Windows `tar -xf APR2026.rar -C <dir>`.

Then, from the repo root:
```
IMPORT=out/import.json npx tsx scripts/verify-registers.ts     # engine vs every paid row
IMPORT=out/import.json DRY=1 npx tsx scripts/import-registers.ts  # preview
IMPORT=out/import.json npx tsx scripts/import-registers.ts      # backup → merge → save
```
`BASE=backups/<file>.json` re-applies a merge on a saved snapshot.

## Rules decoded (verified on 2,454 register rows, Apr–Sep 2026)
- **Odisha pay days** (12-hour basis): X/Y = 1 day, OT on those days is true OT;
  D/H/F/G (8h) + OT on 8h/non-shift days pool and convert to days in 12h blocks.
- **Odisha wage**: rate × days; OT = ROUNDUP(rate÷12 × hrs); incentive 26–27 d ×₹15,
  28+ ×₹30; ESI ₹200; agent ₹10/day (only when under an agent); net MROUND ₹10.
- **Hostel girls**: days present; incentive 26–27 ×₹10, 28+ ×₹20; no OT/ESI/agent;
  PM DIF (last month's round-off) carried; net MROUND ₹10.
- **Security / Driver / Mess / Semi-staff sheet**: days × rate + OT at rate÷8 (+food); exact net.
  Mess "O.T" column is a ₹ amount.
- **Apprentice / Permanent statements, Casual sheet**: wages + allowances; net MROUND ₹10.
- Same person under two tokens (salary sheet vs muster) is linked by name; generated
  tokens continue each series (SS73…, M01…, C01…, SG01…).
