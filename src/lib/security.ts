import type { User } from "@supabase/supabase-js";

export async function getRequiredUser(supabase: any): Promise<User> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
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
