# DentalCompare — תוכנית ביצוע (עבור Opus)

> **מסמך זה נכתב על ידי Fable 5 לאחר סקירה ארכיטקטונית מלאה (2026-07-10).**
> הוא עצמאי: כל ההקשר הנדרש לביצוע נמצא כאן. הקוד יושב ב-`app/` (ריפו גיט נפרד).
> יש לבצע את הצעדים **לפי הסדר** — הסדר נקבע לפי תלויות.

---

## הקשר והחלטות מחייבות

1. **PayPlus בלבד.** החלטת בעל המוצר: Stripe יוצא לחלוטין (אינו זמין לעסקים בישראל). כל התשלומים — חד-פעמי למטופלים (49 ₪) ומנויי מרפאות — עוברים דרך PayPlus.
2. **אין להוסיף ספקים/תלויות חדשות** אלא היכן שצוין במפורש (Sentry בצעד 12 — אופציונלי).
3. **אין לשנות את זרימת ה-UI** של המטופל או המרפאה — רק את הצנרת מאחור.
4. שפת הודעות השגיאה למשתמש: **עברית**, בסגנון הקיים בקוד.
5. כל צעד = commit נפרד עם בדיקות ירוקות (`npm run build && npm test && npm run lint`).

## מפת המערכת (תקציר)

- **סטאק**: Next.js 16 App Router, React 19, TypeScript, Prisma 7 (קליינט ב-`src/generated/prisma`), PostgreSQL, Clerk (auth), Vercel Blob (קבצים), Resend (מייל), Vercel (פריסה + cron יומי 06:00).
- **שכבות**: `src/app/` (ראוטים) → `src/server/` (server actions ולוגיקה עסקית) → `src/lib/` (קליינטים לספקים + לוגיקה טהורה עם טסטים) → `prisma/`.
- **זרימת מטופל**: יצירת Request → העלאת תוכנית טיפול + צילום → בחירת עד 10 רופאים → תשלום → `fulfillPaidSession` (ב-`src/server/fulfillment.ts`) שולח מייל לכל רופא עם הקבצים + קישור-קסם `/quote/[token]` → הרופא מזין מחיר → המטופל רואה השוואה.
- **זרימת מרפאה**: הרשמה עצמית (`/clinics/join`) → אישור אדמין → דף תשלום PayPlus שמטוקנן כרטיס → webhook מפעיל מנוי → cron מחדש חיובים.
- **Middleware**: `src/proxy.ts` (Clerk). אדמין: allowlist מיילים ב-`ADMIN_EMAILS`, נאכף ב-`src/server/admin.ts` דרך `admin/layout.tsx`.

## בעיות שהתוכנית פותרת (למה כל צעד קיים)

| # | בעיה | חומרה |
|---|---|---|
| C1 | `isPaymentsTestMode()` (ב-`src/lib/stripe.ts`) מחזיר true כשאין `STRIPE_SECRET_KEY` — כלומר בפרודקשן כל בקשת מטופל עוברת **בחינם**. | 🔴 |
| C2 | תוכניות טיפול וצילומי רנטגן מועלים ל-Vercel Blob עם `access: "public"` — מידע רפואי נגיש לכל מחזיק URL. | 🔴 |
| C3 | הפעלת מנוי מרפאה תלויה אך ורק ב-webhook של PayPlus, ששם ה-header של חתימתו לא אומת; דף `billing/return` הוא תצוגה בלבד וסומך על `status=success` מה-URL. | 🔴 |
| C4 | `fulfillPaidSession` נקרא במקביל (webhook + דף success); ה-gate של `emailSent` הוא check-then-act ללא נעילה → מיילים כפולים עם שני `quoteToken` שונים (הראשון נשבר). כישלון Resend נבלע ללא retry. | 🔴 |
| R1 | `PAST_DUE_GRACE_DAYS` מוגדר אך לא ממומש — כישלון חיוב ראשון מעיף מרפאה מהדירקטורי מיידית. | 🟠 |
| R2 | `Payment.stripeSessionId` כמפתח fulfillment, `amount` כ-Float, סטטוסים ממחזרים את `RequestStatus`. | 🟠 |
| R3 | מחיקת משתמש ב-Clerk מוחקת ב-cascade את רשומות ה-Payment (מסמכים כספיים). | 🟠 |
| R4 | אין rate limiting ואין audit log (דרישות PRD סעיף 12). | 🟠 |
| R5 | אין observability — הכול `console.error`. | 🟡 |

