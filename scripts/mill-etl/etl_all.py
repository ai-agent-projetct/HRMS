"""Consolidate every source into one token-keyed dataset for the app.

Inputs (already parsed): out/muster.json, out/registers.json, out/pdf.json
Parsed here: MONTHLY.xls (security, driver, mess, casual, semi-staff sheet),
             employee-directory.xlsx (Odisha personal master).
Output: out/import.json  {employees, attendance, deductions, daily, aliases, report}
"""
import json, re, sys, collections, datetime as dt, warnings
import xlrd, openpyxl
sys.path.insert(0, "tools")
from rule import pay_days, present_days

warnings.filterwarnings("ignore")
D = "C:/Users/aakas/Downloads/"
MUS = json.load(open("out/muster.json"))
REG = json.load(open("out/registers.json"))
PDF = [r for r in json.load(open("out/pdf.json")) if "parse_error" not in r and not r["category"].startswith("CASUAL")]
MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]
TOK = re.compile(r"^[A-Z]{1,3}\d{1,5}$")
H8, H12 = set("DHFG"), set("XY")


def s(v):
    return "" if v is None else str(v).strip()


def n(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def xl_date(v):
    """Excel serial / datetime / text → YYYY-MM-DD or ''."""
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d")
    f = n(v)
    if 20000 < f < 60000:
        return (dt.date(1899, 12, 30) + dt.timedelta(days=int(f))).isoformat()
    return ""


def norm_name(x):
    return re.sub(r"[^A-Z]", "", s(x).upper())


def last_day(ym):
    y, m = map(int, ym.split("-"))
    return (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)).isoformat()


