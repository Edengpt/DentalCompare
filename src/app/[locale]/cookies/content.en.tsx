import { SITE_CONFIG } from "@/lib/constants";
import { Section, P, List } from "@/components/legal/legal-layout";

export const cookiesTitleEn = "Cookie Policy";

export default function CookiesContentEn() {
  return (
    <>
      <P>
        Cookies are small text files stored in your browser. This policy explains how{" "}
        {SITE_CONFIG.name} uses cookies and similar technologies.
      </P>

      <Section heading="1. Which cookies we use">
        <P>
          The service currently uses <strong>essential cookies only</strong>, needed for it to
          function:
        </P>
        <List
          items={[
            "Authentication and sign-in cookies (managed through Clerk) — these keep you signed in and secure your session.",
            "Basic security and operational cookies — to prevent abuse and hold essential preferences.",
          ]}
        />
        <P>
          We do not currently use third-party advertising or marketing tracking cookies. If any are
          added in future (analytics or advertising, for example), we will update this policy and
          ask for consent where required.
        </P>
      </Section>

      <Section heading="2. Essential cookies need no consent">
        <P>
          Essential cookies are necessary to provide the service and therefore do not require prior
          consent. Non-essential cookies, if and when they are introduced, will be set only with
          your agreement.
        </P>
      </Section>

      <Section heading="3. Managing cookies">
        <P>
          You can delete or block cookies through your browser settings. Blocking essential cookies
          may prevent you from signing in and using the service properly.
        </P>
      </Section>

      <Section heading="4. Contact">
        <P>For questions about cookies: {SITE_CONFIG.supportEmail}.</P>
      </Section>
    </>
  );
}
