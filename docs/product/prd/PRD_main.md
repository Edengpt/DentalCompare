# PRD – DentalCompare
## פלטפורמת השוואת מחירים בין רופאי שיניים
### Version
1.0
### Status
MVP
### Product Owner
Founder

# 1. Product Vision
DentalCompare היא פלטפורמה המאפשרת למטופלים לקבל מספר הצעות מחיר מרופאי שיניים בישראל באמצעות העלאה חד פעמית של תוכנית טיפול וצילומי שיניים.
במקום ליצור קשר עם עשרות מרפאות באופן ידני, המשתמש שולח בקשה אחת לעד 3 רופאים במקביל ומקבל הצעות מחיר להשוואה — בחינם.

# 2. Problem Statement
מטופלים מתקשים:
להבין האם קיבלו מחיר הוגן
להשוות מחירים בין מרפאות
ליצור קשר עם מספר מרפאות
לקבל הצעות מחיר במהירות
רופאי שיניים מתקשים:
לקבל לידים איכותיים
להגיע למטופלים חדשים

# 3. Success Metrics
### חודש ראשון
100 משתמשים רשומים עם טלפון מאומת
50 בקשות מחיר
300 מיילים שנשלחו
20 מרפאות בתקופת התנסות (60 יום חינם)
### 6 חודשים
1000 משתמשים
300 רופאים רשומים
500 בקשות בחודש
60 מרפאות משלמות
### North Star Metric
לידים מחויבים בחודש (Billed Leads / Month)

# 4. User Types
## Patient
מטופל המחפש הצעות מחיר. אינו משלם בשום שלב.
## Dentist / Clinic
המרפאה — הלקוח המשלם היחיד בפלטפורמה.
## Admin
מנהל המערכת.

# 5. User Flow
Home Page
↓
Register
↓
Email Verification
↓
Phone OTP Verification
↓
Upload Treatment Plan
↓
Upload X-Ray / Dental Images
↓
Treatment Category + Start Timing
↓
Choose Dentists
↓
Send Request (Free)
↓
Receive Quotes

# 6. Business Rules
חובה להיות משתמש רשום
ההגשה חינמית ב-100% — אין תשלום ואין הזנת אמצעי תשלום בצד המטופל
חובה לאמת מייל וטלפון נייד (OTP)
חובה להעלות תוכנית טיפול
חובה להעלות צילום שיניים
ניתן לבחור עד 3 רופאים (מגבלת בלעדיות ליד — ראה PRD_full סעיף 4.6)
המייל נשלח במקביל רק למרפאות שעברו את שער הנראות (מנוי TRIALING / ACTIVE / PAST_DUE בתוך החסד)
אין ניכוי או מכסה ברמת הליד — המרפאה משלמת מנוי, לא פר-פנייה
לא ניתן לשלוח פעמיים את אותה בקשה

# 7. Screens
## Home Page
Components:
Hero Section
CTA
Benefits
FAQ
Testimonials
CTA:
“קבל 3 הצעות מחיר — בחינם”

## Registration Page
Fields:
Full Name
Email
Phone
Password
Validation:
Email required
Phone required
Password min 8 chars

## Payment Page — REMOVED
מסך התשלום הוסר לחלוטין ממסלול המטופל.
PayPlus (לא Stripe) משמש אך ורק בצד ה-B2B: מנוי מרפאות חודשי 299 ₪ / שנתי 1,990 ₪, עם 60 יום התנסות חינם וחיוב חוזר בטוקן שמור.

## Upload Page
Required Files:
Treatment Plan
Formats:
PDF
JPG
PNG
Dental Images
Formats:
PDF
JPG
PNG
Max Size:
20MB

## Dentist Directory
Card Includes:
Profile Image
Clinic Name
Dentist Name
City
Address
Experience
Specializations
Treatments
Health Funds
Rating
Actions:
Select Dentist
Maximum:
3 Dentists

## Request Confirmation
Summary:
Number of Dentists
Files Uploaded
Treatment Category
Date
Legal Consent Checkbox
Button:
Send Request
אין להציג מחירים, יתרות או כל התייחסות לעלות במסכי המטופל.

