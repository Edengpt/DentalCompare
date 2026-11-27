import { SITE_CONFIG } from "@/lib/constants";
import { LEGAL_ENTITY } from "@/lib/legal-entity";
import { Section, P, List, Fill } from "@/components/legal/legal-layout";

export const accessibilityTitleEn = "Accessibility Statement";

export default function AccessibilityContentEn() {
  const c = LEGAL_ENTITY.accessibilityCoordinator;
  return (
    <>
      <P>
        {SITE_CONFIG.name}, operated by{" "}
        <Fill value={LEGAL_ENTITY.name} label="Operator / company name" />, is committed to making
        the Service accessible to everyone, including people with disabilities, out of a commitment
        to equal rights and human dignity. We work to bring the site in line with Israel&rsquo;s
        Equal Rights for Persons with Disabilities Law, 5758-1998, and the Equal Rights for Persons
        with Disabilities (Service Accessibility Adjustments) Regulations, 5773-2013.
      </P>

      <Section heading="Accessibility level">
        <P>
          The site aims to meet Israeli Standard SI 5568, based on the WCAG 2.0 guidelines at level
          AA. <strong>The site is partially accessible.</strong> It has not yet been audited by a
          certified accessibility auditor. Last audit:{" "}
          <Fill
            value={LEGAL_ENTITY.accessibilityAuditDateEn}
            label="to be updated after an accessibility audit"
          />
          .
        </P>
      </Section>

      <Section heading="Accessibility features in place">
        <List
          items={[
            "The site is available in 7 languages. Every page declares its language and text direction (right-to-left in Hebrew), so screen readers read it correctly.",
            "The site can be navigated and operated with a keyboard, and buttons show a clear focus outline.",
            "Required form fields are marked, and error messages are linked to the relevant field so screen readers announce them.",
            "A hierarchical heading structure and semantic HTML elements.",
            "Alternative text for meaningful images; decorative images are hidden from screen readers.",
            "Responsive layout for different screen sizes, and support for browser text zoom.",
            "The operating system’s “reduce motion” setting is respected: animations run only when it is off.",
          ]}
        />
      </Section>

      <Section heading="Known limitations">
        <List
          items={[
            "There is not yet a “skip to main content” link at the top of pages.",
            "Medical documents patients upload (images and PDFs), and documents clinics attach to quotes, are user content whose accessibility we do not control.",
            "Sign-up and sign-in forms are provided by a third-party service (Clerk), and their accessibility depends on it.",
            "Other parts of the site may not yet be fully accessible. We will update this list after an accessibility audit.",
          ]}
        />
        <P>
          The Service is provided online only. The Operator has no offices or premises open to the
          public, so this statement has no section on physical accessibility arrangements.
        </P>
      </Section>

      <Section heading="Contacting the accessibility coordinator">
        <P>
          If you run into an accessibility problem, or need an adjustment or information in another
          format (for example by phone or email), contact our accessibility coordinator:
        </P>
        <List
          items={[
            <>
              Accessibility coordinator: <Fill value={c.name} label="full name" />
            </>,
            <>
              Email: <Fill value={c.email} label="coordinator email" />
            </>,
            <>
              Phone: <Fill value={c.phone} label="phone" />
            </>,
          ]}
        />
        <P>
          To help us deal with your request, please include: the address of the page where you hit
          the problem, a description of it, your browser and device, and any assistive technology
          you used. We will reply within 5 business days and work to fix the problem as soon as
          possible.
        </P>
      </Section>

      <Section heading="Updates to this statement">
        <P>
          This statement was updated in November 2026. It will be updated after an accessibility
          audit and whenever the site changes materially.
        </P>
      </Section>
    </>
  );
}
