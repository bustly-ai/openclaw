export type SupabaseUserResponse = {
  id?: string;
  email?: string;
  role?: string;
};

export type SupabaseVerifyResult = {
  ok: boolean;
  status: number;
  data?: SupabaseUserResponse;
};

export async function verifySupabaseAuth(params: {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}): Promise<SupabaseVerifyResult> {
  if (!params.supabaseUrl) {
    throw new Error("Missing Supabase URL");
  }
  if (!params.supabaseAnonKey) {
    throw new Error("Missing Supabase anon key");
  }
  const endpoint = `${params.supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${params.accessToken}`,
    apikey: params.supabaseAnonKey,
  };

  console.log("[Supabase API] Verify auth request:", endpoint);
  const response = await fetch(endpoint, { method: "GET", headers });
  console.log("[Supabase API] Verify auth response:", response.status, response.statusText);
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const data = (await response.json()) as SupabaseUserResponse;
  console.log("[Supabase API] Verify auth user:", data.id ?? "unknown");
  return { ok: true, status: response.status, data };
}
