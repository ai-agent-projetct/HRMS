"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

/** Config-driven create/edit form rendered in a modal. onSubmit receives the
 *  field values keyed by name; return an error string to keep the modal open. */
export function FormModal({
  title,
  description,
  fields,
  submitLabel = "Save",
  onSubmit,
  onClose,
}: {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => string | void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => [f.name, f.defaultValue ?? (f.type === "select" ? f.options?.[0] ?? "" : "")])
    )
  );
  const [error, setError] = useState("");

  const set = (name: string, v: string) =>
    setValues((s) => ({ ...s, [name]: v }));

  const submit = () => {
    for (const f of fields) {
      if (f.required && !values[f.name]?.trim()) {
        setError(`"${f.label}" is required.`);
        return;
      }
      if (f.type === "number" && values[f.name] && isNaN(Number(values[f.name]))) {
        setError(`"${f.label}" must be a number.`);
        return;
      }
    }
    const err = onSubmit(values);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              {f.label}
              {f.required && <span className="text-danger"> *</span>}
            </label>
            {f.type === "select" ? (
              <select
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {f.options?.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <Input
                type={f.type === "number" ? "text" : (f.type ?? "text")}
                value={values[f.name]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </div>
        ))}
        {error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{submitLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
