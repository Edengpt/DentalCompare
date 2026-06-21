const benefits = [
  {
    number: "I",
    title: "חסכון של אלפי שקלים",
    description:
      "השוואה חכמה שמה את כוח המיקוח אצלכם. מטופלים שלנו חוסכים בממוצע ₪3,400 לטיפול שיניים מורכב.",
  },
  {
    number: "II",
    title: "שליחה מרוכזת",
    description:
      "בקשה אחת מגיעה לעד 10 מרפאות במקביל. במקום שעות שיחות טלפון — שלוש דקות מול המסך.",
  },
  {
    number: "III",
    title: "שומרים על הפרטיות",
    description:
      "המידע הרפואי מועבר אך ורק לרופאים שאתם בחרתם. ללא שיתוף עם גורמים שלישיים, ללא ספאם.",
  },
  {
    number: "IV",
    title: "ללא שיחות טלפון",
    description:
      "הרופאים חוזרים אליכם ישירות למייל עם הצעה כתובה ומפורטת. אתם משווים בנחת, בזמן שלכם.",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-16 lg:grid-cols-[1fr_2fr] lg:items-start lg:gap-20">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow">למה DentalCompare</p>
            <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              ארבעה דברים שעשינו אחרת.
            </h2>
            <p className="text-muted-foreground mt-5 leading-relaxed text-pretty">
              לקח לנו שנה לנסח את ההבטחה הזאת. בלי מילים גדולות. בלי &ldquo;פלטפורמה מהפכנית&rdquo;.
              רק התשובה לארבעה כאבים אמיתיים של מטופלים.
            </p>
          </div>

          <ul className="divide-border/60 divide-y">
            {benefits.map((b) => (
              <li
                key={b.number}
                className="group grid grid-cols-[auto_1fr] gap-6 py-8 first:pt-0 last:pb-0 sm:gap-10"
              >
                <span className="font-display text-teal-deep/50 group-hover:text-teal-deep text-3xl leading-none font-bold transition-colors sm:text-4xl">
                  {b.number}
                </span>
                <div>
                  <h3 className="font-display text-foreground text-2xl leading-tight font-bold">
                    {b.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 leading-relaxed">{b.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
