import { SITE_CONFIG } from "@/lib/constants";
import { LEGAL_ENTITY } from "@/lib/legal-entity";
import { Section, P, List, Fill, DocLink } from "@/components/legal/legal-layout";

export const privacyTitleEn = "Privacy Policy";

export default function PrivacyContentEn() {
  return (
    <>
      <P>
        Your privacy matters to us. This policy explains what information is collected on{" "}
        {SITE_CONFIG.name} (the &ldquo;Service&rdquo;), operated by{" "}
        <Fill value={LEGAL_ENTITY.name} label="operator / company name" /> (company no.{" "}
        <Fill value={LEGAL_ENTITY.idNumber} label="number" />, registered address{" "}
        <Fill value={LEGAL_ENTITY.address} label="registered address" />) (the
        &ldquo;Operator&rdquo;, &ldquo;we&rdquo;), how it is used, and your rights under
        Israel&rsquo;s Protection of Privacy Law, 5741-1981 and its regulations, and under the EU
        General Data Protection Regulation (GDPR) where it applies to you.
      </P>
      <P>
        For information collected on the Service, the Operator is the controller. A clinic that
        receives your request becomes an independent controller of the information it received, and
        its use of it is subject to the law that applies to it and to its own privacy policy.
      </P>

      <Section heading="1. What we collect">
        <List
          items={[
            "Account details: full name, email address and phone number (managed through the Clerk identity service).",
            "Medical information: the treatment plan and dental x-ray you upload — this is “sensitive information” under the Protection of Privacy Law.",
            "Payment information: applies to clinics only. Clinic subscriptions are processed through the Tranzila payment provider. Card details are held by Tranzila as an encrypted token, and we do not store card details on our servers. Patients are never charged and are never asked for payment details at any stage.",
            "Technical information: IP address, browser type and operational logs (timings, errors) for maintenance, security and abuse prevention.",
            "Clinics: clinic and dentist details, licence documents, and the quotes the clinic submitted.",
          ]}
        />
      </Section>

      <Section heading="2. How we use it">
        <List
          items={[
            "To provide the service — sending your request and medical documents to the clinics you chose, and receiving their quotes.",
            "To manage clinic subscriptions and process their billing.",
            "To contact you about your request and to provide support.",
            "To secure the service, prevent fraud, and comply with legal requirements.",
          ]}
        />
        <P>
          Legal bases: performance of our agreement with you (providing the Service); your explicit
          consent for medical information (GDPR Article 9(2)(a)); compliance with legal obligations
          (tax, for example); and the Operator&rsquo;s legitimate interest in securing the Service
          and preventing fraud.
        </P>
        <P>
          We do not send marketing email without your consent, we do not sell information, and we do
          not make decisions with legal effect on you based solely on automated processing.
        </P>
        <P>
          You are under no legal obligation to give us information, but without your account details
          and medical documents we cannot send your request to clinics.
        </P>
      </Section>

      <Section heading="3. Sharing your medical information">
        <P>
          The medical documents you upload are sent{" "}
          <strong>only to the clinics you explicitly selected</strong> when creating your request,
          for the purpose of obtaining a quote. They are sent only after your explicit confirmation.
          We do not publish this information, we do not use it for advertising, and we do not sell
          information to third parties.
        </P>
        <P>
          The documents are <strong>never attached to emails</strong>. A clinic receives a link and
          views them only in the clinic area of the site, after signing in with the email address
          the request was sent to. That way no copies are left in mailboxes beyond our control.
        </P>
      </Section>

      <Section heading="4. Service providers (data processors)">
        <P>
          We rely on providers who process information on our behalf under appropriate agreements:
        </P>
        <List
          items={[
            "Clerk — identity and account management.",
            "Vercel — site hosting and file storage (Vercel Blob), with private, secured access.",
            "Neon — the database.",
            "Tranzila (Israel) — clinic payment processing, recurring billing and invoicing, and PayPal if the clinic chooses it. Clinics only.",
            "Sentry — technical error monitoring. It is configured not to receive medical documents.",
            "Resend — sending email (never with medical documents).",
            "Anthropic — a plain-language explanation of your treatment plan, only when you press the button for it. In that case the treatment plan (not the x-ray) is sent to Anthropic for processing.",
          ]}
        />
      </Section>

      <Section heading="4a. Where your information is stored">
        <P>
          <strong>
            Your information — including your treatment plan and your dental x-ray — is processed
            and stored on servers in the United States.
          </strong>{" "}
          This is not a footnote: it is the central fact a patient should know before uploading a
          medical document, which is why it also appears on the consent checkbox itself rather than
          only here.
        </P>
        <P>
          Concretely: server functions and file storage run in Vercel&rsquo;s <code>iad1</code>{" "}
          region (Virginia, USA), and the database is hosted with Neon. Clerk handles identity,
          Resend sends email, and Anthropic (USA) processes the treatment plan when you ask for an
          explanation.
        </P>
        <P>
          For patients in the European Union, the EEA and the United Kingdom, the transfer relies on{" "}
          the European Commission&rsquo;s standard contractual clauses (SCCs) included in our data
          processing agreements with the providers, and the EU-US Data Privacy Framework for
          providers certified under it — together with your explicit consent, which is recorded
          alongside the wording it was given to and the moment it was given.
        </P>
      </Section>

      <Section heading="5. Retention">
        <P>
          <strong>Medical documents are kept only briefly.</strong> The treatment plan, the x-ray
          and any documents clinics attached to their quotes are deleted automatically 30 days after
          the request was sent to clinics. For a request that was never sent, they are deleted after
          7 days without changes. The quotes themselves are kept, so you can go on comparing them.
        </P>
        <P>
          Other information (account details and quotes) is kept for as long as your account is
          active and as needed to provide the service and meet legal obligations (tax requirements,
          for example). Deleting your account immediately deletes all medical documents and the
          notes you wrote. You may request further deletion, subject to section 7.
        </P>
      </Section>

      <Section heading="6. Information security">
        <P>
          We apply accepted security measures: encryption in transit (HTTPS); encryption of medical
          documents at rest (AES-256) with a key kept separately from the files; permission-based
          access controls (the files can be reached only by the request&rsquo;s owner, by the
          clinics the request was sent to after they sign in, and by an authorised administrator);
          rate limiting; and signature verification on payment interfaces. No security is perfect,
          however, and we cannot guarantee absolute immunity.
        </P>
        <P>
          If a serious security incident affects your information, we will report it to the Privacy
          Protection Authority and to the relevant supervisory authorities as the law requires, and
          notify you without undue delay where the law requires it or where the incident is likely
          to harm you.
        </P>
      </Section>

      <Section heading="7. Your rights">
        <P>
          <strong>Deleting it yourself:</strong> every request in your account has a &ldquo;Delete
          request&rdquo; button, which removes the request together with the treatment plan and
          x-ray from storage. You do not need to contact us.
        </P>
        <List
          items={[
            "To review the information collected about you.",
            "To request correction of inaccurate information.",
            "To request deletion of your account and the information relating to it, subject to legal retention obligations.",
            "To withdraw your consent to future uses, without affecting the lawfulness of processing before the withdrawal.",
          ]}
        />
        <P>
          If you are in the European Union, the EEA or the United Kingdom, you also have your rights
          under the GDPR: to receive a copy of your data in a portable format, to restrict
          processing, to object to processing based on legitimate interest, and to complain to the
          data protection authority in your country. In Israel you may contact the Privacy
          Protection Authority.
        </P>
        <P>We answer requests within 30 days, and may ask you to verify your identity first.</P>
        <P>
          For privacy enquiries and to exercise these rights: {SITE_CONFIG.supportEmail}. Data
          protection officer:{" "}
          <Fill
            value={LEGAL_ENTITY.privacyOfficer}
            label="name and contact details — if applicable"
          />
          .
        </P>
      </Section>

      <Section heading="8. Cookies">
        <P>
          The service uses essential cookies only (mainly for authentication). For details see the{" "}
          <DocLink href="/cookies">cookie policy</DocLink>.
        </P>
      </Section>

      <Section heading="9. Minors">
        <P>
          The Service is not intended for anyone under 18. Information about a minor may be provided
          only by a parent or guardian who confirms they are authorised to do so.
        </P>
      </Section>

      <Section heading="10. Changes to this policy">
        <P>
          We will update this policy from time to time; the date of the update appears at the top of
          the page. We will give advance notice of any material change — in particular any change in
          how medical information is used — and ask for your consent again where the law requires
          it.
        </P>
      </Section>

      <P>
        This document is a general draft prepared for the service operator and does not constitute
        legal advice. It should be reviewed by a lawyer before publication.
      </P>
    </>
  );
}