# ---------------------------------------------------------------- MONTHLY.xls
def parse_monthly():
    wb = xlrd.open_workbook(D + "MONTHLY.xls")
    out = []
    MNAMES = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}
    for sh in wb.sheets():
        rows = [sh.row_values(i) for i in range(sh.nrows)]
        # block = (title row → month) ; header row contains NAME
        month = None
        hdr = None
        col = {}
        for i, r in enumerate(rows):
            t = " ".join(s(v) for v in r if s(v)).upper()
            m1 = re.search(r"(\d{2})/(\d{2})/(2026)\s+TO", t)
            m2 = re.search(r"MONTH OF\s+([A-Z]+)-?(2026)", t)
            if m1:
                month = f"2026-{m1.group(2)}"; hdr = None; continue
            if m2 and m2.group(1)[:3] in MNAMES:
                month = f"2026-{MNAMES[m2.group(1)[:3]]:02d}"; hdr = None; continue
            if sh.name == "SS" and month is None and "SEMI STAFF" in t:
                month = "2026-09"  # sheet has no period line; it is the latest (Sep) semi-staff sheet
            cells = [s(v).upper() for v in r]
            if any(c in ("NAME", "T NO NAME") for c in cells) and any(c in ("S.NO", "SL", "S.NO.") for c in cells):
                hdr = i
                col = {}
                for j, c in enumerate(cells):
                    if c and c not in col:
                        col[c] = j
                continue
            if hdr is None or month is None:
                continue
            g = lambda *ks: next((r[col[k]] for k in ks if k in col and col[k] < len(r)), None)
            name = s(g("NAME", "T NO NAME"))
            sno = n(g("S.NO", "SL", "S.NO."))
            if not name or sno <= 0 or "TOTAL" in name.upper():
                continue
            tok = s(g("T.NO.", "T.NO"))
            rec = {"sheet": sh.name, "month": month, "name": name, "token": tok if TOK.match(tok) else "",
                   "doj": xl_date(g("D.O.J", "D.O.J.")), "design": s(g("DESIGN.")), "dept": s(g("DEPT"))}
            if sh.name in ("SEC-1", "DRIVER"):
                days, rate, ot = n(g("D.W")), n(g("W/D")), n(g("OT"))
                otamt = n(g("OT.AMT", "OTW")); food = n(g("FOOD"))
                gross = round(days * rate + otamt + food)
                pf, esi, adv, mess = n(g("P.F")), n(g("ESI")), n(g("ADVN.")), n(g("MESS"))
                net = n(g("NET", "NET AMOUNT"))
                rec.update(days=days, rate=rate, ot=ot, wages=round(days * rate), otAmt=round(otamt), allowance=food,
                           gross=gross, pf=pf, esi=esi, adv=adv, mess=mess, others=0, net=net)
            elif sh.name == "SEC-2":
                days, rate, ot = n(g("W.DAYS")), n(g("W/D")), n(g("OT HRS"))
                rec.update(days=days, rate=rate, ot=ot, wages=n(g("T.WAGES")), otAmt=n(g("OT AMT")), allowance=0,
                           gross=n(g("G.WAGES")), pf=0, esi=n(g("ESI")), adv=n(g("ADV")), mess=n(g("MESS")), others=0,
                           net=n(g("N.WAGES")))
            elif sh.name == "MESS":
                # "O.T" here is an OT *amount* (₹): T.SAL = DAYS × W/D + O.T
                days, rate = n(g("DAYS")), n(g("W/D"))
                rec.update(days=days, rate=rate, ot=0, wages=round(days * rate), otAmt=n(g("O.T")), allowance=0,
                           gross=n(g("T.SAL")), pf=0, esi=n(g("PF/ESI")), adv=n(g("ADV")), mess=n(g("MESS")),
                           others=n(g("OTH")), net=n(g("N.SAL")))
            elif sh.name == "CASUAL":
                days, rate = n(g("WKD")), n(g("W /  DAY", "W / DAY"))
                rec.update(days=days, rate=rate, ot=n(g("OT HRS")), wages=n(g("BASIC AMOUNT")), otAmt=n(g("OT AMT")),
                           allowance=n(g("OTHER ALLW")), incentive=n(g("ATTN INCEN")), gross=n(g("TOTAL EARNED")),
                           pf=0, esi=0, adv=n(g("ADVANCE")), mess=n(g("MESS")), others=n(g("OTHERS")),
                           net=n(g("NET SALARY")))
            elif sh.name == "SS":
                days, rate = n(g("DAYS")), n(g("W/D"))
                rec.update(days=days, rate=rate, ot=0, wages=round(days * rate), otAmt=n(g("O.T")), allowance=0,
                           gross=n(g("T.SAL")), pf=0, esi=n(g("PF/ESI")), adv=n(g("ADV")), mess=n(g("MESS")),
                           others=0, net=n(g("N.SAL")))
            else:
                continue
            out.append(rec)
    return out


MON = parse_monthly()

# ---------------------------------------------------------------- directory
dwb = openpyxl.load_workbook(D + "employee-directory.xlsx", read_only=True, data_only=True)
drows = list(dwb.worksheets[0].iter_rows(min_row=4, values_only=True))
dh = [s(h) for h in drows[0]]
DIR = {}
for r in drows[1:]:
    if r and TOK.match(s(r[0])):
        DIR[s(r[0])] = dict(zip(dh, r))

# ---------------------------------------------------------------- muster: canonical rows per (token, month)
CANON = {"2026-07": ["ATT-UNIT-1", "ATT-UNIT-2", "SS&APP"], "2026-08": ["U-1", "U-2", "SS&APP"],
         "2026-09": ["UNIT-1", "UNIT-2", "SS&APP"]}


def unit_of(sheet):
    m = re.search(r"(?:UNIT|U)-(\d)", sheet)
    return f"Unit {m.group(1)}" if m else ""


mus_by = collections.defaultdict(lambda: collections.defaultdict(list))
for r in MUS:
    if r["days"]:
        mus_by[r["month"]][r["token"]].append(r)
