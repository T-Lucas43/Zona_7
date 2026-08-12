import { getCharacterSheetVisibility } from "@/lib/character-visibility";
import { getCurrentUser, roleCanAccess } from "@/lib/auth/session";
import { buildCharacterSheetPdf } from "@/lib/pdf/character-sheet-pdf";
import {
  getAuthorizedCharacter,
  getCharacterAbilities,
  getCharacterActions,
  getCharacterInventory,
  getCharacterSkills,
  getCharacterWeaknesses,
} from "@/server/repositories/character-repository";
import { requireCampaignMaster } from "@/server/services/master-access";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allFields = [
  "portrait", "codename", "origin", "class", "path", "nex", "status", "role",
  "defense", "movement", "attributes", "meter", "conditions",
];
const allSections = ["resources", "skills", "combat", "abilities", "weaknesses", "inventory"];

function pdfFileName(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `ficha-${normalized || "personagem"}-zona-7.pdf`;
}

async function loadPortrait(url?: string) {
  if (!url) return undefined;
  try {
    const portraitUrl = new URL(url);
    const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null;
    if (!storageOrigin || portraitUrl.origin !== storageOrigin || portraitUrl.protocol !== "https:") return undefined;
    const response = await fetch(portraitUrl, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const mimeType = response.headers.get("content-type")?.split(";")[0];
    const length = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || !["image/png", "image/jpeg", "image/webp"].includes(mimeType ?? "") || length > 5_000_000) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 5_000_000) return undefined;
    const optimized = await sharp(bytes)
      .rotate()
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    return { bytes: new Uint8Array(optimized), mimeType: "image/jpeg" as const };
  } catch {
    return undefined;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const { characterId } = await params;
    const character = await getAuthorizedCharacter(characterId);
    if (!character) return Response.json({ error: "Ficha não encontrada ou não autorizada." }, { status: 404 });

    const master = roleCanAccess(user.role, "master");
    if (master) {
      if (!character.campaignId) return Response.json({ error: "Campanha da ficha não encontrada." }, { status: 404 });
      await requireCampaignMaster(character.campaignId);
    }
    const visibility = master
      ? { fields: allFields, sections: allSections }
      : getCharacterSheetVisibility(character);

    const [skills, actions, abilities, inventory, weaknesses, portrait] = await Promise.all([
      visibility.sections.includes("skills") ? getCharacterSkills(character.id) : Promise.resolve([]),
      visibility.sections.includes("combat") ? getCharacterActions(character.id) : Promise.resolve([]),
      visibility.sections.includes("abilities") ? getCharacterAbilities(character.id) : Promise.resolve([]),
      visibility.sections.includes("inventory") ? getCharacterInventory(character.id) : Promise.resolve([]),
      visibility.sections.includes("weaknesses") ? getCharacterWeaknesses(character.id) : Promise.resolve([]),
      visibility.fields.includes("portrait") ? loadPortrait(character.portraitUrl) : Promise.resolve(undefined),
    ]);
    const pdfAbilities = master ? abilities : abilities.map((ability) => ability.state === "sealed" ? {
      ...ability,
      name: "Habilidade ainda não revelada",
      description: "O mestre ainda não disponibilizou as informações desta habilidade.",
      costs: {},
      limit: undefined,
    } : ability);
    const bytes = await buildCharacterSheetPdf({
      character,
      audience: master ? "master" : "player",
      visibleFields: visibility.fields,
      visibleSections: visibility.sections,
      portrait,
      details: { skills, actions, abilities: pdfAbilities, inventory, weaknesses },
    });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const fileName = pdfFileName(character.name);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar a ficha em PDF." },
      { status: 400 },
    );
  }
}
