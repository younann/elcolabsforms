// israeli number to wa.me format, or null when invalid
export function normalizeIlPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0')) d = '972' + d.slice(1);
  return /^972\d{8,9}$/.test(d) ? d : null;
}

export function jobMessage(j: {
  inspectorName: string;
  clientName: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  siteName: string;
  siteAddress: string;
  plannedDate: string;
  forms: string[];
  note?: string | null;
  link: string;
}): string {
  const d = new Date(`${j.plannedDate}T12:00:00Z`);
  const date = Number.isNaN(d.getTime())
    ? j.plannedDate
    : d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', year: 'numeric' });
  const contact = [j.contactPerson, j.contactPhone].filter((x) => x && x.trim()).join(' ');
  const lines = [
    `שלום ${j.inspectorName},`,
    `נקבעה לך בדיקה אצל ${j.clientName}`,
    `אתר: ${[j.siteName, j.siteAddress].filter((x) => x && x.trim()).join(', ')}`,
    `תאריך: ${date}`,
    contact && `איש קשר: ${contact}`,
    j.forms.length ? `טפסים: ${j.forms.join(', ')}` : '',
    j.note && j.note.trim() ? `הערה: ${j.note.trim()}` : '',
    `לפתיחה: ${j.link}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
