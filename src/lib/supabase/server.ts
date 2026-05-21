import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl, hasSupabaseAuthConfig } from "@/lib/supabase/config";

export function createSupabaseServerClient(options?: { writable?: boolean }) {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return null;
  }

  const writable = options?.writable ?? false;
  const cookieStorePromise = cookies();

  return createServerClient(url, key, {
    cookies: {
      async getAll() {
        const cookieStore = await cookieStorePromise;
        return cookieStore.getAll();
      },
      async setAll(cookiesToSet) {
        if (!writable) {
          return;
        }

        const cookieStore = await cookieStorePromise;
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
}

export async function getSupabaseAuthUser(options?: { writable?: boolean }) {
  if (!hasSupabaseAuthConfig()) {
    return null;
  }

  const client = createSupabaseServerClient(options);

  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser();

  if (error) {
    return null;
  }

  return data.user ?? null;
}
