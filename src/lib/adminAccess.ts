export function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

function parseConfiguredEmails(raw?: string | null) {
  return (raw || "")
    .split(",")
    .map((v) => normalizeEmail(v))
    .filter(Boolean);
}

export function getConfiguredAdminEmails() {
  const publicEmails = parseConfiguredEmails(process.env.NEXT_PUBLIC_ADMIN_EMAILS);
  const publicEmail = parseConfiguredEmails(process.env.NEXT_PUBLIC_ADMIN_EMAIL);
  const serverEmails = parseConfiguredEmails(process.env.ADMIN_EMAILS);
  const serverEmail = parseConfiguredEmails(process.env.ADMIN_EMAIL);
  return Array.from(new Set([...publicEmails, ...publicEmail, ...serverEmails, ...serverEmail]));
}

export function matchesConfiguredAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getConfiguredAdminEmails().includes(normalized);
}

export async function checkAdminWithClient(
  supabase: any,
  email?: string | null
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (matchesConfiguredAdminEmail(normalized)) return true;

  let res = await (supabase as any).from("admin_users").select("email, is_active").eq("email", normalized).maybeSingle();

  if (res.error) {
    const message = String(res.error.message || "");
    if (/column .*is_active.* does not exist/i.test(message)) {
      res = await (supabase as any).from("admin_users").select("email").eq("email", normalized).maybeSingle();
    }
  }

  if (res.error) {
    const message = String(res.error.message || "");
    if (
      /relation .*admin_users.* does not exist/i.test(message) ||
      /permission denied/i.test(message) ||
      /row-level security/i.test(message)
    ) {
      return false;
    }
    throw res.error;
  }

  if (!res.data) return false;
  if (typeof (res.data as any)?.is_active === "boolean") return (res.data as any)?.is_active;
  return normalizeEmail((res.data as any)?.email) === normalized;
}

export async function checkAdminWithServiceRole(
  supabase: any,
  email?: string | null
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (matchesConfiguredAdminEmail(normalized)) return true;

  let res = await (supabase as any).from("admin_users").select("email, is_active").eq("email", normalized).maybeSingle();

  if (res.error) {
    const message = String(res.error.message || "");
    if (/column .*is_active.* does not exist/i.test(message)) {
      res = await (supabase as any).from("admin_users").select("email").eq("email", normalized).maybeSingle();
    }
  }

  if (res.error) {
    const message = String(res.error.message || "");
    if (/relation .*admin_users.* does not exist/i.test(message)) return false;
    throw res.error;
  }

  if (!res.data) return false;
  if (typeof (res.data as any)?.is_active === "boolean") return (res.data as any)?.is_active;
  return normalizeEmail((res.data as any)?.email) === normalized;
}
