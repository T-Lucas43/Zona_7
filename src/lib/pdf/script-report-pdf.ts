import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { Zona7Script } from "@/lib/scripts/zona7-parser";

function safe(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    if (!paragraph.trim()) lines.push("");
  }
  return lines;
}

export async function buildScriptReportPdf(input: { campaignName: string; version: number; script: Zona7Script; logo?: Uint8Array }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  let logo: PDFImage | undefined;
  if (input.logo) try { logo = await pdf.embedPng(input.logo); } catch { /* marca textual permanece */ }
  const W = 595.28, H = 841.89, M = 42;
  const ink = rgb(.035, .047, .063), panel = rgb(.075, .09, .115), red = rgb(.78, .08, .14), white = rgb(.96, .97, .98), muted = rgb(.55, .59, .65), purple = rgb(.50, .30, .75);
  const addPage = () => { const page = pdf.addPage([W, H]); page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: ink }); page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: red }); return page; };
  const header = (page: PDFPage, title: string, section: string) => { page.drawText("ZONA 7 // A CONVERGENCIA", { x: M, y: H - 28, size: 7, font: mono, color: muted }); const label = section.toUpperCase(); page.drawText(label, { x: W - M - mono.widthOfTextAtSize(label, 7), y: H - 28, size: 7, font: mono, color: muted }); page.drawText(safe(title), { x: M, y: H - 69, size: 23, font: bold, color: white }); };
  const cover = addPage();
  if (logo) { const scale = Math.min(320 / logo.width, 190 / logo.height); cover.drawImage(logo, { x: (W - logo.width * scale) / 2, y: H - 300, width: logo.width * scale, height: logo.height * scale }); }
  cover.drawText("ROTEIRO OPERACIONAL", { x: M, y: H - 390, size: 10, font: mono, color: red });
  for (const [index, line] of wrap(input.script.title.toUpperCase(), bold, 28, W - 2 * M).slice(0, 3).entries()) cover.drawText(line, { x: M, y: H - 430 - index * 34, size: 28, font: bold, color: white });
  cover.drawText(`${safe(input.campaignName)}  //  VERSAO ${input.version}`, { x: M, y: 125, size: 9, font: mono, color: muted });
  cover.drawText(`Inicio: ${safe(input.script.startNodeId)}  |  Modo: ${safe(input.script.executionMode)}`, { x: M, y: 105, size: 9, font: regular, color: white });

  let page = addPage(); header(page, "Variaveis e estrutura", "referencia do mestre"); let y = H - 108;
  page.drawText("VARIAVEIS EM PORTUGUES", { x: M, y, size: 8, font: mono, color: red }); y -= 22;
  const variables = Object.entries(input.script.variables);
  if (!variables.length) page.drawText("Nenhuma variavel definida.", { x: M, y, size: 9, font: regular, color: muted });
  for (const [name, value] of variables) { page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 24, color: panel }); page.drawText(safe(name), { x: M + 10, y: y + 2, size: 9, font: bold, color: white }); const rendered = safe(typeof value === "string" ? value : JSON.stringify(value)); page.drawText(rendered.slice(0, 70), { x: W / 2, y: y + 2, size: 8, font: mono, color: purple }); y -= 32; }

  for (const [index, node] of input.script.nodes.entries()) {
    const content = String(node.text ?? node.prompt ?? "Sem texto operacional.");
    const contentLines = wrap(content, regular, 9, W - 2 * M - 24);
    const needed = 70 + contentLines.length * 13;
    if (y - needed < 55) { page = addPage(); header(page, input.script.title, "sequencia narrativa"); y = H - 108; }
    page.drawRectangle({ x: M, y: y - needed + 22, width: W - 2 * M, height: needed - 10, color: panel });
    page.drawCircle({ x: M + 15, y: y + 1, size: 10, color: red }); page.drawText(String(index + 1), { x: M + 12, y: y - 2, size: 8, font: bold, color: white });
    page.drawText(safe(node.title ?? node.id), { x: M + 34, y, size: 12, font: bold, color: white });
    const tag = `${node.type} // ${node.id}`.toUpperCase(); page.drawText(safe(tag), { x: M + 34, y: y - 15, size: 7, font: mono, color: purple });
    let lineY = y - 39; for (const line of contentLines) { page.drawText(line, { x: M + 12, y: lineY, size: 9, font: regular, color: white }); lineY -= 13; }
    const edges = input.script.edges.filter((edge) => edge.source === node.id); if (edges.length) page.drawText(`Proximos: ${safe(edges.map((edge) => edge.label ? `${edge.label} -> ${edge.target}` : edge.target).join(" | "))}`, { x: M + 12, y: lineY - 3, size: 7, font: mono, color: muted });
    y -= needed + 10;
  }
  const pages = pdf.getPages(); pages.forEach((item, index) => { const label = `${String(index + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`; item.drawText(label, { x: W - M - mono.widthOfTextAtSize(label, 6), y: 20, size: 6, font: mono, color: muted }); });
  return pdf.save();
}
