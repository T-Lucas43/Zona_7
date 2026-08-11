"use client";

import { createBrowserClient } from "@supabase/ssr";
import { appConfig } from "@/lib/config";

export function createClient() {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) {
    throw new Error(
      "Supabase não configurado. Use o modo de demonstração ou defina as variáveis públicas.",
    );
  }
  return createBrowserClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey);
}
