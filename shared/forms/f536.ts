import type { Field, FormDef } from './types';
import { headerSection } from './header';
import { closingSections } from './common';

const docs: string[] = [
  'משטר הפעלות מערכת בטיחות',
  "תעודת תחזוקה/ מעבדה – מערכת גילוי אש וכריזה 1220 חלק ג'",
  'תעודת תחזוקה/ מעבדה – מערכת כיבוי אש אוטומטית – 1597 / 5210',
  'תעודת תחזוקה/ מעבדה – מערכת כיבוי אש במים – 1928/1596',
  'תעודת תחזוקה/ מעבדה – מערכות מיזוג אוויר ואוורור – ת"י 1001 חלק 1',
  'תעודת תחזוקה/ מעבדה – מערכות מיזוג אוויר ואוורור – ת"י 1001 חלק 2',
  'אישור מהנדס /מעבדה מערכת פינוי עשן',
  'אישור תחזוקה/ מעבדה מעליות ת"י 1953 חלק 12',
  'אישור גנרטור / חשמלאי',
  'מערכת תאורת חירום אישור חשמלאי',
  'משטר הפעלות (מטריצת הפעלות יועץ בטיחות)',
];

const panelItems: string[] = [
  'לוח משנה',
  'מיקרופון כריזת חירום',
  'ניתוק חשמל ראשי',
  'ניתוק גנרטור עם מפתח',
  'פנל חיווי מפוחים (בוררים)',
  'פנל חיווי גנרטור',
  'טלפון כבאים',
  'חיווי חלונות שחרור עשן',
  'נורית סימון להפסקת חשמל',
  'נורית סימון להפעלת פינוי עשן',
  'נורית סימון להפעלת מערכת על לחץ',
];

const panelActions: string[] = [
  'כבלי פיקוד למערכות חירום חסיני אש',
  'נבדקו פעולות של מפסקי מפוחי עשן ידני',
  'חיווי העברת מפסק חשמלי לשליטה במפוחים/על לחץ בפנל הכבאים למצב OFF יפעיל הדלקת נורית וזמזם בפנל הכבאים וחיווי ברכזת גילוי עשן .',
  'נבדקו נבדק חיווי גנרטור',
  'נבדק מפסק ניתוק חשמל',
  'נבדק מפסק להדממת גנרטור',
  'נבדק פעולתם של לחצני פיקוד חלונות עשן שחרור עשן',
  'נבדק פעולתם למערכות חירום בגיבוי גנרטור',
];

const preTest: string[] = [
  'חשמל קבוע הוחזר למבנה',
  'רכזת גילוי מאופסת ללא התרעות/תקלה',
  'מערכת כריזת חירום במצב עולה וגיבוי סוללות',
  'מפסקי מפוחים במצב אוטומטי – מפוחים מחוברים ומוכנים לפעולה.',
];

const scenarioActions: string[] = [
  'התראה ברכזת גילוי עשן',
  'הפעלת חייגן',
  'הפעלת מערכת כריזה',
  'הפעלת צופרים ונצנצים',
  'אזעקת אש בלוח משנה',
  'הורדת מעליות',
  'הפסקת מערכת איוורור',
  'הפעלת מפוחים שחרור עשן /פתיחת חלונות',
  'שחרור דלתות',
  'ניתוק חשמל',
  'ניתוק לוח חשמל',
];

const systems = ['גילוי', 'מיזוג אוויר', 'חשמל', 'שחרור עשן', 'מעליות', 'כיבוי אש במים'];

