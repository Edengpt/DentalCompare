import { SITE_CONFIG } from "@/lib/constants";
import { Section, P, List, Ph } from "@/components/legal/legal-layout";
import { LocaleLink } from "@/i18n/locale-link";

export const privacyTitleEn = "Privacy Policy";

export default function PrivacyContentEn() {
  return (
    <>
      <P>
        Your privacy matters to us. This policy explains what information is collected on{" "}
        {SITE_CONFIG.name} (the &ldquo;Service&rdquo;), operated by <Ph>operator / company name</Ph>{" "}
        (company no. <Ph>number</Ph>, registered address <Ph>registered address</Ph>), how it is
        used, and your rights under Israel&rsquo;s Protection of Privacy Law, 5741-1981 and its
        regulations.
      </P>

      <Section heading="1. What we collect">
        <List
          items={[
            "Account details: full name, email address and phone number (managed through the Clerk identity service).",
            "Medical information: the treatment plan and dental x-ray you upload — this is “sensitive information” under the Protection of Privacy Law.",
            "Payment information: applies to clinics only. Clinic subscriptions are processed through the PayPlus payment provider, and we do not store card details on our servers. Patients are never charged and are never asked for payment details at any stage.",
            "Technical information: basic operational logs (timings, errors) for maintenance and security.",
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
          The legal basis for processing is your consent and the performance of our agreement with
          you.
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
            "PayPlus — payment processing.",
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
          <Ph>transfer mechanism — SCCs / Data Privacy Framework, for legal review</Ph> together
          with your explicit consent, which is recorded alongside the wording it was given to and
          the moment it was given.
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
            "To withdraw your consent to future uses.",
          ]}
        />
        <P>
          For privacy enquiries and to exercise these rights: {SITE_CONFIG.supportEmail}. Data
          protection officer: <Ph>name and contact details — if applicable</Ph>.
        </P>
      </Section>

      <Section heading="8. Cookies">
        <P>
          The service uses essential cookies only (mainly for authentication). For details see the{" "}
          <LocaleLink
            className="text-teal-deep font-semibold underline underline-offset-4"
            href="/cookies"
          >
            cookie policy
          </LocaleLink>
          .
        </P>
      </Section>

      <Section heading="9. Changes to this policy">
        <P>
          We will update this policy from time to time. Continued use of the service after an update
          constitutes acceptance of the updated policy.
        </P>
      </Section>

      <P>
        This document is a general draft prepared for the service operator and does not constitute
        legal advice. It should be reviewed by a lawyer before publication.
      </P>
    </>
  );
}
