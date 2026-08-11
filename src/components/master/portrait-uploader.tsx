"use client";

import { useState } from "react";
import { Camera, ImageUp } from "lucide-react";

export function PortraitUploader({
  campaignId,
  characterId,
  characterName,
  initialUrl,
}: {
  campaignId: string;
  characterId: string;
  characterName: string;
  initialUrl?: string;
}) {
  const [preview, setPreview] = useState(initialUrl ?? "");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5_242_880) return setNotice("O retrato deve ter no máximo 5 MB.");
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setSending(true);
    const form = new FormData();
    form.set("campaignId", campaignId);
    form.set("characterId", characterId);
    form.set("assetType", "portrait");
    form.set("title", `Retrato de ${characterName}`);
    form.set("file", file);
    const response = await fetch("/api/master/media", { method: "POST", body: form });
    const result = (await response.json()) as { signedUrl?: string; error?: string };
    setSending(false);
    if (!response.ok) return setNotice(result.error ?? "Falha ao salvar retrato.");
    if (result.signedUrl) setPreview(result.signedUrl);
    setNotice("Retrato salvo na ficha e registrado na auditoria.");
  }

  return (
    <section className="rounded border border-[#30333a] bg-black/15 p-3 md:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#5b3036] bg-[#25161a]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="size-full object-cover"
              src={preview}
              alt={`Retrato de ${characterName}`}
            />
          ) : (
            <Camera size={27} className="text-[#a34a53]" />
          )}
        </div>
        <div className="min-w-56 flex-1">
          <strong className="text-sm">Foto e retrato do personagem</strong>
          <p className="mt-1 text-xs text-[#777a82]">
            PNG, JPG ou WebP · até 5 MB · acesso protegido.
          </p>
          <label className="btn mt-3 cursor-pointer">
            <ImageUp size={14} /> {sending ? "Enviando..." : "Escolher nova imagem"}
            <input
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={sending}
              onChange={(event) => void upload(event)}
            />
          </label>
          {notice && (
            <p className="mt-2 text-xs text-[#7bd5a5]" role="status">
              {notice}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
