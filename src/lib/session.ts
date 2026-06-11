export type SessionSecuritySettings = {
  auto_logout_enabled: boolean;
  trusted_device: boolean;
  idle_timeout_minutes: number;
  warning_minutes: number;
};

export const SESSION_SETTINGS_KEY = "cc.session.settings";
export const SESSION_LOGOUT_BROADCAST_KEY = "cc.session.logout";
export const SESSION_ACTIVITY_KEY = "cc.session.activity";
export const SESSION_WARNING_KEY = "cc.session.warning";

export const DEFAULT_SESSION_SECURITY_SETTINGS: SessionSecuritySettings = {
  auto_logout_enabled: true,
  trusted_device: true,
  idle_timeout_minutes: 120,
  warning_minutes: 2,
};

function clampMinutes(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(480, Math.max(15, Math.round(value)));
}

export function getSessionSecuritySettings(): SessionSecuritySettings {
  if (typeof window === "undefined") return DEFAULT_SESSION_SECURITY_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SESSION_SETTINGS_KEY);
    if (!raw) return DEFAULT_SESSION_SECURITY_SETTINGS;
    const parsed = JSON.parse(raw) ?? {};

    return {
      auto_logout_enabled:
        typeof parsed.auto_logout_enabled === "boolean"
          ? parsed.auto_logout_enabled
          : DEFAULT_SESSION_SECURITY_SETTINGS.auto_logout_enabled,
      trusted_device:
        typeof parsed.trusted_device === "boolean"
          ? parsed.trusted_device
          : DEFAULT_SESSION_SECURITY_SETTINGS.trusted_device,
      idle_timeout_minutes: clampMinutes(
        typeof parsed.idle_timeout_minutes === "number"
          ? parsed.idle_timeout_minutes
          : DEFAULT_SESSION_SECURITY_SETTINGS.idle_timeout_minutes,
        DEFAULT_SESSION_SECURITY_SETTINGS.idle_timeout_minutes
      ),
      warning_minutes: clampMinutes(
        typeof parsed.warning_minutes === "number"
          ? parsed.warning_minutes
          : DEFAULT_SESSION_SECURITY_SETTINGS.warning_minutes,
        DEFAULT_SESSION_SECURITY_SETTINGS.warning_minutes
      ),
    };
  } catch {
    return DEFAULT_SESSION_SECURITY_SETTINGS;
  }
}

export function saveSessionSecuritySettings(next: SessionSecuritySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(next));
}

export function getEffectiveIdleTimeoutMinutes(settings: SessionSecuritySettings) {
  if (!settings.auto_logout_enabled) return Number.POSITIVE_INFINITY;

  const base = clampMinutes(settings.idle_timeout_minutes, DEFAULT_SESSION_SECURITY_SETTINGS.idle_timeout_minutes);
  if (settings.trusted_device) return Math.max(base, 120);
  return Math.min(base, 60);
}

export function getEffectiveWarningMinutes(settings: SessionSecuritySettings) {
  const base = clampMinutes(settings.warning_minutes, DEFAULT_SESSION_SECURITY_SETTINGS.warning_minutes);
  return Math.min(base, Math.max(1, Math.floor(getEffectiveIdleTimeoutMinutes(settings) / 2)));
}

export function broadcastSessionLogout(reason: "manual" | "idle" | "expired" = "manual") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SESSION_LOGOUT_BROADCAST_KEY,
    JSON.stringify({ reason, at: new Date().toISOString() })
  );
}

export function broadcastSessionActivity() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
}

export function broadcastSessionWarning(expiresAt: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SESSION_WARNING_KEY,
    JSON.stringify({ expiresAt, at: new Date().toISOString() })
  );
}
