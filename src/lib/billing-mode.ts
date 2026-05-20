export type BillingMode = "credits" | "subscription";

export function getBillingMode(): BillingMode {
  const mode = String(process.env.APP_BILLING_MODE ?? "credits").trim().toLowerCase();

  return mode === "subscription" || mode === "self-hosted" || mode === "license"
    ? "subscription"
    : "credits";
}

export function isCreditsBillingMode() {
  return getBillingMode() === "credits";
}

export function isSubscriptionBillingMode() {
  return getBillingMode() === "subscription";
}
