import { LegalBlock, LegalPage } from "@/components/marketing";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      intro="A clean public-facing terms page for early commercial use. Formal legal review can refine this wording later."
    >
      <LegalBlock title="Use of the platform">
        <p>Commercial Co-Pilot is provided as software to assist users in structuring Compensation Event and variation submissions through a guided commercial workflow.</p>
        <p>The platform is intended to support drafting and internal review. It does not replace user judgement, project-specific contract review or commercial responsibility.</p>
      </LegalBlock>

      <LegalBlock title="User responsibility">
        <p>Users remain responsible for checking all factual inputs, contractual positions, commercial assumptions, supporting evidence and final submission wording before issue.</p>
        <p>Any output generated through the platform should be reviewed internally before it is sent externally.</p>
      </LegalBlock>

      <LegalBlock title="Accounts and access">
        <p>Users are responsible for maintaining the confidentiality of their account credentials and any access granted to the platform.</p>
        <p>Access may be suspended or withdrawn where misuse, abuse, non-payment or unauthorised activity is identified.</p>
      </LegalBlock>

      <LegalBlock title="Fees and billing">
        <p>Paid access, plan terms and credit allocations may be subject to separate pricing and billing terms shown during onboarding, subscription setup or later commercial agreement.</p>
        <p>Unless otherwise agreed in writing, fees are non-refundable once service access or usage has commenced.</p>
      </LegalBlock>

      <LegalBlock title="Intellectual property">
        <p>The platform, workflow logic, interface design and related software remain the intellectual property of Commercial Co-Pilot unless expressly agreed otherwise in writing.</p>
        <p>Users retain responsibility for their own project data and uploaded submission content, subject to the platform terms and privacy policy.</p>
      </LegalBlock>
    </LegalPage>
  );
}
