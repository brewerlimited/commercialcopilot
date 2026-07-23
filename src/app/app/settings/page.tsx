"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppearance } from "@/components/AppearanceProvider";
import { APPEARANCE_THEMES, type AppearanceThemeId } from "@/lib/appearance";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getRequiredUser, isAuthErrorMessage } from "@/lib/security";
import { checkAdminWithClient } from "@/lib/adminAccess";
import {
  DEFAULT_SESSION_SECURITY_SETTINGS,
  getEffectiveIdleTimeoutMinutes,
  getEffectiveWarningMinutes,
  getSessionSecuritySettings,
  saveSessionSecuritySettings,
  type SessionSecuritySettings,
} from "@/lib/session";
import { getBillingSnapshot, humanPlanLabel, humanStatusLabel } from "@/lib/billing";

const c = {
  card: "var(--surface)",
  border: "var(--border)",
  text: "var(--foreground)",
  sub: "var(--text-muted)",
  soft: "var(--surface-soft)",
  black: "var(--accent)",
  accentContrast: "var(--accent-contrast)",
  purple: "var(--purple, #6d4aff)",
  purpleSoft: "var(--purple-soft, #f3efff)",
  purpleBorder: "var(--purple-border, #ddd4ff)",
  input: "var(--surface-input)",
};

type SettingKey =
  | "email_updates"
  | "product_announcements"
  | "compact_tables"
  | "show_autosave_status"
  | "remember_sidebar_state";

type SettingState = Record<SettingKey, boolean>;

const DEFAULTS: SettingState = {
  email_updates: true,
  product_announcements: false,
  compact_tables: false,
  show_autosave_status: true,
  remember_sidebar_state: true,
};

const TIMEOUT_OPTIONS = [30, 60, 120, 240];
const WARNING_OPTIONS = [1, 2, 5, 10];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        border: `1px solid ${checked ? c.black : c.border}`,
        background: checked ? c.black : c.input,
        padding: 3,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: checked ? "flex-end" : "flex-start",
        transition: "all 0.18s ease",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: checked ? c.accentContrast : c.soft,
          border: `1px solid ${checked ? "rgba(255,255,255,0.2)" : c.border}`,
          display: "block",
        }}
      />
    </button>
  );
}

function SettingRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        background: c.input,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: c.sub, maxWidth: 620 }}>{hint}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function OptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 40,
        padding: "0 14px",
        borderRadius: 12,
        border: `1px solid ${active ? c.purpleBorder : c.border}`,
        background: active ? c.purpleSoft : c.input,
        color: active ? c.purple : c.text,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function AppearanceThemeCard({
  theme,
  active,
  resolved,
  onSelect,
}: {
  theme: (typeof APPEARANCE_THEMES)[number];
  active: boolean;
  resolved: boolean;
  onSelect: (theme: AppearanceThemeId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      aria-pressed={active}
      style={{
        textAlign: "left",
        border: `1px solid ${active ? c.purpleBorder : c.border}`,
        background: active ? c.purpleSoft : c.input,
        borderRadius: 16,
        padding: 14,
        display: "grid",
        gap: 12,
        cursor: "pointer",
        minHeight: 150,
        boxShadow: active ? "var(--focus-ring)" : "none",
      }}
    >
      <div style={{ display: "flex", gap: 7 }}>
        {theme.swatches.map((swatch, index) => (
          <span
            key={`${theme.id}-${index}`}
            aria-hidden
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: swatch,
              border: `1px solid ${c.border}`,
            }}
          />
        ))}
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: c.text }}>{theme.name}</div>
          {active ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: c.purple }}>Selected</span>
          ) : resolved ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: c.sub }}>Active</span>
          ) : null}
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.45, color: c.sub }}>{theme.description}</div>
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useAppearance();
  const [email, setEmail] = useState("account@company.com");
  const [settings, setSettings] = useState<SettingState>(DEFAULTS);
  const [sessionSettings, setSessionSettings] = useState<SessionSecuritySettings>(DEFAULT_SESSION_SECURITY_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [billing, setBilling] = useState(() => getBillingSnapshot({ plan_type: "starter", subscription_status: "inactive" }, { credits_remaining: 0 }));

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      let user;
      try {
        user = await getRequiredUser(supabase);
      } catch (e: any) {
        if (isAuthErrorMessage(e?.message)) {
          window.location.href = "/login";
          return;
        }
        throw e;
      }

      const activeEmail = user.email ?? "account@company.com";
      setEmail(activeEmail);

      const adminState = await checkAdminWithClient(supabase, activeEmail);
      setIsAdmin(adminState);

      const [{ data: profile }, { data: creditRow }] = await Promise.all([
        (supabase as any).from("profiles")
          .select("plan_type, subscription_status, account_status, stripe_customer_id, stripe_subscription_id, current_period_end, is_admin_unlimited, credits_remaining")
          .eq("id", user.id)
          .maybeSingle(),
        (supabase as any).from("user_credits").select("credits_remaining").eq("user_id", user.id).maybeSingle(),
      ]);
      setBilling(getBillingSnapshot(profile, creditRow));


      try {
        const raw = window.localStorage.getItem("cc.settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULTS, ...(parsed ?? {}) });
        }
      } catch {
        setSettings(DEFAULTS);
      }

      setSessionSettings(getSessionSecuritySettings());
      setLoaded(true);
    })();
  }, []);

  function updateSetting(key: SettingKey, value: boolean) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem("cc.settings", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function updateSessionSettings(patch: Partial<SessionSecuritySettings>) {
    setSessionSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSessionSecuritySettings(next);
      return next;
    });
  }


  const sessionSummary = useMemo(() => {
    if (!sessionSettings.auto_logout_enabled) return "Automatic sign out is disabled on this device.";
    return `Inactive sessions will end after ${getEffectiveIdleTimeoutMinutes(sessionSettings)} minutes with a ${getEffectiveWarningMinutes(sessionSettings)} minute warning.`;
  }, [sessionSettings]);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1120 }}>
      {isAdmin ? (
        <section
          style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 22,
            padding: 22,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: c.text }}>Internal tools</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 720 }}>
              Operator-only reporting and user tracking for Commercial Co-Pilot.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/app/admin"
              style={{
                height: 42,
                padding: "0 14px",
                borderRadius: 14,
                border: `1px solid ${c.border}`,
                background: c.soft,
                color: c.text,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Open admin dashboard
            </Link>
          </div>
        </section>
      ) : null}

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
        <div style={{ fontSize: 24, fontWeight: 700, color: c.text, letterSpacing: 0 }}>Settings</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>
          Account preferences, session controls and workspace defaults for Commercial Co-Pilot.
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.2 }}>
              Account
            </div>
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: c.text }}>{email}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: `1px solid ${c.border}`,
              background: c.soft,
              fontSize: 12,
              fontWeight: 700,
              color: c.sub,
            }}
          >
            {loaded ? "Preferences saved on this device" : "Loading settings..."}
          </div>
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
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Appearance</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>
            Choose how Commercial Co-Pilot looks on this device. Theme changes apply immediately across the main app workspace.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          {APPEARANCE_THEMES.map((item) => (
            <AppearanceThemeCard
              key={item.id}
              theme={item}
              active={theme === item.id}
              resolved={item.id === resolvedTheme}
              onSelect={setTheme}
            />
          ))}
        </div>
      </section>


      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 22,
          padding: 22,
          display: "grid",
          gap: 12,
          boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Session & security</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>{sessionSummary}</div>
        </div>

        <SettingRow
          title="Automatic sign out"
          hint="End inactive sessions automatically so open tabs do not leave CE data exposed on shared or unattended devices."
          checked={sessionSettings.auto_logout_enabled}
          onChange={(next) => updateSessionSettings({ auto_logout_enabled: next })}
        />

        <SettingRow
          title="Trusted device"
          hint="Keep a longer inactivity window on your primary device. Disable this on shared machines or site laptops used by multiple people."
          checked={sessionSettings.trusted_device}
          onChange={(next) => updateSessionSettings({ trusted_device: next })}
        />

        <div
          style={{
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            background: c.input,
            padding: 18,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Idle timeout</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TIMEOUT_OPTIONS.map((minutes) => (
              <OptionButton
                key={minutes}
                active={sessionSettings.idle_timeout_minutes === minutes}
                label={`${minutes} min`}
                onClick={() => updateSessionSettings({ idle_timeout_minutes: minutes })}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: c.sub }}>
            The effective timeout is automatically tightened on non-trusted devices and extended on your main working device.
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            background: c.input,
            padding: 18,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Warning window</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {WARNING_OPTIONS.map((minutes) => (
              <OptionButton
                key={minutes}
                active={sessionSettings.warning_minutes === minutes}
                label={`${minutes} min`}
                onClick={() => updateSessionSettings({ warning_minutes: minutes })}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: c.sub }}>
            A warning modal appears before sign out so you can keep the session alive without losing your place.
          </div>
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Billing</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>
              Stripe subscription status, monthly credits and access control for paid draft generation.
            </div>
          </div>
          <Link
            href="/app/billing"
            style={{
              height: 42,
              padding: "0 14px",
              borderRadius: 14,
              border: `1px solid ${c.border}`,
              background: c.soft,
              color: c.text,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Open billing
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          {[
            ["Plan", humanPlanLabel(billing.plan)],
            ["Status", humanStatusLabel(billing.status)],
            ["Credits", String(billing.creditsRemaining)],
            ["Admin unlimited", billing.isAdminUnlimited ? "Enabled" : "No"],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ border: `1px solid ${c.border}`, borderRadius: 14, background: c.soft, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.sub, textTransform: "uppercase", letterSpacing: 0.2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 22,
          padding: 22,
          display: "grid",
          gap: 12,
          boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Workspace</div>

        <SettingRow
          title="Show autosave status"
          hint="Keep autosave and save-state messaging visible while working through each CE."
          checked={settings.show_autosave_status}
          onChange={(next) => updateSetting("show_autosave_status", next)}
        />

        <SettingRow
          title="Remember sidebar state"
          hint="Preserve whether the left navigation is collapsed or expanded between sessions on this device."
          checked={settings.remember_sidebar_state}
          onChange={(next) => updateSetting("remember_sidebar_state", next)}
        />

        <SettingRow
          title="Compact tables"
          hint="Use a denser table feel for list-based pages where more records need to sit on screen."
          checked={settings.compact_tables}
          onChange={(next) => updateSetting("compact_tables", next)}
        />
      </section>

      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 22,
          padding: 20,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Notifications</div>

        <SettingRow
          title="Email updates"
          hint="Receive important account and workflow-related updates by email."
          checked={settings.email_updates}
          onChange={(next) => updateSetting("email_updates", next)}
        />

        <SettingRow
          title="Product announcements"
          hint="Receive occasional updates about new features, improvements and billing changes."
          checked={settings.product_announcements}
          onChange={(next) => updateSetting("product_announcements", next)}
        />
      </section>
    </div>
  );
}
