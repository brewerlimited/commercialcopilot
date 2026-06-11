"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const c = {
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  sub: "#475569",
  soft: "#f8fafc",
  black: "#111827",
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
        background: checked ? c.black : "#fff",
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
          background: checked ? "#fff" : c.soft,
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
        background: "#fff",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: c.text }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: c.sub, maxWidth: 620 }}>{hint}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const [email, setEmail] = useState("account@company.com");
  const [settings, setSettings] = useState<SettingState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      setEmail(user.email ?? "account@company.com");

      try {
        const raw = window.localStorage.getItem("cc.settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULTS, ...(parsed ?? {}) });
        }
      } catch {
        setSettings(DEFAULTS);
      }

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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, color: c.text, letterSpacing: -0.4 }}>Settings</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: c.sub, maxWidth: 760 }}>
          Account preferences and interface defaults for Commercial Co-Pilot.
        </div>
      </section>

      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: c.sub, textTransform: "uppercase", letterSpacing: 0.2 }}>
              Account
            </div>
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: c.text }}>{email}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: `1px solid ${c.border}`,
              background: c.soft,
              fontSize: 12,
              fontWeight: 800,
              color: c.sub,
            }}
          >
            {loaded ? "Preferences saved locally" : "Loading settings..."}
          </div>
        </div>
      </section>

      <section
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: c.text }}>Workspace</div>

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
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: c.text }}>Notifications</div>

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
