import { SITE_CONFIG, REQUEST_LIMITS } from "@/lib/constants";
import { LEGAL_ENTITY } from "@/lib/legal-entity";
import { Section, P, List, Fill, DocLink } from "@/components/legal/legal-layout";

export const termsTitleEn = "Terms of Use";

export default function TermsContentEn() {
  return (
    <>
      <P>
        Welcome to {SITE_CONFIG.name} (the &ldquo;Service&rdquo;). The Service is operated by{" "}
        <Fill value={LEGAL_ENTITY.name} label="Operator / company name" /> (company/dealer no.{" "}
        <Fill value={LEGAL_ENTITY.idNumber} label="number" />) (the &ldquo;Operator&rdquo;,
        &ldquo;we&rdquo;). These terms govern every use of the Service by any user, patient or
        clinic. By using the Service, or by ticking the consent box when you register, you confirm
        that you have read and agree to these terms. If you do not agree, do not use the Service.
      </P>
      <P>
        Clinics are also bound by the <DocLink href="/clinic-agreement">Clinic Agreement</DocLink>,
        which prevails over these terms where clinics are concerned. The{" "}
        <DocLink href="/privacy">Privacy Policy</DocLink>, the{" "}
        <DocLink href="/medical-disclaimer">Medical Disclaimer</DocLink>, the{" "}
        <DocLink href="/cookies">Cookie Policy</DocLink> and the{" "}
        <DocLink href="/refunds">Cancellation &amp; Refund Policy</DocLink> form part of these
        terms.
      </P>

      <Section heading="1. Definitions">
        <List
          items={[
            "“Patient” — a person who registers to request and receive quotes for dental treatment.",
            "“Clinic” — a dental clinic or dentist, in Israel or elsewhere, registered to receive requests and submit quotes.",
            "“Quote” — an estimate a clinic submits to a patient through the Service, based on the documents the patient uploaded.",
            "“User Content” — any information, document, file, image or text a user uploads or provides to the Service.",
          ]}
        />
      </Section>

      <Section heading="2. What the Service is — a connecting platform only">
        <P>
          {SITE_CONFIG.name} is a technology platform that connects patients with independent dental
          clinics. A patient uploads a treatment plan and an X-ray, chooses up to{" "}
          {REQUEST_LIMITS.maxDentists} clinics, and the clinics submit quotes. The Service is free
          for patients.
        </P>
        <P>
          <strong>
            The Operator is not a clinic, does not provide treatment or any medical service, does
            not employ the clinics or dentists, and is not a party to any arrangement between a
            patient and a clinic.
          </strong>{" "}
          Treatment, diagnosis, final price, payment, warranty, refunds and the handling of
          complications are matters solely between the patient and the clinic.
        </P>
        <P>
          Before a clinic is listed, our team reviews the licence documents the clinic uploaded. The
          review relies on the documents provided to us and is correct only as of the date it was
          made. It does not assess the dentist&rsquo;s skills, the quality of treatment or the
          clinic&rsquo;s compliance with local law, and it is not a recommendation or guarantee of
          any kind about the clinic.
        </P>
        <P>
          The order in which clinics are shown and the quote comparison exist only to make comparing
          easier. They are not a recommendation to choose any clinic or quote. A clinic&rsquo;s
          subscription plan does not affect its position in results.
        </P>
      </Section>

      <Section heading="3. No medical advice">
        <P>
          Information on the Service, including automatically generated (AI) explanations, is
          general information only. It is not medical advice, diagnosis or recommendation, and it
          does not replace an examination by and consultation with a licensed dentist. See the full{" "}
          <DocLink href="/medical-disclaimer">Medical Disclaimer</DocLink>.
        </P>
      </Section>

      <Section heading="4. Registration, account and eligibility">
        <List
          items={[
            "The Service is for adults (18+) with legal capacity to enter a binding agreement. A minor patient may be represented only by a parent or guardian.",
            "You must provide accurate, complete and current details, and update them if they change.",
            "You are responsible for keeping your sign-in details confidential and for everything done in your account. Tell us immediately if you learn of unauthorised use.",
            "You may not register in another person’s name, impersonate anyone, or open an account for a clinic you are not authorised to act for.",
          ]}
        />
      </Section>

      <Section heading="5. User Content">
        <List
          items={[
            "You confirm that the User Content you upload is yours or that you are entitled to share it, and that it is accurate. A patient uploading another person’s documents confirms they have that person’s explicit consent.",
            "You allow the Operator to store, process and transmit User Content as needed to run the Service — for example, sending your documents to the clinics you chose — in line with the Privacy Policy.",
            "You are responsible for your User Content. The Operator does not verify medical documents or quotes, and may remove any content that breaches these terms or the law.",
          ]}
        />
      </Section>

      <Section heading="6. Prohibited use and security">
        <P>You must not do, attempt, or help anyone else do any of the following:</P>
        <List
          items={[
            "Access or attempt to access the Service, its servers, databases or other users’ accounts without authorisation; bypass or disable authentication, authorisation, rate-limiting or any security measure.",
            "Scan, probe or test the Service for vulnerabilities without the Operator’s prior written consent.",
            "Use robots, crawlers, scrapers or any automated means to collect data from the Service — including clinic lists, prices or contact details — or use such data to build a competing database.",
            "Upload malicious code, viruses or files designed to harm the Service or its users, or place an abnormal load on the Service.",
            "Reverse-engineer, copy or decompile the Service’s code, except to the extent the law expressly allows.",
            "Access another user’s information, and in particular medical documents, without authorisation.",
            "Send fictitious requests, false quotes, spam, or offensive, misleading, threatening or unlawful content.",
            "Use the Service in any way that breaks the law, infringes others’ rights or breaches these terms.",
          ]}
        />
        <P>
          Breaching this section may be a criminal offence under Israel&rsquo;s Computers Law,
          5755-1995 and equivalent laws elsewhere. The Operator may block any user or address,
          preserve and hand evidence to law-enforcement authorities, and take any legal action
          against the person responsible, including claiming its damages and the cost of handling
          the incident.
        </P>
        <P>
          <strong>Responsible disclosure:</strong> if you find a security vulnerability, report it
          to {SITE_CONFIG.supportEmail} and do not exploit it, access other people&rsquo;s data or
          publish it before it is fixed. We will not take action against anyone who acts in good
          faith and within these rules.
        </P>
      </Section>

      <Section heading="7. The relationship between patient and clinic">
        <List
          items={[
            "A quote is a preliminary estimate the clinic gives from the uploaded documents, without a physical examination. The final treatment and price are set by the clinic only after examination and may change.",
            "The Operator does not guarantee that you will receive quotes, how many, their accuracy, the clinic’s availability, or that a clinic will honour its quote.",
            "The Operator does not collect or transfer payment for treatment. Any payment for treatment is made directly to the clinic on the terms you agree with it.",
            "Before treatment starts, we recommend getting from the clinic, in a language you understand, a written treatment plan, a final price, and its warranty and cancellation terms.",
            "Any claim about treatment, diagnosis, price, warranty or harm must be directed to the clinic.",
          ]}
        />
      </Section>

      <Section heading="8. Treatment outside your country (dental travel)">
        <P>
          The Service lets you receive quotes from clinics in different countries. If you choose to
          be treated outside your country of residence, that decision and its risks are yours alone,
          including:
        </P>
        <List
          items={[
            "Professional standards, regulation and licensing that differ from your own country’s, and foreign law governing the treatment and any dispute with the clinic.",
            "Difficulty getting follow-up care, repairs or treatment of complications after you return home, and difficulty enforcing a warranty or bringing legal proceedings in another country.",
            "Medical risks of flying shortly after treatment.",
            "Costs of flights, accommodation, visas, insurance, transport and time off. Travel-cost estimates in a quote are the clinic’s estimates only.",
          ]}
        />
        <P>
          The Operator does not book, arrange or take responsibility for flights, accommodation,
          transfers or any travel service. We recommend consulting a dentist in your country before
          you travel, buying suitable travel and health insurance, and agreeing in advance with the
          clinic what its warranty covers and what happens if further treatment is needed.
        </P>
      </Section>

      <Section heading="9. Payments">
        <List
          items={[
            "Patients: the Service is completely free. No payment is taken and no payment details are requested at any stage.",
            "Clinics: a paid subscription or a free plan, under the Clinic Agreement and at the prices shown on the clinic sign-up page. Payment is for being listed and receiving requests only, and never depends on the number of patients, who they are, or whether any treatment takes place.",
            "Cancellations and refunds — under the Cancellation & Refund Policy.",
          ]}
        />
      </Section>

      <Section heading="10. Intellectual property">
        <P>
          All rights in the Service — including the {SITE_CONFIG.name} name, design, code, content,
          databases and trademarks — belong to the Operator or its licensors, except User Content.
          You may not copy, reproduce, distribute, publish or commercially use the Service or any
          part of it without prior written permission.
        </P>
      </Section>

      <Section heading="11. Availability and changes">
        <P>
          The Operator may change, suspend or discontinue the Service or any part of it at any time.
          The Service may be down for maintenance, and we do not promise it will run without
          interruption or error. Keep your own copy of any important document: medical documents are
          deleted from the Service as described in the Privacy Policy.
        </P>
      </Section>

      <Section heading="12. Third-party links and services">
        <P>
          The Service may link to clinic or third-party websites, or rely on third-party services
          (for example sign-in or payment processing). The Operator is not responsible for their
          content, availability or privacy practices.
        </P>
      </Section>

      <Section heading="13. Limitation of liability">
        <P>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the fullest
          extent permitted by law, the Operator, its staff and anyone acting for it are not liable
          for any loss or damage, direct or indirect, arising from:
        </P>
        <List
          items={[
            "Treatment, diagnosis, or any act or omission of a clinic or dentist, including negligence, complications and treatment outcomes.",
            "The content or accuracy of quotes, price changes, or a clinic not honouring a quote.",
            "Travelling abroad for treatment and everything it involves.",
            "Reliance on general information or an automatic explanation on the Service.",
            "Faults, outages, data loss or unauthorised access that occur despite the reasonable security measures the Operator takes, including cyber-attacks.",
            "Third-party services.",
          ]}
        />
        <P>
          In any event, the Operator&rsquo;s total liability to any user, on any ground, will not
          exceed the greater of the amount that user paid the Operator in the 12 months before the
          event, or USD 100. Nothing in these terms limits liability that cannot be limited by law,
          including liability for wilful misconduct or gross negligence, or mandatory consumer
          rights.
        </P>
      </Section>

      <Section heading="14. Indemnity">
        <P>
          You agree to indemnify the Operator, its staff and anyone acting for it against any loss,
          claim, demand and expense (including reasonable legal fees) arising from your breach of
          these terms or of the law, from User Content you uploaded, or — if you are a clinic — from
          any service or treatment you provided. The Operator will notify you of any such claim and
          allow you to defend it.
        </P>
      </Section>

      <Section heading="15. Suspension and termination">
        <P>
          The Operator may suspend or block a user, remove content or close an account, immediately
          and without notice, if the user breached these terms, gave false information, acted in a
          way that may harm other users, the Operator or the Service, or if the law requires it. You
          may stop using the Service and delete your account at any time. Sections that by their
          nature should survive — including sections 10, 13, 14 and 16 — continue to apply.
        </P>
      </Section>

      <Section heading="16. Governing law and jurisdiction">
        <P>
          These terms and your use of the Service are governed by the laws of the State of Israel,
          without regard to conflict-of-laws rules. The competent courts in{" "}
          <Fill value={LEGAL_ENTITY.jurisdictionCityEn} label="city — e.g. Tel Aviv-Jaffa" /> have
          exclusive jurisdiction over any matter relating to these terms.
        </P>
        <P>
          However, if you are a consumer living outside Israel — in particular in the European Union
          or the United Kingdom — nothing here removes consumer protections that the law of your
          country of residence gives you and that cannot be waived, including your right to bring
          proceedings in the courts of your country.
        </P>
      </Section>

      <Section heading="17. Changes to these terms">
        <P>
          The Operator may update these terms from time to time. The updated version will be
          published on this page with its date. We will give advance notice of any material change
          on the site or by email. Continuing to use the Service after an update takes effect means
          you accept it.
        </P>
      </Section>

      <Section heading="18. General">
        <List
          items={[
            "These terms, together with the documents listed at the top, are the entire agreement between you and the Operator about the Service.",
            "If any provision is held invalid or unenforceable, it will be applied to the greatest extent possible and the rest remain in force.",
            "A delay or failure by the Operator to exercise a right is not a waiver of it.",
            "The Operator may assign its rights and obligations under these terms, including as part of a merger or sale of the Service. A user may not assign theirs without the Operator’s consent.",
            "Notices will be sent to the email address registered in your account and are treated as received on the next business day.",
          ]}
        />
      </Section>

      <Section heading="19. Contact">
        <P>
          Questions and requests: {SITE_CONFIG.supportEmail}. Operator&rsquo;s address:{" "}
          <Fill value={LEGAL_ENTITY.address} label="registered address" />.
        </P>
      </Section>

      <P>
        This document is a general draft and is not legal advice. It should be reviewed by a lawyer
        before publication.
      </P>
    </>
  );
}
