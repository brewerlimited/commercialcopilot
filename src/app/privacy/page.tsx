import { LegalBlock, LegalPage } from "@/components/marketing";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This page explains, in straightforward terms, how account and project data may be handled within the platform."
    >
      <LegalBlock title="What we may collect">
        <p>We may collect account details, uploaded documents, event drafting inputs, valuation inputs, evidence references and usage information required to operate the software.</p>
      </LegalBlock>

      <LegalBlock title="Why we collect it">
        <p>Data may be used to provide the drafting workflow, maintain user accounts, support platform performance, improve stability and generate the outputs requested by the user.</p>
      </LegalBlock>

      <LegalBlock title="Analytics and product usage">
        <p>We use first-party analytics to understand visits, sign-ups, feature use, generation reliability and billing journeys. Analytics are designed to fail quietly and should never interrupt login, billing, CE generation, exports or normal product use.</p>
        <p>Visitor analytics may include page views, referral information, broad browser/device details and a rotating hashed visitor identifier. Raw IP addresses are not stored in the analytics tables. Product analytics may include event names such as CE created, EWN converted, evidence uploaded or pack generated, but should not include uploaded evidence, contract wording, generated narratives or detailed commercial submissions.</p>
      </LegalBlock>

      <LegalBlock title="Confidentiality">
        <p>Project and commercial information should be treated as confidential within the platform environment. Users should still apply appropriate judgement regarding what information is uploaded, stored and shared.</p>
      </LegalBlock>

      <LegalBlock title="Data retention">
        <p>Account and project data may be retained for as long as reasonably necessary to provide the service, support users, maintain operational records and comply with legal obligations.</p>
      </LegalBlock>

      <LegalBlock title="User rights">
        <p>Where applicable, users may request access to or deletion of personal account data, subject to legal, contractual and technical limitations.</p>
      </LegalBlock>
    </LegalPage>
  );
}
