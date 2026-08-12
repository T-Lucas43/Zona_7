import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { CharacterSummary } from "@/types/domain";

export type CharacterPdfDetails = {
  skills: Array<{ id: string; name: string; attribute: string; bonus: number; training: string; notes?: string }>;
  actions: Array<{ id: string; name: string; test: string; damage: string; range: string; type: string; description?: string }>;
  abilities: Array<{ id: string; name: string; actionType: string; description: string; state: string; costs: Record<string, string | undefined>; limit?: string }>;
  inventory: Array<{ id: string; name: string; detail: string; state: string }>;
  weaknesses: Array<{ id: string; name: string; effect: string; active: boolean }>;
};

export type CharacterPdfInput = {
  character: CharacterSummary;
  details: CharacterPdfDetails;
  visibleFields: string[];
  visibleSections: string[];
  audience: "master" | "player";
  generatedAt?: Date;
  portrait?: { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" };
};

const W = 595.28;
const H = 841.89;
const M = 38;
const CW = W - M * 2;
const dark = rgb(0.045, 0.052, 0.063);
const darkPanel = rgb(0.125, 0.14, 0.17);
const ink = rgb(0.095, 0.105, 0.12);
const muted = rgb(0.38, 0.39, 0.42);
const lightMuted = rgb(0.65, 0.67, 0.71);
const paper = rgb(0.965, 0.952, 0.925);
const panel = rgb(0.9, 0.88, 0.84);
const line = rgb(0.74, 0.72, 0.68);
const red = rgb(0.69, 0.09, 0.14);
const white = rgb(0.98, 0.98, 0.97);

function safeText(value: unknown) {
  return String(value ?? "").normalize("NFC")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-")
    .replace(/·/g, "|")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const result: string[] = [];
  for (const paragraph of safeText(text).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { result.push(""); continue; }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else { if (current) result.push(current); current = word; }
    }
    if (current) result.push(current);
  }
  return result;
}

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

function field(input: CharacterPdfInput, name: string) {
  return input.audience === "master" || input.visibleFields.includes(name);
}

function section(input: CharacterPdfInput, name: string) {
  return input.audience === "master" || input.visibleSections.includes(name);
}