MUSTER = {}  # (tok, month) -> merged {days, row}
for m, toks in mus_by.items():
    for t, rows in toks.items():
        canon = [r for r in rows if r["sheet"] in CANON[m]] or rows
        merged = {}
        for r in canon:
            for d, (code, ot) in r["days"].items():
                c = (code or "").strip().upper()
                cur = merged.get(d)
                # keep a worked mark over A/N/blank when two rows overlap the same day
                if cur is None or (cur[0] not in H8 | H12 and (c in H8 | H12 or (not cur[0] and c))):
                    merged[d] = [c, float(ot or 0)]
        MUSTER[(t, m)] = {"days": merged, "row": canon[-1], "unit": unit_of(canon[-1]["sheet"])}

# ---------------------------------------------------------------- name-only staff → stable tokens; CS ↔ SS aliases
aliases = {}  # alt token / name-key -> canonical token
cs_rows = {}
for (t, m), v in MUSTER.items():
    if t.startswith(("CS", "SS")):
        cs_rows[t] = v["row"]["name"]
pdf_ss = {r["token"] for r in PDF}  # these already carry their own paid statements
used = set(r["token"] for r in REG) | set(r["token"] for r in PDF) | set(t for t, _ in MUSTER) | set(DIR)
for r in MON:
    if r["token"]:
        used.add(r["token"])


def match_cs(name):
    """Semi-staff salary sheet uses its own tokens (SS66…) for people the muster
    lists as CS1… — link by name similarity so one person stays one record."""
    import difflib
    k = norm_name(name)
    scored = sorted(((difflib.SequenceMatcher(None, k, norm_name(nm)).ratio(), t) for t, nm in cs_rows.items() if t not in pdf_ss), reverse=True)
    if not scored:
        return None
    best = scored[0]
    second = scored[1][0] if len(scored) > 1 else 0
    return best[1] if best[0] >= 0.78 and best[0] - second >= 0.08 else None


# Muster tokens that no salary source pays (new joiners whose pay sheet still
# lists them by name, or a typo'd token on the register). One exact-name match
# → same person, keep the muster token.
paid_tokens = {r["token"] for r in REG} | {r["token"] for r in PDF} | {r["token"] for r in MON if r["token"]}
mus_only = collections.defaultdict(set)
for (t, m), v in MUSTER.items():
    if t not in paid_tokens:
        mus_only[norm_name(v["row"]["name"])].add(t)
mus_only = {k: next(iter(v)) for k, v in mus_only.items() if len(v) == 1 and k}
muster_tokens = {t for t, _ in MUSTER}
regalias = {}
for r in REG + PDF:
    t = r["token"]
    if t not in muster_tokens and norm_name(r["name"]) in mus_only:
        regalias[t] = mus_only[norm_name(r["name"])]
for r in REG + PDF:
    if r["token"] in regalias:
        r["alt"], r["token"] = r["token"], regalias[r["token"]]
aliases.update(regalias)

gen_counter = collections.Counter()
PREFIX = {"SEC-2": "SG", "MESS": "M", "CASUAL": "C", "SS": "SS", "SEC-1": "G", "DRIVER": "D"}
# Name-only semi-staff continue the sheet's own SS series (SS66, SS68 … → SS73 …)
# so a generated token can never be mistaken for a CS1-style muster token.
gen_counter["SS"] = max(int(t[2:]) for t in used if re.fullmatch(r"SS\d+", t))
name_key_tok = {}
for r in sorted(MON, key=lambda x: x["month"]):
    if r["sheet"] == "SS":
        cs = match_cs(r["name"])
        if cs:
            if r["token"]:
                aliases[r["token"]] = cs
            r["alt"] = r["token"]
            r["token"] = cs
            continue
    if r["token"]:
        continue
    if norm_name(r["name"]) in mus_only:  # on the muster under a real token
        r["token"] = mus_only[norm_name(r["name"])]
        continue
    # name-only: same sheet group + normalized name = same person across months.
    # Exact duplicate names inside one month block keep their order (#1, #2).
    key = (PREFIX[r["sheet"]], norm_name(r["name"]))
    occ = sum(1 for x in MON if x is not r and x["sheet"] == r["sheet"] and x["month"] == r["month"] and norm_name(x["name"]) == key[1] and MON.index(x) < MON.index(r))
    key = key + (occ,)
    if key not in name_key_tok:
        p = key[0]
        while True:
            gen_counter[p] += 1
            cand = f"{p}{gen_counter[p]}" if p == "SS" else f"{p}{gen_counter[p]:02d}"
            if cand not in used:
                break
        used.add(cand)
        name_key_tok[key] = cand
    r["token"] = name_key_tok[key]
    r["generated"] = True

