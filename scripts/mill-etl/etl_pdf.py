"""Parse mwages monthly statements (APP / PAR / SS PDFs in the APR..SEP RARs).

Every worker is a 5-line block:
  pre   : APP -> [night_inc, adv]            PAR/SS -> [hra, lic]
  main  : APP -> sno tok tday wkd rate totwage gross pf pmdiff totded netpre rnd net
          PAR -> sno tok wkd basic26 basic fda vda atinc nfh gross pf pmdiff totded netpre
  line2 : APP -> [incentive, esi, mess]      PAR -> [spl, esi, adv, rnd, net]
  line3 : NAME [UAN] numbers                 APP -> [others]   PAR -> [oth_earn, oth_ded]
"""
import re, json, sys, glob, os
from pypdf import PdfReader

NUM = re.compile(r"-?\d+(?:\.\d+)?")
TOK = re.compile(r"^[A-Z]{1,3}\d{1,5}$")
MON = {"APR": "04", "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08", "SEP": "09"}


def nums(line):
    return [float(x) for x in NUM.findall(line.replace("�", ""))]


def parse(path, month):
    text = "\n".join(p.extract_text() or "" for p in PdfReader(path).pages)
    cat = re.search(r"CATEGORY\s*:\s*([A-Z ]+?)\s{2,}", text)
    cat = cat.group(1).strip() if cat else "?"
    unit = re.search(r"UNIT\s*:\s*(\d)", text)
    unit = unit.group(1) if unit else ""
    if cat in ("CASUAL",):
        return []  # hostel girls register printed — covered by HOSETL_GIRLS.xlsx
    L = [l for l in text.splitlines() if l.strip()]
    out = []
    for i, l in enumerate(L):
        parts = l.split()
        if len(parts) < 3 or not parts[0].isdigit() or not TOK.match(parts[1]):
            continue
        tok = parts[1]
        main = nums(" ".join(parts[2:]))
        pre = nums(L[i - 1]) if i > 0 else []
        l2 = nums(L[i + 1]) if i + 1 < len(L) else []
        l3raw = L[i + 2] if i + 2 < len(L) else ""
        name = re.split(r"\s{2,}|\[", l3raw.strip())[0].strip()
        uan = re.search(r"\[([^\]]*)\]", l3raw)
        l3 = nums(re.sub(r"\[[^\]]*\]", "", l3raw))
        r = {"src": f"PDF:{os.path.basename(path)}", "month": month, "category": cat, "unit": unit,
             "token": tok, "name": name, "uan": uan.group(1) if uan else ""}
        try:
            if cat == "APPRENTICE":
                tday, wkd, rate, totwage, gross, pf, pmdiff, totded, netpre, rnd, net = main[:11]
                r.update(tday=tday, wkd=wkd, rate=rate, wages=totwage, gross=gross, pf=pf, pmdiff=pmdiff,
                         totded=totded, rnd=rnd, net=net, night=pre[0] if pre else 0, adv=pre[1] if len(pre) > 1 else 0,
                         incentive=l2[0] if l2 else 0, esi=l2[1] if len(l2) > 1 else 0, mess=l2[2] if len(l2) > 2 else 0,
                         others=l3[0] if l3 else 0)
            else:  # PERMANENT / SEMI STAFF
                wkd, basic26, basic, fda, vda, atinc, nfh, gross, pf, pmdiff, totded, netpre = main[:12]
                r.update(wkd=wkd, basic26=basic26, basic=basic, fda=fda, vda=vda, atinc=atinc, nfh=nfh, gross=gross,
                         pf=pf, pmdiff=pmdiff, totded=totded, hra=pre[0] if pre else 0, lic=pre[1] if len(pre) > 1 else 0,
                         spl=l2[0] if l2 else 0, esi=l2[1] if len(l2) > 1 else 0, adv=l2[2] if len(l2) > 2 else 0,
                         rnd=l2[3] if len(l2) > 3 else 0, net=l2[4] if len(l2) > 4 else netpre,
                         oth_earn=l3[0] if l3 else 0, others=l3[1] if len(l3) > 1 else 0)
        except ValueError:
            r["parse_error"] = l
        out.append(r)
    return out


if __name__ == "__main__":
    base = sys.argv[1]
    recs = []
    for d in sorted(glob.glob(base + "/*/*2026")):
        m = MON[os.path.basename(d)[:3]]
        for f in sorted(glob.glob(d + "/*.pdf")):
            recs += parse(f, f"2026-{m}")
    import collections
    print(collections.Counter((r["category"], r["month"]) for r in recs), file=sys.stderr)
    print("parse errors:", sum(1 for r in recs if "parse_error" in r), file=sys.stderr)
    json.dump(recs, open(sys.argv[2], "w"))