export async function buildCharacterSheetPdf(input: CharacterPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ficha de ${safeText(input.character.name)} - Zona 7`);
  pdf.setAuthor("Zona 7 - Terminal");
  pdf.setSubject(input.audience === "master" ? "Ficha completa do mestre" : "Ficha autorizada do jogador");
  pdf.setCreator("Zona 7 - Terminal");
  pdf.setProducer("Zona 7 - Terminal");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  let portrait: PDFImage | undefined;
  if (input.portrait) {
    try { portrait = input.portrait.mimeType === "image/png" ? await pdf.embedPng(input.portrait.bytes) : await pdf.embedJpg(input.portrait.bytes); } catch { portrait = undefined; }
  }
  const pages: PDFPage[] = [];

  function addPage(background = paper) {
    const page = pdf.addPage([W, H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: background });
    return page;
  }

  function lightHeader(page: PDFPage, title: string, category: string) {
    page.drawRectangle({ x: 0, y: H - 40, width: W, height: 40, color: ink });
    page.drawRectangle({ x: 0, y: H - 42, width: W, height: 3, color: red });
    page.drawText("ZONA 7 // A CONVERGÊNCIA", { x: M, y: H - 25, size: 6.2, font: mono, color: lightMuted });
    page.drawText(safeText(category).toUpperCase(), { x: W - M - mono.widthOfTextAtSize(safeText(category).toUpperCase(), 6.2), y: H - 25, size: 6.2, font: mono, color: lightMuted });
    page.drawText(safeText(title).toUpperCase(), { x: M, y: H - 82, size: 21, font: bold, color: ink });
  }

  function drawLines(page: PDFPage, lines: string[], x: number, y: number, size: number, leading: number, font = regular, color = ink) {
    lines.forEach((text, index) => page.drawText(text, { x, y: y - index * leading, size, font, color }));
  }

  function drawCoverPortrait(page: PDFPage, x: number, y: number, width: number, height: number) {
    page.drawRectangle({ x, y, width, height, color: rgb(0.09, 0.1, 0.12), borderColor: red, borderWidth: 1.2 });
    if (portrait) {
      const scale = Math.min(width / portrait.width, height / portrait.height);
      const imageW = portrait.width * scale;
      const imageH = portrait.height * scale;
      page.drawImage(portrait, { x: x + (width - imageW) / 2, y: y + (height - imageH) / 2, width: imageW, height: imageH });
    } else {
      const initials = safeText(input.character.name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
      page.drawText(initials, { x: x + width / 2 - bold.widthOfTextAtSize(initials, 20) / 2, y: y + height / 2 - 7, size: 20, font: bold, color: white });
    }
  }

  // Page 1: dense operational sheet, deliberately bounded to one page.
  const first = addPage(dark);
  first.drawRectangle({ x: 0, y: H - 38, width: W, height: 38, color: rgb(0.08, 0.09, 0.11) });
  first.drawRectangle({ x: 0, y: H - 40, width: W, height: 3, color: red });
  first.drawText("ZONA 7 // A CONVERGÊNCIA", { x: M, y: H - 24, size: 6.3, font: mono, color: lightMuted });
  const typeLabel = input.audience === "master" ? "FICHA COMPLETA // MESTRE" : "FICHA LIBERADA // JOGADOR";
  first.drawText(typeLabel, { x: W - M - mono.widthOfTextAtSize(typeLabel, 6.3), y: H - 24, size: 6.3, font: mono, color: lightMuted });

  if (field(input, "portrait")) drawCoverPortrait(first, M, H - 164, 116, 106);
  const titleX = field(input, "portrait") ? M + 132 : M;
  first.drawText(safeText(input.character.name).toUpperCase(), { x: titleX, y: H - 79, size: 24, font: bold, color: white });
  const subtitle = [
    field(input, "codename") ? input.character.codename : null,
    field(input, "origin") ? input.character.origin : null,
    field(input, "class") ? input.character.className : null,
    field(input, "path") ? input.character.path : null,
  ].filter(Boolean).join(" // ");
  drawLines(first, wrap(subtitle, mono, 6.5, W - M - titleX), titleX, H - 98, 6.5, 9, mono, rgb(0.93, 0.34, 0.4));
  const heroFacts = [
    field(input, "nex") ? `NEX ${input.character.nex}%` : null,
    field(input, "status") ? safeText(input.character.status) : null,
    field(input, "role") ? safeText(input.character.role) : null,
    field(input, "affinities") && input.character.affinities?.length ? input.character.affinities.join(" + ") : null,
  ].filter(Boolean).join("  |  ");
  drawLines(first, wrap(heroFacts, regular, 6.5, W - M - titleX), titleX, H - 119, 6.5, 9, regular, white);
  const profile = field(input, "description") ? input.character.shortDescription : undefined;
  if (profile) drawLines(first, wrap(profile, regular, 6.2, W - M - titleX), titleX, H - 140, 6.2, 8, regular, lightMuted);

  let y = H - 184;
  if (field(input, "attributes")) {
    first.drawText("ATRIBUTOS", { x: M, y, size: 6.5, font: mono, color: rgb(0.94, 0.31, 0.38) });
    y -= 12;
    const attrs = Object.entries(input.character.attributes);
    const cellW = (CW - 16) / 5;
    attrs.forEach(([name, value], index) => {
      const x = M + index * (cellW + 4);
      first.drawRectangle({ x, y: y - 43, width: cellW, height: 43, color: darkPanel, borderColor: rgb(0.22, 0.24, 0.28), borderWidth: 0.6 });
      first.drawText(name.toUpperCase(), { x: x + 7, y: y - 13, size: 5.7, font: mono, color: rgb(0.96, 0.35, 0.42) });
      first.drawText(String(value), { x: x + 7, y: y - 35, size: 15, font: bold, color: white });
    });
    y -= 57;
  }

  first.drawText("RECURSOS E PARÂMETROS", { x: M, y, size: 6.5, font: mono, color: rgb(0.94, 0.31, 0.38) });
  y -= 12;
  const stats: Array<[string, string]> = [];
  if (section(input, "resources")) Object.values(input.character.resources).forEach((resource) => stats.push([`${resource.kind.toUpperCase()} ATUAL / MÁX.`, `${resource.current} / ${resource.maximum}`]));
  if (field(input, "defense")) stats.push(["DEFESA", String(input.character.defense)]);
  if (field(input, "block")) stats.push(["BLOQUEIO", String(input.character.blockValue ?? 0)]);
  if (field(input, "dodge")) stats.push(["ESQUIVA", String(input.character.dodgeValue ?? 0)]);
  if (field(input, "movement")) stats.push(["DESLOC.", `${input.character.movement ?? 0} m`]);
  if (field(input, "main_dc")) stats.push(["DT PRINCIPAL", String(input.character.mainDc ?? 0)]);
  if (field(input, "pe_per_turn")) stats.push(["PE / TURNO", String(input.character.pePerTurn ?? 0)]);
  const statsCols = 5;
  const statW = (CW - (statsCols - 1) * 4) / statsCols;
  stats.forEach(([label, value], index) => {
    const row = Math.floor(index / statsCols);
    const col = index % statsCols;
    const x = M + col * (statW + 4);
    const top = y - row * 41;
    first.drawRectangle({ x, y: top - 36, width: statW, height: 36, color: darkPanel });
    first.drawRectangle({ x, y: top - 36, width: 3, height: 36, color: red });
    first.drawText(label, { x: x + 8, y: top - 12, size: 4.8, font: mono, color: lightMuted });
    first.drawText(value, { x: x + 8, y: top - 29, size: 10.5, font: bold, color: white });
  });
  y -= Math.ceil(stats.length / statsCols) * 41 + 8;

  if (field(input, "resistances")) {
    const saves = Object.entries(input.character.resistances ?? {}).map(([name, value]) => `${name.toUpperCase()} +${value}`).join("   |   ");
    first.drawText(`RESISTÊNCIAS  ${saves}`, { x: M, y, size: 6.1, font: mono, color: lightMuted });
    y -= 17;
  }

  if (section(input, "skills") && input.details.skills.length) {
    first.drawText("PERÍCIAS", { x: M, y, size: 6.5, font: mono, color: rgb(0.94, 0.31, 0.38) });
    y -= 10;
    const skillText = input.details.skills.map((skill) => `${skill.name} +${skill.bonus}`).join("  |  ");
    const lines = wrap(skillText, regular, 6, CW - 18);
    const h = Math.max(31, lines.length * 8 + 14);
    first.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: darkPanel });
    drawLines(first, lines, M + 9, y - 13, 6, 8, regular, white);
    y -= h + 12;
  }

  if (section(input, "combat") && input.details.actions.length) {
    first.drawText("ATAQUES E AÇÕES", { x: M, y, size: 6.5, font: mono, color: rgb(0.94, 0.31, 0.38) });
    y -= 12;
    const columns = [0, 0.4, 0.58, 0.71, 0.86].map((ratio) => M + CW * ratio);
    const labels = ["AÇÃO", "TESTE", "DANO", "ALCANCE", "TIPO"];
    first.drawRectangle({ x: M, y: y - 17, width: CW, height: 17, color: rgb(0.1, 0.11, 0.13) });
    labels.forEach((label, index) => first.drawText(label, { x: columns[index] + 5, y: y - 11, size: 5.2, font: mono, color: rgb(0.95, 0.3, 0.37) }));
    y -= 17;
    input.details.actions.forEach((action, index) => {
      const rowH = 18;
      if (index % 2 === 0) first.drawRectangle({ x: M, y: y - rowH, width: CW, height: rowH, color: darkPanel });
      [action.name, action.test, action.damage, action.range, action.type].forEach((value, col) => {
        const max = col === 0 ? CW * 0.38 : CW * (col === 4 ? 0.14 : 0.15);
        const text = wrap(value, regular, 5.6, max - 7)[0] ?? "";
        first.drawText(text, { x: columns[col] + 5, y: y - 12, size: 5.6, font: regular, color: white });
      });
      y -= rowH;
    });
    y -= 11;
  }

  if (field(input, "meter")) {
    first.drawText(safeText(input.character.meter.name).toUpperCase(), { x: M, y, size: 6.5, font: mono, color: rgb(0.94, 0.31, 0.38) });
    y -= 11;
    const meterW = (CW - Math.max(input.character.meter.stages.length - 1, 0) * 4) / Math.max(input.character.meter.stages.length, 1);
    input.character.meter.stages.forEach((stage, index) => {
      const x = M + index * (meterW + 4);
      first.drawRectangle({ x, y: y - 24, width: meterW, height: 24, color: index <= input.character.meter.value ? red : darkPanel });
      const text = wrap(stage, mono, 4.5, meterW - 8)[0] ?? String(index);
      first.drawText(text.toUpperCase(), { x: x + 4, y: y - 15, size: 4.5, font: mono, color: white });
    });
  }

  const abilityPages = section(input, "abilities") ? chunks(input.details.abilities, 6) : [];
  abilityPages.forEach((abilities, chunkIndex) => {
    const page = addPage();
    lightHeader(page, chunkIndex ? `Habilidades de ${input.character.name} (continuação)` : `Habilidades de ${input.character.name}`, "habilidades e combate");
    const subtitle = field(input, "tagline") && input.character.tagline ? input.character.tagline : "Descrição, custo, estado e limite de uso das habilidades liberadas.";
    drawLines(page, wrap(subtitle, regular, 6.5, CW), M, H - 100, 6.5, 9, regular, muted);
    const cardW = (CW - 16) / 2;
    const cardH = 196;
    abilities.forEach((ability, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = M + col * (cardW + 16);
      const top = H - 126 - row * (cardH + 14);
      page.drawRectangle({ x, y: top - cardH, width: cardW, height: cardH, color: panel, borderColor: line, borderWidth: 0.7 });
      page.drawRectangle({ x, y: top - 28, width: cardW, height: 28, color: ink });
      page.drawCircle({ x: x + 16, y: top - 14, size: 9, color: red });
      const no = String(chunkIndex * 6 + index + 1);
      page.drawText(no, { x: x + 16 - bold.widthOfTextAtSize(no, 7) / 2, y: top - 16.5, size: 7, font: bold, color: white });
      page.drawText(safeText(ability.name).toUpperCase(), { x: x + 30, y: top - 17, size: 7.5, font: bold, color: white });
      const costs = Object.entries(ability.costs).flatMap(([kind, value]) => value ? [`${value} ${kind.toUpperCase()}`] : []).join(" | ");
      const meta = [ability.actionType, costs, ability.limit, ability.state].filter(Boolean).join("  |  ");
      drawLines(page, wrap(meta.toUpperCase(), mono, 4.7, cardW - 16), x + 8, top - 42, 4.7, 6, mono, red);
      let bodySize = 6.1;
      let bodyLines = wrap(ability.description, regular, bodySize, cardW - 18);
      while (bodyLines.length > 18 && bodySize > 4.3) {
        bodySize -= 0.3;
        bodyLines = wrap(ability.description, regular, bodySize, cardW - 18);
      }
      drawLines(page, bodyLines.slice(0, 18), x + 9, top - 64, bodySize, bodySize + 1.5, regular, ink);
    });
  });

  const extraContent = (section(input, "weaknesses") && input.details.weaknesses.length > 0)
    || (section(input, "inventory") && input.details.inventory.length > 0)
    || (field(input, "public_history") && Boolean(input.character.publicHistory));
  if (extraContent) {
    const weakChunks = section(input, "weaknesses") ? chunks(input.details.weaknesses, 6) : [];
    const pagesNeeded = Math.max(1, weakChunks.length);
    for (let pageIndex = 0; pageIndex < pagesNeeded; pageIndex += 1) {
      const page = addPage();
      lightHeader(page, pageIndex ? "Fraquezas e controle (continuação)" : "Fraquezas, inventário e controle", "dossiê operacional");
      let top = H - 116;
      const weaknesses = weakChunks[pageIndex] ?? [];
      if (weaknesses.length) {
        const cardW = (CW - 16) / 2;
        const cardH = 116;
        weaknesses.forEach((weakness, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = M + col * (cardW + 16);
          const cardTop = top - row * (cardH + 12);
          page.drawRectangle({ x, y: cardTop - cardH, width: cardW, height: cardH, color: panel, borderColor: line, borderWidth: 0.7 });
          page.drawCircle({ x: x + 13, y: cardTop - 14, size: 8, color: red });
          page.drawText(String(pageIndex * 6 + index + 1), { x: x + 10.7, y: cardTop - 16.5, size: 6.5, font: bold, color: white });
          page.drawText(safeText(weakness.name).toUpperCase(), { x: x + 26, y: cardTop - 17, size: 7, font: bold, color: red });
          page.drawText(weakness.active ? "ATIVA" : "INATIVA", { x: x + cardW - 36, y: cardTop - 17, size: 4.8, font: mono, color: muted });
          let effectSize = 5.8;
          let effectLines = wrap(weakness.effect, regular, effectSize, cardW - 18);
          while (effectLines.length > 11 && effectSize > 4.3) {
            effectSize -= 0.3;
            effectLines = wrap(weakness.effect, regular, effectSize, cardW - 18);
          }
          drawLines(page, effectLines.slice(0, 11), x + 9, cardTop - 37, effectSize, effectSize + 1.4, regular, ink);
        });
        top -= Math.ceil(weaknesses.length / 2) * (cardH + 12) + 3;
      }
      if (pageIndex === 0 && section(input, "inventory") && input.details.inventory.length) {
        page.drawText("INVENTÁRIO", { x: M, y: top, size: 8, font: bold, color: ink });
        top -= 13;
        const itemW = (CW - 12) / 3;
        input.details.inventory.slice(0, 9).forEach((item, index) => {
          const col = index % 3;
          const row = Math.floor(index / 3);
          const x = M + col * (itemW + 6);
          const itemTop = top - row * 45;
          page.drawRectangle({ x, y: itemTop - 39, width: itemW, height: 39, color: rgb(0.92, 0.9, 0.86) });
          page.drawText(safeText(item.name), { x: x + 7, y: itemTop - 13, size: 6.3, font: bold, color: ink });
          page.drawText(safeText(`${item.detail} | ${item.state}`), { x: x + 7, y: itemTop - 28, size: 5.1, font: regular, color: muted });
        });
        top -= Math.ceil(Math.min(input.details.inventory.length, 9) / 3) * 45 + 5;
      }
      if (pageIndex === 0 && field(input, "public_history") && input.character.publicHistory && top > 92) {
        page.drawText("HISTÓRIA PÚBLICA", { x: M, y: top, size: 8, font: bold, color: ink });
        top -= 13;
        page.drawRectangle({ x: M, y: 55, width: CW, height: Math.max(35, top - 55), color: panel, borderColor: line, borderWidth: 0.7 });
        drawLines(page, wrap(input.character.publicHistory, regular, 6.1, CW - 18).slice(0, 22), M + 9, top - 10, 6.1, 8, regular, ink);
      }
    }
  }

  const generatedAt = input.generatedAt ?? new Date();
  pages.forEach((page, index) => {
    const darkPage = index === 0;
    const footerColor = darkPage ? lightMuted : muted;
    page.drawText(`ZONA 7 // ${safeText(input.character.name).toUpperCase()} // ${generatedAt.toLocaleDateString("pt-BR")}`, { x: M, y: 20, size: 5.2, font: mono, color: footerColor });
    const label = `${String(index + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`;
    page.drawText(label, { x: W - M - mono.widthOfTextAtSize(label, 5.2), y: 20, size: 5.2, font: mono, color: footerColor });
  });
  return pdf.save();
}
