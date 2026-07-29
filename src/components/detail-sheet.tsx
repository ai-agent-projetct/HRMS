"use client";

import { Modal } from "@/components/ui/modal";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export interface DetailStat { label: string; value: React.ReactNode; tone?: BadgeTone; }
export interface DetailTable { cols: string[]; rows: React.ReactNode[][]; right?: boolean[]; }
export interface DetailSection {
  heading: string;
  rows?: [string, React.ReactNode][];
  stats?: DetailStat[];
  table?: DetailTable;
  note?: React.ReactNode;
}

/**
 * A reusable per-record detail view — opens a wide modal showing full,
 * function-specific details for a single individual (used from module rows).
 */
export function DetailSheet({
  title, subtitle, badges, sections, onClose, footer,
}: {
  title: string;
  subtitle?: string;
  badges?: { label: string; tone?: BadgeTone }[];
  sections: DetailSection[];
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <Modal title={title} description={subtitle} onClose={onClose} wide>
      {badges && badges.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {badges.map((b, i) => <Badge key={i} tone={b.tone ?? "muted"}>{b.label}</Badge>)}
        </div>
      )}
      <div className="space-y-5">
        {sections.map((sec, i) => (
          <section key={i}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">{sec.heading}</p>

            {sec.stats && sec.stats.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sec.stats.map((s, j) => (
                  <div key={j} className="rounded-lg border p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="mt-0.5 text-sm font-bold">{s.tone ? <Badge tone={s.tone}>{s.value}</Badge> : s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {sec.rows && sec.rows.length > 0 && (
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {sec.rows.map(([k, v], j) => (
                  <div key={j} className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1">
                    <span className="text-xs text-muted-foreground">{k}</span>
                    <span className="text-right text-sm font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {sec.table && (
              <div className="overflow-x-auto">
                <Table>
                  <THead><TR>{sec.table.cols.map((c, j) => <TH key={j} className={sec.table!.right?.[j] ? "text-right" : ""}>{c}</TH>)}</TR></THead>
                  <TBody>
                    {sec.table.rows.map((r, j) => (
                      <TR key={j}>{r.map((cell, k) => <TD key={k} className={sec.table!.right?.[k] ? "text-right" : ""}>{cell}</TD>)}</TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}

            {sec.note && <p className="mt-2 text-xs text-muted-foreground">{sec.note}</p>}
          </section>
        ))}
      </div>
      {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-3">{footer}</div>}
    </Modal>
  );
}