---

# Phase A — יסודות (חוסם את כל השאר)

## צעד 1 — מיגרציית סכימה: מודל תשלום ניטרלי-ספק 🔴

**קבצים**: `prisma/schema.prisma`, מיגרציה חדשה, וכל האזכורים בקוד.

**שינויים בסכימה**:
- enum חדש `PaymentStatus { PENDING, PAID, FAILED }`.
- `Payment.stripeSessionId` → `providerRef` (שימור נתונים: SQL `RENAME COLUMN`, לא drop+add).
- `Payment.amount Float` → `amountAgorot Int` (במיגרציה: `ROUND(amount * 100)`).
- `Payment.status` ו-`SubscriptionCharge.status`: `RequestStatus` → `PaymentStatus`.
- `Payment.userId` ו-`Request.userId`: nullable + `onDelete: SetNull` (במקום Cascade) — שימור רשומות כספיות אחרי מחיקת משתמש. **שים לב**: כל הקוד שקורא `request.user` / `payment.user` חייב לטפל ב-null (משתמש שנמחק).

**עדכוני קוד**: `src/server/payments.ts`, `src/server/fulfillment.ts`, `src/app/request/[id]/success/page.tsx`, עמודי אדמין (`admin/payments`, `admin/subscriptions`, `admin/requests`), `prisma/seed.ts`, וה-webhook של Clerk (`user.deleted` כבר לא צריך למחוק תשלומים — ה-SetNull מטפל).

**✅ אימות**: `npm run db:migrate` עובר על DB עם נתונים; `grep -r stripeSessionId app/src/` ריק; build + tests ירוקים; מחיקת משתמש בטסט משאירה את רשומות ה-Payment עם `userId=null`.

## צעד 2 — הקשחת מצב טסט 🔴

**קבצים**: קובץ חדש `src/lib/payments-mode.ts`; עדכון היבואים ב-`src/server/payments.ts` ו-`src/app/request/[id]/success/page.tsx`.

**שינוי**: להעביר את `isPaymentsTestMode` מ-`src/lib/stripe.ts` לקובץ החדש, עם לוגיקה חדשה:

```ts
// true רק אם שני התנאים מתקיימים — לעולם לא ברירת מחדל שקטה
process.env.PAYMENTS_TEST_MODE === "true" && process.env.NODE_ENV !== "production"
```

בפרודקשן ללא קונפיגורציית PayPlus, `createCheckoutSession` חייב להחזיר שגיאה ברורה — לא מסלול חינם.

**✅ אימות**: unit test על שלוש הקומבינציות (flag+dev → true, flag+prod → false, בלי flag → false).

---

# Phase B — PayPlus לתשלומי מטופלים (תלוי בצעדים 1–2)

> ⚠️ **לפני התחלת Phase B יש לוודא מול בעל המוצר**: (א) גישה לסנדבוקס PayPlus; (ב) שם ה-header המדויק של חתימת ה-IPN מהדשבורד (הקוד היום מנחש בין `hash` ל-`x-payplus-signature` — `src/app/api/webhooks/payplus/route.ts:10`); (ג) שלחשבון יש הרשאה לעסקאות חד-פעמיות בנוסף להוראות קבע.

## צעד 3 — הרחבת קליינט PayPlus 🔴

**קבצים**: `src/lib/payplus.ts`, `src/lib/payplus.test.ts`.

**להוסיף**:
1. `createOneTimePaymentPage(args)` — כמו `createSubscriptionPaymentPage` הקיימת אבל **בלי** `create_token`, עם `more_info: "req_<paymentId>"`, ו-refURL-ים לדפי המטופל (`/request/[id]/success`, `/request/[id]/confirm`). מחזירה `{ url, pageRequestUid }`.
2. `getPageRequestStatus(pageRequestUid)` — אימות אקטיבי של עסקה מול PayPlus (endpoint בסגנון `/PaymentPages/ipn` — **לאמת את הנתיב המדויק מול תיעוד PayPlus לפני מימוש**). מחזירה `{ approved: boolean, transactionUid: string }`.
3. הרחבת `parseWebhook`: לזהות prefix ב-`more_info` — `req_` → `{ kind: "patient", paymentId }`, `sub_` או ללא prefix (תאימות לאחור למנויים קיימים) → `{ kind: "subscription", setupToken }`.
4. עדכון `verifyWebhookSignature` לשם ה-header המאומת בלבד (להסיר את הניחוש הכפול).

