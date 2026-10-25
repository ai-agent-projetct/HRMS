/**
 * Hand a message to WhatsApp or the mail app — the app has no messaging
 * gateway, so the user presses Send there. Electron opens these externally.
 */
export function shareMessage(channel: "WhatsApp" | "Email", to: string | undefined, subject: string, text: string) {
  if (channel === "WhatsApp") {
    const digits = (to ?? "").replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`${subject}\n${text}`)}`, "_blank");
  } else {
    window.open(`mailto:${to ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, "_blank");
  }
}

/** Opens a printable payslip (print or "Save as PDF" from the dialog). */
export function printPayslip(
  company: string,
  e: { id: string; name: string; department?: string; category?: string },
  month: string,
  slip: { earnings: { label: string; amount: number }[]; deductions: { label: string; amount: number }[]; grossEarnings: number; totalDeductions: number; netPay: number },
  words: string,
) {
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const rows = (list: { label: string; amount: number }[]) => list.map((x) => `<tr><td>${esc(x.label)}</td><td class="r">${rs(x.amount)}</td></tr>`).join("") || `<tr><td>None</td><td></td></tr>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(e.id)} ${esc(month)}</title>
<style>body{font:13px Arial,sans-serif;margin:28px;color:#111}h1{font-size:17px;margin:0}h2{font-size:13px;margin:4px 0 14px;font-weight:normal}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:5px 7px}th{background:#eee;text-align:left}.r{text-align:right}
.grid{display:flex;gap:14px}.grid>div{flex:1}.net{margin-top:14px;padding:10px;border:2px solid #111;font-size:15px}.sig{margin-top:48px;display:flex;justify-content:space-between}</style></head><body>
<h1>${esc(company)}</h1><h2>Payslip — ${esc(month)}</h2>
<table><tr><th>Roll no</th><td>${esc(e.id)}</td><th>Name</th><td>${esc(e.name)}</td></tr><tr><th>Department</th><td>${esc(e.department)}</td><th>Category</th><td>${esc(e.category)}</td></tr></table><br>
<div class="grid"><div><table><tr><th>Earnings</th><th class="r">₹</th></tr>${rows(slip.earnings)}<tr><th>Gross</th><th class="r">${rs(slip.grossEarnings)}</th></tr></table></div>
<div><table><tr><th>Deductions</th><th class="r">₹</th></tr>${rows(slip.deductions)}<tr><th>Total</th><th class="r">${rs(slip.totalDeductions)}</th></tr></table></div></div>
<div class="net"><b>Net pay: ${rs(slip.netPay)}</b><br><small>${esc(words)}</small></div>
<div class="sig"><span>Employee signature</span><span>Authorised signatory</span></div>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
  return true;
}
