export function getSupabaseUrl() {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
}

export function getSupabasePublishableKey() {
  return String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
}

export function getSupabaseServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function getAuthProvider() {
  return String(process.env.APP_AUTH_PROVIDER ?? "auto").trim().toLowerCase();
}

export function shouldUseSupabaseAuth() {
  return getAuthProvider() !== "local";
}

export function hasSupabaseAuthConfig() {
  return shouldUseSupabaseAuth() && Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
