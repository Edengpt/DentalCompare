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
