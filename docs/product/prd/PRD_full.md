זהו זה. כל הקצוות סגורים, ויש לנו את כל המידע הדרוש כדי לבנות את ה-PRD המקיף, המקצועי והיסודי ביותר עבור DentalCompare.

המסמך הבא נכתב בפורמט Production-Ready – הוא בנוי בצורה מודולרית, מפורטת ומדויקת להפליא, 
# Product Requirements Document (PRD)
## DentalCompare – פלטפורמת השוואת מחירים וניתוב לידים לרופאי שיניים
גרסה: 1.0 (MVP Scope)
סטטוס: מוכן לפיתוח (Ready for Dev)
מחבר: Founder
קהל יעד: צוות פיתוח / Claude Code
## 1. חזון המוצר ומטרות על (Product Vision & Strategy)
### 1.1 חזון (Vision)
DentalCompare היא פלטפורמת Marketplace מבוססת Web, המשנה את הדרך שבה מטופלים בישראל צורכים טיפולי שיניים מורכבים ויקרים. הפלטפורמה מאפשרת למטופלים לבצע "מכרז" מוגן, מהיר ודיסקרטי בין עשרות רופאי שיניים מובילים באמצעות העלאה חד-פעמית של תוכנית טיפול קיימת וצילומי רנטגן/סינוס.
### 1.2 הגדרת הבעיה (Problem Statement)
עבור המטופל: טיפולי שיניים בישראל (השתלות, כתרים, שיקום הפה) מגיעים לעשרות אלפי שקלים. המטופלים סובלים מחוסר שקיפות קיצוני במחירים, נאלצים לכתת רגליהם בין מרפאות שונות רק בשביל לקבל "הצעת מחיר שנייה", ומאבדים זמן יקר ואלפי שקלים.
עבור רופא השיניים: עלויות רכישת המדיה והלידים בדיגיטל (פייסבוק, גוגל) גבוהות מאוד ואינן ממוקדות. רופאים מחפשים "לידים חמים" – מטופלים שכבר מחזיקים בתוכנית טיפול חתומה, יודעים מה הם צריכים, ומוכנים להתחיל בטיפול באופן מיידי.
### 1.3 מדדי הצלחה (Success Metrics - KPIs)
טווח קצר (חודש 1): 100 מטופלים רשומים עם טלפון מאומת, 50 בקשות מכרז שנשלחו, מעל 150 פניות מנותבות בהצלחה למרפאות, 20 מרפאות פעילות בתקופת התנסות.
טווח בינוני (6 חודשים): 1,000 מטופלים רשומים, 300 רופאי שיניים פעילים ומאושרים במאגר, קצב של 500 בקשות מכרז בחודש, ומעל 60 מרפאות משלמות (Paying Clinics) שסיימו התנסות ועברו לחיוב.
מדד הליבה (North Star Metric): הכנסה חודשית חוזרת — MRR. זהו המדד היחיד שמייצג הכנסה בפועל, שכן צד המטופל אינו מייצר הכנסה כלל. יעד 6 חודשים: 60 מרפאות × ~299 ₪ ≈ 18,000 ₪ MRR.
מדד המרה קריטי: שיעור המרה מהתנסות לתשלום (Trial → Paid). מכיוון שאמצעי התשלום נאסף מראש (סעיף 4.4), המדד בפועל הוא שיעור אי-הביטול בתום 60 הימים. יעד: מעל 60%.
מדד שימור קריטי: נטישה חודשית (Monthly Churn) מתחת ל-5%. במודל מנוי, שימור הוא הפרמטר שקובע את שווי החברה — לא כמות הלידים.
מדד איכות קריטי: שיעור הפניות הפסולות (Disputed Lead Rate) חייב להישאר מתחת ל-10%. עלייה מעל סף זה מעידה שהמסננים בצד המטופל חלשים מדי, והיא האינדיקטור המקדים לעליית הנטישה.
## 2. סוגי משתמשים והרשאות (User Roles & Permissions)
המערכת תנהל מנגנון הרשאות מבוסס תפקידים (RBAC):
אורח (Guest): יכול לצפות במסך הבית, בסיפורי הצלחה, ב-FAQ ובמאגר רופאי השיניים הפומבי (ללא פרטי קשר ישירים של הרופא).
מטופל (Patient): משתמש רשום שעבר אימות מייל ואימות טלפון (OTP ב-SMS). יכול להקים בקשה, להעלות קבצים רפואיים, לבחור עד 3 רופאים, ולצפות בהיסטוריית הבקשות שלו. השירות עבור המטופל חינמי לחלוטין בכל שלב — המערכת לא תבקש ממנו אמצעי תשלום בשום נקודה במסלול.
רופא שיניים / מרפאה (Dentist): הלקוח המשלם היחיד של הפלטפורמה. נרשם דרך טופס ייעודי וממתין לאישור אדמין. בגרסת ה-MVP, הרופא אינו מחזיק באזור אישי (Dashboard). הוא נרשם בעצמו, בוחר מסלול מנוי וחותם על החוזה דרך `/clinics/join`, ומשם מתפקד כ"יעד לקבלת פניות" במייל — עם קישור ייעודי (מגנט-לינק) להגשת הצעת מחיר. ניהול המנוי (אישור, התנסות, ביטול, פיצוי) מתבצע כולו בפאנל האדמין.
מנהל מערכת (Admin): גישה מלאה לפאנל הניהול. יכול לאשר/לחסום רופאים, לנהל מנויים ותקופות התנסות, לפצות מרפאות על פניות פסולות ולראות סטטיסטיקות כלליות.
## 3. ארכיטקטורה וטכנולוגיות (Tech Stack)
## 4. מודל עסקי וחוקים עסקיים (Business Rules & Monetization)
### 4.1 עקרון היסוד: חינם למטופל, גבייה מהמרפאה (B2B)
הפלטפורמה מיישמת מודל Marketplace חד-צדדי בגבייה. הערך הכלכלי של העסקה נמצא כולו בצד המרפאה — טיפול שיקומי מורכב שווה למרפאה 6,000–15,000 ₪ — בעוד שהמטופל מגיע לפלטפורמה במטרה מוצהרת לחסוך כסף. לפיכך:
צד המטופל (B2C): חינמי לחלוטין, ללא תשלום, ללא הזנת אמצעי תשלום וללא התחייבות, בכל שלב במסלול. אין מודול סליקה כלשהו במסלול המטופל.
צד המרפאה (B2B): המרפאה היא הלקוח המשלם. הגבייה מתבצעת במודל מנוי חודשי/שנתי עבור נראות במאגר וקבלת פניות, ומודול הסליקה (PayPlus) משמש אך ורק בצד זה.
נימוק אסטרטגי: גביית תשלום מהמטופל מייצרת חסם המרה חריף בראש המשפך, ומייצרת הכנסה נמוכה וחד-פעמית. בהינתן יעדי חודש 1: מודל "המטופל משלם" מניב 50 × 49 ₪ = 2,450 ₪ חד-פעמיים; מודל המנוי מניב 20 מרפאות × 299 ₪ = 5,980 ₪ חוזרים בכל חודש, ומצטבר ל-~18,000 ₪ MRR בחודש 6. ההפרש אינו רק בגודל אלא באופי: הכנסה חוזרת וצפויה מול הכנסה חד-פעמית התלויה בנפח תנועה.
הבהרה: הסרת התשלום מהמטופל אינה ויתור על הכנסה — היא הסרת המחסום שמונע את התנועה שעליה מבוסס כל ערך המנוי למרפאה.
### 4.2 החלפת החיכוך: מסננים לא-כספיים (Qualification Gates)
התשלום שהוסר מצד המטופל שימש בפועל כמסנן איכות. הסרתו ללא תחליף תציף את המרפאות בפניות לא רציניות, שיעור הפניות הפסולות יטפס, והמרפאות יבטלו את המנוי בתום התקופה. אך התחליף חייב להיות מדוד — כל חסימה שנוסיף עלולה לבטל בדיוק את הרווח שהשגנו בהסרת התשלום.
מסנן חוסם יחיד — הוכחת כוונה קלינית: העלאת חובה של תוכנית טיפול קיימת וצילום פנורמי/סטטוס, בתוספת מספר טלפון כלשהו. ראה סעיף 6.4. זהו המסנן החזק, ולמעשה היחיד שנדרש: מטופל שטרח להשיג ולהעלות תוכנית טיפול חתומה וצילום כבר עבר אבחון והוא בכוונת רכישה. אין מצב שבו פנייה נשלחת ללא מספר טלפון — חזרה טלפונית היא כל תהליך העבודה של המרפאה.
אימות טלפון ב-SMS — מומלץ, לא חוסם: מוצע למטופל במסך הסיכום ואינו מונע שליחה. הנימוק: האימות ממוקם בנקודה הגרועה ביותר במשפך — אחרי שהמטופל כבר העלה שני קבצים ובחר מרפאות — ונטישה שם מאבדת משתמש שכבר השקיע את כל המאמץ. מעל מסנן הקבצים הוא מוסיף בעיקר תפיסת טעויות הקלדה, ולא הצדקה לחסימה.
שקיפות מול המרפאה: מייל הפנייה מציין במפורש אם המספר אומת ("✓ אומת ב-SMS") או לא ("לא אומת"), כדי שהמרפאה תדע מה קיבלה במקום להניח שכל המספרים נבדקו.
תנאי להחמרה: אם שיעור הפניות הפסולות (סעיף 1.3) יעלה מעל 10%, יש להפוך את האימות לחוסם. זהו שינוי של תנאי אחד בקוד, והמדד קיים במערכת בדיוק לצורך ההחלטה הזו.
הערה טכנית: כל עוד האימות אינו חובה, אין לאכוף ייחודיות על מספר הטלפון. מספר לא מאומת אינו מוכיח דבר, ואילוץ ייחודיות עליו רק יחסום אדם אמיתי שמישהו אחר הקליד את מספרו. אם האימות יהפוך לחובה, יש להחזיר את הייחודיות כאינדקס חלקי על מספרים מאומתים בלבד.
מסנן עתידי (V2, לא ב-MVP) — הצהרת קטגוריית טיפול וחלון זמן מתוכנן להתחלה. אינו נדרש לתמחור במודל המנוי, אך יידרש אם וכאשר נעבור ל-Pay-per-Lead (סעיף 4.3). לא לממש בשלב זה.
עקרון מנחה: אלה מסנני איכות, לא מסנני נפח. אין להוסיף שדות חובה נוספים בצד המטופל מבלי למדוד תחילה את השפעתם על שיעור הנטישה במשפך.
### 4.3 מודל הגבייה מהמרפאה (MVP): מנוי חודשי/שנתי
בגרסת ה-MVP הגבייה מתבצעת במודל מנוי (Subscription) בלבד. המרפאה משלמת עבור נראות במאגר DentalCompare וקבלת פניות ממטופלים — ולא עבור ליד בודד.
מסלולים (מוגדרים ב-`SUBSCRIPTION_PLANS`): מסלול חודשי 299 ₪ לחודש · מסלול שנתי 1,990 ₪ לשנה.
מנגנון החיוב: המנוי מתחדש אוטומטית בתום כל תקופה באמצעות טוקן כרטיס שמור אצל ספק הסליקה (PayPlus recurring token). המרפאה אינה נדרשת לפעולה ידנית בכל חידוש.
חיוב ראשון: מתבצע רק לאחר אישור המרפאה על ידי צוות DentalCompare ובתום תקופת ההתנסות (סעיף 4.4). כל עוד לא הושלם תשלום, המרפאה אינה מופיעה במאגר.
שער הנראות (Visibility Gate) — זהו מנגנון האכיפה היחיד של המודל: מרפאה מופיעה בספריית הרופאים ומקבלת פניות אך ורק אם סטטוס המנוי שלה הוא `TRIALING`, `ACTIVE`, או `PAST_DUE` בתוך חלון החסד. אין ניכוי, מונה או מכסה ברמת הליד הבודד.
כשל בחיוב: מנוי שחיובו נכשל עובר ל-`PAST_DUE` ושומר על הנראות שלו למשך 3 ימי חסד (`PAST_DUE_GRACE_DAYS`), שבמהלכם קרון החידוש מנסה שוב ונשלח מייל התראה חד-פעמי למרפאה. בתום החסד המרפאה יורדת מהמאגר.
ביטול: ניתן לבטל בכל עת; הביטול נכנס לתוקף בתום התקופה ששולמה, ללא החזר יחסי.
מודל בנק קרדיטים / Pay-per-Lead: אינו נכלל ב-MVP ומתוכנן ל-V2. הוא צמוד יותר לערך שנמסר בפועל, אך דורש מונה לידים, תמחור לפי קטגוריית טיפול ומנגנון זיכויים — כולם אינם קיימים היום. המעבר אליו ייבחן רק לאחר שייצבר דאטה על שיעורי סגירה בפועל.
### 4.4 תקופת התנסות למרפאות (Free Trial)
כדי לפתור את בעיית ה-Cold Start — אי-אפשר למכור מנוי למרפאה לפני שהוכחנו לה את איכות הפניות — כל מרפאה חדשה מקבלת תקופת התנסות חינמית.
תנאי ההתנסות: 60 יום קלנדריים ללא חיוב. אין מגבלת לידים בתקופה זו.
נקודת התחלה: מונה 60 הימים מתחיל ממועד אישור המרפאה על ידי האדמין, ולא ממועד ההרשמה. נשמר ב-`trialEndsAt`.
סטטוס ייעודי: `TRIALING`. המרפאה נראית במאגר ומקבלת פניות ככל מרפאה משלמת, אך אינה מחויבת.
איסוף אמצעי תשלום מראש: המרפאה בוחרת מסלול וחותמת על חוזה המנוי בעת ההרשמה, כך שהחיוב הראשון מתבצע אוטומטית בתום 60 הימים ללא צורך בפעולה נוספת מצדה. זה מה שממיר את שיעור ההמרה מהתנסות לתשלום מ"מכירה מחודשת" ל"אי-ביטול".
התראות אוטומטיות: מייל למרפאה ביום ה-45 ("נותרו 15 ימי התנסות") וביום ה-58 ("החיוב הראשון יתבצע בעוד יומיים"). שקיפות כאן מונעת ביטולי עסקה (Chargebacks).
מעבר אוטומטי: בתום 60 הימים קרון החידוש מבצע את החיוב הראשון והסטטוס עובר ל-`ACTIVE`. כשל בחיוב מעביר ל-`PAST_DUE` לפי הכללים בסעיף 4.3.
הארכת התנסות: האדמין רשאי לדחות ידנית את `trialEndsAt` עבור מרפאות אסטרטגיות.
### 4.5 התחייבות איכות פניות (Lead Quality Commitment)
במודל מנוי אין קרדיט להחזיר, ולכן ההגנה על המרפאה מפני פניות פסולות מתבצעת בזיכוי ימי מנוי ולא בכסף.
פנייה פסולה: פרטי קשר שגויים או לא פעילים; קובץ פגום או בלתי קריא; פנייה כפולה של אותו מטופל לאותה מרפאה בתוך 90 יום.
חלון ערעור: המרפאה רשאית לדווח על פנייה פסולה תוך 7 ימים ממועד קבלתה, באמצעות השבה למייל הפנייה.
פיצוי: האדמין מאריך את `currentPeriodEnd` של המנוי בימים, לפי שיקול דעתו. הפעולה נרשמת ב-AuditLog עם סיבה.
מדידה: כל דיווח נרשם גם אם לא ניתן פיצוי, לצורך חישוב שיעור הפניות הפסולות (סעיף 1.3). המדד הזה הוא מערכת ההתרעה המוקדמת על קריסת איכות בצד המטופל.
### 4.6 חוקים עסקיים כלליים
מגבלת בחירה: משתמש חייב לבחור לפחות רופא אחד (1) ומקסימום 3 רופאים. לא ניתן לעקוף מגבלה זו ברמת הממשק וה-API.
נימוק המגבלה (Lead Exclusivity): ערך המנוי למרפאה נמדד בשיעור הסגירה על הפניות שהיא מקבלת. בבקשה שנשלחת ל-10 מרפאות, לכל מרפאה סיכוי סגירה של כ-10% בלבד — היא תחווה את המנוי כלא משתלם ותבטל בתום התקופה. בשליחה ל-3 מרפאות סיכוי הסגירה עולה פי כמה, מה שמצדיק את דמי המנוי ושומר על שימור (Retention) — המדד הקריטי ביותר במודל מבוסס מנוי. 3 הצעות הן גם הסטנדרט המקובל והמספיק להשוואת מחירים אפקטיבית מצד המטופל.
הרחבה עתידית: המספר יוגדר כפרמטר גלובלי ניתן לעריכה בפאנל האדמין (`maxDentistsPerRequest`), כדי לאפשר כיול לפי דאטת סגירה בפועל מבלי לשנות קוד.
סינון זמינות בשליחה: המטופל רואה בספרייה אך ורק מרפאות שעברו את שער הנראות (סעיף 4.3), ולכן הסינון מתבצע כבר בשלב התצוגה. בנוסף, ברגע השליחה המערכת מאמתת מחדש שכל מרפאה שנבחרה עדיין `isActive` ועדיין עומדת בשער הנראות — למקרה שמנוי פקע בין הבחירה לשליחה. המטופל מקבל חיווי שקוף על מספר המרפאות שאליהן נשלחה הבקשה בפועל.
מניעת כפילויות: המערכת לא תאפשר שליחת בקשה זהה (אותם קבצים ואותם רופאים) באותו יום כדי למנוע ספאם למרפאות.
אישור רפואי ומשפטי: לפני לחיצה על "שלח בקשה", המטופל חייב לסמן Checkbox חובה המאשר את תנאי השימוש, מדיניות הפרטיות, ומתן אישור מפורש להעברת המידע הרפואי והאישי שלו לרופאים הנבחרים.
### 4.7 סוגיה משפטית פתוחה (Open Legal Item — טעון בדיקת עו"ד לפני עלייה לאוויר)
בישראל קיימת רגישות רגולטורית ואתית (כללי האתיקה של הר"י) לתשלום עבור הפניית מטופלים. ההבחנה המקובלת היא בין תשלום עבור חשיפה ופרסום — לגיטימי, לבין תגמול הנגזר מטיפול שבוצע בפועל — בעייתי.
מודל המנוי שנבחר הוא הבטוח ביותר משפטית מבין החלופות: המרפאה משלמת סכום קבוע וידוע מראש עבור נראות ופרסום במאגר, ללא כל תלות במספר הפניות שקיבלה, בזהותן או בשאלה אם טיפול כלשהו בוצע בסופו של דבר. זו הגדרה קלאסית של דמי פרסום.
נגזרת מחייבת: אין להכניס אחוזים, עמלת הצלחה, Revenue Share או תמחור המשתנה לפי מספר הפניות שנמסרו — ללא חוות דעת משפטית מקדימה. הערה זו רלוונטית במיוחד למעבר המתוכנן ל-Pay-per-Lead ב-V2, שקרוב יותר לגבול האפור ויחייב בדיקה מחודשת.
## 5. תרשים זרימה מלא של המשתמש (End-to-End User Flow)



[מסך בית פומבי] 
       ↓
[לחצן CTA: קבל הצעות מחיר]
       ↓
[טופס הרשמה / התחברות (Clerk)] -> (אימות קוד במייל + אימות OTP בטלפון)
       ↓
[מסך העלאת קבצים רפואיים] -> (ולידציה על סוג גודל וקובץ)
       ↓
[מסך סינון ובחירת רופאים] -> (בחירה של 1 עד 3 רופאים)
       ↓
[מסך סיכום, אישור הצהרת פרטיות ולחיצה על "שלח"]
       ↓
[מאחורי הקלעים: הפעלת Resend ושליחת מיילים במקביל לרופאים]
       ↓
[מסך הצלחה + מעבר לאזור אישי למעקב

## 6. אפיון מסכים מפורט (Screen-by-Screen Specification)
### 6.1 מסך בית (Home Page)
רכיב Hero: כותרת ראשית "קבל 3 הצעות מחיר מרופאי שיניים מובילים בישראל — בחינם". כותרת משנה: "מעלים תוכנית טיפול וצילום, חוסכים אלפי שקלים ומקבלים הצעות ישירות למייל ללא שיחות טלפון מציקות".
הערה שיווקית: המילה "בחינם" חייבת להופיע ב-Hero, ב-CTA הראשי וברכיב ה-FAQ. היעדר עלות הוא כעת הבידול המרכזי מול חיפוש בגוגל או בקבוצות פייסבוק, ואין להסתירו.
לחצן CTA מרכזי: "קבל הצעות מחיר עכשיו" -> מנתב למסך הרשמה/התחברות.
רכיב יתרונות (Benefits Grid): 4 כרטיסים מעוצבים עם אייקונים של ShadCN:
✓ חסכון של אלפי שקלים: השוואה חכמה שמה את כוח המיקוח אצלך.
✓ שליחה מרוכזת: בקשה אחת מגיעה ל-3 מרפאות נבחרות במקביל.
✓ ללא עלות: השירות חינמי לחלוטין למטופל, ללא כרטיס אשראי וללא התחייבות.
✓ שומרים על פרטיות: המידע מועבר רק לרופאים שבחרת.
✓ ללא שיחות טלפון: הרופאים חוזרים אליך ישירות למייל עם הצעה כתובה.
רכיב שאלות ותשובות (FAQ Accordion): שאלות נפוצות בנושא אבטחת מידע, עלות השירות ואופן קבלת התשובות מהרופאים.
### 6.2 מסך הרשמה והתחברות (Sign Up & Login)
הממשק יבוצע באמצעות הקומפוננטה המובנית של Clerk (מנוהלת ונקייה).
שדות חובה: שם מלא, אימייל, טלפון נייד, סיסמה.
תהליך אימות: שליחת קוד OTP בן 6 ספרות למייל המשתמש. לא ניתן להתקדם במערכת ללא אימות המייל.
### 6.3 מסך תשלום — בוטל (Removed)
מסך התשלום הוסר לחלוטין ממסלול המטופל בהתאם לסעיף 4.1. אין מודול סליקה, אין הזנת אמצעי תשלום ואין מסך ביניים כלשהו בין ההרשמה לבין העלאת הקבצים. המשתמש עובר ישירות מאימות ההרשמה למסך 6.4.
מודול הסליקה (PayPlus) משמש אך ורק בצד ה-B2B — מנויי מרפאות, דרך `/clinics/join` ופאנל האדמין.
### 6.4 מסך העלאת מסמכים (Upload Medical Files)
ממשק מסוג Drag & Drop מבוסס Tailwind.
אזור העלאה 1: תוכנית טיפול (חובה)
פורמטים מאושרים: PDF, JPG, PNG.
גודל מקסימלי: 20MB.
אזור העלאה 2: צילומי שיניים / סטטוס / פנורמי (חובה)
פורמטים מאושרים: PDF, JPG, PNG.
גודל מקסימלי: 20MB.
ולידציה בזמן אמת: לחצן "המשך לבחירת רופאים" חסום (Disabled) לחלוטין כל עוד שני הקבצים לא הועלו בהצלחה ועברו את הולידציה של גודל וסוג הקובץ.
### 6.5 מסך ספריית רופאים (Dentist Directory & Selection)
מסך המציג את כל רופאי השיניים הפעילים במערכת בצורת גריד כרטיסים (Cards).
רכיב פילטרים עליון (Sticky Filter Bar):
פילטר עיר / אזור (בחירה מרובה/Dropdown).
פילטר התמחות (טיפולי שורש, השתלות ושיקום, יישור שיניים, אסתטיקה).
פילטר קופת חולים (כללית, מכבי, מאוחדת, לאומית) – מציג רופאים שעובדים עם הקופה שנבחרה.
פילטר שנות ניסיון (5+, 10+, 15+ שנים).
מבנה כרטיס רופא:
תמונת פרופיל של הרופא/מרפאה + דירוג כוכבים ומספר חוות דעת (לדוגמה: ⭐ 4.9 (32 ביקורות)).
שם הרופא ושם המרפאה.
מיקום: עיר וכתובת מדויקת.
שנות ניסיון ותחומי התמחות מרכזיים.
קופות חולים איתן המרפאה עובדת (תגים ויזואליים קטנים).
לחצן פעולה: כפתור Toggle "בחר רופא" / "הסר רופא".
מונה בחירה צף (Floating Counter): בתחתית המסך יוצג בר קבוע המציג: "נבחרו X מתוך 3 רופאים".
אם $X = 0$, לחצן "המשך לסיכום" חסום.
אם $X = 3$, המערכת לא מאפשרת לסמן רופאים נוספים ומציגה הודעת Toast: "ניתן לבחור עד 3 רופאים בלבד — כך כל מרפאה מתייחסת לפנייה שלך ברצינות ומחזירה הצעה תחרותית".
### 6.6 מסך סיכום ושליחה (Request Confirmation)
הצגת תקציר הבקשה: כמות הרופאים שנבחרו, שמות הקבצים שהועלו.
תיבת טקסט חופשי (אופציונלי): "הערות מיוחדות לרופא (לדוגמה: מעוניין בכתרי זרקוניה בלבד, רגישות לתרופות מסוימות וכו')".
Checkbox הצהרה משפטית (חובה): "אני מאשר כי קראתי את תקנון האתר ומדיניות הפרטיות, ואני נותן בזאת את הסכמתי המלאה להעברת המידע הרפואי והאישי שלי ל-X המרפאות שבחרתי לצורך קבלת הצעת מחיר".
לחצן הפעלה סופי: "שלח בקשה ופתח מכרז". לחיצה עליו מפעילה את הלוגיקה של ה-Backend (שליחת מיילים סימולטנית).
### 6.7 אזור אישי למטופל (Patient Dashboard)
מסך נקי המציג את היסטוריית הפעילות של המטופל במערכת.
טבלת בקשות שנשלחו (My Requests):
מזהה בקשה (ID) ותאריך יצירה.
כמות רופאים אליהם נשלחה הבקשה בפועל (לאחר סינון זמינות לפי סעיף 4.6).
סטטוס בקשה: Sent (נשלחה בהצלחה) / Failed (כשל בשליחה). אין עוד סטטוס תשלום כלשהו בצד המטופל.
לחצן "צפייה בפרטי הבקשה" (מציג את הקבצים שנשלחו ואת רשימת הרופאים הספציפית).
הערה: בכל מסכי המטופל אין להציג מחירים, יתרות, סטטוס מנוי או כל התייחסות לעלות — המטופל אינו אמור לדעת שקיים חיוב בצד המרפאה.
## 7. מנגנון שליחת המיילים (Email Workflow & Automation)
ברגע שהמטופל לוחץ על "שלח בקשה", ה-Backend מבצע לולאה ושולח מייל נפרד ומותאם אישית לכל אחד מרופאי השיניים שנבחרו באמצעות Resend.
### 7.1 הגדרות מייל טכניות
From: DentalCompare Requests <requests@dentalcompare.co.il>
Reply-To: כתובת האימייל של המטופל המבקש (על מנת שהרופא יוכל ללחוץ על "השב/Reply" במייל שלו והתשובה תגיע ישירות למטופל).
Attachments: הקבצים הרפואיים נמשכים מ-S3/R2 ומצורפים כקבצים פיזיים למייל (ולא כקישורים) כדי להקל על הרופא לפתוח אותם ישירות בנייד או במחשב המרפאה.
### 7.2 תבנית המייל לרופא (Email Template)



HTML
נושא: בקשה חמה להצעת מחיר מתוך פלטפורמת DentalCompare (מזהה בקשה: #{{requestId}})

שלום ד"ר {{dentistName}},

מטופל חדש מאזורך השתמש בפלטפורמת DentalCompare ומעוניין לקבל מהמרפאה שלך הצעת מחיר תחרותית עבור תוכנית טיפול קיימת.

להלן פרטי הבקשה והמטופל:
- שם מלא: {{patientName}}
- טלפון נייד: {{patientPhone}}
- אימייל לחזרה: {{patientEmail}}

הערות מיוחדות מהמטופל:
"{{patientNotes}}"

למייל זה מצורפים המסמכים הרפואיים המלאים שהועלו על ידי המטופל:
1. קובץ תוכנית הטיפול המקורית (TreatmentPlan)
2. צילומי שיניים / רנטגן / פנורמי (DentalImages)

כיצד להשיב למטופל?
אנא עברו על התוכנית והצילומים המצורפים, והשיבו ישירות למייל זה עם הצעת המחיר שלכם, או צרו קשר טלפוני עם המטופל להמשך תיאום.

בברכה,
צוות התמיכה והפיתוח העסקי,
DentalCompare ישראל

## 8. פאנל ניהול מערכת (Admin Dashboard)
אזור הניהול יהיה נגיש אך ורק למשתמשים עם רול Admin ב-Clerk. הממשק יכלול:
ניהול רופאים (Dentist Management):
טבלת כל הרופאים במערכת.
אפשרות להוספת רופא חדש (שם, מרפאה, עיר, כתובת, טלפון, מייל, שנות ניסיון, התמחויות, קופות חולים, תמונה, דירוג).
כפתור Toggle מהיר: Active / Inactive (רופא מושבת לא יופיע בתוצאות החיפוש והסינון של המטופלים).
כפתור "אשר מרפאה" (Approve): מפעיל את המרפאה, מציב `approvedAt`, ומעביר את המנוי מ-`PENDING` ל-`TRIALING` עם `trialEndsAt = approvedAt + 60 יום` (סעיף 4.4).
ניהול מנויים (Subscription Management) — ליבת ניהול ההכנסות ב-MVP:
טבלת מרפאות עם עמודות: שם מרפאה, סטטוס מנוי (PENDING / TRIALING / ACTIVE / PAST_DUE / CANCELED), מסלול (חודשי/שנתי), מחיר, תאריך סיום התנסות, תאריך חידוש הבא, מועד חיוב אחרון, סה"כ פניות שקיבלה.
פילטר מהיר "דורש טיפול": מרפאות ב-`PAST_DUE` (חיוב נכשל) ומרפאות שההתנסות שלהן מסתיימת בתוך 7 ימים — אלה שתי הקבוצות שקובעות את שיעור ההמרה והנטישה.
לחצן "הארך התנסות": דחיית `trialEndsAt` בימים עבור מרפאה אסטרטגית.
לחצן "פצה על פנייה פסולה": הארכת `currentPeriodEnd` בימים, עם שדה חובה "סיבה" הנרשם ב-AuditLog (סעיף 4.5).
לחצן "בטל מנוי": מציב `canceledAt`; הנראות נשמרת עד תום התקופה ששולמה.
צפייה בהיסטוריית חיובים (SubscriptionCharge) לכל מרפאה: סכום, תקופה, סטטוס, ומזהה עסקה אצל הספק.
ניהול פניות ודיווחים (Lead & Dispute Management):
טבלת כל הפניות שנמסרו: מזהה בקשה, מרפאה, תאריך מסירה, האם הוגשה הצעת מחיר, והאם דווחה כפסולה.
פעולת "סמן כפנייה פסולה": מציבה `disputedAt` ו-`disputeReason`. זמינה רק בתוך חלון 7 הימים (סעיף 4.5). הדיווח נרשם למדידה גם כשלא ניתן פיצוי.
ניהול משתמשים (User Management):
צפייה ברשימת המטופלים הרשומים, תאריך הרשמה, סטטוס אימות טלפון, כמות בקשות שביצעו.
אפשרות לחסימת משתמש (Block) במקרה של שימוש לרעה או ספאם.
מסך סטטיסטיקות (Analytics Overview):
MRR — הכנסה חודשית חוזרת (North Star Metric, סעיף 1.3). כל ההכנסות מקורן ב-B2B בלבד.
פילוח מרפאות לפי סטטוס מנוי, וגרף חיובים חודשי.
שיעור המרה מהתנסות לתשלום (Trial → Paid) ונטישה חודשית (Churn).
שיעור הפניות הפסולות (Disputed Lead Rate) — התראה ויזואלית בחריגה מ-10%.
סך הכל בקשות שנשלחו במערכת, כמות מטופלים פעילים וכמות רופאים רשומים במאגר.
## 9. ארכיטקטורת נתונים (Database Schema - Prisma)
להלן מבנה ה-Schema הרשמי בפורמט Prisma ORM המשקף את מבנה הנתונים המלא של הפלטפורמה:



קטע קוד
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

> הערה: הסכמה שלהלן משקפת את המימוש בפועל ב-`app/prisma/schema.prisma`, בתוספת השינויים הנדרשים לביטול תשלום המטופל ולהוספת תקופת ההתנסות. ספק הסליקה הוא PayPlus (לא Stripe), ולכן שדות התשלום ניטרליים לספק (`providerRef`).

// ── סטטוס בקשת המטופל. אין עוד סטטוס PAID: ההגשה חינמית ב-100% (סעיף 4.1) ──
enum RequestStatus {
  DRAFT      // נוצרה, טרם הועלו קבצים או נבחרו רופאים
  SUBMITTED  // המטופל אישר ושלח, לפני ריצת מנוע המיילים
  SENT       // נמסרה בהצלחה לפחות למרפאה אחת
  FAILED     // כשל בשליחה לכל המרפאות שנבחרו
}

// ── מצב המנוי של המרפאה — הישות המשלמת היחידה בפלטפורמה (סעיף 4.3-4.4) ──
enum SubscriptionStatus {
  PENDING   // נרשמה, טרם אושרה על ידי אדמין
  TRIALING  // בתקופת התנסות של 60 יום — נראית במאגר, לא מחויבת
  ACTIVE    // מנוי בתוקף
  PAST_DUE  // כשל בחיוב — נראית עוד 3 ימי חסד
  CANCELED  // בוטלה
}

enum SubscriptionPlan {
  MONTHLY  // 299 ₪
  YEARLY   // 1,990 ₪
}

// ניטרלי לספק, ומופרד במכוון מ-RequestStatus: תשלום אינו בקשה.
enum PaymentStatus {
  PENDING
  PAID
  FAILED
}

// ── המטופל. אין לו יותר relation לתשלומים — הוא לעולם אינו משלם ──
model User {
  id              String    @id @default(uuid())
  clerkUserId     String    @unique
  fullName        String
  email           String    @unique
  phone           String    @unique // E.164 מנורמל, לדוגמה +9725XXXXXXXX
  phoneVerifiedAt DateTime? // חובה non-null כדי לשלוח בקשה (מסנן 1, סעיף 4.2)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  requests Request[]

  @@index([clerkUserId])
}

// ── המרפאה. הלקוח המשלם, דרך ClinicSubscription ──
model Dentist {
  id              String   @id @default(uuid())
  clinicName      String
  dentistName     String
  email           String   @unique
  phone           String
  city            String
  address         String
  experienceYears Int
  specialties     String[]
  treatments      String[]
  hmoAffiliations String[]
  profileImageUrl String?
  rating          Float    @default(5.0)
  reviewCount     Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // הרשמה עצמית + חוזה מנוי
  contactName     String?
  submittedBySelf Boolean   @default(false) // הרשמה עצמית הממתינה לאישור
  agreedToTermsAt DateTime?
  termsVersion    String?
  approvedAt      DateTime? // טריגר תחילת 60 ימי ההתנסות (סעיף 4.4)

  requestDentists RequestDentist[]
  subscription    ClinicSubscription?

  @@index([city])
  @@index([isActive])
  @@index([submittedBySelf])
}

model Request {
  id               String        @id @default(uuid())
  // Nullable: מחיקת משתמש (Clerk user.deleted) משמרת את הבקשה כרשומת ביקורת
  userId           String?
  user             User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  treatmentFileUrl String
  xrayFileUrl      String
  patientNotes     String?       @db.Text
  status           RequestStatus @default(DRAFT)
  sentAt           DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  requestDentists RequestDentist[]

  @@index([userId])
  @@index([status])
}

// ── טבלת המעבר. זוהי גם רשומת הפנייה לצורכי מדידה ואיכות ──
model RequestDentist {
  id        String    @id @default(uuid())
  requestId String
  request   Request   @relation(fields: [requestId], references: [id], onDelete: Cascade)
  dentistId String
  dentist   Dentist   @relation(fields: [dentistId], references: [id], onDelete: Cascade)
  emailSent Boolean   @default(false)
  sentAt    DateTime?

  quoteToken String? @unique // מגנט-לינק פר-נמען לטופס הצעת המחיר
  quote      Quote?

  // דיווח פנייה פסולה (סעיף 4.5) — אין זיכוי כספי, רק מדידה ופיצוי בימי מנוי
  disputedAt    DateTime?
  disputeReason String?   @db.Text

  @@unique([requestId, dentistId])
  @@index([dentistId, sentAt]) // איתור פניות כפולות לאותה מרפאה ב-90 יום
}

model Quote {
  id                String         @id @default(uuid())
  requestDentistId  String         @unique
  requestDentist    RequestDentist @relation(fields: [requestDentistId], references: [id], onDelete: Cascade)
  amountILS         Int
  note              String?        @db.Text
  patientNotifiedAt DateTime?      // null = טרם נשלחה התראה למטופל; קרון הריטריי אוסף אלה
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([requestDentistId])
}

// ── מנוי המרפאה. מחליף לחלוטין את מודל Payment הישן שהיה קשור למטופל ──
model ClinicSubscription {
  id                 String             @id @default(uuid())
  dentistId          String             @unique
  dentist            Dentist            @relation(fields: [dentistId], references: [id], onDelete: Cascade)
  plan               SubscriptionPlan
  status             SubscriptionStatus @default(PENDING)
  priceILS           Int
  setupToken         String             @unique
  recurringToken     String?            // טוקן כרטיס שמור אצל הספק, נקבע לאחר החיוב הראשון
  payplusCustomerUid String?
  pageRequestUid     String?
  trialEndsAt        DateTime?          // approvedAt + 60 יום (סעיף 4.4)
  currentPeriodEnd   DateTime?
  lastChargeAt       DateTime?
  canceledAt         DateTime?
  paymentFailedNotifiedAt DateTime?     // כדי שמרפאה ב-PAST_DUE תקבל התראה פעם אחת
  trialEndingNotifiedAt   DateTime?     // התראת יום 45 / יום 58 (סעיף 4.4)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  charges SubscriptionCharge[]

  @@index([status])
  @@index([currentPeriodEnd])
  @@index([trialEndsAt])
}

model SubscriptionCharge {
  id                    String             @id @default(uuid())
  subscriptionId        String
  subscription          ClinicSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  amountILS             Int
  status                PaymentStatus      @default(PENDING)
  payplusTransactionUid String?            @unique
  periodStart           DateTime
  periodEnd             DateTime
  paidAt                DateTime?
  createdAt             DateTime           @default(now())

  @@index([subscriptionId])
}

model RateLimit {
  id        String   @id @default(uuid())
  bucket    String   // "clinic-join:<ip>", "quote:<token>", "upload:<requestId>", "otp:<phone>"
  createdAt DateTime @default(now())

  @@index([bucket, createdAt])
}

model AuditLog {
  id       String   @id @default(uuid())
  actor    String   // מייל אדמין, או "system" / "webhook"
  action   String   // "clinic.approve", "request.fulfilled", "subscription.canceled", "lead.disputed"
  entity   String
  entityId String
  metadata Json?
  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([createdAt])
}

// ❌ מודל Payment (תשלום מטופל) — נמחק. אין ישות תשלום הקשורה ל-User או ל-Request.

## 10. מפרט נקודות קצה (API Endpoints Specification)
כל נקודות הקצה מוגנות באמצעות שכבת אבטחה הבודקת Authentication (למעט שליפת רופאים פומבית).
### 10.1 אימות ומשתמשים (Auth)
POST /api/auth/webhook – קליטת נתונים מ-Clerk בעת הרשמת משתמש חדש וסנכרון הנתונים ישירות לטבלת User ב-PostgreSQL.
### 10.2 תשלומים ומנויים (Payments) — B2B בלבד
❌ בוטל: POST /api/payments/create-session — נקודת הקצה של סליקת המטופל נמחקה במלואה, יחד עם ה-Server Action `createCheckoutSession`. אין מסלול תשלום כלשהו במסלול הגשת הבקשה של המטופל, וההגשה חינמית ב-100%.
POST /api/webhooks/payplus – קצה פתוח המקשיב ל-PayPlus. מטפל אך ורק באירועי מנוי: השלמת חיוב ההקמה (שמירת `recurringToken`), וחיובי חידוש. הווביהוק אינו נוגע בישויות Request ואינו מפעיל את שליחת המיילים למטופל.
GET /api/cron/renew-subscriptions – קרון יומי. מחייב מנויים שהגיע מועד חידושם, מבצע את החיוב הראשון למנויים שתקופת ההתנסות שלהם הסתיימה (`trialEndsAt` חלף), שולח התראות יום 45 ויום 58, ומטפל במעבר ל-`PAST_DUE` ובחלון החסד.
טריגר שליחת המיילים לרופאים אינו תלוי עוד בתשלום, ומופעל ישירות מ-POST /api/requests/[id]/submit (סעיף 10.4).
### 10.3 רופאי שיניים (Dentists)
GET /api/dentists – שליפת כל הרופאים שבהם isActive: true. תמיכה ב-Query Parameters עבור סינון: ?city=Jerusalem&specialty=Implants&hmo=Clalit.
POST /api/admin/dentists – (חסום לאדמין בלבד) יצירת כרטיס רופא חדש במערכת.
PUT /api/admin/dentists/[id] – (חסום לאדמין בלבד) עריכת פרטי רופא או שינוי סטטוס פעיל/מושבת.
### 10.4 בקשות (Requests)
POST /api/requests/create – יצירת ישות בקשה חדשה במצב PENDING עם הקישורים לקבצים שהועלו ל-S3. מחזיר את ה-requestId.
POST /api/requests/[id]/submit – נקודת הקצה המרכזית של המערכת, ומחליפה את ה-Webhook של ספק הסליקה כטריגר לשליחת המיילים. מקבל מערך של עד 3 מזהי רופאים (dentistIds) והערות מטופל, ומבצע ברצף:
1. אימות זכאות המטופל: `phoneVerifiedAt` אינו null, ושני הקבצים הרפואיים קיימים. אחרת 403.
2. אימות מחדש של זכאות המרפאות (סעיף 4.6): שמירת הרופאים שנבחרו שעבורם `isActive: true` וגם המנוי עומד בשער הנראות (`TRIALING` / `ACTIVE` / `PAST_DUE` בתוך החסד). מרפאה שמנויה פקע בין הבחירה לשליחה מסוננת החוצה.
3. בניית הקישורים בטבלת המעבר RequestDentist עבור המרפאות שנותרו.
4. הפעלת מנוע שליחת המיילים (Resend), עם תפיסה אטומית של כל נמען (`emailSent: false → true`) כדי שכל מרפאה תקבל מייל אחד בדיוק, ועם `quoteToken` יציב אחד לכל נמען.
5. עדכון סטטוס הבקשה ל-SENT או FAILED, ורישום ב-AuditLog.
6. החזרת מספר המרפאות שאליהן נשלחה הבקשה בפועל, לצורך חיווי שקוף למטופל.
הערה: אין כאן שלב חיוב. במודל מנוי הכסף כבר נגבה ברמת המרפאה, ושליחת הפנייה היא אספקת השירות שכבר שולם עליו — לא אירוע חיוב.
POST /api/admin/leads/[id]/dispute – (חסום לאדמין בלבד) מסמן פנייה כפסולה בתוך חלון 7 הימים (סעיף 4.5): מציב `disputedAt` ו-`disputeReason`, ובאופן נפרד מאפשר הארכת `currentPeriodEnd` כפיצוי. הפעולה נרשמת ב-AuditLog.
GET /api/requests/my-requests – שליפת היסטוריית הבקשות של המשתמש המחובר הנוכחי לטובת ה-Dashboard שלו.
## 11. דרישות אבטחה, הגנת פרטיות וולידציה (Security & Privacy)
מכיוון שהמערכת מטפלת במידע רפואי רגיש (תוכניות טיפול וצילומים), יש ליישם את ההנחיות הבאות באופן מחמיר:
אבטחת תעבורה וגישה: שימוש ב-HTTPS בלבד בכל סביבות העבודה. כל ה-API Routes (למעט ה-Webhooks של PayPlus ו-Clerk, ולמעט מסלולי המגנט-לינק של הצעות המחיר המאובטחים בטוקן) יבצעו בדיקת סשן מול Clerk לפני הרצת לוגיקה.
הגנת קבצים ב-Storage (S3/R2): הבאקטים של האחסון יהיו חסומים לחלוטין לגישה ציבורית (Private). ה-URLs שיישמרו במסד הנתונים ויישלחו במיילים יהיו קישורים חתומים זמנית (Presigned URLs) פגי תוקף (לדוגמה: בתוקף ל-7 ימים בלבד), או שהקבצים ייקראו כ-Buffer ויישלחו כ-Attachment פיזי ישיר לרופא מבלי לחשוף את כתובת השרת.
מניעת התקפות מניעת שירות (Rate Limiting): הגבלת כמות הקריאות ל-API Routes (במיוחד עבור יצירת בקשות והעלאת קבצים) באמצעות חבילות כמו upstash/ratelimit או מידלוור ייעודי ב-Next.js – מקסימום 5 בקשות העלאה בדקה ל-IP/User.
אבטחת קלטים (Sanitization): ולידציה קשיחה על כל שדות הטקסט (הערות המטופל, טופס הרשמה) למניעת הזרקות קוד (XSS / SQL Injection) באמצעות ספריות ולידציה כמו Zod.
## 12. הגדרת ה-MVP מול גרסאות עתידיות (MVP Scope)
כדי להבטיח עלייה חלקה ומהירה לאוויר בתוך 2–4 שבועות לצורך ולידציה של השוק, הגדרנו גבולות גזרה ברורים:
### ⚙️ כלול בגרסת ה-MVP (In Scope)
מערכת הרשמה ואימות מייל למטופלים (Clerk), בתוספת אימות טלפון נייד ישראלי ב-OTP/SMS כתנאי חוסם להגשת בקשה.
מסלול הגשה חינמי ב-100% למטופל, ללא מודול סליקה וללא הזנת אמצעי תשלום בשום שלב.
דף בית שיווקי וממיר הכולל רכיב FAQ מובנה.
מערכת העלאת קבצים רפואיים מוגנת עם חסימת המשך.
דף סינון ובחירת רופאים (עד 3 רופאים) המבוסס על מיקום, קופת חולים והתמחות.
הרשמה עצמית של מרפאות (`/clinics/join`) הכוללת בחירת מסלול מנוי וחתימה על חוזה מגורסן.
מנוי מרפאות מלא: מסלול חודשי/שנתי, תקופת התנסות אוטומטית של 60 יום, חיוב חוזר בטוקן שמור, חלון חסד ל-PAST_DUE, וקרון חידוש יומי.
אינטגרציית PayPlus בצד ה-B2B בלבד.
שער נראות: רק מרפאה עם מנוי תקף מופיעה בספרייה ומקבלת פניות.
מנגנון שליחת מיילים אוטומטי ומקבילי לרופאים באמצעות Resend הכולל קבצים מצורפים (Attachments) וקישור ייעודי להגשת הצעת מחיר.
מערכת הצעות מחיר: הרופא מגיש הצעה דרך מגנט-לינק, והמטופל מקבל התראה במייל.
אזור אישי בסיסי למטופל לצפייה בסטטוס הבקשות שלו ובהצעות שהתקבלו (ללא כל התייחסות לעלות).
פאנל ניהול אדמין מלא: מאגר הרופאים, ניהול מנויים והתנסויות, ניהול פניות ודיווחים, וסטטיסטיקות MRR.
### ❌ לא כלול בגרסת ה-MVP (Out of Scope – מתוכנן ל-V2/V3)
אין אזור אישי או ממשק התחברות לרופאי שיניים. (הרופאים מגיבים אך ורק בתוך המייל שלהם חזרה למטופל).
אין בנק קרדיטים ואין תמחור Pay-per-Lead — מתוכנן ל-V2 לאחר צבירת דאטה על שיעורי סגירה בפועל.
אין הצהרת קטגוריית טיפול או חלון זמן בצד המטופל (מסנן 3 בסעיף 4.2) — נדרש רק למודל ה-V2.
אין חיוב או תשלום כלשהו בצד המטופל, בשום גרסה עתידית. זהו עקרון מוצר ולא מגבלת MVP.
אין מערכת השוואת מחירים פנימית או הזנת הצעות בתוך האתר.
אין צ'אט פנימי בין הרופא למטופל באתר.
אין אפליקציית מובייל ייעודית (האתר מפותח כ-Web רספונסיבי מותאם מובייל באופן מושלם).
## 13. הנחיה ממוקדת לפיתוח באמצעות סוכני AI (Master Prompt for Claude Code)
[!TIP]
באפשרותך להעתיק את הטקסט בתיבה להלן ולהזין אותו ישירות ל-Claude Code / Cursor כהנחיית התחלה (Master Prompt) לאחר יצירת הפרויקט:









Plaintext
You are an expert full-stack developer working on "DentalCompare", an EXISTING Next.js 15 application located in `app/`. This is a migration task, not a greenfield build. Do NOT scaffold a new project and do NOT re-implement what already works.

Actual stack in the repo: Next.js 15 (App Router), TypeScript, Tailwind CSS, ShadCN UI, Prisma ORM with PostgreSQL, Clerk for Auth, PayPlus for payments (NOT Stripe), Vercel Blob (private) for medical file storage, and Resend for email delivery. Read `app/AGENTS.md` first — this Next.js version has breaking changes; consult `node_modules/next/dist/docs/` before writing code.

GOAL OF THIS MIGRATION: the patient side becomes 100% free, and the clinic subscription becomes the sole revenue stream.

1. REMOVE PATIENT PAYMENT ENTIRELY.
   - Delete `src/server/payments.ts` (the `createCheckoutSession` server action) and `src/components/request/pay-button.tsx`.
   - Delete the `PRICING` constant from `src/lib/constants.ts`.
   - Remove the `Payment` model and the `RequestStatus.PAID` member from `prisma/schema.prisma`. Write a migration; do not lose historical rows without an explicit backup step.
   - `RequestStatus` becomes DRAFT | SUBMITTED | SENT | FAILED. Update every reader of the old PAID status: `src/app/dashboard/page.tsx`, `src/app/admin/requests/page.tsx`, `src/app/admin/page.tsx`, and delete `src/app/admin/payments/page.tsx`.
   - `src/lib/payplus.ts`: `createOneTimePaymentPage` becomes dead code — remove it. Keep everything the subscription flow uses.
   - `src/app/api/webhooks/payplus/route.ts`: stop handling one-time patient payments. Subscription charge handling stays.

2. RE-KEY FULFILLMENT OFF PAYMENT.
   `src/server/fulfillment.ts` currently exposes `fulfillPaidSession(providerRef)`, keyed on `Payment.providerRef`, and is triggered by the payment webhook and the success page. Rewrite it as `fulfillRequest(requestId)`, triggered by the patient pressing "send" on the confirm screen. Preserve exactly as-is: the atomic per-recipient claim (`emailSent: false → true` via updateMany, count === 1 wins), the stable `quoteToken`, the claim-release on send failure, and idempotency — these are what stop a clinic being emailed twice. Update `src/app/api/cron/retry-fulfillment/route.ts` to find SUBMITTED-but-unsent requests instead of PAID ones.

3. LIMIT SELECTION TO 3 DENTISTS.
   Set `REQUEST_LIMITS.maxDentists = 3` in `src/lib/constants.ts`. Every consumer already reads from that constant (`dentist-directory.tsx`, `selection-counter.tsx`, `server/requests.ts`) — do not hardcode the number anywhere new. This is a deliberate lead-exclusivity decision (PRD Section 4.6), not a UI preference.

4. ADD A 60-DAY FREE TRIAL FOR CLINICS.
   - Add `TRIALING` to the `SubscriptionStatus` enum and `trialEndsAt` + `trialEndingNotifiedAt` to `ClinicSubscription`.
   - On admin approval, set `Dentist.approvedAt`, move the subscription to `TRIALING`, and set `trialEndsAt = approvedAt + 60 days`.
   - `visibleSubscriptionFilter()` and `isClinicVisible()` in `src/lib/subscription.ts` MUST include TRIALING, or trial clinics silently receive nothing. Update both, and their tests.
   - `src/app/api/cron/renew-subscriptions/route.ts`: when `trialEndsAt` has passed, run the first real charge and move to ACTIVE. Send the day-45 and day-58 warning emails. Existing PAST_DUE grace logic is unchanged.
   - The payment method is collected at registration, so the trial converts by non-cancellation, not by a second sale.

5. ADD PATIENT PHONE OTP.
   Israeli mobile verification via SMS. Normalize to E.164 (+9725XXXXXXXX), make `User.phone` unique, set `User.phoneVerifiedAt`. Rate-limit OTP sends using the existing DB-backed `RateLimit` model (add an `otp:<phone>` bucket to `RATE_LIMITS`). A request cannot be submitted while `phoneVerifiedAt` is null — enforce this server-side in the submit action, not only in the UI.

6. UPDATE PATIENT-FACING COPY AND LEGAL PAGES.
   `src/components/sections/hero.tsx`, `final-cta.tsx`, and `faq.tsx` all advertise "₪49 חד-פעמי" — replace with free-service messaging and the 3-quote promise. `src/app/terms/page.tsx` and `src/app/refunds/page.tsx` describe a patient charge and its refund policy that will no longer exist; these are compliance text, not marketing copy — rewrite them to describe a free patient service and a clinic subscription, and flag them for legal review.

7. NEVER re-introduce any patient-facing price, paywall, card collection, balance, or credit indicator. If a task seems to require charging a patient, stop and ask instead of implementing it.

Update the tests that encode the old model (`src/lib/payplus.test.ts`, `src/server/fulfillment.integration.test.ts`) rather than deleting them. Do not output placeholders; write production-ready, clean, commented code, and run the existing test suite before declaring done.


[TABLE 1]
שכבה | טכנולוגיה נבחרת | הסבר והצדקה ארכיטקטונית
Frontend | Next.js 15 (App Router) + TypeScript | ביצועי SSR/SSG מעולים לטובת SEO, חוויית משתמש מהירה וארכיטקטורה מודרנית.
Styling & UI | Tailwind CSS + ShadCN UI | פיתוח מהיר של ממשק רספונסיבי, נקי ואסתטי המבוסס על קומפוננטות נגישות.
Backend | Next.js API Routes (Serverless) | קוד אחיד (Full-stack TypeScript), פיתוח מהיר וסקיילאביליות ללא ניהול שרתים.
Database | PostgreSQL | בסיס נתונים רלציוני חזק ויציב, חובה לניהול קשרים מורכבים (Requests, Dentists).
ORM | Prisma | Type-safe queries, מיגרציות פשוטות ועבודה מהירה מול PostgreSQL.
Authentication | Clerk (או Auth.js) | ניהול מאובטח של משתמשים, אימות מייל, הרשאות משתמשים וניהול סשנים ללא שבריריות.
Storage | AWS S3 / Cloudflare R2 | אחסון קבצים רפואיים (PDF, תמונות) בצורה מוצפנת, מאובטחת ומהירה עם קישורים מוגבלים בזמן.
Email Service | Resend | שליחת מיילים טרנזקציוניים מהירה במיוחד עם תמיכה בטמפלייטים מבוססי React.
Payments | PayPlus | ספק סליקה ישראלי. נבחר על פני Stripe בשל תמיכה מלאה בכרטיסי אשראי ישראליים, חשבוניות בעברית, ותמיכה בטוקן חיוב חוזר (Recurring Token) הנדרש למנויי המרפאות. משמש אך ורק בצד ה-B2B.
Storage (Files) | Vercel Blob (Private) | אחסון הקבצים הרפואיים בגישה פרטית; הקבצים נמשכים כ-Buffer ומצורפים פיזית למייל, ללא חשיפת URL.
[/TABLE]
