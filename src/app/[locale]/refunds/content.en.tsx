import { formatMoney } from "@/lib/money";
import { SITE_CONFIG } from "@/lib/constants";
import { getSubscriptionPricing } from "@/lib/subscription-pricing";
import { Section, P, List } from "@/components/legal/legal-layout";

export const refundsTitleEn = "Cancellations & Refunds";

export default async function RefundsContentEn() {
  const pricing = await getSubscriptionPricing("PAYPLUS");
  return (
    <>
      <P>
        This policy sets out the cancellation and refund terms for {SITE_CONFIG.name}, in line with
        Israel&rsquo;s Consumer Protection Law, 5741-1981.
      </P>

      <Section heading="1. Patients — the service is free">
        <P>
          The service is provided to patients at no charge whatsoever. {SITE_CONFIG.name} does not
          charge patients anything, does not ask for payment details at any stage, and places no
          obligation on the patient.
        </P>
        <List
          items={[
            "Since no charge is made, there is no basis for a refund on the patient side.",
            "You may stop using the service at any time, and request deletion of your documents and account by contacting support.",
          ]}
        />
      </Section>

      <Section heading="2. Clinic subscriptions">
        <List
          items={[
            `Every new clinic receives a free ${pricing.trialDays}-day trial. Cancelling during that period incurs no charge at all.`,
            `Billing begins when the trial ends: a monthly plan (${formatMoney(pricing.monthlyPriceMinor, pricing.currency, "en")}) or an annual plan (${formatMoney(pricing.yearlyPriceMinor, pricing.currency, "en")}), renewing automatically at the end of each period.`,
            "A subscription can be cancelled at any time. Cancellation takes effect at the end of the period already paid for, and the clinic is not charged for the following one.",
            "No pro-rata refund is given for a paid period that was not used in full.",
          ]}
        />
      </Section>

      <Section heading="3. How to cancel">
        <P>
          Clinics: contact support to cancel the subscription. Patients: there is nothing to cancel,
          as no charge was made, and you can request deletion of your account and documents at any
          time. For any request, write to {SITE_CONFIG.supportEmail} and we will handle it in
          accordance with this policy and applicable law.
        </P>
      </Section>

      <Section heading="4. How refunds are paid">
        <P>
          Any refund given is issued to the payment method used for the original transaction, within
          a reasonable time and subject to the payment provider&rsquo;s processing times. This
          section applies to clinic subscriptions only.
        </P>
      </Section>

      <P>
        This document is a general draft and does not constitute legal advice. It should be reviewed
        by a lawyer before publication.
      </P>
    </>
  );
}
