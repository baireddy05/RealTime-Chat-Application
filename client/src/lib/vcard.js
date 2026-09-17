/**
 * Utility to generate standard vCard 3.0 format and trigger download
 * Compatible with iOS Contacts, Android Contacts, Google Contacts, Outlook, macOS Contacts
 */
export const generateVCard = (contact) => {
  if (!contact) return "";
  const fullName = contact.fullName || contact.name || contact.username || "Contact";
  const username = contact.username || "";
  const phone = contact.phone || "";
  const email = contact.email || "";
  const note = contact.about || contact.bio || "Shared via Pulse Messenger";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fullName}`,
    `N:${fullName};;;;`,
    username ? `NICKNAME:${username}` : "",
    phone ? `TEL;TYPE=CELL,VOICE:${phone}` : "",
    email ? `EMAIL;TYPE=INTERNET,HOME:${email}` : "",
    note ? `NOTE:${note.replace(/\r?\n/g, " ")}` : "",
    "PRODID:-//Pulse Messenger//Contact Card//EN",
    "END:VCARD",
  ].filter(Boolean);

  return lines.join("\r\n");
};

export const downloadVCard = (contact) => {
  if (!contact) return;
  const vcardContent = generateVCard(contact);
  const blob = new Blob([vcardContent], { type: "text/vcard;charset=utf-8" });
  const rawName = contact.fullName || contact.username || contact.name || "contact";
  const filename = `${rawName.trim().replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_")}.vcf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
