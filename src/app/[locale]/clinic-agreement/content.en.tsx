import { SITE_CONFIG } from "@/lib/constants";
import { LEGAL_ENTITY } from "@/lib/legal-entity";
import { Section, P, List, Fill, DocLink } from "@/components/legal/legal-layout";

export const clinicAgreementTitleEn = "Clinic Agreement";

export default function ClinicAgreementContentEn() {
  return (
    <>
      <P>
        This agreement is made between{" "}
        <Fill value={LEGAL_ENTITY.name} label="Operator / company name" /> (company/dealer no.{" "}
        <Fill value={LEGAL_ENTITY.idNumber} label="number" />, of{" "}
        <Fill value={LEGAL_ENTITY.address} label="registered address" />) (the
        &ldquo;Operator&rdquo;), which operates the {SITE_CONFIG.name} platform (the
        &ldquo;Service&rdquo;), and the clinic or dentist registering with the Service (the
        &ldquo;Clinic&rdquo;). It applies to clinics in Israel and elsewhere.
      </P>
      <P>
        The agreement takes effect when a person authorised to act for the Clinic ticks the consent
        box on the registration form. Ticking it is an electronic signature that binds the Clinic.
        The Operator records the time of consent and the version accepted. The person ticking the
        box confirms they are authorised to bind the Clinic.
      </P>

      <Section heading="1. Agreement documents and order of precedence">
        <P>
          The agreement consists of: (a) this agreement; (b) the plan terms and prices shown to the
          Clinic on the registration form or the clinic sign-up page; (c) the{" "}
          <DocLink href="/terms">Terms of Use</DocLink>; (d) the{" "}
          <DocLink href="/privacy">Privacy Policy</DocLink>; and (e) the{" "}
          <DocLink href="/refunds">Cancellation &amp; Refund Policy</DocLink>. If they conflict: on
          price and plan, the registration-form terms prevail; on everything else, this agreement
          prevails over the Terms of Use.
        </P>
      </Section>

      <Section heading="2. The service to the Clinic">
        <List
          items={[
            "Listing the Clinic’s profile in the Service’s directory, receiving quote requests from patients who chose the Clinic, and submitting quotes through the Service.",
            "The Operator does not guarantee any number of requests, enquiries or patients, or that a patient will accept the Clinic’s quote.",
            "Payment is only for being listed and using the Service. The Operator charges no commission, referral fee or percentage of treatment, and payment never depends on the number of patients, who they are, or whether treatment takes place.",
            "The subscription plan does not affect the Clinic’s position in results.",
          ]}
        />
      </Section>

      <Section heading="3. Licensing, verification and the Clinic’s representations">
        <P>
          The Clinic represents and undertakes, at registration and throughout the agreement, that:
        </P>
        <List
          items={[
            "It and every dentist shown in its profile hold a valid licence to practise dentistry in the country where treatment is given, and any further permit required there, and that no such licence is suspended or restricted.",
            "All documents and details it provided — including licence documents, dentists’ names, specialties, languages, address and photos — are true, complete and its own.",
            "It holds valid professional liability insurance as required by the law that applies to it and to a reasonable extent, and will provide proof on the Operator’s request.",
            "It will notify the Operator within 7 days of any suspension, revocation or restriction of a licence, any disciplinary or criminal proceeding relating to its practice, or any change in material details.",
          ]}
        />
        <P>
          The Operator reviews licence documents before listing the Clinic and may ask for further
          documents at any time. The review is for the Operator&rsquo;s own purposes: it transfers
          no responsibility to the Operator and does not relieve the Clinic of responsibility for
          the accuracy of its representations.
        </P>
      </Section>

      <Section heading="4. Professional responsibility">
        <List
          items={[
            "The Clinic is independent and is solely responsible for diagnosis, the treatment plan, treatment, obtaining informed consent, medical records and their retention, warranty on the work and handling complications.",
            "The Clinic will act in line with professional standards and the law that applies to it, including advertising, consumer-protection and patients’-rights law.",
            "The Operator provides no medical service, does not supervise the Clinic and is not a party to any arrangement between the Clinic and a patient.",
            "The Clinic will not present the Operator as recommending it, guaranteeing its quality or being responsible for treatment.",
          ]}
        />
      </Section>

      <Section heading="5. Quotes">
        <List
          items={[
            "Quotes must be given in good faith, based on the documents the patient uploaded, and must clearly state the currency, what is and is not included, the number of visits or trips required, and the warranty terms.",
            "A quote must make clear that the final price is set after examination. The Clinic must not quote an artificially low price to attract a patient while intending to change it materially without medical justification.",
            "If the treatment or price changes after examination, the Clinic will explain this to the patient in writing, in a language the patient understands, before treatment starts and before any extra payment is taken.",
            "Travel and accommodation estimates in a quote are the Clinic’s responsibility and must be presented as estimates only.",
          ]}
        />
      </Section>

      <Section heading="6. Patient data and privacy">
        <P>
          The Clinic receives sensitive medical information. For the information it receives, the
          Clinic is an independent controller, and it undertakes:
        </P>
        <List
          items={[
            "To use the information only to prepare a quote and, if the patient chooses the Clinic, to treat that patient.",
            "To keep it confidential, give access only to authorised staff who need it, and apply reasonable security measures appropriate to its sensitivity.",
            "Not to pass it to any third party, use it for marketing, or contact the patient for any other purpose without the patient’s consent.",
            "Not to download, copy or keep patient documents beyond what is needed. If a patient does not choose the Clinic, the Clinic will delete any copy it made of their documents.",
            "To comply with the data-protection law that applies to it, including the GDPR if it operates in the European Union or treats EU residents.",
            "To notify the Operator within 72 hours of any security incident or unauthorised access that may affect information received through the Service, and to cooperate in handling it.",
          ]}
        />
        <P>
          The Operator processes the Clinic&rsquo;s and its contacts&rsquo; details under the{" "}
          <DocLink href="/privacy">Privacy Policy</DocLink>.
        </P>
      </Section>

      <Section heading="7. Subscription, payment and invoices">
        <List
          items={[
            "Plans, prices, the trial period and any promotion are as shown on the registration form. A free plan involves no payment.",
            "On a paid plan, the Clinic authorises recurring charges — monthly or yearly, according to the plan it chose — to the payment method it provided, until cancelled. The payment method is stored as a token with the payment processor Tranzila, not on the Operator’s servers.",
            "Prices exclude VAT unless stated otherwise; VAT is added where it applies. Invoices are issued by the Operator through the payment processor.",
            "Bank fees, currency-conversion fees and the Clinic’s card-issuer fees are borne by the Clinic.",
            "If a charge fails and is not settled within a short grace period, the Operator may pause the Clinic’s listing until payment is made.",
            "The Operator may change prices with at least 30 days’ notice by email. The change applies from the next billing period, and the Clinic may cancel before it takes effect.",
            "Cancellations and refunds follow the Cancellation & Refund Policy: the Clinic may cancel at any time, cancellation takes effect at the end of the paid period, and there is no pro-rata refund unless the law requires otherwise.",
          ]}
        />
      </Section>

      <Section heading="8. Clinic conduct">
        <List
          items={[
            "The Clinic will not submit false or misleading quotes, post fake reviews, or impersonate a patient or another clinic.",
            "It will contact patients on the Service only about a request it received, and will not send them spam.",
            "It will not discriminate against patients on grounds of religion, nationality, origin, sex, sexual orientation, disability or any other improper ground.",
            "It will comply with the prohibited-use section of the Terms of Use and, in particular, will not attempt to access other clinics’ or patients’ information.",
          ]}
        />
      </Section>

      <Section heading="9. Content and intellectual property">
        <P>
          The Clinic grants the Operator a non-exclusive, royalty-free licence, for the term of the
          agreement, to display its name, logo, photos and descriptions it provided on the Service
          and in the Service&rsquo;s marketing. The Clinic confirms it owns the rights in that
          content. The Operator may edit it for display and remove unsuitable content.
        </P>
      </Section>

      <Section heading="10. Disputes with patients">
        <P>
          Any dispute about treatment, price, payment or warranty is between the Clinic and the
          patient. The Operator is not obliged to mediate, but may forward patient complaints to the
          Clinic, ask it for an explanation, and suspend it after repeated or serious complaints.
        </P>
      </Section>

      <Section heading="11. Limitation of the Operator’s liability">
        <P>
          The Service is provided to the Clinic &ldquo;as is&rdquo;. The Operator is not liable for
          loss of income, profit, customers or goodwill, or for any indirect damage. The
          Operator&rsquo;s total liability to the Clinic, on any ground, will not exceed the total
          the Clinic paid the Operator in the 12 months before the event. Nothing here limits
          liability for wilful misconduct.
        </P>
      </Section>

      <Section heading="12. Indemnity">
        <P>
          The Clinic will indemnify the Operator, its staff and anyone acting for it against any
          loss, fine, claim and expense (including reasonable legal fees) arising from: treatment or
          services the Clinic provided; a quote it submitted; a breach of its licensing or insurance
          representations; use of patient information contrary to this agreement or the law; or any
          other breach of this agreement. The Operator will notify the Clinic of any such claim and
          allow it to defend it.
        </P>
      </Section>

      <Section heading="13. Term, suspension and termination">
        <List
          items={[
            "The agreement runs from registration until ended by either party.",
            "The Clinic may cancel at any time, as set out in section 7.",
            "The Operator may end the agreement on 30 days’ notice for any reason, in which case it refunds the pro-rata part of any prepaid fee for the period after termination.",
            "The Operator may suspend the Clinic or end the agreement immediately, without refund, if: a licence is not valid or documents prove false; serious or repeated complaints are received; the Clinic breaches sections 5, 6 or 8; or payment is not settled.",
            "On termination the Clinic is removed from the directory. The Clinic’s obligations on patient data, its indemnity, and any section that by its nature should survive, continue to apply.",
          ]}
        />
      </Section>

      <Section heading="14. Special terms for clinics in Israel">
        <List
          items={[
            "The Clinic and its dentists hold a Ministry of Health licence to practise dentistry under the Dentists Ordinance [New Version], 5739-1979, and a specialist licence for every specialty shown in the profile.",
            "The Clinic will comply with the Patient’s Rights Law, 5756-1996 — including on informed consent and medical records — and with the advertising rules that apply to dentists.",
            "The Clinic will comply with the Protection of Privacy Law, 5741-1981 and the Protection of Privacy (Data Security) Regulations, 5777-2017.",
            "Payment to the Operator is made in shekels or in the currency shown at registration, plus VAT as required by law.",
          ]}
        />
      </Section>

      <Section heading="15. Special terms for clinics outside Israel">
        <List
          items={[
            "The Clinic is responsible for complying with all law in its country, including licensing, advertising, consumer protection, medical tourism, tax and data protection. The Operator does not review local law and is not responsible for the Clinic’s compliance with it.",
            "Before treatment starts, and in a language the patient understands, the Clinic will give the patient: a written treatment plan, the final price, the warranty terms, aftercare instructions for after they return home, and contact details for questions after treatment.",
            "The Clinic will be reasonably available for questions and for handling complications after the patient returns home, in line with the warranty it offered.",
            "Payment to the Operator is made through an Israeli payment processor in the currency shown at registration. Foreign-card fees, currency conversion, and any tax or withholding in the Clinic’s country are borne by the Clinic and will not reduce the amount due to the Operator.",
            "A Clinic operating in the European Union or the United Kingdom acknowledges that it is an independent controller of the information it receives, and that the information is transferred to it at the patient’s request and with the patient’s consent.",
            "This is a business-to-business agreement, and the Clinic is not a consumer for its purposes.",
          ]}
        />
      </Section>

      <Section heading="16. Changes to this agreement">
        <P>
          The Operator may update this agreement by email notice at least 30 days before the update
          takes effect. If an update is material and adverse to the Clinic, the Clinic may cancel
          before it takes effect and receive a pro-rata refund of any prepaid fee. Continuing to use
          the Service after the update takes effect means the Clinic accepts it. Changes required by
          law may take effect sooner.
        </P>
      </Section>

      <Section heading="17. Governing law and jurisdiction">
        <P>
          This agreement is governed by the laws of the State of Israel, without regard to
          conflict-of-laws rules. The competent courts in{" "}
          <Fill value={LEGAL_ENTITY.jurisdictionCityEn} label="city — e.g. Tel Aviv-Jaffa" /> have
          exclusive jurisdiction over any matter relating to it, including where the Clinic is
          outside Israel. The Operator may nevertheless apply to a competent court in the
          Clinic&rsquo;s country for enforcement or urgent relief.
        </P>
      </Section>

      <Section heading="18. General">
        <List
          items={[
            "The parties are independent contractors. Nothing in this agreement creates a partnership, employment, agency or joint venture.",
            "The Clinic may not assign its rights under this agreement without the Operator’s written consent. The Operator may assign its rights, including as part of a merger or sale of the Service.",
            "Notices will be sent to the email address the Clinic provided and are treated as received on the next business day.",
            "If any provision is held invalid, the rest remain in force. A delay or failure to exercise a right is not a waiver of it.",
            "This agreement is written in Hebrew and English. The Clinic may choose the version in which it contracts.",
          ]}
        />
      </Section>

      <Section heading="19. Contact">
        <P>Questions about this agreement: {SITE_CONFIG.supportEmail}.</P>
      </Section>

      <P>
        This document is a general draft and is not legal advice. It should be reviewed by a lawyer
        before publication.
      </P>
    </>
  );
}
