import type { FormDef } from './types';
import { headerSection } from './header';
import { closingSections } from './common';

const CHECK_BASIS = 'מס\' : 5750-1102-2015-000467 מתאריך : 12.09.2023';

export const detectors: FormDef = {
  id: 'detectors',
  docNumber: '',
  title: 'רשימת תיוג גלאים עצמאיים',
  shortTitle: 'גלאים עצמאיים',
  version: 1,
  sections: [
    headerSection({ gushHelkaMigrash: true, installer: true }),
    {
      id: 'building',
      title: 'פרטי המבנה',
      fields: [
        { id: 'companyName', type: 'text', label: 'שם החברה' },
        { id: 'companyAddress', type: 'text', label: 'כתובת החברה' },
        { id: 'floors', type: 'number', label: "מס' קומות" },
        { id: 'apartmentsInBuilding', type: 'number', label: "מס' דירות בבניין" },
        { id: 'apartmentsWithDetectors', type: 'number', label: "מס' דירות שהותקנו גלאים עצמאיים" },
      ],
    },
    {
      id: 'detectorInfo',
      title: 'פרטי גלאי עצמאי',
      fields: [
        { id: 'detectorModel', type: 'text', label: 'דגם' },
        { id: 'detectorMaker', type: 'text', label: 'מתוצרת חברת' },
        { id: 'detectorLocation', type: 'text', label: 'מיקום התקנת הגלאי' },
        { id: 'batteryModel', type: 'text', label: 'דגם סוללת הגלאי' },
      ],
    },
    {
      id: 'basis',
      title: 'בדיקת התאמה לדרישות נציבות כבאות והצלה',
      fields: [{ id: 'basisNote', type: 'note', text: CHECK_BASIS }],
    },
    {
      id: 'general',
      title: 'כללי',
      fields: [
        { id: 'c1', type: 'check', clause: '1', topic: 'כללי', text: 'האם הגלאי המותקן מאושר לתקן 1220 חלק 5', answers: 'fitNotfitNA' },
        { id: 'c2', type: 'check', clause: '2', topic: 'כללי', text: "האם הותקינו גלאי עשן בכל ד'רות המוגרים", answers: 'fitNotfitNA' },
        { id: 'c3', type: 'check', clause: '3', topic: 'כללי', text: 'האם הותקינו גלאים בכל מקבץ חדרים', answers: 'fitNotfitNA' },
        { id: 'c4', type: 'check', clause: '4', topic: 'כללי', text: 'בדירות " מעטפת האם הותקינו גלאי עשן בהתאם לתוכנית החלוקה שהוגישה בהיתר', answers: 'fitNotfitNA' },
      ],
    },
    {
      id: 'power',
      title: 'חיבור זינה',
      fields: [
        { id: 'c5', type: 'check', clause: '5', topic: 'חיבור זינה', text: 'חיבור הגלאים למתח זינה בוצע ממפסק חצי אוטומטי נפרד או מחצי אוטומטי של קו התאורה עם סימון', answers: 'fitNotfitNA' },
        { id: 'c6', type: 'check', clause: '6', topic: 'חיבור זינה', text: 'הבדיקה בוצעה עם חשמל', answers: 'fitNotfitNA' },
      ],
    },
    {
      id: 'install',
      title: 'התקנת גלאי עצמאי',
      fields: [
        { id: 'c7', type: 'check', clause: '7', topic: 'התקנת גלאי עצמאי', text: 'הגלאי מרוחק מקירות לפחות 102 מ"מ', answers: 'fitNotfitNA' },
        { id: 'c8', type: 'check', clause: '8', topic: 'התקנת גלאי עצמאי', text: 'הגלאי ממוקם בהאתם להוראות נציב 550', answers: 'fitNotfitNA' },
        { id: 'c9', type: 'check', clause: '9', topic: 'התקנת גלאי עצמאי', text: 'הגלאי עומד בתנאי סבביה בגבולות היצרן', answers: 'fitNotfitNA' },
        { id: 'c10', type: 'check', clause: '10', topic: 'התקנת גלאי עצמאי', text: 'הגלאי ממוקם מפתח מיזוג אוויר /מאווריר תקרה לפחות 105 מטר', answers: 'fitNotfitNA' },
        { id: 'c11', type: 'check', clause: '11', topic: 'התקנת גלאי עצמאי', text: 'הגלאי מרוחק מקורות לפחות במרחק של גובה הקורה', answers: 'fitNotfitNA' },
        { id: 'c12', type: 'check', clause: '12', topic: 'התקנת גלאי עצמאי', text: 'הגאלי העצמאי ממוקם במרחק של 1 מטר מדלת הכניסה לאמבטיה', answers: 'fitNotfitNA' },
      ],
    },
    {
      id: 'indications',
      title: 'בדיקת חיווים ובקורת',
      fields: [
        { id: 'c13', type: 'check', clause: '13', topic: 'בדיקת חיווים ובקורת', text: 'על גבאי הגלאי ישנם מנורת חיווי ירוקה –ציון מתחת רשת ,אדומה-אזעקה', answers: 'fitNotfitNA' },
        { id: 'c14', type: 'check', clause: '14', topic: 'בדיקת חיווים ובקורת', text: 'ניתוק מתח רשת מבוקר מתקבל התראה בגלאי כגגון כיבוי מנורת חיווי', answers: 'fitNotfitNA' },
        { id: 'c15', type: 'check', clause: '15', topic: 'בדיקת חיווים ובקורת', text: 'ניתוק סוללת גיבוי מתקבל חיווי על ידי צפצוף ייחודי', answers: 'fitNotfitNA' },
        { id: 'c16', type: 'check', clause: '16', topic: 'בדיקת חיווים ובקורת', text: 'אם בגלאי קיים השתקת צופר ,מפסק זה יהיה רגעי', answers: 'fitNotfitNA' },
        { id: 'c17', type: 'check', clause: '17', topic: 'בדיקת חיווים ובקורת', text: 'אות אזעקה מקבל עדיפות מאות תקלה', answers: 'fitNotfitNA' },
      ],
    },
    {
      id: 'operation',
      title: 'פעולה',
      fields: [
        { id: 'c18', type: 'check', clause: '18', topic: 'פעולה', text: 'נבדקו פעולתם של כל הגלאים המותקנים', answers: 'fitNotfitNA' },
        { id: 'c19', type: 'check', clause: '19', topic: 'פעולה', text: 'עוצמת הצופר שנמדדה ליד הגלאי אינה מופחת מהוראות היצרן', answers: 'fitNotfitNA' },
      ],
    },
    {
      id: 'documents',
      title: 'מסמכים',
      fields: [
        { id: 'c20', type: 'check', clause: '20', topic: 'מסמכים', text: 'המתקין /ספק או קבלן מסר לבעלים או אחראי חוברת הדרכה הכוללת הוראות לבדיקת תחזוקה ,הוראות לשירות ,תיקון או החלפה בשפה העברית', answers: 'fitNotfitNA' },
        { id: 'c21', type: 'check', clause: '21', topic: 'הצהרת חשמלאי', text: 'האם התקבל הצהרה מחשמלאי לחיבור הגלאים למתח זינה או למתח סוללות לאחר חיבור שעון החשמל לדירה והזנת הגלאי ממתח רשת קבוע', answers: 'fitNotfitNA' },
      ],
    },
    {
      id: 'apartments',
      title: 'פירוט דירות',
      fields: [
        {
          id: 'apartments',
          type: 'repeatTable',
          label: 'פירוט דירות',
          columns: [
            { id: 'floor', label: 'קומה', type: 'text' },
            { id: 'apartment', label: "מס' דירה", type: 'text' },
            { id: 'count', label: 'כמות גלאים', type: 'number' },
            { id: 'location', label: 'מיקום גלאים', type: 'text' },
          ],
        },
      ],
    },
    {
      id: 'conclusion',
      title: 'מסקנה',
      fields: [
        {
          id: 'conclusion',
          type: 'check',
          clause: 'מסקנה',
          topic: 'מסקנה',
          text: 'התקנת גלאי עצמאי בדירות מתאימה / לא מתיאמה למסמך כבאות מס\' 5750-1102-2015-000467',
          answers: 'conclusion',
        },
      ],
    },
    ...closingSections({ inspectorLabel: 'שם הבודק', approverLabel: 'שם המאשר' }),
  ],
};
