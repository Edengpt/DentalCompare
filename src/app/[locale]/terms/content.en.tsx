import { formatMoney } from "@/lib/money";
import { SITE_CONFIG, REQUEST_LIMITS } from "@/lib/constants";
import { getSubscriptionPricing } from "@/lib/subscription-pricing";
import { Section, P, List, Ph } from "@/components/legal/legal-layout";

export const termsTitleEn = "Terms of Use";

export default async function TermsContentEn() {
  const pricing = await getSubscriptionPricing("PAYPLUS", "BASIC");
  return (
    <>
      <P>
        Welcome to {SITE_CONFIG.name}. The service is operated by <Ph>operator / company name</Ph>{" "}
        (company no. <Ph>number</Ph>) (the &ldquo;Operator&rdquo;). Use of the service is subject to
        these terms. If you do not agree to them, do not use the service.
      </P>

      <Section heading="1. What the service is">
        <P>
          {SITE_CONFIG.name} is a platform connecting patients seeking quotes for dental treatment
          with independent dental clinics. A patient uploads a treatment plan and an x-ray, selects
          up to {REQUEST_LIMITS.maxDentists} clinics, and those clinics submit quotes. The service
          is provided to patients free of charge.{" "}
          <strong>
            The Operator does not provide medical care, is not a party to the arrangement between
            patient and clinic, and is not responsible for the quality of treatment, for any
            diagnosis, or for pricing.
          </strong>
        </P>
      </Section>

      <Section heading="2. Not medical advice">
        <P>
          Information in the service, including any automated explanations, is general only. It does
          not constitute medical advice, diagnosis or recommendation, and is no substitute for
          consulting a qualified dentist.
        </P>
      </Section>

      <Section heading="3. Accounts and eligibility">
        <List
          items={[
            "Use of the service requires registration with accurate and complete details.",
            "You must keep your sign-in credentials confidential.",
            "The service is intended for adults (18+) legally able to enter into an agreement.",
          ]}
        />
      </Section>

      <Section heading="4. Patient obligations">
        <List
          items={[
            "Upload only documents that are yours and that you are entitled to share.",
            "Do not upload offensive or unlawful content, or content that infringes any rights.",
            "Use the service in good faith and do not abuse it.",
          ]}
        />
      </Section>

      <Section heading="5. Clinic obligations">
        <List
          items={[
            "The clinic declares that it holds the licensing required to practise dentistry in the country in which it operates.",
            "The clinic will use patient information solely for the purpose of providing a quote and delivering the service.",
            "The Operator may remove a clinic from the directory at any time, at its discretion.",
          ]}
        />
      </Section>

      <Section heading="6. Payments">
        <List
          items={[
            "Patients: the service is entirely free. No payment is taken and no payment details are requested at any stage — neither for sending a request nor for receiving quotes.",
            `Clinics: a monthly subscription (${formatMoney(pricing.monthlyPriceMinor, pricing.currency, "en")}) or an annual one (${formatMoney(pricing.yearlyPriceMinor, pricing.currency, "en")}) for appearing in the directory and receiving enquiries, following a free ${pricing.trialDays}-day trial.`,
            "The subscription pays for visibility and listing in the directory only. Nothing is charged based on the number of enquiries received, the identity of a patient, or whether any treatment actually takes place.",
            "The cancellation and refund policy is set out on its own page.",
          ]}
        />
      </Section>

      <Section heading="7. Intellectual property">
        <P>
          All rights in the service, its design, code and content (other than documents you upload)
          belong to the Operator. They may not be copied, reproduced or used commercially without
          written permission.
        </P>
      </Section>

      <Section heading="8. Limitation of liability">
        <P>
          The service is provided &ldquo;AS IS&rdquo;. To the fullest extent permitted by law, the
          Operator is not liable for any direct or indirect loss arising from use of the service,
          from dealings with a clinic, or from the availability or accuracy of quotes.
        </P>
      </Section>

      <Section heading="9. Governing law and jurisdiction">
        <P>
          These terms are governed by the laws of the State of Israel, and the competent courts of{" "}
          <Ph>city — for example Tel Aviv</Ph> shall have exclusive jurisdiction.
        </P>
      </Section>

      <Section heading="10. Changes and contact">
        <P>
          The Operator may update these terms from time to time. For enquiries:{" "}
          {SITE_CONFIG.supportEmail}.
        </P>
      </Section>

      <P>
        This document is a general draft and does not constitute legal advice. It should be reviewed
        by a lawyer before publication.
      </P>
    </>
  );
}
