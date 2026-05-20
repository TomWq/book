export type BillingMode = "subscription";

export function getBillingMode(): BillingMode {
  return "subscription";
}

export function isCreditsBillingMode() {
  return false;
}

export function isSubscriptionBillingMode() {
  return true;
}