# an alias learned in one month applies to every month (spellings drift)
for r in MON:
    if r["token"] in aliases:
        r["alt"], r["token"] = r["token"], aliases[r["token"]]

# ---------------------------------------------------------------- per (token, month) paid + attendance
att, ded, paid_src = {}, {}, {}


NUMF = ("days", "ot", "wages", "otAmt", "incentive", "allowance", "gross", "esi", "pf", "adv", "others", "mess", "agent", "roundOff", "net", "pmDiff")


def put(tok, m, days, rate, ot, paid, d_mess=0, d_oth=0, d_adv=0, d_pm=0, note=""):
    if paid is not None:
        paid["pmDiff"] = d_pm
    k = (tok, m)
    if k in att and att[k]["paid"] and paid:
        # Paid from two registers in one month (moved Odisha <-> hostel mid-month):
        # the month carries the total; each register row is kept as a part.
        prev = att[k]
        parts = prev["paid"].get("parts") or [dict(prev["paid"])]
        parts.append(dict(paid))
        tot = {f: round(sum((x.get(f) or 0) for x in parts), 2) for f in NUMF}
        tot.update(src=" + ".join(x["src"] for x in parts), rate=paid["rate"],
                   agentId=next((x.get("agentId") for x in parts if x.get("agentId")), None), parts=parts)
        prev.update(paid=tot, daysWorked=tot["days"], otHours=tot["ot"], rate=round(rate, 2) if rate else prev["rate"])
        d = ded[k]
        d.update(mess=d["mess"] + round(d_mess), others=d["others"] + round(d_oth), adv=d["adv"] + round(d_adv), pmDiff=d["pmDiff"] + round(d_pm),
                 othersNote="; ".join(x for x in (d["othersNote"], note, "paid from two registers this month") if x))
        return
    att[k] = {"empId": tok, "month": m, "daysWorked": days, "otHours": ot, "rate": round(rate, 2) if rate else None, "paid": paid}
    ded[k] = {"empId": tok, "month": m, "mess": round(d_mess), "others": round(d_oth), "adv": round(d_adv), "pmDiff": round(d_pm), "othersNote": note}


AGENT_REG = {"GUNAM": "AGT-GUNA", "GUNAMANI": "AGT-GUNA", "RAJESH": "AGT-RAJESH", "JEGAN": "AGT-JAGANATH"}
emp_src = collections.defaultdict(list)  # tok -> [(month, kind, record)]
for r in REG:
    m, t = r["month"], r["token"]
    if r["src"] == "ORISSA":
        days = int(r.get("DW", 0)); esi = r.get("ESI", r.get("PF/ESI", 0))
        paid = {"src": f"ORISSA_SALARY {m}", "days": days, "rate": r.get("W/D", 0), "ot": r.get("OT", 0),
                "wages": r.get("T.WAG", 0), "otAmt": r.get("OTW", 0), "incentive": r.get("INCEN", 0), "gross": r.get("GROSS", 0),
                "esi": esi, "adv": r.get("ADV", 0), "others": r.get("OTH", 0), "mess": r.get("CANT", 0),
                "agent": r.get("AGENT", 0), "roundOff": r.get("R.OFF", 0), "net": r.get("NETPAY", 0),
                "agentId": AGENT_REG.get(s(r.get("AG")).upper())}
        put(t, m, days, r.get("W/D", 0), r.get("OT", 0), paid, r.get("CANT", 0), r.get("OTH", 0), r.get("ADV", 0))
        emp_src[t].append((m, "ORISSA", r))
    else:
        days = int(r.get("WKD", 0))
        paid = {"src": f"HOSETL_GIRLS {m}", "days": days, "rate": r.get("DW", 0), "ot": 0, "wages": r.get("T.WAG", 0),
                "otAmt": 0, "incentive": r.get("INCEN", 0), "gross": r.get("GROSS", 0), "esi": 0, "adv": r.get("ADV", 0),
                "others": r.get("OTH", 0), "mess": r.get("CANT", 0), "agent": 0, "roundOff": r.get("R.OFF", 0), "net": r.get("NETPAY", 0)}
        put(t, m, days, r.get("DW", 0), 0, paid, r.get("CANT", 0), r.get("OTH", 0), r.get("ADV", 0), r.get("PM DIF", 0),
            "PM DIF = previous month round-off" if r.get("PM DIF") else "")
        emp_src[t].append((m, "HOSTEL", r))
