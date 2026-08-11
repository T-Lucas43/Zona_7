import { extname } from "node:path";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { requireCampaignMaster } from "@/server/services/master-access";

export const runtime = "nodejs";

function asAssistedDraft(raw: string, fileName: string) {
  const clean = raw
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, 1_800_000);
  if (clean.length < 2) throw new Error("Nenhum texto legível foi encontrado no arquivo.");
  const title = fileName.replace(/\.[^.]+$/, "").trim() || "Roteiro importado";
  const slug =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "roteiro-importado";
  const body = clean
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
  return `---
zona7_script_version: 1
id: ${slug}
title: ${JSON.stringify(title)}
execution_mode: manual
start: conteudo_importado
variables: {}
---
:::zona7
id: conteudo_importado
type: narration
title: ${JSON.stringify(title)}
text: |-
${body}
next: encerramento
:::
:::zona7
id: encerramento
type: session_end
title: Encerramento
:::`;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const campaignId = String(form.get("campaignId") ?? "");
    const file = form.get("file");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) throw new Error("Campanha inválida.");
    await requireCampaignMaster(campaignId);
    if (!(file instanceof File)) throw new Error("Selecione um arquivo.");
    if (file.size > 15_728_640) throw new Error("O arquivo ultrapassa 15 MB.");
    const extension = extname(file.name).toLowerCase();
    const buffer = await file.arrayBuffer();
    let text: string;
    if (extension === ".docx") {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      text = result.value;
    } else if (extension === ".pdf") {
      const result = await extractText(new Uint8Array(buffer), { mergePages: true });
      text = String(result.text);
    } else if (extension === ".txt") {
      text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    } else {
      throw new Error("Use um arquivo TXT, DOCX ou PDF para a importação assistida.");
    }
    return NextResponse.json({
      source: asAssistedDraft(text, file.name),
      format: "markdown",
      warning: "Rascunho extraído sem executar ações. Revise os nós antes de validar e publicar.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao extrair o roteiro." },
      { status: 400 },
    );
  }
}