export const f536: FormDef = {
  id: 'f536',
  docNumber: 'T-20004-5',
  title: 'רשימת תיוג משטר הפעלות מכ"ר 536',
  shortTitle: 'משטר הפעלות מכ"ר 536',
  version: 1,
  sections: [
    headerSection({ gushHelkaMigrash: true }),
    {
      id: 'details',
      title: 'פרטי הלקוח / הזמנה ומהות הבדיקה',
      fields: [
        { id: 'designerName', type: 'text', label: 'שם מתכנן' },
        { id: 'purposeNote', type: 'note', text: 'בדיקת משטר הפעלות מערכות חירום בהתאם לתקן 1220 חלק 3 והוראת מכ"ר 536 למבנה חדש / ביקורת תקופתית.' },
        { id: 'inspectionType', type: 'choice', label: 'מהות הבדיקה', options: ['מבנה חדש', 'ביקורת תקופתית'] },
        { id: 'previousCertNumber', type: 'text', label: 'מס\' תעודה קודמת' },
        { id: 'heightClass', type: 'text', label: 'סיווג הבניין לפי גובה' },
        { id: 'floorsDetail', type: 'text', label: 'פירוט קומות' },
        { id: 'inspectionStage', type: 'text', label: 'הבדיקה היא בשלב' },
        { id: 'testedSpaceHeight', type: 'text', label: 'גובה חלל נבדק' },
      ],
    },
    {
      id: 'documents',
      title: 'רשימת מסמכים',
      fields: [
        { id: 'docsStage', type: 'text', label: 'שלב הבדיקה' },
        ...docs.map(
          (t, i): Field => ({
            id: `doc${i + 1}`,
            type: 'check',
            topic: 'רשימת מסמכים',
            text: t,
            answers: 'fitNotfitNA',
            inline: [
              { id: 'source', label: 'מקור' },
              { id: 'docNumber', label: "מס' מסמך" },
            ],
          }),
        ),
      ],
    },
    {
      id: 'participants',
      title: 'משתתפים בבדיקה',
      fields: [
        {
          id: 'participants',
          type: 'repeatTable',
          label: 'משתתפים בבדיקה',
          columns: [
            { id: 'system', label: 'מערכת', type: 'choice', options: systems },
            { id: 'name', label: 'שם', type: 'text' },
            { id: 'company', label: 'נציג חברה', type: 'text' },
          ],
        },
        { id: 'systemsNote', type: 'note', text: 'מערכות משתתפות בבדיקת משטר ההפעלות ימולא בהתאם למערכות המותקנות באתר.' },
        { id: 'installedSystems', type: 'systemsGrid', systems: ["מערכת לגילוי עשן חלק ג'", ...systems.slice(1)], allowOther: true },
      ],
    },
    {
      id: 'docReview',
      title: 'בדיקת מסמכים',
      fields: [
        {
          id: 'docReview',
          type: 'repeatTable',
          label: 'בדיקת מסמכים',
          columns: [
            { id: 'topic', label: 'נושאים לבדיקה', type: 'text' },
            { id: 'fit', label: 'התאמה לתקן', type: 'choice', options: ['מתאים', 'לא מתאים', 'ל"י'] },
            { id: 'notes', label: 'הערות', type: 'text' },
          ],
        },
      ],
    },
    {
      id: 'routine',
      title: 'מצב מערכת בשגרה לפני בדיקה',
      fields: [
        { id: 'routineDetection', type: 'note', text: 'מצב מערכת הגילוי – מצב המתנה' },
        { id: 'routinePump', type: 'text', label: 'מצב משאבת אש' },
        { id: 'routineSmoke', type: 'text', label: 'מצב מערכת פינוי עשן' },
        { id: 'routineAc', type: 'text', label: 'מצב מערכת מיזוג' },
        { id: 'routineElevators', type: 'text', label: 'מעליות' },
        { id: 'routineLighting', type: 'text', label: 'תאורת חירום' },
        { id: 'scenarioPages', type: 'text', label: 'מסמך T-20004-5.1 של סצנריות אירועים – מספר דפים' },
      ],
    },
    {
      id: 'firePanel',
      title: 'בעמדת כבאים מותקנים',
      fields: panelItems.map(
        (t, i): Field => ({ id: `panel${i + 1}`, type: 'check', clause: '7', topic: 'בעמדת כבאים מותקנים', text: t, answers: 'existsActive' }),
      ),
    },
    {
      id: 'panelActions',
      title: 'פעולות לביצוע בפנל כבאים',
      fields: panelActions.map(
        (t, i): Field => ({ id: `action${i + 1}`, type: 'check', clause: '7.1', topic: 'פעולות לביצוע בפנל כבאים', text: t, answers: 'fitNotfitNA' }),
      ),
    },
    {
      id: 'scenarios',
      title: 'בדיקת משטר הפעלות',
      fields: [
        {
          id: 'scenarios',
          type: 'scenarioMatrix',
          actions: [...scenarioActions, '', '', ''],
          columns: ['גלאי ראשון', 'גלאי שני', 'לחצן', 'רגש זרימה', 'גלאי ראשון בלוח חשמל', 'גלאי שני בלוח חשמל'],
          values: ['+', 'למ', '-', 'לח'],
          tableFields: [
            { id: 'tableNo', label: 'טבלה מס' },
            { id: 'location', label: 'מיקום הבדיקה' },
            { id: 'detail', label: 'פירוט הבדיקה' },
            { id: 'addresses', label: 'כתובת התקנים' },
          ],
        },
      ],
    },
    {
      id: 'consultantMatrix',
      title: 'טבלת משטר הפעלות של יועץ הבטיחות',
      fields: [{ id: 'consultantMatrix', type: 'photos', label: 'צילום / סריקה של טבלת משטר ההפעלות של יועץ הבטיחות' }],
    },
    {
      id: 'preTest',
      title: 'טרום בדיקה',
      fields: preTest.map((t, i): Field => ({ id: `pre${i + 1}`, type: 'check', clause: '8', topic: 'טרום בדיקה', text: t, answers: 'yesNoNA' })),
    },
    {
      id: 'planConclusion',
      title: 'מסקנה להתאמת מכ"ר 500 הוראה 536',
      fields: [
        {
          id: 'planConclusion',
          type: 'check',
          topic: 'מסקנה להתאמת מכ"ר 500 הוראה 536',
          text: 'תוצאות בדיקת התכנון: תכנון המערכת מתאים/ לא מתאים .',
          answers: 'conclusion',
        },
      ],
    },
    ...closingSections({ inspectorLabel: 'בודק', approverLabel: 'ראש תחום' }),
  ],
};
