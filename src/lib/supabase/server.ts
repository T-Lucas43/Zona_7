import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { appConfig } from "@/lib/config";

export async function createClient() {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) {
    throw new Error("Supabase não configurado.");
  }
  const cookieStore = await cookies();
  return createServerClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; src/proxy.ts refreshes them.
        }
      },
    },
  });
}
