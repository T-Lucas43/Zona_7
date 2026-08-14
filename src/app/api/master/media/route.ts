import { extname } from "node:path";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/ogg",
  "video/mp4",
  "application/pdf",
]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const campaignId = String(form.get("campaignId") ?? "");
    const assetType = String(form.get("assetType") ?? "image");
    const title = String(form.get("title") ?? "Arquivo").trim();
    const characterId = String(form.get("characterId") ?? "");
    const actorId = String(form.get("actorId") ?? "");
    const itemId = String(form.get("itemId") ?? "");
    const sceneId = String(form.get("sceneId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Selecione um arquivo.");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) throw new Error("Campanha inválida.");
    const user = await requireCampaignMaster(campaignId);
    if (!allowed.has(file.type)) throw new Error("Formato de arquivo não permitido.");
    if (file.size > 26_214_400) throw new Error("O arquivo ultrapassa 25 MB.");
    if (["portrait", "actor_portrait", "item"].includes(assetType) && file.size > 5_242_880)
      throw new Error("O retrato ultrapassa 5 MB.");
    if (!isSupabaseConfigured)
      return NextResponse.json(
        {
          id: crypto.randomUUID(),
          title,
          mimeType: file.type,
          size: file.size,
          signedUrl: null,
          backgroundKey: assetType === "map" ? `demo/${crypto.randomUUID()}` : undefined,
          demo: true,
        },
        { status: 201 },
      );
    const supabase = await createClient();
    const portrait = assetType === "portrait" || assetType === "token";
    const actorPortrait = assetType === "actor_portrait";
    const itemImage = assetType === "item";
    if (actorPortrait) {
      if (!/^[0-9a-f-]{36}$/i.test(actorId)) throw new Error("Ator inválido.");
      const { data: actor, error: actorLookupError } = await supabase
        .from("actors")
        .select("id")
        .eq("id", actorId)
        .eq("campaign_id", campaignId)
        .is("deleted_at", null)
        .maybeSingle();
      if (actorLookupError || !actor) throw new Error("Ator não encontrado.");
    }
    if (itemImage) {
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new Error("Item inválido.");
      const { data: item, error: itemLookupError } = await supabase
        .from("items")
        .select("id")
        .eq("id", itemId)
        .eq("campaign_id", campaignId)
        .is("deleted_at", null)
        .maybeSingle();
      if (itemLookupError || !item) throw new Error("Item não encontrado.");
    }
    const bucket = actorPortrait
      ? "actor-portraits"
      : portrait
        ? "portraits"
        : assetType === "map" || itemImage
          ? "handouts-public"
          : "handouts-private";
    const suffix = extname(file.name)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, "");
    const path = actorPortrait
      ? `${campaignId}/${actorId}/${crypto.randomUUID()}${suffix}`
      : itemImage
        ? `${campaignId}/items/${itemId}/${crypto.randomUUID()}${suffix}`
        : `${campaignId}/${assetType}/${crypto.randomUUID()}${suffix}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        campaign_id: campaignId,
        owner_user_id: user.id,
        asset_type: actorPortrait ? "portrait" : itemImage ? "image" : assetType,
        title,
        storage_bucket: bucket,
        storage_path: path,
        mime_type: file.type,
        byte_size: file.size,
        visibility: assetType === "map" || itemImage ? "campaign" : "gm_only",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (assetType === "portrait") {
      if (!/^[0-9a-f-]{36}$/i.test(characterId)) throw new Error("Personagem inválido.");
      const { error: characterError } = await supabase
        .from("characters")
        .update({ portrait_path: path, updated_at: new Date().toISOString() })
        .eq("id", characterId)
        .eq("campaign_id", campaignId);
      if (characterError) throw new Error(characterError.message);
      const { error: actorError } = await supabase
        .from("actors")
        .update({ public_portrait_path: path, updated_at: new Date().toISOString() })
        .eq("character_id", characterId)
        .eq("campaign_id", campaignId);
      if (actorError) throw new Error(actorError.message);
    }
    if (assetType === "actor_portrait") {
      const { error: actorError } = await supabase
        .from("actors")
        .update({ public_portrait_path: path, updated_at: new Date().toISOString() })
        .eq("id", actorId)
        .eq("campaign_id", campaignId);
      if (actorError) throw new Error(actorError.message);
      await supabase
        .from("actor_media")
        .update({ is_primary: false })
        .eq("actor_id", actorId)
        .eq("purpose", "portrait");
      const { error: mediaLinkError } = await supabase.from("actor_media").insert({
        campaign_id: campaignId,
        actor_id: actorId,
        media_asset_id: data.id,
        purpose: "portrait",
        is_primary: true,
      });
      if (mediaLinkError) throw new Error(mediaLinkError.message);
    }
    if (assetType === "map") {
      if (!/^[0-9a-f-]{36}$/i.test(sceneId)) throw new Error("Cena inválida.");
      const { error: sceneError } = await supabase
        .from("game_scenes")
        .update({
          map_asset_id: data.id,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sceneId)
        .eq("campaign_id", campaignId);
      if (sceneError) throw new Error(sceneError.message);
    }
    if (itemImage) {
      const { error: itemError } = await supabase
        .from("items")
        .update({ image_path: path, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("campaign_id", campaignId);
      if (itemError) throw new Error(itemError.message);
    }
    await supabase.from("audit_events").insert({
      campaign_id: campaignId,
      actor_user_id: user.id,
      entity_type:
        assetType === "map"
          ? "game_scene"
          : actorPortrait
            ? "actor"
            : itemImage
              ? "item"
              : "character",
      entity_id:
        assetType === "map"
          ? sceneId
          : actorPortrait
            ? actorId
            : itemImage
              ? itemId
              : characterId || data.id,
      event_type:
        assetType === "map"
          ? "scene_map_updated"
          : itemImage
            ? "item_image_updated"
            : "portrait_updated",
      visibility: "gm_only",
      after_data: { mediaAssetId: data.id, assetType, title },
      metadata: { storageBucket: bucket },
      idempotency_key: crypto.randomUUID(),
    });
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return NextResponse.json(
      {
        ...data,
        signedUrl: signed?.signedUrl ?? null,
        backgroundKey: assetType === "map" ? `${bucket}/${path}` : undefined,
        imagePath: itemImage ? path : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha no envio." },
      { status: 400 },
    );
  }
}
