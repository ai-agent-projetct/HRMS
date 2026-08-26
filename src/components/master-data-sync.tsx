"use client";

import { useEffect } from "react";
import { useHr } from "@/stores/hr";
import { setCustomCategories, setCustomDepartments } from "@/lib/hr-master";

/**
 * Pushes Admin-created categories and departments from the store into the
 * hr-master registry, so `categoryById()` / `allCategories()` resolve them
 * everywhere in the app — tables, filters, exports, payroll — without every
 * call site needing the store. Mounted once in the portal layout.
 */
export function MasterDataSync() {
  const customCats = useHr((s) => s.customCategories);
  const departments = useHr((s) => s.departments);

  // Run during render as well as in the effect: children of the layout read the
  // registry on their first render, which happens before effects flush.
  setCustomCategories(customCats);
  setCustomDepartments(departments);

  useEffect(() => {
    setCustomCategories(customCats);
    setCustomDepartments(departments);
  }, [customCats, departments]);

  return null;
}
