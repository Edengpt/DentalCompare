import type he from "./he";

/**
 * English copy, written natively rather than translated word-for-word — the
 * Hebrew marketing voice doesn't survive a literal crossing.
 *
 * Typed `typeof he`: a key added to Hebrew and missed here fails the build. That
 * annotation is the only thing preventing a half-translated site, so do not
 * loosen it.
 *
 * Two deliberate divergences from the Hebrew, both because the audiences differ
 * rather than the words:
 *
 *  - Currency figures are quoted in the reader's own terms. A British visitor
 *    weighing a trip abroad doesn't price the decision in shekels, and a figure
 *    they can't feel is worse than no figure.
 *  - The Hebrew hero positions the site as Israeli. The English one doesn't,
 *    because its readers are the cross-border audience — the whole reason this
 *    locale exists.
 */
const en: typeof he = {
  meta: {
    title: "DentalCompare – Compare dental quotes. Save thousands.",
    description:
      "Compare written quotes from leading dental clinics with a single request, free. Upload your treatment plan once — no phone calls, no pressure.",
    ogTitle: "DentalCompare – Compare dental quotes. Save thousands.",
    ogDescription:
      "Get quotes from 3 dental clinics with one request, free — no phone calls, no pressure.",
  },

  common: {
    switchLanguage: "Language",
    loading: "Loading…",
  },

  nav: {
    ariaLabel: "Main",
    howItWorks: "How it works",
    faq: "FAQ",
    clinicsJoin: "For clinics",
    signIn: "Sign in",
    getStarted: "Get started",
    dashboard: "My account",
  },

  hero: {
    eyebrow: "Compare dental quotes",
    headlineTop: "Not sure the price you were quoted is fair?",
    headlineMain: "Get 3 written quotes.",
    headlineAccent: "Save thousands.",
    benefitUpload: "Upload once: your treatment plan and your x-ray.",
    benefitSend: "Your request goes to 3 leading clinics at the same time.",
    benefitCompare: "Quotes come back to your inbox — compare, and save.",
    benefitNoCalls: "No phone calls, no commitment, no pressure.",
    cta: "Get my quotes",
    secondaryCta: "How does it work?",
    reassurance: "Completely free ✦ No credit card ✦ No commitment",
    statDentistsValue: "300+",
    statDentistsLabel: "dentists in our network",
    statResponseValue: "97%",
    statResponseLabel: "of requests answered within 48 hours",
    statSavingsValue: "£750",
    statSavingsLabel: "average saving per treatment",
  },

  howItWorks: {
    eyebrow: "How it works",
    title: "Three steps — and the hardest part is waiting.",
    subtitle:
      "No endless forms, no pushy calls. The whole thing happens on one screen and takes about three minutes.",
    step1Title: "Upload your plan and x-ray",
    step1Description:
      "The treatment plan a dentist has already given you, plus your x-ray. PDF or photo, up to 20MB each — that's it.",
    step1Detail: "1–2 minutes",
    step2Title: "Pick up to 3 clinics",
    step2Description:
      "Filter by city, speciality and insurer, and choose exactly who you want. Your request goes only to the clinics you ticked — no spam, ever.",
    step2Detail: "Smart filters",
    step3Title: "Quotes arrive by email",
    step3Description:
      "Each clinic receives your documents and replies with a written quote. Compare them in your own time and choose — with no obligation.",
    step3Detail: "Within 24–48 hours",
  },

  benefits: {
    eyebrow: "Why DentalCompare",
    title: "Four problems. Four answers.",
    subtitle:
      "No grand claims about a “revolutionary platform” — just a direct answer to four frustrations anyone facing expensive dental work knows well.",
    oneTitle: "Save thousands",
    oneDescription:
      "Transparent comparison hands you back the bargaining power. Our patients save around £750 on complex treatment, and often a great deal more.",
    twoTitle: "One request, 3 clinics",
    twoDescription:
      "Instead of hours of phone calls and email chains — three minutes at your screen, and your request is already on its way to every clinic at once.",
    threeTitle: "Your privacy is kept",
    threeDescription:
      "Your medical documents reach only the clinics you picked. Never shared with third parties, never used for advertising, never spammed.",
    fourTitle: "No pointless clinic visits",
    fourDescription:
      "Instead of travelling between clinics and booking appointments just to hear a price — quotes arrive written down and itemised. You only visit once you've chosen.",
  },

  testimonials: {
    eyebrow: "Our patients",
    title: "Real savings, real people.",
    subtitle:
      "Three patients, three different treatments — and the same thought at the end: “why didn't I do this sooner?”",
    savedLabel: "Saved",
    oneQuote:
      "I was quoted £6,000 for 3 implants. Through DentalCompare I had 6 quotes within 3 days — the lowest was £4,200. I saved almost 30%.",
    oneName: "Ori Ben-David",
    oneLocation: "Ra'anana",
    oneSavings: "£1,800",
    oneTreatment: "3 implants + crowns",
    twoQuote:
      "I was convinced I had to stay with my usual dentist because he “already knows me”. Turned out a clinic ten minutes away offered the same treatment for 40% less.",
    twoName: "Maya Cohen",
    twoLocation: "Tel Aviv",
    twoSavings: "£900",
    twoTreatment: "Root canal + crown",
    threeQuote:
      "With three kids I have no time to shop around between clinics. I uploaded my husband's plan one evening and by morning there were 4 quotes. We picked the clinic that suited our schedule — and saved as well.",
    threeName: "Shira Levi",
    threeLocation: "Modi'in",
    threeSavings: "£600",
    threeTreatment: "Orthodontics",
  },

  faq: {
    eyebrow: "FAQ",
    title: "Got a question? Chances are someone else asked it too.",
    contactPrefix: "Still have a question?",
    contactLink: "Email us",
    contactSuffix: "— we reply within 24 hours.",
    q1: "What does it cost?",
    a1: "Nothing. The service is completely free for you — we never ask for card details at any stage, and there are no subscription fees or hidden commissions. We earn from the subscriptions clinics pay to appear in our network, so we have no reason to charge you.",
    q2: "Is my medical information secure?",
    a2: "Yes. Every file is stored in encrypted cloud storage with private access only, transferred over HTTPS, and sent solely to the clinics you personally chose. We don't share it with third parties and we don't use it for advertising or sell it. You can request full deletion at any time.",
    q3: "How long until quotes arrive?",
    a3: "97% of requests receive at least 3 replies within 48 hours, and most arrive within 24. Clinics reply straight to your email — there's no need to come back to the site.",
    q4: "How do clinics get back to me?",
    a4: "Each clinic receives a dedicated email with your documents and a private link for submitting a quote. You get personal replies by email — exactly as if you had approached them directly, except you approached 3 clinics at once.",
    q5: "What if I don't like any of the quotes?",
    a5: "There is no obligation to accept any of them. The platform is a comparison tool — you decide whether and when to start treatment, and with whom. Even if you go back to your original dentist, you'll be holding written quotes and real bargaining power.",
    q6: "Which treatments is this best for?",
    a6: "DentalCompare is most useful for expensive work: implants, crowns and bridges, orthodontics, full-mouth reconstruction, complex root canals and cosmetic treatment. For simple work like a single filling, the gap between clinics is usually much smaller.",
  },

  finalCta: {
    eyebrow: "The first step",
    title: "Healthy teeth shouldn't cost a fortune.",
    subtitle:
      "The first price you're given is almost never the lowest one available. Join the patients already comparing — and saving — quietly, and in their own time.",
    cta: "Get my quotes",
    secondaryCta: "I still have questions",
    reassurance: "✦ Completely free ✦ No credit card ✦ No commitment ✦",
  },

  request: {
    rateLimitedTitle: "Too many new requests",
    rateLimitedBody:
      "You've created a lot of requests in a short time. Try again in an hour, or carry on with an existing request from your account.",
    backToDashboard: "Back to my account",
  },

  verifyPhone: {
    metaTitle: "Verify your mobile number",
    eyebrow: "One last step before sending",
    title: "Let's verify your mobile number",
    subtitle:
      "Clinics reply to you directly, so the number needs to be right. Verification is free and takes 30 seconds — we never ask for card details at any stage.",
  },

  requestStatus: {
    DRAFT: "Draft",
    SUBMITTED: "Sending",
    SENT: "Sent",
    FAILED: "Sending failed",
  },

  dashboard: {
    metaTitle: "My account",
    eyebrow: "My account",
    adminPanel: "Admin panel",
    greeting: "Hello",
    newRequest: "New quote request",
    emptyTitle: "No active requests yet",
    emptyBody:
      "Start your first request — pick up to 3 clinics, upload your treatment plan and x-ray, and the quotes will arrive in your inbox.",
    emptyCta: "Start a request",
    myRequests: "My requests",
    requestLabel: "Request",
    statusLabel: "Status",
    dentistsLabel: "clinics",
    view: "View details",
    continue: "Continue",
    fallbackGreetingName: "there",
  },

  requestFlow: {
    uploadMetaTitle: "Upload your documents",
    uploadStep: "Step 1 of 3",
    uploadTitle: "Upload your medical documents",
    uploadSubtitle:
      "Just two files are needed for clinics to quote accurately — the treatment plan you already have, and a recent x-ray.",
    dentistsMetaTitle: "Choose clinics",
    dentistsStep: "Step 2 of 3",
    dentistsTitle: "Choose the clinics that will compete for your treatment.",
    dentistsSubtitle:
      "Filter by location, speciality and insurer. Tick up to 3 clinics — your request goes to all of them at once.",
    successMetaTitle: "Request sent",
    successBodySent: (count: number) =>
      `We've sent your treatment plan and x-ray to ${count} ${count === 1 ? "clinic" : "clinics"}. Their quotes will arrive straight in your inbox — usually within 48 hours.`,
    successTitleSent: "Your request is on its way! 🎉",
    successTitlePending: "Sending in progress…",
    successBodyPending: "We've received your request and it's on its way to the clinics. Try refreshing in a moment.",
    successWatchInbox: "Keep an eye on your inbox (and sometimes your spam folder)",
    successToDashboard: "Go to my account",
  },

  confirm: {
    metaTitle: "Review your request",
    step: "Step 3 of 3",
    title: "Review before sending",
    subtitle:
      "Check the details are right. When you send, your request goes to every selected clinic at once — at no cost.",
    statusFailed: "Sending failed — please try again",
    statusReady: "Ready to send",
    selectedDentists: "Selected clinics",
    dentistsCount: (n: number) => `${n} ${n === 1 ? "clinic" : "clinics"}`,
    treatmentPlan: "Treatment plan",
    uploadedFeminine: "Uploaded ✓",
    xray: "Dental x-ray",
    uploadedMasculine: "Uploaded ✓",
    status: "Status",
    createdAt: "Created",
    recipients: "Clinics that will receive your request",
    editSelection: "Edit clinic selection",
    phoneVerifyTitle: "We recommend verifying your phone number",
    phoneMissingTitle: "No phone number on file",
    phoneBody:
      "Clinics call you back. A quick check makes sure the number is right — it takes 30 seconds and it's free.",
    phoneVerifyCta: "Verify my number",
    phoneAddCta: "Add a number",
    freeNoticePrefix:
      "Your request goes automatically to every selected clinic, together with your files.",
    freeNoticeStrong: "The service is completely free",
    freeNoticeSuffix: "— we never ask for card details at any stage.",
    backToDashboard: "Back to my account",
  },

  submitButton: {
    sending: "Sending your request…",
    submit: "Send my request — free",
  },

  selection: {
    chosen: (selected: number, max: number) => `${selected} of ${max} selected`,
    ready: "Ready to continue — you'll get quotes from every clinic you picked",
    limit: (max: number) => `You can pick up to ${max} clinics`,
    saving: "Saving…",
    continue: "Continue",
  },

  upload: {
    treatmentPlanTitle: "Treatment plan",
    treatmentPlanDescription:
      "The document your dentist gave you, listing the treatments and their costs",
    xrayTitle: "Dental x-ray",
    xrayDescription: "Panoramic, full-mouth series, or a single image from the clinic that examined you",
    required: "Required",
    saveForLater: "Save and continue later",
    continueToDentists: "Continue to choosing clinics",
  },

  dentists: {
    yearsExperience: (n: number) => `${n} years' experience`,
    reviews: (n: number) => `${n} ${n === 1 ? "review" : "reviews"}`,
    isNew: "New",
    insurersLabel: "Insurers: ",
    selected: "Selected",
    selectAria: "Select this clinic",
    filterCity: "City",
    filterSpecialty: "Speciality",
    filterInsurer: "Insurer",
    filterExperience: "Experience",
    experience5: "5+ years",
    experience10: "10+ years",
    experience15: "15+ years",
    clearFilters: "Clear filters",
    clear: "↺ Clear",
    clearOne: (label: string) => `↺ All ${label.toLowerCase()}`,
    resultCount: (shown: number, total: number) => `${shown} of ${total} clinics`,
    noResults: "No clinics match these filters.",
    clearAndRetry: "Clear the filters",
    maxReached: (max: number) => `You can select up to ${max} clinics`,
    maxReachedHint: "Remove one to add another",
    startRequestFirst: "Start a new request to save your selection",
    startRequestHint: (n: number) => `${n} ${n === 1 ? "clinic" : "clinics"} selected so far`,
  },

  dropzone: {
    uploadSuccess: (label: string) => `${label} uploaded`,
    uploadFailed: "Upload failed. Please try again.",
    networkError: "Network error during upload",
    dragHere: "Drag a file here, or",
    chooseFile: "choose one",
    fileHint: (mb: number) => `PDF, JPG, PNG ✦ up to ${mb}MB`,
    uploaded: (label: string) => `${label} uploaded`,
    replace: "Replace",
  },

  validation: {
    fileType: "Unsupported file type. Please upload a PDF, JPG or PNG.",
    fileSize: (mb: number) => `That file is too large. The limit is ${mb}MB.`,
    fileSignature:
      "The file's contents don't match its declared type. Please upload a valid PDF, JPG or PNG.",
    logoType: "Unsupported file type. Please upload a JPG, PNG or WEBP image.",
    noFile: "No file was sent",
    tooManyUploads: "Too many uploads for this request. Please try again later.",
    logoUnavailable: "Logo upload isn't available right now",
    logoSize: (mb: number) => `That image is too large. The limit is ${mb}MB.`,
  },

  legal: {
    updatedLabel: "Last updated:",
    lastUpdated: "July 2026",
  },

  footer: {
    tagline:
      "The transparent way to get several quotes for dental treatment. No phone calls, no pressure.",
    groupProduct: "Product",
    groupCompany: "Company",
    groupLegal: "Legal",
    howItWorks: "How it works",
    benefits: "Benefits",
    faq: "FAQ",
    about: "About",
    contact: "Contact",
    clinicsJoin: "For clinics",
    terms: "Terms of use",
    privacy: "Privacy policy",
    cookies: "Cookie policy",
    refunds: "Cancellations & refunds",
    accessibility: "Accessibility statement",
    rights: "All rights reserved.",
    builtWith: "Designed and built with care",
  },
};

export default en;
