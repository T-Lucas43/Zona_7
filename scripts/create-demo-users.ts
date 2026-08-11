import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const masterEmail = process.env.SEED_MASTER_EMAIL;
const masterPassword = process.env.SEED_MASTER_PASSWORD;
const playerEmails = (process.env.SEED_PLAYER_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

if (!url || !serviceRoleKey || !masterEmail || !masterPassword) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_MASTER_EMAIL e SEED_MASTER_PASSWORD.",
  );
  process.exit(1);
}

if (masterPassword.length < 12) {
  console.error("SEED_MASTER_PASSWORD deve ter pelo menos 12 caracteres.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findOrCreateUser(email: string, password?: string, displayName?: string) {
  const { data: listing, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw listError;
  const existing = listing.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? email.split("@")[0] },
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  const master = await findOrCreateUser(masterEmail!, masterPassword!, "Mestre da Convergência");
  const { error: seedError } = await supabase.rpc("seed_zona7_demo", {
    p_owner_user_id: master.id,
  });
  if (seedError) throw seedError;

  const characterIds = [
    "20000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    "20000000-0000-4000-8000-000000000003",
    "20000000-0000-4000-8000-000000000004",
    "20000000-0000-4000-8000-000000000005",
    "20000000-0000-4000-8000-000000000006",
  ];

  for (const [index, email] of playerEmails.slice(0, characterIds.length).entries()) {
    const temporaryPassword = crypto.randomUUID() + crypto.randomUUID();
    const player = await findOrCreateUser(email, temporaryPassword);
    const { error: memberError } = await supabase.from("campaign_members").upsert(
      {
        campaign_id: "11111111-1111-4111-8111-111111111111",
        user_id: player.id,
        role: "player",
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id,user_id" },
    );
    if (memberError) throw memberError;

    const { error: ownerError } = await supabase.from("character_owners").upsert(
      {
        campaign_id: "11111111-1111-4111-8111-111111111111",
        character_id: characterIds[index],
        user_id: player.id,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "character_id,user_id" },
    );
    if (ownerError) throw ownerError;

    const { data: actor } = await supabase
      .from("actors")
      .select("id")
      .eq("character_id", characterIds[index])
      .maybeSingle();
    if (actor) {
      const { error: controllerError } = await supabase.from("actor_controllers").upsert(
        {
          campaign_id: "11111111-1111-4111-8111-111111111111",
          actor_id: actor.id,
          user_id: player.id,
          control_level: "owner",
          granted_by: master.id,
        },
        { onConflict: "actor_id,user_id" },
      );
      if (controllerError) throw controllerError;
    }

    if (index === 0) {
      const { error: recipientError } = await supabase.from("message_recipients").upsert(
        {
          campaign_id: "11111111-1111-4111-8111-111111111111",
          message_id: "52000000-0000-4000-8000-000000000001",
          user_id: player.id,
          status: "pending",
        },
        { onConflict: "message_id,user_id" },
      );
      if (recipientError) throw recipientError;
    }
  }

  console.log(`Seed concluído: 1 mestre e ${Math.min(playerEmails.length, 6)} jogador(es).`);
  console.log(
    "Senhas temporárias de jogadores não foram exibidas; envie convites para definir acesso.",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Falha ao criar os usuários de demonstração.",
  );
  process.exit(1);
});
