const testimonials = [
  {
    quote:
      "קיבלתי הצעה ל-3 השתלות בסכום של 27,500 ₪. דרך DentalCompare קיבלתי 6 הצעות תוך 3 ימים — הזולה הייתה 19,200 ₪. חסכתי כמעט 30%.",
    name: "אורי בן-דוד",
    location: "רעננה",
    savings: "₪8,300",
    treatment: "3 השתלות + כתרים",
  },
  {
    quote:
      "הייתי בטוחה שאני חייבת ללכת לרופא המשפחה שלי כי הוא 'כבר מכיר אותי'. גיליתי שיש מרפאה במרחק 10 דקות שמציעה את אותו הטיפול ב-40% פחות. שוקית.",
    name: "מאיה כהן",
    location: "תל אביב",
    savings: "₪4,100",
    treatment: "טיפול שורש + כתר",
  },
  {
    quote:
      "כאמא לשלושה, אין לי זמן לרוץ בין מרפאות. העליתי את התוכנית של בעלי בערב, בבוקר היו כבר 4 הצעות. בחרנו את המרפאה שהכי התאימה לנו מבחינת זמינות וגם חסכנו.",
    name: "שירה לוי",
    location: "מודיעין",
    savings: "₪2,800",
    treatment: "יישור שיניים",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-muted/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow justify-center">מטופלים שלנו</p>
          <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            סיפורי חיסכון אמיתיים.
          </h2>
          <p className="text-muted-foreground mt-5 text-lg text-pretty">
            שלושה מטופלים, שלושה טיפולים שונים — ואותה מחשבה בסוף: &ldquo;למה לא עשיתי את זה
            קודם?&rdquo;
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3 lg:mt-20">
          {testimonials.map((t, i) => (
            <figure
              key={t.name}
              className={`bg-card ring-border/60 relative flex flex-col rounded-3xl p-8 ring-1 transition-all hover:shadow-lg ${
                i === 1 ? "md:mt-12" : ""
              }`}
            >
              {/* Decorative quote mark */}
              <span
                aria-hidden="true"
                className="font-display text-teal/15 absolute end-6 top-2 text-7xl leading-none select-none"
              >
                &ldquo;
              </span>

              <blockquote className="text-foreground relative flex-1 text-base leading-relaxed">
                {t.quote}
              </blockquote>

              <div className="border-border/60 mt-8 flex items-end justify-between gap-4 border-t pt-6">
                <figcaption>
                  <div className="text-foreground font-semibold">{t.name}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {t.location} ✦ {t.treatment}
                  </div>
                </figcaption>
                <div className="text-end">
                  <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    חסך/ה
                  </div>
                  <div className="font-display text-teal-deep text-xl leading-none font-bold">
                    {t.savings}
                  </div>
                </div>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
