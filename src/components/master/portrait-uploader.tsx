"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, PersonStanding } from "lucide-react";

type ImageKind = "sheet" | "map";

const imageSettings = {
  sheet: {
    title: "Foto da ficha",
    description: "Retrato usado na ficha, no perfil, nas listas e no PDF.",
    success: "Foto da ficha salva e publicada nos locais autorizados.",
    assetType: "portrait",
  },
  map: {
    title: "Imagem de corpo inteiro para o mapa",
    description: "Usada no token do mapa e na iniciativa. Prefira PNG ou WebP com fundo transparente.",
    success: "Imagem do mapa salva. O token e a iniciativa já usarão a foto de corpo inteiro.",
    assetType: "character_map_portrait",
  },
} as const;

function CharacterImageUploader({
  campaignId,
  characterId,
  characterName,
  initialUrl,
  kind,
}: {
  campaignId: string;
  characterId: string;
  characterName: string;
  initialUrl?: string;
  kind: ImageKind;
}) {
  const settings = imageSettings[kind];
  const [preview, setPreview] = useState(initialUrl ?? "");
  const [notice, setNotice] = useState("");
  const [successful, setSuccessful] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("");
    setSuccessful(false);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      event.target.value = "";
      return setNotice("Formato inválido. Use PNG, JPG ou WebP.");
    }
    if (file.size > 5_242_880) {
      event.target.value = "";
      return setNotice("A imagem deve ter no máximo 5 MB.");
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setSending(true);
    try {
      const form = new FormData();
      form.set("campaignId", campaignId);
      form.set("characterId", characterId);
      form.set("assetType", settings.assetType);
      form.set(
        "title",
        kind === "map" ? `Imagem de mapa de ${characterName}` : `Retrato de ${characterName}`,
      );
      form.set("file", file);
      const response = await fetch("/api/master/media", { method: "POST", body: form });
      const result = (await response.json()) as { signedUrl?: string; error?: string };
      if (!response.ok) {
        setPreview(initialUrl ?? "");
        return setNotice(result.error ?? "Falha ao salvar a imagem.");
      }
      if (result.signedUrl) setPreview(result.signedUrl);
      setSuccessful(true);
      setNotice(settings.success);
    } catch {
      setPreview(initialUrl ?? "");
      setNotice("A conexão falhou durante o envio. Tente novamente.");
    } finally {
      URL.revokeObjectURL(localPreview);
      event.target.value = "";
      setSending(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#30333a] bg-black/15 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={
            kind === "map"
              ? "grid h-40 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#5b3036] bg-[linear-gradient(135deg,#22161a_25%,#191b20_25%,#191b20_50%,#22161a_50%,#22161a_75%,#191b20_75%)] bg-[length:16px_16px]"
              : "grid size-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#5b3036] bg-[#25161a]"
          }
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={kind === "map" ? "size-full object-contain object-bottom" : "size-full object-cover"}
              src={preview}
              alt={`${settings.title} de ${characterName}`}
            />
          ) : kind === "map" ? (
            <PersonStanding size={38} className="text-[#a34a53]" />
          ) : (
            <Camera size={30} className="text-[#a34a53]" />
          )}
        </div>
        <div className="min-w-56 flex-1">
          <strong className="text-sm">{settings.title}</strong>
          <p className="mt-1 text-xs leading-5 text-[#8b8f98]">{settings.description}</p>
          <p className="mt-1 text-[0.68rem] text-[#696e78]">PNG, JPG ou WebP · até 5 MB · acesso protegido.</p>
          <button
            className="btn mt-3"
            type="button"
            disabled={sending}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUp size={14} /> {sending ? "Enviando e processando..." : "Escolher imagem"}
          </button>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={sending}
            onChange={(event) => void upload(event)}
          />
          {notice && (
            <p
              className={`mt-2 text-xs ${successful ? "text-[#7bd5a5]" : "text-[#ff8992]"}`}
              role="status"
            >
              {notice}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function PortraitUploader({
  campaignId,
  characterId,
  characterName,
  initialUrl,
  initialMapUrl,
}: {
  campaignId: string;
  characterId: string;
  characterName: string;
  initialUrl?: string;
  initialMapUrl?: string;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <CharacterImageUploader
        campaignId={campaignId}
        characterId={characterId}
        characterName={characterName}
        initialUrl={initialUrl}
        kind="sheet"
      />
      <CharacterImageUploader
        campaignId={campaignId}
        characterId={characterId}
        characterName={characterName}
        initialUrl={initialMapUrl}
        kind="map"
      />
    </div>
  );
}
