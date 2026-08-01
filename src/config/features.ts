export const FEATURE_FLAGS = {
  authentication: false,
  supabase: false,
  functionalCart: false,
  functionalCheckout: false,
  demoAdminPanel: true,
  demoCustomerAccount: true,
} as const;

// These flags communicate the current phase only. They are not an authorization mechanism.
