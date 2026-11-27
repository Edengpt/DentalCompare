import { SITE_CONFIG } from "@/lib/constants";
import { Section, P, List, DocLink } from "@/components/legal/legal-layout";

export const disclaimerTitleEn = "Medical Disclaimer";

export default function DisclaimerContentEn() {
  return (
    <>
      <P>
        <strong>
          {SITE_CONFIG.name} is not a clinic and does not provide medical advice, diagnosis or
          treatment. Nothing on the Service replaces an examination by a licensed dentist.
        </strong>{" "}
        This disclaimer is part of the <DocLink href="/terms">Terms of Use</DocLink>. Please read it
        before relying on any information on the Service.
      </P>

      <Section heading="1. Information on the site is general only">
        <P>
          Content on the site — treatment explanations, FAQs, price ranges and destination
          descriptions — is general information only. It is not tailored to your medical condition
          and must not be relied on to make a medical decision.
        </P>
      </Section>

      <Section heading="2. Automatic (AI) explanation">
        <P>
          The Service can give you a plain-language explanation of your treatment plan, generated
          automatically by artificial intelligence. The explanation may be incomplete, inaccurate or
          wrong, and it is not based on an examination of you. It is not a diagnosis or a medical
          opinion. Take any question about your treatment plan to your dentist.
        </P>
      </Section>

      <Section heading="3. Quotes are not a diagnosis or a commitment">
        <List
          items={[
            "Quotes are set by clinics alone, from the documents you uploaded and without a physical examination.",
            "A clinic may change the treatment plan or the price after examining you. A quote that differs from your original treatment plan is not necessarily better or worse than it.",
            "The Operator does not check quotes for accuracy, suitability to your condition or reasonableness of price.",
          ]}
        />
      </Section>

      <Section heading="4. The comparison is not a recommendation">
        <P>
          The quote comparison, the order in which clinics appear and the &ldquo;verified&rdquo;
          badge exist only to help you compare. The badge means only that our team reviewed the
          licence documents the clinic uploaded, as of the review date. It says nothing about the
          quality of treatment, the dentist&rsquo;s experience or the clinic&rsquo;s compliance with
          the law. Which clinic and which treatment to choose is your decision alone.
        </P>
      </Section>

      <Section heading="5. The clinic is responsible for treatment">
        <P>
          Every clinic is independent. Diagnosis, treatment, informed consent, medical records,
          warranty on the work and handling complications are the sole responsibility of the clinic
          and the treating dentist. The Operator does not supervise clinics and is not responsible
          for their acts or omissions.
        </P>
      </Section>

      <Section heading="6. Treatment abroad">
        <P>
          Treatment in another country carries extra risks: different regulation, difficulty getting
          follow-up care and treatment of complications after you return, and the risk of flying
          shortly after treatment. Before deciding, consult a dentist in your country and check that
          you have suitable insurance.
        </P>
      </Section>

      <Section heading="7. Emergencies">
        <P>
          <strong>The Service is not for emergencies.</strong> For severe pain, swelling, bleeding
          that will not stop, fever, or difficulty breathing or swallowing, contact a dentist, an
          emergency department or your local emergency services immediately.
        </P>
      </Section>

      <Section heading="8. Limitation of liability">
        <P>
          To the fullest extent permitted by law, the Operator is not liable for any harm arising
          from reliance on information on the Service, an automatic explanation or a quote, or from
          treatment given by a clinic. See also the limitation of liability in the{" "}
          <DocLink href="/terms">Terms of Use</DocLink>.
        </P>
      </Section>

      <P>
        This document is a general draft and is not legal advice. It should be reviewed by a lawyer
        before publication.
      </P>
    </>
  );
}
