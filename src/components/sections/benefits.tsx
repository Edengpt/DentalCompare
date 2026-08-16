const benefits = [
  {
    number: "I",
    title: "חוסכים אלפי שקלים",
    description:
      "השוואה שקופה מחזירה אליכם את כוח המיקוח. מטופלים שלנו חוסכים בממוצע ₪3,400 בטיפול מורכב — ולא פעם הרבה יותר.",
  },
  {
    number: "II",
    title: "בקשה אחת, 3 מרפאות",
    description:
      "במקום שעות של שיחות טלפון וסבבי מיילים — שלוש דקות מול המסך, והבקשה כבר בדרך לכל הרופאים במקביל.",
  },
  {
    number: "III",
    title: "הפרטיות שלכם נשמרת",
    description:
      "המסמכים הרפואיים מגיעים אך ורק לרופאים שבחרתם. בלי שיתוף עם צד שלישי, בלי פרסום, ובלי ספאם.",
  },
  {
    number: "IV",
    title: "אפס הגעות מיותרות למרפאות",
    description:
      "במקום להסתובב בין מרפאה למרפאה ולתאם פגישות רק כדי לשמוע כמה זה יעלה — ההצעות מגיעות אליכם כתובות ומפורטות. מגיעים למרפאה רק כשכבר בחרתם.",
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
              ארבעה כאבים. ארבעה פתרונות.
            </h2>
            <p className="text-muted-foreground mt-5 leading-relaxed text-pretty">
              בלי מילים גדולות ובלי &ldquo;פלטפורמה מהפכנית&rdquo; — רק תשובה ישירה לארבעה כאבים שכל
              מי שעומד לפני טיפול שיניים יקר מכיר היטב.
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
