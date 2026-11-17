import type { Field, FormDef } from './types';
import { headerSection } from './header';
import { closingSections, protectedSpacesTable, NOTICE_TITLE } from './common';

export const aerosol: FormDef = {
  id: 'aerosol',
  docNumber: '',
  title: 'רשימת תיוג לבדיקת מערכת כיבוי אש בארוסול',
  shortTitle: 'כיבוי אש בארוסול',
  version: 1,
  sections: [
    headerSection({ gushHelkaMigrash: true, owner: true, installer: true, times: true }),
    {
      id: 'site',
      title: 'סקירת האתר המוגן',
      fields: [
        { id: 'buildingArea', type: 'number', label: 'שטח המבנה (מ"ר)' },
        { id: 'buildingHeight', type: 'number', label: 'גובה המבנה (מטר)' },
        { id: 'buildingDescription', type: 'textarea', label: 'תיאור האתר (מספר מבנים באתר, מספר קומות, מספר קומות עליונות ומספר קומות מרתף, מיקום הפרויקט במבנה, יעוד)' },
      ],
    },
    { id: 'spaces', title: 'חללים מוגנים', fields: [protectedSpacesTable()] },
    {
      id: 'equipment',
      title: 'אביזרי המערכת',
      fields: [
        {
          id: 'equipment',
          type: 'equipmentTable',
          rows: ['רכזת אנלוגית / אזורית', 'סוללות גיבוי', 'חייגן אוטומטי', 'גלאי עשן', 'גלאי חום', 'גלאי קרן', 'גלאי להבה', 'לחצני הפעלה', 'צופר פנימי', 'צופר חיצוני', 'מנורת סימון', 'לוח משנה', 'צופר פנימי נצנץ', 'צופר חיצוני נצנץ', 'מחולל ארוסול', 'כרטיס כיבוי', 'כרטיס כתובת'],
        },
      ],
    },
    {
      id: 'notice',
      title: 'אישור קבלת הודעה',
      fields: [
        { id: 'noticeAck1', type: 'contactAck', label: NOTICE_TITLE },
        { id: 'noticeAck2', type: 'contactAck', label: `${NOTICE_TITLE} – נוסף` },
        { id: 'dialerPhone', type: 'text', label: 'מספר קו טלפון המחובר לחייגן' },
      ],
    },
    {
      id: 'results',
      title: 'תוצאות הבדיקה',
      fields: [
        { id: 'c1', type: 'check', clause: "1", topic: "תוצאות הבדיקה", text: "האם הוצגו דרישות כב\"א", answers: 'yesNoNA' },
        { id: 'c2', type: 'check', clause: "2", topic: "תוצאות הבדיקה", text: "האם קיימת התאמה בין בתוכניות של החלל המוגן למידות ותצורת החלל בפועל.", answers: 'yesNoNA' },
        { id: 'c3', type: 'check', clause: "3", topic: "תוצאות הבדיקה", text: "האם קיימת התאמה בין נפח החלל המוגן לתכנון", answers: 'yesNoNA' },
        { id: 'c4', type: 'check', clause: "4", topic: "תוצאות הבדיקה", text: "קיימת אטימות לפתחי אוורור – במידה ואין אטימות האם קיים חישוב לתוספת חומר כיבוי כפיצוי מ10%-30%", answers: 'yesNoNA' },
        { id: 'c5', type: 'check', clause: "5", topic: "תוצאות הבדיקה", text: "האם מקדמי התכנון מתאימים לחלל המוגן", answers: 'yesNoNA' },
        { id: 'c6', type: 'check', clause: "6", topic: "תוצאות הבדיקה", text: "האם משקל חומר הכיבוי ומספר המחוללים מתאים לתכנון.", answers: 'yesNoNA' },
        { id: 'c7', type: 'check', clause: "7", topic: "תוצאות הבדיקה", text: "האם סימון המחוללים מתאים לתקן?", answers: 'yesNoNA' },
        { id: 'c8', type: 'check', clause: "8", topic: "תוצאות הבדיקה", text: "האם טמפרטורת הסביבה מתאימה לטווח הטמפרטורה המותר על ידי היצרן", answers: 'yesNoNA' },
        { id: 'c9', type: 'check', clause: "9", topic: "תוצאות הבדיקה", text: "המרחק בין מוצא המחולל לחומרים בעירים גדול מ 0.5 מטר או הוראות היצרן?", answers: 'yesNoNA' },
        { id: 'c10', type: 'check', clause: "10", topic: "תוצאות הבדיקה", text: "מיקום המחולל ואופן התקנתו תואמת את הוראות היצרן", answers: 'yesNoNA' },
        { id: 'c11', type: 'check', clause: "11", topic: "תוצאות הבדיקה", text: "וודא כי המחולל, רכיביו וחיבוריו החשמליים אינם פגומים.", answers: 'yesNoNA' },
        { id: 'c12', type: 'check', clause: "12", topic: "תוצאות הבדיקה", text: "האם התקנת המחולל יציבה.", answers: 'yesNoNA' },
        { id: 'c13', type: 'check', clause: "13", topic: "תוצאות הבדיקה", text: "האם המחולל מותאם לרכזת גילוי האש", answers: 'yesNoNA' },
        { id: 'c14', type: 'check', clause: "14", topic: "תוצאות הבדיקה", text: "המרחק בין מוצא האירוסול במחולל לגורמים מפריעים בחלל המוגן גדול מהמוגדר בהוראות היצרן.", answers: 'yesNoNA' },
        { id: 'c15', type: 'check', clause: "15", topic: "תוצאות הבדיקה", text: "האם המתקין הוסמך להתקנת אירוסולים על ידי היצרן או מי מטעמו", answers: 'yesNoNA' },
        { id: 'c16', type: 'check', clause: "16", topic: "תוצאות הבדיקה", text: "מערכת גילוי האש נבדקה ואושרה:", answers: 'yesNoNA', inline: [{ id: 'labName', label: 'שם המעבדה' }, { id: 'certNumber', label: 'מס\' תעודה' }] },
        { id: 'c17', type: 'check', clause: "17", topic: "תוצאות הבדיקה", text: "קבלת התרעות שמע וחזותיות", answers: 'yesNoNA' },
        { id: 'c18', type: 'check', clause: "18", topic: "תוצאות הבדיקה", text: "האם בתום הבדיקה מערכת החשמל נמצאת במצב מופעל", answers: 'yesNoNA' },
        { id: 'c19', type: 'check', clause: "19", topic: "תוצאות הבדיקה", text: "האם המחוללים מקבלים פיקוד להפעלת המחולל", answers: 'yesNoNA' },
        { id: 'c20', type: 'check', clause: "20", topic: "תוצאות הבדיקה", text: "האם בעת גילוי אש על ידי המערכת גורמת לניתוק מתח הזנה ללוח", answers: 'yesNoNA' },
        { id: 'c21', type: 'check', clause: "21", topic: "תוצאות הבדיקה", text: "האם הפעלת לחצנים מפעילה את הפעולות הנדרשות מהמערכת", answers: 'yesNoNA' },
        { id: 'c22', type: 'check', clause: "22", topic: "תוצאות הבדיקה", text: "האם השילוט בהתאם למופיע בסעיפי התקן", answers: 'yesNoNA' },
        { id: 'c23', type: 'check', clause: "23", topic: "תוצאות הבדיקה", text: "האם מתקבלות התרעות תקלה ברכזת בעת ניתוק המחולל ממוצא הכיבוי.", answers: 'yesNoNA' },
      ] as Field[],
    },
    {
      id: 'drawing',
      title: 'תרשים התקנת המחולל בחלל המוגן',
      fields: [{ id: 'installDrawing', type: 'drawing', label: 'תרשים התקנת המחולל בחלל המוגן' }],
    },
    ...closingSections({ inspectorLabel: 'שם בודק', approverLabel: 'שם המאשר' }),
  ],
};
