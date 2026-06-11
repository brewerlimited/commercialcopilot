"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { COMPANY_PROFILE_SELECT, cleanCompanyProfile, type CompanyProfile } from "@/lib/companyProfile";

const c = {
  card: "var(--surface)",
  input: "var(--surface-input)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  soft: "var(--surface-soft)",
  black: "var(--accent)",
  blackContrast: "var(--accent-contrast)",
  redText: "var(--red-text)",
};

export default function CompanyProfilePage() {
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => cleanCompanyProfile(null));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      try {
        const user = await getRequiredUser(supabase);
        const { data, error } = await (supabase as any).from("company_profiles")
          .select(COMPANY_PROFILE_SELECT)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setCompanyProfile(cleanCompanyProfile(data || null));
        setLoaded(true);
      } catch (e: any) {
        if (isAuthErrorMessage(e?.message)) {
          window.location.href = "/login";
          return;
        }
        setMessage(e?.message || "Failed to load company profile.");
        setLoaded(true);
      }
    })();
  }, []);

  function updateField<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setCompanyProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function saveCompanyProfile(nextProfile = companyProfile) {
    setSaving(true);
    setMessage("");
    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const payload = {
        user_id: user.id,
        company_name: nextProfile.company_name || "",
        trading_name: nextProfile.trading_name || "",
        role: nextProfile.role || "Subcontractor",
        logo_url: nextProfile.logo_url || "",
        logo_path: nextProfile.logo_path || "",
        address: nextProfile.address || "",
        email: nextProfile.email || "",
        phone: nextProfile.phone || "",
        vat_number: nextProfile.vat_number || "",
        company_registration_number: nextProfile.company_registration_number || "",
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("company_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      setCompanyProfile(cleanCompanyProfile(payload));
      setMessage("Company profile saved.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to save company profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file?: File | null) {
    if (!file) return;
    setSaving(true);
    setMessage("");
    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      const next = cleanCompanyProfile({ ...companyProfile, user_id: user.id, logo_path: path, logo_url: data.publicUrl });
      setCompanyProfile(next);
      await saveCompanyProfile(next);
      setMessage("Company logo uploaded and saved.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to upload company logo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoRemove() {
    if (!companyProfile.logo_url && !companyProfile.logo_path) return;
    setSaving(true);
    setMessage("");
    try {
      const supabase = supabaseBrowser();
      const user = await getRequiredUser(supabase);

      if (companyProfile.logo_path) {
        const { error: removeError } = await supabase.storage
          .from("company-logos")
          .remove([companyProfile.logo_path]);
        if (removeError) console.warn("Company logo storage removal failed", removeError);
      }

      const next = cleanCompanyProfile({
        ...companyProfile,
        user_id: user.id,
        logo_url: "",
        logo_path: "",
      });

      setCompanyProfile(next);
      await saveCompanyProfile(next);
      setMessage("Company logo removed.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to remove company logo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1120 }}>
      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 22,
          padding: 22,
          display: "grid",
          gap: 8,
          boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, color: c.text, letterSpacing: 0 }}>Company Profile</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>
          This is the source of truth for your submitting party details. AI drafts, Excel outputs and future PDF/Word packs use this instead of inferred or hardcoded company names.
        </div>
      </section>

      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 22,
          padding: 22,
          display: "grid",
          gap: 14,
          boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Submitting party details</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>
              Lock these details so Commercial Co-Pilot never guesses your company name, role or branding.
            </div>
          </div>
          <button
            type="button"
            onClick={() => saveCompanyProfile()}
            disabled={saving || !loaded}
            style={{
              height: 42,
              padding: "0 14px",
              borderRadius: 14,
              border: `1px solid ${c.black}`,
              background: c.black,
              color: c.blackContrast,
              fontWeight: 700,
              cursor: saving || !loaded ? "not-allowed" : "pointer",
              opacity: saving || !loaded ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save company profile"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {[
            ["Company legal name", "company_name", "e.g. M O’Brien Civil Engineering Ltd"],
            ["Trading name", "trading_name", "e.g. M O’Brien"],
            ["Role in submissions", "role", "Subcontractor"],
            ["Company email", "email", "commercial@company.co.uk"],
            ["Company phone", "phone", ""],
            ["VAT number", "vat_number", ""],
            ["Company registration number", "company_registration_number", ""],
          ].map(([label, key, placeholder]) => (
            <label key={key} style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: c.text }}>
              {label}
              <input
                value={String((companyProfile as any)[key] || "")}
                placeholder={String(placeholder)}
                onChange={(e) => updateField(key as keyof CompanyProfile, e.target.value as any)}
                style={{ height: 42, borderRadius: 12, border: `1px solid ${c.border}`, padding: "0 12px", fontSize: 14, color: c.text, background: c.input }}
              />
            </label>
          ))}

          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: c.text, gridColumn: "1 / -1" }}>
            Company address
            <textarea
              value={companyProfile.address || ""}
              placeholder="Registered / correspondence address"
              onChange={(e) => updateField("address", e.target.value)}
              rows={3}
              style={{ borderRadius: 12, border: `1px solid ${c.border}`, padding: 12, fontSize: 14, color: c.text, background: c.input, resize: "vertical" }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 12, padding: 14, border: `1px solid ${c.border}`, borderRadius: 14, background: c.soft }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Company logo</div>
              <div style={{ fontSize: 12, color: c.sub }}>Upload a PNG/JPG logo. It will be used at the top of the Excel Summary sheet where supported.</div>
            </div>
          </div>

          {companyProfile.logo_url ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <img src={companyProfile.logo_url} alt="Company logo" style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain", background: c.input, border: `1px solid ${c.border}`, borderRadius: 12, padding: 8 }} />
              <a href={companyProfile.logo_url} target="_blank" rel="noreferrer" style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>Open logo</a>
              <button
                type="button"
                onClick={handleLogoRemove}
                disabled={saving || !loaded}
                style={{
                  height: 38,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  background: c.input,
                  color: c.redText,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving || !loaded ? "not-allowed" : "pointer",
                  opacity: saving || !loaded ? 0.65 : 1,
                }}
              >
                Remove logo
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: c.sub, border: `1px dashed ${c.border}`, borderRadius: 12, padding: 14, background: c.input }}>No company logo uploaded.</div>
          )}

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "fit-content",
              minHeight: 38,
              padding: "0 12px",
              borderRadius: 12,
              border: `1px solid ${c.black}`,
              background: companyProfile.logo_url ? c.input : c.black,
              color: companyProfile.logo_url ? c.text : c.blackContrast,
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || !loaded ? "not-allowed" : "pointer",
              opacity: saving || !loaded ? 0.65 : 1,
            }}
          >
            {companyProfile.logo_url ? "Replace logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={saving || !loaded}
              onChange={(e) => {
                handleLogoUpload(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {message ? <div style={{ fontSize: 13, color: message.toLowerCase().includes("failed") ? c.redText : c.sub }}>{message}</div> : null}
      </section>
    </div>
  );
}
