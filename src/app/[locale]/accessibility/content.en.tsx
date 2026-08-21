import { SITE_CONFIG } from "@/lib/constants";
import { Section, P, List, Ph } from "@/components/legal/legal-layout";

export const accessibilityTitleEn = "Accessibility Statement";

export default function AccessibilityContentEn() {
  return (
    <>
      <P>
        {SITE_CONFIG.name} considers it important to make the service usable by everyone, including
        people with disabilities, out of a commitment to equal rights. We work towards conformance
        with WCAG 2.1 Level AA, and with Israel&rsquo;s Equal Rights for Persons with Disabilities
        Regulations (Service Accessibility Adjustments), 5773-2013, and Israeli Standard IS 5568.
      </P>

      <Section heading="Level of accessibility">
        <P>
          The site was built with the aim of meeting Level AA. Among other things: semantic
          structure, keyboard navigation support, colour contrast, alternative text for meaningful
          images, and screen-reader compatibility.{" "}
          <Ph>update after an actual accessibility audit</Ph>.
        </P>
      </Section>

      <Section heading="Known limitations">
        <P>
          Some parts of the service may not yet be fully accessible. We work on this continuously.
          If you run into an accessibility problem, please tell us and we will address it promptly.{" "}
          <Ph>list known limitations after an audit, if any</Ph>.
        </P>
      </Section>

      <Section heading="Getting in touch and requesting adjustments">
        <P>
          Run into a problem, or need an accessibility adjustment? You can contact our accessibility
          coordinator and we will do our best to respond quickly:
        </P>
        <List
          items={[
            <>
              Accessibility coordinator: <Ph>full name</Ph>
            </>,
            <>
              Email: <Ph>coordinator email</Ph>
            </>,
            <>
              Phone: <Ph>phone</Ph>
            </>,
          ]}
        />
        <P>
          Please tell us which page the problem occurred on, describe what went wrong, and mention
          the assistive technology you were using, if relevant.
        </P>
      </Section>

      <Section heading="Date of this statement">
        <P>
          This statement was updated in July 2026.{" "}
          <Ph>update on any material change, or after an audit</Ph>.
        </P>
      </Section>

      <P>
        This statement is an initial template. A binding accessibility statement must reflect a real
        audit and include the accessibility coordinator&rsquo;s details. Working with a certified
        accessibility auditor is recommended.
      </P>
    </>
  );
}
