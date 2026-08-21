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

  common: {
    switchLanguage: "שפה",
    loading: "טוען…",
  },

  nav: {
    ariaLabel: "ראשי",
    howItWorks: "איך זה עובד",
    faq: "שאלות נפוצות",
    clinicsJoin: "הצטרפות מרפאות",
    signIn: "כניסה",
    getStarted: "התחילו עכשיו",
    dashboard: "אזור אישי",
  },

  hero: {
    eyebrow: "פלטפורמת השוואת מחירים",
    headlineTop: "לא יודעים אם המחיר לטיפול השיניים הוגן?",
    headlineMain: "קבלו 3 הצעות מחיר.",
    headlineAccent: "חסכו אלפי שקלים.",
    benefitUpload: "מעלים פעם אחת: תוכנית טיפול וצילום שיניים.",
    benefitSend: "הבקשה נשלחת ל-3 רופאים מובילים במקביל.",
    benefitCompare: "הצעות המחיר חוזרות ישירות למייל — משווים וחוסכים.",
    benefitNoCalls: "בלי שיחות טלפון, בלי התחייבות, בלי לחץ.",
    cta: "קבלו הצעות מחיר עכשיו",
    secondaryCta: "איך זה עובד?",
    reassurance: "חינם לחלוטין ✦ ללא כרטיס אשראי ✦ ללא התחייבות",
    statDentistsValue: "300+",
    statDentistsLabel: "רופאי שיניים במאגר",
    statResponseValue: "97%",
    statResponseLabel: "מהבקשות מקבלות מענה תוך 48 שעות",
    statSavingsValue: "₪3,400",
    statSavingsLabel: "ממוצע חיסכון לטיפול",
  },

  howItWorks: {
    eyebrow: "איך זה עובד",
    title: "שלושה שלבים — והעבודה הכי קשה היא לחכות.",
    subtitle:
      "בלי טפסים אינסופיים ובלי שיחות מציקות — כל התהליך במסך אחד, ומסתיים בשלוש דקות.",
    step1Title: "מעלים תוכנית טיפול וצילום",
    step1Description:
      "את תוכנית הטיפול שכבר קיבלתם מרופא, ואת צילום השיניים. PDF או תמונה, עד 20MB לקובץ — וזהו.",
    step1Detail: "1–2 דקות",
    step2Title: "בוחרים עד 3 רופאים",
    step2Description:
      "מסננים לפי עיר, התמחות ומבטח, ובוחרים בדיוק את מי שתרצו. הבקשה נשלחת רק לרופאים שסימנתם — אפס ספאם.",
    step2Detail: "פילטרים חכמים",
    step3Title: "ההצעות מגיעות למייל",
    step3Description:
      "כל רופא מקבל את המסמכים ומשיב אליכם הצעת מחיר כתובה. אתם משווים בנחת ובוחרים — בלי שום התחייבות.",
    step3Detail: "תוך 24–48 שעות",
  },

  benefits: {
    eyebrow: "למה DentalCompare",
    title: "ארבעה כאבים. ארבעה פתרונות.",
    subtitle:
      "בלי מילים גדולות ובלי „פלטפורמה מהפכנית” — רק תשובה ישירה לארבעה כאבים שכל מי שעומד לפני טיפול שיניים יקר מכיר היטב.",
    oneTitle: "חוסכים אלפי שקלים",
    oneDescription:
      "השוואה שקופה מחזירה אליכם את כוח המיקוח. מטופלים שלנו חוסכים בממוצע ₪3,400 בטיפול מורכב — ולא פעם הרבה יותר.",
    twoTitle: "בקשה אחת, 3 מרפאות",
    twoDescription:
      "במקום שעות של שיחות טלפון וסבבי מיילים — שלוש דקות מול המסך, והבקשה כבר בדרך לכל הרופאים במקביל.",
    threeTitle: "הפרטיות שלכם נשמרת",
    threeDescription:
      "המסמכים הרפואיים מגיעים אך ורק לרופאים שבחרתם. בלי שיתוף עם צד שלישי, בלי פרסום, ובלי ספאם.",
    fourTitle: "אפס הגעות מיותרות למרפאות",
    fourDescription:
      "במקום להסתובב בין מרפאה למרפאה ולתאם פגישות רק כדי לשמוע כמה זה יעלה — ההצעות מגיעות אליכם כתובות ומפורטות. מגיעים למרפאה רק כשכבר בחרתם.",
  },

  testimonials: {
    eyebrow: "מטופלים שלנו",
    title: "סיפורי חיסכון אמיתיים.",
    subtitle:
      "שלושה מטופלים, שלושה טיפולים שונים — ואותה מחשבה בסוף: „למה לא עשיתי את זה קודם?”",
    savedLabel: "חסך/ה",
    oneQuote:
      "קיבלתי הצעה ל-3 השתלות בסכום של 27,500 ₪. דרך DentalCompare קיבלתי 6 הצעות תוך 3 ימים — הזולה הייתה 19,200 ₪. חסכתי כמעט 30%.",
    oneName: "אורי בן-דוד",
    oneLocation: "רעננה",
    oneSavings: "₪8,300",
    oneTreatment: "3 השתלות + כתרים",
    twoQuote:
      "הייתי בטוחה שאני חייבת ללכת לרופא המשפחה שלי כי הוא „כבר מכיר אותי”. גיליתי שיש מרפאה במרחק 10 דקות שמציעה את אותו הטיפול ב-40% פחות.",
    twoName: "מאיה כהן",
    twoLocation: "תל אביב",
    twoSavings: "₪4,100",
    twoTreatment: "טיפול שורש + כתר",
    threeQuote:
      "כאמא לשלושה, אין לי זמן לרוץ בין מרפאות. העליתי את התוכנית של בעלי בערב, בבוקר היו כבר 4 הצעות. בחרנו את המרפאה שהכי התאימה לנו מבחינת זמינות וגם חסכנו.",
    threeName: "שירה לוי",
    threeLocation: "מודיעין",
    threeSavings: "₪2,800",
    threeTreatment: "יישור שיניים",
  },

  faq: {
    eyebrow: "שאלות נפוצות",
    title: "יש לכם שאלה? כנראה שאחרים שאלו אותה גם.",
    contactPrefix: "יש שאלה נוספת?",
    contactLink: "כתבו לנו",
    contactSuffix: "— נחזור אליכם תוך 24 שעות.",
    q1: "כמה זה עולה?",
    a1: "כלום. השירות חינמי לחלוטין עבורכם — לא נבקש מכם פרטי אשראי בשום שלב, ואין דמי מנוי או עמלות נסתרות. אנחנו מרוויחים מדמי מנוי שהמרפאות משלמות כדי להופיע במאגר שלנו, ולכן אין לנו שום סיבה לגבות מכם.",
    q2: "האם המידע הרפואי שלי מאובטח?",
    a2: "כן. כל הקבצים מאוחסנים בענן מוצפן עם גישה פרטית בלבד, מועברים ב-HTTPS, ונשלחים אך ורק לרופאים שאתם בחרתם באופן אישי. איננו חולקים את המידע עם גורמים שלישיים, ואיננו משתמשים בו לפרסום או מכירה. אתם יכולים לבקש מחיקה מלאה בכל עת.",
    q3: "כמה זמן לוקח עד שמקבלים הצעות?",
    a3: "97% מהבקשות שלנו מקבלות לפחות 3 תשובות תוך 48 שעות. רוב התשובות מגיעות תוך 24 שעות. הרופאים מגיבים ישירות למייל שלכם — אין צורך לחזור לאתר.",
    q4: "איך הרופאים מגיבים אליי?",
    a4: "כל רופא מקבל מייל ייעודי עם המסמכים שלכם וקישור אישי להגשת הצעת מחיר. תקבלו תשובות אישיות במייל — בדיוק כמו שהייתם פונים ישירות, רק שעכשיו אתם פונים ל-3 מרפאות בו זמנית.",
    q5: "מה אם אני לא מרוצה מאף הצעה?",
    a5: "אין שום התחייבות לקבל אף הצעה. הפלטפורמה היא רק כלי השוואה — אתם בוחרים אם ומתי להתחיל טיפול, ועם מי. גם אם בחרתם בסוף לחזור לרופא המקורי שלכם, לפחות יש בידיכם כוח מיקוח עם הצעות בכתב.",
    q6: "אילו סוגי טיפולים מתאימים לפלטפורמה?",
    a6: "DentalCompare מתאים במיוחד לטיפולים יקרים: השתלות, כתרים וגשרים, יישור שיניים, שיקום הפה, טיפולי שורש מורכבים ואסתטיקה. עבור טיפולים פשוטים כמו סתימות בודדות — ההפרשים בין מרפאות בדרך כלל קטנים יותר.",
  },

  finalCta: {
    eyebrow: "הצעד הראשון",
    title: "שיניים בריאות לא צריכות לעלות הון.",
    subtitle:
      "המחיר הראשון שאתם מקבלים כמעט אף פעם לא הזול ביותר. הצטרפו לאלפי מטופלים שכבר משווים — וחוסכים אלפי שקלים, בדיסקרטיות ובזמן שלהם.",
    cta: "קבלו הצעות מחיר עכשיו",
    secondaryCta: "יש לי עדיין שאלות",
    reassurance: "✦ חינם לחלוטין ✦ ללא כרטיס אשראי ✦ ללא התחייבות ✦",
  },

  request: {
    rateLimitedTitle: "יותר מדי בקשות חדשות",
    rateLimitedBody:
      "יצרתם הרבה בקשות בזמן קצר. נסו שוב בעוד שעה, או המשיכו בבקשה קיימת מהאזור האישי.",
    backToDashboard: "חזרה לאזור האישי",
  },

  verifyPhone: {
    metaTitle: "אימות מספר נייד",
    eyebrow: "שלב אחרון לפני שליחה",
    title: "נאמת את מספר הנייד שלכם",
    subtitle:
      "המרפאות חוזרות אליכם ישירות, ולכן חשוב שהמספר יהיה נכון. האימות חינמי ולוקח 30 שניות — לא נבקש מכם פרטי אשראי בשום שלב.",
  },

  requestStatus: {
    DRAFT: "טיוטה",
    SUBMITTED: "בשליחה",
    SENT: "נשלחה",
    FAILED: "השליחה נכשלה",
  },

  dashboard: {
    metaTitle: "אזור אישי",
    eyebrow: "אזור אישי",
    adminPanel: "פאנל ניהול",
    greeting: "שלום",
    newRequest: "בקשת מחיר חדשה",
    emptyTitle: "עוד אין בקשות פעילות",
    emptyBody:
      "התחילו את הבקשה הראשונה שלכם — בחרו עד 3 רופאים, העלו את תוכנית הטיפול והצילום, וההצעות יגיעו אליכם למייל.",
    emptyCta: "להתחלת הבקשה",
    myRequests: "הבקשות שלי",
    requestLabel: "בקשה",
    statusLabel: "סטטוס",
    dentistsLabel: "רופאים",
    view: "צפייה בפרטים",
    continue: "המשך",
    fallbackGreetingName: "ברוך הבא",
  },

  requestFlow: {
    uploadMetaTitle: "העלאת מסמכים רפואיים",
    uploadStep: "שלב 1 מתוך 3",
    uploadTitle: "העלאת מסמכים רפואיים",
    uploadSubtitle:
      "שני קבצים בלבד דרושים כדי שהרופאים יוכלו להציע לכם הצעת מחיר מדויקת — תוכנית הטיפול הקיימת וצילום עדכני.",
    dentistsMetaTitle: "בחירת רופאים",
    dentistsStep: "שלב 2 מתוך 3",
    dentistsTitle: "בחרו את הרופאים שיתחרו על הטיפול שלכם.",
    dentistsSubtitle:
      "סננו לפי מיקום, התמחות ומבטח. סמנו עד 3 רופאים — והבקשה שלכם תישלח לכולם בו זמנית.",
    successMetaTitle: "הבקשה נשלחה",
    // A function rather than a split string: the count sits mid-sentence, and
    // English needs the singular/plural to agree with it.
    successBodySent: (count: number) =>
      `שלחנו את תוכנית הטיפול והצילום ל-${count} רופאים. הצעות המחיר יגיעו ישירות לאימייל שלכם — בדרך כלל תוך 48 שעות.`,
    successTitleSent: "הבקשה שלכם נשלחה! 🎉",
    successTitlePending: "השליחה בעיבוד…",
    successBodyPending: "קיבלנו את בקשתכם והיא בדרך לרופאים. נסו לרענן בעוד רגע.",
    successWatchInbox: "עקבו אחר תיבת הדואר הנכנס (ולפעמים הספאם)",
    successToDashboard: "לאזור האישי",
  },

  confirm: {
    metaTitle: "סיכום הבקשה",
    step: "שלב 3 מתוך 3",
    title: "סיכום הבקשה לפני שליחה",
    subtitle:
      "בדקו שהפרטים נכונים. בלחיצה על השליחה הבקשה תישלח לכל הרופאים הנבחרים במקביל — ללא עלות.",
    statusFailed: "השליחה נכשלה — נסו שוב",
    statusReady: "מוכן לשליחה",
    selectedDentists: "רופאים נבחרים",
    dentistsCount: (n: number) => `${n} רופאים`,
    treatmentPlan: "תוכנית טיפול",
    uploadedFeminine: "הועלתה ✓",
    xray: "צילום שיניים",
    uploadedMasculine: "הועלה ✓",
    status: "סטטוס",
    createdAt: "תאריך יצירה",
    recipients: "הרופאים שיקבלו את הבקשה",
    editSelection: "עריכת בחירת הרופאים",
    phoneVerifyTitle: "מומלץ לאמת את מספר הטלפון",
    phoneMissingTitle: "לא נמצא מספר טלפון",
    phoneBody:
      "המרפאות חוזרות אליכם בטלפון. אימות מהיר מוודא שלא נפלה טעות במספר — לוקח 30 שניות, וזה חינם.",
    phoneVerifyCta: "אימות המספר",
    phoneAddCta: "הוספת מספר",
    freeNoticePrefix: "הבקשה תישלח אוטומטית לכל הרופאים הנבחרים, יחד עם הקבצים.",
    freeNoticeStrong: "השירות חינמי לחלוטין",
    freeNoticeSuffix: "— לא נבקש מכם פרטי אשראי בשום שלב.",
    backToDashboard: "חזרה לאזור האישי",
  },

  submitButton: {
    sending: "שולחים את הבקשה…",
    submit: "שליחת הבקשה — ללא עלות",
  },

  selection: {
    chosen: (selected: number, max: number) => `נבחרו ${selected} מתוך ${max}`,
    ready: "מוכן להמשך — תקבלו הצעות מכל הרופאים הנבחרים",
    limit: (max: number) => `ניתן לבחור עד ${max} רופאים`,
    saving: "שומר…",
    continue: "המשך",
  },

  upload: {
    treatmentPlanTitle: "תוכנית טיפול",
    treatmentPlanDescription: "המסמך שקיבלתם מרופא השיניים שלכם עם פירוט הטיפולים והעלויות",
    xrayTitle: "צילומי שיניים",
    xrayDescription: "פנורמי, סטטוס, או צילום נקודתי מהמרפאה שביצעה אבחון",
    required: "חובה",
    saveForLater: "שמירה והמשך מאוחר יותר",
    continueToDentists: "המשך לבחירת רופאים",
  },

  dentists: {
    yearsExperience: (n: number) => `${n} שנות ניסיון`,
    reviews: (n: number) => `${n} ביקורות`,
    isNew: "חדש",
    insurersLabel: "מבטחים: ",
    selected: "נבחר",
    selectAria: "בחירת רופא",
    filterCity: "עיר",
    filterSpecialty: "התמחות",
    filterInsurer: "מבטח",
    filterExperience: "ניסיון",
    experience5: "5+ שנים",
    experience10: "10+ שנים",
    experience15: "15+ שנים",
    clearFilters: "ניקוי סינון",
    clear: "↺ ניקוי",
    clearOne: (label: string) => `↺ כל ה${label}`,
    resultCount: (shown: number, total: number) => `${shown} מתוך ${total} רופאים`,
    noResults: "לא נמצאו רופאים שמתאימים לסינון.",
    clearAndRetry: "נקו את הסינון",
    maxReached: (max: number) => `ניתן לבחור עד ${max} רופאים בלבד`,
    maxReachedHint: "הסירו רופא מהבחירה כדי להוסיף אחר",
    startRequestFirst: "התחילו בקשה חדשה כדי לשמור את הבחירה",
    startRequestHint: (n: number) => `כרגע נבחרו ${n} רופאים`,
  },

  dropzone: {
    uploadSuccess: (label: string) => `${label} עלה בהצלחה`,
    uploadFailed: "ההעלאה נכשלה. נסו שוב.",
    networkError: "שגיאת רשת בהעלאה",
    dragHere: "גררו לכאן או",
    chooseFile: "בחרו קובץ",
    fileHint: (mb: number) => `PDF, JPG, PNG ✦ עד ${mb}MB`,
    uploaded: (label: string) => `${label} הועלה`,
    replace: "החלפה",
  },

  validation: {
    fileType: "סוג קובץ לא נתמך. אנא העלו PDF, JPG או PNG בלבד.",
    fileSize: (mb: number) => `הקובץ גדול מדי. המגבלה היא ${mb}MB.`,
    fileSignature: "תוכן הקובץ אינו תואם לסוג שהוצהר. אנא העלו PDF, JPG או PNG תקין.",
    logoType: "סוג קובץ לא נתמך. אנא העלו תמונה בפורמט JPG, PNG או WEBP.",
    noFile: "לא נשלח קובץ",
    tooManyUploads: "יותר מדי העלאות לבקשה זו. נסו שוב מאוחר יותר.",
    logoUnavailable: "העלאת הלוגו אינה זמינה כרגע",
    logoSize: (mb: number) => `התמונה גדולה מדי. המגבלה היא ${mb}MB.`,
  },

  legal: {
    updatedLabel: "עודכן לאחרונה:",
    lastUpdated: "יולי 2026",
  },

  footer: {
    tagline: "הדרך השקופה לקבל מספר הצעות מחיר לטיפול שיניים. ללא שיחות טלפון, ללא לחץ.",
    groupProduct: "המוצר",
    groupCompany: "חברה",
    groupLegal: "משפטי",
    howItWorks: "איך זה עובד",
    benefits: "יתרונות",
    faq: "שאלות נפוצות",
    about: "אודות",
    contact: "צרו קשר",
    clinicsJoin: "הצטרפות מרפאות",
    terms: "תנאי שימוש",
    privacy: "מדיניות פרטיות",
    cookies: "מדיניות עוגיות",
    refunds: "ביטולים והחזרים",
    accessibility: "הצהרת נגישות",
    rights: "כל הזכויות שמורות.",
    builtWith: "עוצב ופותח באהבה",
  },
};

export default he;
