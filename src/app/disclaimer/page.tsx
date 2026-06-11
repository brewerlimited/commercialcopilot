import { LegalBlock, LegalPage } from "@/components/marketing";

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Disclaimer"
      intro="Important clarification on how Commercial Co-Pilot should be used in practice and where user review remains essential."
    >
      <LegalBlock title="Commercial assistance, not regulated advice">
        <p>Commercial Co-Pilot is designed to assist with structuring Compensation Event and variation submissions. It is not legal advice, adjudication advice, delay expert advice or regulated professional advice of any kind.</p>
      </LegalBlock>

      <LegalBlock title="User review remains essential">
        <p>All output should be checked by the user before issue. That includes factual content, contractual entitlement, clause relevance, valuation assumptions, evidence completeness and final submission wording.</p>
      </LegalBlock>

      <LegalBlock title="Deterministic costing principle">
        <p>The product is intended to support user-controlled, deterministic valuation logic. Users remain responsible for the correctness of rates, quantities, prelim allowances, fee settings and supporting records used within the platform.</p>
      </LegalBlock>

      <LegalBlock title="Project-specific limitations">
        <p>No generic software output can capture every bespoke amendment, Z clause, evidential nuance, programme issue or project-specific risk. Final responsibility for the issued submission remains with the submitting party.</p>
      </LegalBlock>
    </LegalPage>
  );
}
