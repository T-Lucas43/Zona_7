import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { messageSchema } from "@/lib/validation/schemas";

export async function sendMessage(input: unknown, actorUserId: string) {
  const message = messageSchema.parse(input);
  if (!isSupabaseConfigured) return { id: message.idempotencyKey, status: "sent", demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_campaign_message", {
    p_campaign_id: message.campaignId,
    p_real_sender_user_id: actorUserId,
    p_apparent_sender_name: message.apparentSenderName,
    p_recipient_user_ids: message.recipientUserIds,
    p_body: message.body,
    p_format: message.format,
    p_visibility: message.visibility,
    p_expires_at: message.expiresAt ?? null,
    p_idempotency_key: message.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}
