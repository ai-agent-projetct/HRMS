/**
 * End-to-end store workflows (no DB, no browser): add → mark days → recompute
 * → pay, paid-month edits, advances, leave approval, exit/rejoin, agents,
 * go-live lock, users, recycle bin. Run: npx tsx scripts/test-workflow.ts
 */
import { useHr, attendanceFor, TODAY, CURRENT_MONTH } from "../src/stores/hr";
import { monthSalary } from "../src/lib/payroll";
import type { HrEmployee } from "../src/lib/hr-data";

let pass = 0, fail = 0;
function t(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
const S = () => useHr.getState();
S().login({ name: "Test", role: "Super Admin", loginId: "superadmin" } as never);
const base = S().employees[0];
const emp: HrEmployee = { ...base, id: "O9001", name: "TEST WORKER", category: "ODISHA", status: "Active", agentId: undefined, salaryPerDay: 600, wageType: "Daily", doj: TODAY, leave: { el: 5, cl: 4, sl: 3, lopThisMonth: 0 } } as HrEmployee;
useHr.setState((s) => ({ employees: [...s.employees, emp], attendance: s.attendance.filter((a) => a.empId !== emp.id) }));

// 1. Day marks → month summary (Odisha 12h basis: X = 1 pay day, D = 8h pooled)
const [y, m] = CURRENT_MONTH.split("-");
const d = (n: number) => `${y}-${m}-${String(n).padStart(2, "0")}`;
S().markAttendanceDay(emp.id, d(1), "Present", 0, "X");
S().markAttendanceDay(emp.id, d(2), "Present", 0, "X");
S().markAttendanceDay(emp.id, d(3), "Present", 4, "D");
S().markAttendanceDay(emp.id, d(4), "Absent");
let a = attendanceFor(S().attendance, emp.id)!;
t("2×X + D(8h)+4h OT → 3 pay days", a.daysWorked, 3);
t("absent counted", a.absent, 1);
const pay = monthSalary(S().employees.find((e) => e.id === emp.id)!, a, { mess: 0, others: 0 });
t("wages 3 × ₹600", pay.wages, 1800);
t("no agent → no agent cut", pay.agentComm, 0);
S().clearAttendanceDay(emp.id, d(4));
t("clear day drops absent", attendanceFor(S().attendance, emp.id)!.absent, 0);

// 2. Paid month: editing days drops the register snapshot
useHr.setState((s) => ({ attendance: s.attendance.map((x) => (x.empId === emp.id ? { ...x, paid: { net: 1, gross: 1 } as never } : x)) }));
S().markAttendanceDay(emp.id, d(5), "Present", 0, "X");
t("paid month ignores new marks", attendanceFor(S().attendance, emp.id)!.daysWorked, 3);
S().setAttendance(emp.id, { daysWorked: 10 });
a = attendanceFor(S().attendance, emp.id)!;
t("manual edit clears paid", a.paid, undefined);
t("manual days kept", a.daysWorked, 10);

// 3. Advance: book → recover → cleared
S().addAdvance({ empId: emp.id, empName: emp.name, date: TODAY, amount: 1000, reason: "test", monthlyRecovery: 500 });
const adv = S().advances.find((x) => x.empId === emp.id)!;
S().recoverAdvance(adv.id, 500); S().recoverAdvance(adv.id, 500);
t("advance cleared after full recovery", S().advances.find((x) => x.id === adv.id)!.status, "Cleared");

// 4. Leave: apply → manager → HR
S().applyLeave({ empId: emp.id, empName: emp.name, type: "CL" as never, from: d(10), to: d(10), days: 1, reason: "test" });
const lv = S().leave.find((x) => x.empId === emp.id)!;
t("leave pending", lv.status, "Pending");
S().advanceLeave(lv.id, "approve", "Supervisor" as never);
S().advanceLeave(lv.id, "approve", "HR Manager");
t("leave approved", S().leave.find((x) => x.id === lv.id)!.status, "Approved");
t("approved day marked Leave", S().dailyAttendance.find((x) => x.empId === emp.id && x.date === d(10))?.status, "Leave");
t("CL balance reduced by 1", S().employees.find((e) => e.id === emp.id)!.leave.cl, 3);

// 5. Exit → rejoin
t("mark left ok", S().markLeft(emp.id, { exitDate: TODAY, reason: "Resigned", settled: false }).ok, true);
t("status exited", S().employees.find((e) => e.id === emp.id)!.status, "Exited");
t("rejoin ok", S().markRejoin(emp.id, { rejoinDate: TODAY }).ok, true);
t("status active again", S().employees.find((e) => e.id === emp.id)!.status, "Active");

// 6. Agent add + assign
t("add agent", S().addAgent({ name: "Test Agent", place: "X", phone: "1", commissionPerWorker: 12, id: "TA" }).ok, true);
S().updateEmployee(emp.id, { agentId: "TA" });
const withAgent = monthSalary(S().employees.find((e) => e.id === emp.id)!, attendanceFor(S().attendance, emp.id)!, { mess: 0, others: 0 });
t("agent cut ₹10/day on Odisha register", withAgent.agentComm, attendanceFor(S().attendance, emp.id)!.daysWorked * 10);

// 7. Users: add, duplicate refused
t("add user", S().addHrUser({ loginId: "tester", password: "x1", name: "T", role: "HR Executive" }).ok, true);
t("duplicate login refused", S().addHrUser({ loginId: "TESTER", password: "x", name: "T", role: "HR Executive" }).ok, false);

// 8. Recycle bin: delete → restore
S().deleteEmployee(emp.id);
t("deleted", S().employees.some((e) => e.id === emp.id), false);
const bin = S().recycleBin.find((r) => JSON.stringify(r).includes(emp.id))!;
S().restoreFromBin(bin.id);
t("restored", S().employees.some((e) => e.id === emp.id), true);

// 9. Go-live lock
t("lock", S().setDataLock(true, "test").ok, true);
t("locked", S().dataLock.locked, true);
S().setDataLock(false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
