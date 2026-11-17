import type { Field, Section } from './types';

type Opts = { gushHelkaMigrash?: boolean; owner?: boolean; installer?: boolean; times?: boolean };

export function headerSection(opts: Opts = {}): Section {
  const f: Field[] = [
    { id: 'date', type: 'date', label: 'תאריך הבדיקה', required: true },
    { id: 'testNumber', type: 'text', label: "מס' בדיקה", required: true },
    { id: 'orderNumber', type: 'text', label: "מס' הזמנה" },
  ];
  if (opts.times) {
    f.push({ id: 'startTime', type: 'time', label: 'שעת התחלת הבדיקה' }, { id: 'endTime', type: 'time', label: 'שעת סיום' });
  }
  f.push(
    { id: 'siteName', type: 'text', label: 'שם האתר', required: true },
    { id: 'siteAddress', type: 'text', label: 'כתובת האתר', required: true },
    { id: 'buildingPurpose', type: 'text', label: 'ייעוד המבנה' },
  );
  if (opts.gushHelkaMigrash) {
    f.push(
      { id: 'gush', type: 'text', label: 'גוש' },
      { id: 'helka', type: 'text', label: 'חלקה' },
      { id: 'migrash', type: 'text', label: 'מגרש' },
    );
  }
  if (opts.owner) {
    f.push(
      { id: 'ownerName', type: 'text', label: 'בעל האתר – שם' },
      { id: 'ownerMobile', type: 'text', label: 'בעל האתר – טלפון נייד' },
      { id: 'ownerOffice', type: 'text', label: 'בעל האתר – משרד' },
    );
  }
  f.push(
    { id: 'customerName', type: 'text', label: 'שם המזמין', required: true },
    { id: 'customerAddress', type: 'text', label: 'כתובת המזמין' },
    { id: 'customerPhone', type: 'text', label: 'טלפון המזמין' },
    { id: 'customerEmail', type: 'text', label: 'כתובת דוא"ל' },
  );
  if (opts.installer) {
    f.push(
      { id: 'installerName', type: 'text', label: 'שם המתקין' },
      { id: 'installerAddress', type: 'text', label: 'כתובת המתקין' },
      { id: 'installerPhone', type: 'text', label: 'טלפון המתקין' },
      { id: 'installerId', type: 'text', label: 'ת.ז המתקין' },
    );
  }
  return { id: 'header', title: 'פרטי הבדיקה', fields: f };
}

export const REQUIRED_HEADER = ['date', 'testNumber', 'siteName', 'siteAddress', 'customerName'] as const;