**במקביל**: לעדכן את `createSubscriptionPaymentPage` לשלוח `more_info: "sub_<setupToken>"` (עם תאימות לאחור בפירסור עבור מנויים שכבר באוויר).

**✅ אימות**: unit tests עם fetch ממוקק על שתי הפונקציות החדשות; טסטים לפירסור שלושת סוגי ה-more_info (`req_`, `sub_`, ללא prefix).

## צעד 4 — החלפת Stripe Checkout ב-PayPlus בזרימת המטופל 🔴

**קבצים**: `src/server/payments.ts`, `src/app/request/[id]/success/page.tsx`.

**`createCheckoutSession`** (לשמור את השם או לשנות ל-`createPaymentPage` — לעדכן את הקוראים ב-`src/components/request/pay-button.tsx`):
- כל ה-gates הקיימים נשארים בדיוק (בעלות, PENDING, שני קבצים, ≥1 רופא).
- במקום Stripe: יצירת רשומת `Payment` (PENDING) **לפני** הקריאה ל-PayPlus כדי שיהיה `paymentId` ל-more_info; ואז `createOneTimePaymentPage`; עדכון `providerRef` = `pageRequestUid`.
- מסלול הטסט (סעיף `isPaymentsTestMode`) נשאר כמו היום, עם `providerRef` סינתטי `test_*`.

**דף success**: במקום `getStripe().checkout.sessions.retrieve` — לקרוא `getPageRequestStatus(providerRef)` (אחרי איתור ה-Payment לפי ה-ref מה-URL ואימות שהוא שייך לבקשה); אם approved → `fulfillPaidSession`. מסלול `test_` נשאר.

**✅ אימות**: E2E בסנדבוקס PayPlus — בקשה מלאה: העלאה → בחירה → תשלום → מייל מגיע לרופא; `npm test` ירוק; מסלול הטסט (`PAYMENTS_TEST_MODE=true` ב-dev) עדיין עובד end-to-end.

## צעד 5 — איחוד ה-webhook 🔴

**קבצים**: `src/app/api/webhooks/payplus/route.ts`, `src/server/fulfillment.ts`.

- ה-route מנתב לפי `parsed.kind`: `subscription` → `activateSubscriptionBySetupToken` (קיים); `patient` → `fulfillPaidSession`.
- `fulfillPaidSession` עובר לחפש `Payment` לפי `providerRef` (אחרי צעד 1 זה כבר שם השדה) — לוודא שהחתימה של הפונקציה מקבלת מזהה ניטרלי.

**✅ אימות**: שני payloads מדומים עם חתימה תקינה מפעילים כל מסלול (integration test או סקריפט ידני מול dev); חתימה שגויה → 401; payload זבל → 400.

## צעד 6 — הסרת Stripe 🔴

**קבצים**: מחיקת `src/lib/stripe.ts` ו-`src/app/api/webhooks/stripe/route.ts`; הסרת `stripe` מ-`package.json`; ניקוי `STRIPE_*` מ-`.env.example`.

**✅ אימות**: `grep -ri stripe app/src/` ריק (מיגרציות SQL היסטוריות מותרות); `npm run build && npm test` ירוקים.

---

# Phase C — קבצים ואמינות (בלתי תלוי ב-Phase B — אפשר לבצע לפניו או במקביל)

## צעד 7 — קבצים רפואיים פרטיים 🔴

**קבצים**: `src/app/api/files/upload/route.ts`, route חדש `src/app/api/files/[requestId]/[kind]/route.ts`, `src/server/fulfillment.ts`, וכל מקום ב-UI שמציג את הקבצים (עמוד `request/[id]`, עמודי אדמין).

