export const appConfig = {
  name: "Zona 7 - Terminal",
  shortName: "Zona 7",
  defaultTimezone: "America/Belem",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export const isSupabaseConfigured = Boolean(
  appConfig.supabaseUrl && appConfig.supabasePublishableKey,
);

export const isAdminConfigured = Boolean(isSupabaseConfigured && appConfig.serviceRoleKey);