# 8. Email Workflow
Trigger:
Request Submitted
Recipients:
Selected Dentists
Subject:
בקשה להצעת מחיר לטיפול שיניים
Attachments:
Treatment Plan
Dental Images
Email Body:
Patient Details
Request Details
Contact Information

# 9. Database Design
## Users
id name email phone phone_verified_at is_blocked created_at
## Dentists
id clinic_name dentist_name email phone city address experience_years specializations treatments health_funds rating image_url active billing_status credit_balance approved_at pilot_ends_at pilot_leads_used lead_price_override total_leads_received total_revenue
## Requests
id user_id treatment_plan_url dental_images_url status sent_at created_at
(ללא payment_id — אין תשלום בצד המטופל)
## RequestDentists
id request_id dentist_id email_sent sent_at quote_token disputed_at dispute_reason
## Quotes
id request_dentist_id amount_ils note patient_notified_at created_at
## ClinicSubscriptions
id dentist_id plan status price_ils setup_token recurring_token payplus_customer_uid trial_ends_at current_period_end last_charge_at canceled_at
## SubscriptionCharges
id subscription_id amount_ils status payplus_transaction_uid period_start period_end paid_at
## AuditLog / RateLimit
(תשתית קיימת — ביקורת פעולות והגבלת קצב)
❌ מודל Payments (תשלום מטופל) — נמחק.

# 10. API Endpoints
POST /api/auth/register
POST /api/auth/login
POST /api/auth/phone/send-otp
POST /api/auth/phone/verify-otp
POST /api/files/upload
GET /api/dentists
GET /api/dentists/{id}
POST /api/requests
GET /api/requests
POST /api/requests/{id}/submit   ← הטריגר היחיד לשליחת המיילים (ללא חיוב)
POST /api/clinics/join           ← הרשמה עצמית של מרפאה + בחירת מסלול + חתימת חוזה
POST /api/admin/leads/{id}/dispute
POST /api/webhooks/payplus       ← אירועי מנוי בלבד
GET  /api/cron/renew-subscriptions ← חידושים, סיום התנסות, התראות, PAST_DUE
❌ POST /api/payments/create-session — בוטל. אין סליקה במסלול המטופל.

# 11. Admin Dashboard
Features:
Manage Dentists (approve → starts 60-day trial)
Subscription Management (status, plan, trial end, next renewal, charge history)
Extend Trial / Compensate with subscription days
Leads & Disputes (report invalid lead within 7 days)
Manage Users
Manage Requests
Analytics
Statistics:
Total Users
Total Requests
MRR (B2B only — North Star)
Trial to Paid Conversion
Monthly Churn
Disputed Lead Rate
Total Dentists

# 12. Security Requirements
HTTPS
JWT Authentication
Role Based Access Control
File Encryption
Audit Logs
Rate Limiting
Email Verification

# 13. Technology Stack
Frontend
Next.js 15
TypeScript
Tailwind
ShadCN
Backend
Next.js API
Database
PostgreSQL
ORM
Prisma
Authentication
Clerk
Storage
Vercel Blob (Private)
Email
Resend
Payments
PayPlus (B2B only — not Stripe)
Hosting
Vercel

# 14. Future Versions
V2
Dentist Portal
Internal Quotes System
Notifications
Chat
V3
AI Quote Analysis
Price Benchmarking
Automated Dentist Ranking
Lead Marketplace

# 15. MVP Scope
Included
✓ Registration
✓ Login
✓ Email + Phone OTP Verification
✓ Free Patient Submission (no payment)
✓ File Upload
✓ Dentist Directory
✓ Select Up To 3 Dentists
✓ Clinic Subscription (monthly/yearly, 60-day free trial, recurring token, grace window)
✓ PayPlus B2B Checkout + renewal cron
✓ Visibility Gate (only subscribed clinics appear and receive leads)
✓ Quote System (magic-link quote submission + patient notification)
✓ Email Sending
✓ Admin Dashboard
Not Included
✗ Patient Payments (ever — product principle, not an MVP limit)
✗ Dentist Portal
✗ Credit Bank / Pay-per-Lead pricing (V2)
✗ Treatment Category + Start Timing fields (V2 — only needed for Pay-per-Lead)
✗ Internal Messaging
✗ Quote Comparison Engine
✗ Mobile App