**שינויים**:
1. העלאה: `access: "public"` → `"private"` (לוודא תמיכה בגרסת `@vercel/blob` המותקנת ^2.4.1; אם ה-API שונה — להשתמש במנגנון ה-private/signed הנתמך).
2. route הורדה חדש: `GET /api/files/[requestId]/[kind]` — מאמת Clerk, בודק שה-Request שייך למשתמש **או** שהמשתמש אדמין (`isAdminEmail`), ואז מזרים את הקובץ מה-Blob (fetch בצד שרת עם ה-token) עם `Content-Type` ו-`Content-Disposition` נכונים.
3. **מיילים לרופאים**: ב-`fulfillPaidSession`, במקום `attachments: [{ path: url }]` (ש-Resend מושך מ-URL ציבורי) — להוריד את שני הקבצים בצד שרת ולצרף כ-`content` (Buffer/base64). הרופא מקבל צרופה, לא לינק.
4. ה-UI עובר להציג/לקשר דרך ה-route החדש במקום URL ה-blob הגולמי.

**✅ אימות**: fetch ישיר של URL ה-blob ללא אימות נכשל; המטופל רואה את הקובץ שלו דרך ה-route; משתמש אחר מקבל 404; מייל לרופא מגיע עם שתי צרופות תקינות שנפתחות.

## צעד 8 — fulfillment אטומי + retry 🔴

**קבצים**: `src/server/fulfillment.ts`, `src/app/api/cron/renew-subscriptions/route.ts` (או cron חדש `src/app/api/cron/retry-fulfillment/route.ts` + עדכון `vercel.json`).

**Claim אטומי** — להחליף את לולאת check-then-act הקיימת:

```
לכל רופא ממתין:
  claimed = db.requestDentist.updateMany({
    where: { id: rd.id, emailSent: false },
    data:  { emailSent: true, sentAt: now, quoteToken: <uuid חדש> },
  })
  if (claimed.count === 0) continue   // קריאה מקבילה כבר טיפלה
  קרא את ה-quoteToken מה-DB (הוא המקור לאמת) ושלח את המייל איתו
  אם השליחה נכשלה:
    db.requestDentist.updateMany({ where: { id: rd.id },
      data: { emailSent: false, sentAt: null, quoteToken: null } })
```

**רשת ביטחון**: סריקה יומית (ב-cron) — `RequestDentist` עם `emailSent=false` שה-Request שלהם `PAID` ונוצר לפני יותר משעה → ניסיון שליחה חוזר דרך אותה פונקציה.

**✅ אימות**: טסט שמריץ שתי קריאות `fulfillPaidSession` במקביל (`Promise.all`) עם Resend ממוקק ומוודא: מייל אחד בדיוק לכל רופא, וה-token במייל זהה לזה שב-DB; טסט שכישלון שליחה משאיר את השורה זמינה ל-retry ושהסריקה מרימה אותה.

---

# Phase D — מנויים (תלוי בצעד 3)

## צעד 9 — מסלול הפעלה שני + תקופת חסד 🟠

**קבצים**: `src/app/clinics/billing/return/page.tsx`, `src/app/api/cron/renew-subscriptions/route.ts`, `src/lib/subscription.ts` + טסטים, `src/app/api/dentists/route.ts` ועמוד הדירקטורי, `src/server/subscription-notifications.ts`, `prisma/schema.prisma` (אם נדרש שדה למניעת מיילי-כשל כפולים, למשל `paymentFailedNotifiedAt`).

**חלק א — הפעלה מדף החזרה**: כשמגיע `status=success` והמנוי עדיין PENDING — לקרוא `getPageRequestStatus`, ואם העסקה מאושרת להפעיל דרך `activateSubscriptionBySetupToken` (כבר אידמפוטנטית). אסור להציג "המנוי הופעל" על סמך פרמטר URL בלבד — רק לפי מצב DB בפועל אחרי האימות.

**חלק ב — תקופת חסד** (`PAST_DUE_GRACE_DAYS = 3` ב-`src/lib/constants.ts`, כיום dead code):
- כישלון חיוב → PAST_DUE (כמו היום) + מייל התראה **פעם אחת** (לא כל יום).
- ה-cron ממשיך לנסות לחייב מנויים ב-PAST_DUE כל יום בתוך חלון החסד (מ-`currentPeriodEnd`).
- עברו ימי החסד ללא הצלחה → `cancelSubscription`.
- נראות בדירקטורי: helper חדש ב-`src/lib/subscription.ts` שמחשיב גם PAST_DUE-בתוך-חסד כגלוי; לעדכן את שאילתת `/api/dentists` ואת עמוד `/dentists` בהתאם (שאילתת prisma לא יכולה לקרוא helper — לגזור ממנו תנאי `OR` על `status`/`currentPeriodEnd`).
- להסיר את השורה `void SUBSCRIPTION_PLANS;` מה-cron.

