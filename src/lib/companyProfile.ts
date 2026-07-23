export type CompanyProfile = {
  user_id?: string;
  company_name?: string | null;
  trading_name?: string | null;
  role?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  vat_number?: string | null;
  company_registration_number?: string | null;
  trade_profile?: string | null;
};

export function cleanCompanyProfile(profile?: CompanyProfile | null): CompanyProfile {
  return {
    user_id: profile?.user_id || undefined,
    company_name: profile?.company_name || "",
    trading_name: profile?.trading_name || "",
    role: profile?.role || "Subcontractor",
    logo_url: profile?.logo_url || "",
    logo_path: profile?.logo_path || "",
    address: profile?.address || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    vat_number: profile?.vat_number || "",
    company_registration_number: profile?.company_registration_number || "",
    trade_profile: profile?.trade_profile || "general",
  };
}

export function companyDisplayName(profile?: CompanyProfile | null) {
  const p = cleanCompanyProfile(profile);
  return p.trading_name || p.company_name || "";
}

export function companyLegalName(profile?: CompanyProfile | null) {
  const p = cleanCompanyProfile(profile);
  return p.company_name || p.trading_name || "";
}

export const COMPANY_PROFILE_SELECT =
  "user_id,company_name,trading_name,role,logo_url,logo_path,address,email,phone,vat_number,company_registration_number";
