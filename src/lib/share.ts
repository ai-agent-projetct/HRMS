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
