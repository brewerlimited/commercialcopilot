import type { User } from "@supabase/supabase-js";

const STALE_REFRESH_TOKEN_MESSAGES = [
  "invalid refresh token",
  "refresh token not found",
  "refresh token already used",
  "session not found",
];

export function isStaleSupabaseAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? "");
  const name = String((error as any)?.name ?? "");
  const lower = message.toLowerCase();

  return STALE_REFRESH_TOKEN_MESSAGES.some((knownMessage) => lower.includes(knownMessage)) || (
    name === "AuthApiError" &&
    lower.includes("refresh")
  );
}

export async function clearStaleSupabaseSession(supabase: any) {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The stored refresh token is already invalid, so failure to revoke remotely is expected.
  }
}

export async function getRequiredUser(supabase: any): Promise<User> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (isStaleSupabaseAuthError(error)) {
      await clearStaleSupabaseSession(supabase);
      throw new Error("AUTH_REQUIRED");
    }
    throw error;
  }
  const user = data.session?.user;
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

export async function getOwnedEventOrThrow(
  supabase: any,
  eventId: string,
  userId: string,
  select = "id,title,user_id"
) {
  const res = await (supabase as any).from("events")
    .select(select)
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (res.error) throw res.error;
  if (!res.data) throw new Error("EVENT_NOT_FOUND_OR_FORBIDDEN");
  return res.data;
}

export function isAuthErrorMessage(message?: string | null) {
  return message === "AUTH_REQUIRED";
}

export function isOwnershipErrorMessage(message?: string | null) {
  return message === "EVENT_NOT_FOUND_OR_FORBIDDEN";
}