for r in PDF:
    m, t = r["month"], r["token"]
    if r["category"] == "APPRENTICE":
        paid = {"src": f"mwages {r['src'][4:]} {m}", "days": r["wkd"], "rate": r["rate"], "ot": 0, "wages": r["wages"], "otAmt": 0,
                "incentive": r["incentive"], "allowance": r["night"], "gross": r["gross"], "esi": r["esi"], "pf": r["pf"],
                "adv": r["adv"], "others": r["others"], "mess": r["mess"], "agent": 0, "roundOff": r["rnd"], "net": r["net"]}
        put(t, m, r["wkd"], r["rate"], 0, paid, r["mess"], r["others"], r["adv"], r["pmdiff"])
    else:
        # rate = Basic+FDA+VDA per worked day; HRA / NFH / special / at-inc are allowances
        rate = round((r["basic"] + r["fda"] + r["vda"]) / r["wkd"], 2) if r["wkd"] else 0
        paid = {"src": f"mwages {r['src'][4:]} {m}", "days": r["wkd"], "rate": rate, "ot": 0, "wages": r["basic"] + r["fda"] + r["vda"],
                "otAmt": 0, "incentive": r["atinc"], "allowance": r["hra"] + r["nfh"] + r["spl"] + r["oth_earn"], "gross": r["gross"],
                "esi": r["esi"], "pf": r["pf"], "adv": r["adv"], "others": r["others"] + r["lic"], "mess": 0, "agent": 0,
                "roundOff": r["rnd"], "net": r["net"]}
        put(t, m, r["wkd"], rate, 0, paid, 0, r["others"] + r["lic"], r["adv"], r["pmdiff"])
    emp_src[t].append((m, "PDF:" + r["category"], r))
for r in MON:
    m, t = r["month"], r["token"]
    if m not in MONTHS:
        continue
    if r["days"] and abs(r["days"] * r["rate"] - r["wages"]) > 1:
        r["rate"] = round(r["wages"] / r["days"], 2)  # W/D cell held a monthly figure — use the paid wages
    paid = {"src": f"MONTHLY {r['sheet']} {m}", "days": r["days"], "rate": r["rate"], "ot": r["ot"], "wages": r["wages"],
            "otAmt": r["otAmt"], "incentive": r.get("incentive", 0), "allowance": r.get("allowance", 0), "gross": r["gross"],
            "esi": r["esi"], "pf": r["pf"], "adv": r["adv"], "others": r["others"], "mess": r["mess"], "agent": 0,
            "roundOff": 0, "net": r["net"]}
    put(t, m, r["days"], r["rate"], r["ot"], paid, r["mess"], r["others"], r["adv"])
    emp_src[t].append((m, "MONTHLY:" + r["sheet"], r))

