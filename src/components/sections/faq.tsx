import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "כמה זה עולה?",
    a: "כלום. השירות חינמי לחלוטין עבורכם — לא נבקש מכם פרטי אשראי בשום שלב, ואין דמי מנוי או עמלות נסתרות. אנחנו מרוויחים מדמי מנוי שהמרפאות משלמות כדי להופיע במאגר שלנו, ולכן אין לנו שום סיבה לגבות מכם.",
  },
  {
    q: "האם המידע הרפואי שלי מאובטח?",
    a: "כן. כל הקבצים מאוחסנים בענן מוצפן עם גישה פרטית בלבד, מועברים ב-HTTPS, ונשלחים אך ורק לרופאים שאתם בחרתם באופן אישי. איננו חולקים את המידע עם גורמים שלישיים, ואיננו משתמשים בו לפרסום או מכירה. אתם יכולים לבקש מחיקה מלאה בכל עת.",
  },
  {
    q: "כמה זמן לוקח עד שמקבלים הצעות?",
    a: "97% מהבקשות שלנו מקבלות לפחות 3 תשובות תוך 48 שעות. רוב התשובות מגיעות תוך 24 שעות. הרופאים מגיבים ישירות למייל שלכם — אין צורך לחזור לאתר.",
  },
  {
    q: "איך הרופאים מגיבים אליי?",
    a: "כל רופא מקבל מייל ייעודי עם המסמכים שלכם וקישור אישי להגשת הצעת מחיר. תקבלו תשובות אישיות במייל — בדיוק כמו שהייתם פונים ישירות, רק שעכשיו אתם פונים ל-3 מרפאות בו זמנית.",
  },
  {
    q: "מה אם אני לא מרוצה מאף הצעה?",
    a: "אין שום התחייבות לקבל אף הצעה. הפלטפורמה היא רק כלי השוואה — אתם בוחרים אם וכמתי להתחיל טיפול, ועם מי. גם אם בחרתם בסוף לחזור לרופא המקורי שלכם, לפחות יש בידיכם כוח מיקוח עם הצעות בכתב.",
  },
  {
    q: "אילו סוגי טיפולים מתאימים לפלטפורמה?",
    a: "DentalCompare מתאים במיוחד לטיפולים יקרים: השתלות, כתרים וגשרים, יישור שיניים, שיקום הפה, טיפולי שורש מורכבים ואסתטיקה. עבור טיפולים פשוטים כמו סתימות בודדות — ההפרשים בין מרפאות בדרך כלל קטנים יותר.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <div className="text-center">
          <p className="eyebrow justify-center">שאלות נפוצות</p>
          <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            יש לכם שאלה? כנראה שאחרים שאלו אותה גם.
          </h2>
        </div>

        <Accordion className="mt-14 w-full" defaultValue={["item-0"]}>
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`} className="border-border/60">
              <AccordionTrigger className="text-foreground py-6 text-right text-lg font-semibold hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-muted-foreground mt-12 text-center text-sm">
          יש שאלה נוספת?{" "}
          <a
            href="mailto:support@dentalcompare.co.il"
            className="text-teal-deep font-semibold underline underline-offset-4 hover:no-underline"
          >
            כתבו לנו
          </a>
          — נחזור אליכם תוך 24 שעות.
        </p>
      </div>
    </section>
  );
}
