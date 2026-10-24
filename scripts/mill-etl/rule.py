H8=set("DHFG"); H12=set("XY")
def pay_days(days):
    """Odisha 12-hour pay basis. days: {day: [code, ot]} -> (wkd, ot_hours).
    12h shift (X/Y) = one day; OT on that day is true overtime.
    8h shifts (D/H/F/G) + OT logged on 8h or non-shift days pool together and
    convert to days in 12h blocks; the remainder joins overtime."""
    n12=0; pool=0.0; ot12=0.0
    for code, o in days.values():
        c=(code or "").strip().upper(); o=float(o or 0)
        if c in H12: n12+=1; ot12+=o
        else:
            if c in H8: pool+=8
            pool+=o
    d=int(pool//12)
    return n12+d, round(ot12+pool-12*d,2)
def present_days(days):
    return sum(1 for code,_ in days.values() if (code or "").strip().upper() in H8|H12)
