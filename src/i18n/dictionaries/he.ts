/**
 * Hebrew is the source of truth.
 *
 * Every other dictionary is typed `typeof he`, so adding a key here and
 * forgetting it elsewhere fails the build rather than shipping a half-translated
 * page. Add keys here first, always.
 *
 * Deliberately NOT `as const`: that would make every value a literal type and
 * `typeof he` would then demand the same Hebrew text in en.ts. The guarantee
 * comes from the object's shape, not its values.
 */
const he = {
  meta: {
    title: "DentalCompare – השוו מחירים. חסכו אלפי שקלים.",
    description:
      "פלטפורמה להשוואת הצעות מחיר מרופאי שיניים — בבקשה אחת, בחינם. העלאה חד-פעמית של תוכנית טיפול, ללא שיחות טלפון, ללא לחץ.",
    ogTitle: "DentalCompare – השוו מחירים. חסכו אלפי שקלים.",
    ogDescription:
      "קבלו הצעות מחיר מ-3 רופאי שיניים בבקשה אחת, בחינם — ללא שיחות טלפון, ללא לחץ.",
  },
};

export default he;
