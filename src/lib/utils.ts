import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indian Rupees, e.g. ₹12,34,567 */
export function formatINR(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_00_00_000)
      return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
    if (Math.abs(value) >= 1_00_000)
      return `₹${(value / 1_00_000).toFixed(2)} L`;
    if (Math.abs(value) >= 1_000) return `₹${(value / 1_000).toFixed(1)} K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