# muster-only months (worker on the muster but no register row) → computed days, no paid figures
for (t, m), v in MUSTER.items():
    if (t, m) in att:
        continue
    hostelish = any(k == "HOSTEL" for _, k, _ in emp_src.get(t, []))
    staff = t[:1] in ("A", "P", "S", "C") and not t.startswith("O")
    if hostelish or staff:
        days, ot = present_days(v["days"]), 0
    else:
        days, ot = pay_days(v["days"])
    att[(t, m)] = {"empId": t, "month": m, "daysWorked": days, "otHours": ot, "rate": None, "paid": None}
    emp_src[t].append((m, "MUSTER", v["row"]))

# fill attendance extras (absent / week split) from the muster when available
for (t, m), a in att.items():
    v = MUSTER.get((t, m))
    a["absent"] = sum(1 for c, _ in v["days"].values() if c == "A") if v else 0
    wk = [0, 0, 0, 0]
    if v:
        for d, (c, o) in v["days"].items():
            if c in H8 | H12:
                wk[min(3, (int(d) - 1) // 7)] += 1
    a["weekDaysWorked"] = wk

# ---------------------------------------------------------------- daily marks (Jul–Sep)
daily = []
for (t, m), v in MUSTER.items():
    unit = v["unit"]
    for d, (c, o) in sorted(v["days"].items(), key=lambda x: int(x[0])):
        date = f"{m}-{int(d):02d}"
        if c in H8 | H12:
            daily.append({"empId": t, "date": date, "status": "Present", "shift": c, "otHours": o, "unit": unit, "source": "import"})
        elif c == "A":
            daily.append({"empId": t, "date": date, "status": "Absent", "otHours": o or None, "unit": unit, "source": "import"})
        elif o:
            daily.append({"empId": t, "date": date, "status": "Present", "otHours": o, "unit": unit, "source": "import"})
        # N / blank = not on roll that day → no mark

# ---------------------------------------------------------------- employees
AGENT = {"G": "AGT-GUNA", "GUNAM": "AGT-GUNA", "GUNAMANI": "AGT-GUNA", "R": "AGT-RAJESH", "RAJESH": "AGT-RAJESH",
         "J": "AGT-JAGANATH", "JEGAN": "AGT-JAGANATH", "PG": "AGT-PROMOD", "PS": "AGT-SENDIL", "T": "AGT-TAMIL",
         "CS": "AGT-CHANDRA", "GB": "AGT-GOBI"}  # M / MILL = direct hire
CAT = {"ORISSA": "ODISHA", "HOSTEL": "HOSTEL_GIRLS", "PDF:APPRENTICE": "APPRENTICE", "PDF:PERMANENT": "PERMANENT",
       "PDF:SEMI STAFF": "SEMISTAFF", "MONTHLY:SEC-1": "SECURITY", "MONTHLY:SEC-2": "SECURITY", "MONTHLY:DRIVER": "DRIVER",
       "MONTHLY:MESS": "MESS", "MONTHLY:CASUAL": "CASUAL", "MONTHLY:SS": "SEMISTAFF"}
FEMALE_END = ("AMMAL", "AMMA", "RANI", "LAKSHMI", "MANI", "DEVI", "VALLI", "MALA", "THI", "NILA", "PRIYA", "SELVI", "MEENA", "KALA", "ESWARI", "VATHI")
employees = []
for t in sorted(set(k for k, _ in att) | set(k for k, _ in MUSTER)):
    srcs = sorted(emp_src.get(t, []), key=lambda x: x[0])
    last_m = srcs[-1][0] if srcs else max(m for (tk, m) in MUSTER if tk == t)
    kinds = [k for _, k, _ in srcs if k != "MUSTER"]
    kind = kinds[-1] if kinds else "MUSTER"
    latest = next((r for _, k, r in reversed(srcs) if k == kind), {})
    mrow = next((MUSTER[(t, m)] for m in reversed(MONTHS) if (t, m) in MUSTER), None)
    name = s(latest.get("name")) or (mrow["row"]["name"] if mrow else t)
    if kind in CAT:
        cat = CAT[kind]
    else:
        cat = {"O": "ODISHA", "F": "ODISHA", "P": "PERMANENT", "A": "APPRENTICE"}.get(t[0], "SEMISTAFF")
    dept = s(latest.get("DEPT") or latest.get("dept") or latest.get("design")) or (mrow["row"]["dept"] if mrow else "")
    if kind.startswith("MONTHLY:") and not dept:
        dept = {"SEC-1": "SECURITY", "SEC-2": "SECURITY", "DRIVER": "DRIVER", "MESS": "MESS", "CASUAL": "CASUAL", "SS": "MAIN"}[kind.split(":")[1]]
    agcode = s(latest.get("AG")) or (mrow["row"]["ag"] if mrow else "")
    d = DIR.get(t, {})
    if not agcode and d.get("Agent"):
        agcode = s(d.get("Agent")).upper()
    agent = AGENT.get(agcode.upper())
    female = t.startswith("F") or cat in ("HOSTEL_GIRLS", "MESS") or (cat == "CASUAL" and norm_name(name).endswith(FEMALE_END))
    rate = next((a["rate"] for (tk, m), a in sorted(att.items(), key=lambda x: x[0][1], reverse=True) if tk == t and a.get("rate")), None)
    doj = xl_date(latest.get("D.O.J.")) or xl_date(d.get("Date of Joining")) or s(latest.get("doj"))
    unit = (mrow["unit"] if mrow else "") or (f"Unit {latest['unit']}" if latest.get("unit") else "")
    monthly = cat in ("PERMANENT", "SEMISTAFF") and kind.startswith("PDF")
    e = {
        "id": t, "name": name, "category": cat, "department": dept or "—", "unit": unit or None,
        "gender": "Female" if female else "Male", "agentId": agent,
        "agentCode": agcode if agcode and not agent and agcode.upper() not in ("MILL", "0", "#N/A", "AGENT", "V") else "",
        "salaryPerDay": rate, "wageType": "Monthly" if monthly else "Daily",
        "monthlyGross": round((latest.get("gross") or 0) * 26 / latest["wkd"]) if monthly and latest.get("wkd") else None,
        "doj": doj, "fatherName": s(d.get("Father's Name")) or None, "dob": xl_date(d.get("DOB")),
        "aadhaar": s(latest.get("AADHAR NO.")).replace(".0", "") or s(d.get("Aadhaar No")).replace(".0", ""),
        "phone": s(latest.get("MOB NO")).replace(".0", "") or s(d.get("Phone")).replace(".0", ""),
        "address": s(d.get("Permanent Address")), "esiNo": s(latest.get("ESI NO")).replace(".0", ""),
        "pfNo": s(latest.get("PF.NO")).replace(".0", "") or s(latest.get("uan")),
        "lastMonth": last_m, "source": kind, "alt": next((r.get("alt") for _, k, r in srcs if r.get("alt")), "") if srcs else "",
        "generated": any(r.get("generated") for _, _, r in srcs),
    }
    for k in ("aadhaar", "phone", "esiNo", "pfNo"):
        if e[k] in ("0", "0.0"):
            e[k] = ""
    employees.append(e)

report = {
    "employees": len(employees),
    "by_category": collections.Counter(e["category"] for e in employees),
    "by_lastMonth": collections.Counter(e["lastMonth"] for e in employees),
    "attendance_rows": len(att), "by_month": collections.Counter(m for _, m in att),
    "paid_rows": sum(1 for a in att.values() if a["paid"]), "daily_rows": len(daily),
    "generated_tokens": sum(1 for e in employees if e["generated"]), "aliases": aliases,
    "agent": collections.Counter(e["agentId"] or ("code:" + e["agentCode"] if e["agentCode"] else "direct") for e in employees),
}
json.dump({"employees": employees, "attendance": list(att.values()), "deductions": list(ded.values()), "daily": daily,
           "aliases": aliases, "report": {k: (dict(v) if isinstance(v, collections.Counter) else v) for k, v in report.items()}},
          open("out/import.json", "w"), default=str)
for k, v in report.items():
    print(f"{k}: {dict(v) if isinstance(v, collections.Counter) else v}")
