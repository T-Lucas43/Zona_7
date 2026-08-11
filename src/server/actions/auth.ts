"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation/schemas";
import { acceptInvitation } from "@/server/services/domain-service";

export async function demoSignInAction(formData: FormData) {
  if (isSupabaseConfigured) return;
  const role = formData.get("role") === "player" ? "player" : "master";
  const cookieStore = await cookies();
  cookieStore.set("z7_demo_role", role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect(role === "player" ? "/app" : "/master");
}

export async function signInAction(
  _previousState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!isSupabaseConfigured) return { error: "Use um dos acessos de demonstração abaixo." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Não foi possível autenticar. Confira e-mail e senha." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.must_change_password) redirect("/reset-password?required=1");
  const { data: memberships } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("status", "active");
  const isMaster = memberships?.some((membership) =>
    ["campaign_owner", "game_master", "co_master"].includes(membership.role),
  );
  redirect(isMaster ? "/master" : "/app");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("z7_demo_role");
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
  }
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (isSupabaseConfigured && /^\S+@\S+\.\S+$/.test(email)) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`,
    });
  }
  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 12 || password !== confirmation) redirect("/reset-password?error=1");
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) redirect("/reset-password?error=2");
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", userData.user.id);
    }
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login?reset=1");
}

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!token || password.length < 8) redirect(`/invite/${encodeURIComponent(token)}?error=1`);
  if (!isSupabaseConfigured) {
    const cookieStore = await cookies();
    cookieStore.set("z7_demo_role", "player", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 28_800,
    });
    redirect("/app");
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?error=2`);
  await acceptInvitation(token);
  await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userData.user.id);
  redirect("/app");
}
