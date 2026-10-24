"""Parse salary registers: ORISSA_SALARY.xls (APR-26..SEP-26) and HOSETL_GIRLS.xlsx."""
import xlrd, openpyxl, re, json, sys, warnings
warnings.filterwarnings("ignore")
TOK=re.compile(r"^[A-Z]{1,3}\d{1,5}$")
D="C:/Users/aakas/Downloads/"
MONTHS={"APR":"04","MAY":"05","JUNE":"06","JUN":"06","JULY":"07","JUL":"07","AUG":"08","SEP":"09"}
def ym(sheet):
    m=re.match(r"([A-Z]+)-26", sheet.strip().upper())
    return f"2026-{MONTHS[m.group(1)]}" if m and m.group(1) in MONTHS else None
def s(v): return "" if v is None else str(v).strip()
def n(v):
    try: return float(v)
    except: return 0.0
def rows_to_recs(rows, month, src):
    hi=next(i for i,r in enumerate(rows[:10]) if any(s(v)=="T.NO" for v in r))
    hdr=[s(v) for v in rows[hi]]
    col={}
    for i,v in enumerate(hdr[:30]):
        if v and v not in col: col[v]=i
    out=[]
    for r in rows[hi+1:]:
        t=s(r[col["T.NO"]]) if col["T.NO"]<len(r) else ""
        if not TOK.match(t): continue
        g=lambda k: r[col[k]] if k in col and col[k]<len(r) else None
        rec={"src":src,"month":month,"token":t,"name":s(g("NAME"))}
        for k in ["AG","ESI NO","PF.NO","AADHAR NO.","MOB NO","D.O.J.","LEFT","DEPT","STATUS"]:
            if k in col: rec[k]=s(g(k))
        for k in ["W/D","DW","T.WAG","OT","OTW","INCEN","GROSS","ESI","PF/ESI","ADV","OTH","CANT","AGENT","15S C","R.OFF","NETPAY","T.DAY","WKD","PM DIF","T.DEDU","T WAG"]:
            if k in col: rec[k]=n(g(k))
        # agent marker for hostel sheet = col 1 letter
        if src=="HOSTEL": rec["AG"]=s(r[1])
        out.append(rec)
    return out
recs=[]
o=xlrd.open_workbook(D+"ORISSA_SALARY.xls", on_demand=True)
for nm in o.sheet_names():
    m=ym(nm)
    if not m: continue
    sh=o.sheet_by_name(nm)
    recs+=rows_to_recs([sh.row_values(i) for i in range(sh.nrows)], m, "ORISSA")
hg=openpyxl.load_workbook(D+"HOSETL_GIRLS.xlsx", read_only=True, data_only=True)
for ws in hg.worksheets:
    m=ym(ws.title)
    if not m: continue
    recs+=rows_to_recs(list(ws.iter_rows(min_row=1,max_row=ws.max_row,max_col=30,values_only=True)), m, "HOSTEL")
import collections
print(collections.Counter((r["src"],r["month"]) for r in recs), file=sys.stderr)
json.dump(recs, open(sys.argv[1],"w"))