**✅ אימות**: unit tests על helpers החסד (בתוך/מחוץ לחלון); סימולציה ב-DB: כשל חיוב → PAST_DUE ועדיין מופיע בדירקטורי; אחרי החסד → CANCELED ונעלם; return page עם `status=success` אך עסקה לא מאושרת ב-PayPlus → המנוי נשאר PENDING והעמוד מציג כישלון.

---

# Phase E — הקשחה (אחרי כל השאר)

## צעד 10 — AuditLog 🟠

**קבצים**: `prisma/schema.prisma` (+מיגרציה), קובץ חדש `src/lib/audit.ts`, קריאות מ-`src/server/admin-actions.ts` (כל action), webhook PayPlus, `fulfillment.ts`, cron.

**מודל**: `AuditLog { id, actor (email/"system"/"webhook"), action, entity, entityId, metadata Json?, createdAt }` + אינדקס על `[entity, entityId]` ו-`[createdAt]`. כתיבה fire-and-forget — כשל כתיבת audit לא מפיל את הפעולה העסקית (try/catch + console.error).

**✅ אימות**: אישור מרפאה באדמין יוצר רשומה; unit test על ה-helper.

## צעד 11 — Rate limiting 🟠

**קבצים**: helper חדש `src/lib/rate-limit.ts` (מבוסס-DB — ספירת רשומות אחרונות או טבלת מונים; **בלי** תלות חדשה), שילוב ב-`src/server/clinic-registration.ts`, `src/server/quotes.ts`, `src/app/api/files/upload/route.ts`.

**מגבלות התחלתיות**: הרשמת מרפאה ~3/שעה ל-IP (מ-`x-forwarded-for`) + בדיקת אימייל כפול קיימת; `submitQuote` ~10/שעה לטוקן; העלאות — עד ~20 קבצים ל-Request. הודעות חסימה בעברית.

**✅ אימות**: unit test שהקריאה שמעבר לסף נחסמת; קריאות בתוך הסף עוברות.

## צעד 12 — Observability 🟡 (אופציונלי — לאשר עם בעל המוצר לפני הוספת תלות)

`@sentry/nextjs` עם דיווח מהנתיבים הקריטיים (webhook, שליחת מייל, חיוב חוזר), או לחלופין לוגים מובנים + Vercel log drains/alerts בלבד.

**✅ אימות**: שגיאה מאולצת מדווחת ונראית.

## צעד 13 — ניקיונות 🟡

- zod לוולידציית formData ב-actions (להחליף את פירוק ה-`String(formData.get(...))` הידני) — בלי לשנות התנהגות.
- חילוץ תבניות ה-HTML של המיילים מ-`fulfillment.ts` ו-`*-notifications.ts` לתיקייה `src/server/emails/`.
- `logoBlobPath` (ב-`src/lib/storage.ts`) — נתיב ייחודי פר-העלאה (כיום כולם `clinics/logos/logo.<ext>` וניצלים רק בזכות `addRandomSuffix`).
- הוספת `requireAdmin()` בראש כל page תחת `/admin/*` כ-defense-in-depth (כיום רק ב-layout).

**✅ אימות**: build + tests ירוקים; התנהגות זהה.

---

## סיכום סדר וחסמים

```
Phase A (1→2)  ──►  Phase B (3→4→5→6)  ──►  Phase D (9)
        │
        └────►  Phase C (7→8)   [בלתי תלוי ב-B]
Phase E (10→13) — אחרי הכול
```

**חסמים חיצוניים לפני Phase B** (באחריות בעל המוצר):
1. גישה לסנדבוקס PayPlus.
2. שם ה-header המדויק של חתימת ה-IPN מדשבורד PayPlus.
3. אישור שהחשבון תומך בעסקאות חד-פעמיות + טוקניזציה.

**הגדרת "גמור" לכל צעד**: `npm run build`, `npm test`, `npm run lint` ירוקים; האימות הספציפי של הצעד בוצע; commit עם הודעה תיאורית.
