export function getAdminLoginPath() {
  const configured = String(process.env.ADMIN_LOGIN_PATH ?? "").trim();
  const path = configured.startsWith("/") ? configured : configured ? `/${configured}` : "/license-center-admin";
  return path.replace(/\/+$/, "") || "/license-center-admin";
}

