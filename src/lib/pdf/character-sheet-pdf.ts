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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ink = rgb(0.075, 0.086, 0.105);
const muted = rgb(0.34, 0.36, 0.4);
const line = rgb(0.82, 0.83, 0.85);
const paper = rgb(0.975, 0.973, 0.965);
const panel = rgb(0.93, 0.925, 0.91);
const red = rgb(0.69, 0.12, 0.18);

function safeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-")
    .replace(/·/g, "|")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = safeText(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function sectionAllowed(input: CharacterPdfInput, section: string) {
  return input.audience === "master" || input.visibleSections.includes(section);
}

function fieldAllowed(input: CharacterPdfInput, field: string) {
  return input.audience === "master" || input.visibleFields.includes(field);
}

export async function buildCharacterSheetPdf(input: CharacterPdfInput) {
  const document = await PDFDocument.create();
  document.setTitle(`Ficha de ${safeText(input.character.name)} - Zona 7`);
  document.setAuthor("Zona 7 - Terminal");
  document.setSubject(input.audience === "master" ? "Ficha completa do mestre" : "Ficha autorizada do jogador");
  document.setCreator("Zona 7 - Terminal");
  document.setProducer("Zona 7 - Terminal");

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const mono = await document.embedFont(StandardFonts.CourierBold);
  let portrait: PDFImage | null = null;
  if (input.portrait) {
    try {
      portrait = input.portrait.mimeType === "image/png"
        ? await document.embedPng(input.portrait.bytes)
        : await document.embedJpg(input.portrait.bytes);
    } catch {
      portrait = null;
    }
  }

  let page!: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];

  function newPage(continuation = false) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: paper });
    if (continuation) {
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 48, width: PAGE_WIDTH, height: 48, color: ink });
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 48, width: 7, height: 48, color: red });
      page.drawText("ZONA 7 / FICHA DE PERSONAGEM", { x: MARGIN, y: PAGE_HEIGHT - 31, size: 9, font: mono, color: rgb(1, 1, 1) });
      page.drawText(safeText(input.character.name).toUpperCase(), { x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(safeText(input.character.name).toUpperCase(), 9), y: PAGE_HEIGHT - 31, size: 9, font: bold, color: rgb(0.85, 0.87, 0.9) });
      y = PAGE_HEIGHT - 74;
    } else y = PAGE_HEIGHT - MARGIN;
  }

  function ensure(height: number) {
    if (y - height < 58) newPage(true);
  }

  function drawSectionTitle(title: string, subtitle?: string) {
    ensure(subtitle ? 48 : 34);
    page.drawRectangle({ x: MARGIN, y: y - 22, width: 4, height: 22, color: red });
    page.drawText(safeText(title).toUpperCase(), { x: MARGIN + 13, y: y - 15, size: 11, font: bold, color: ink });
    y -= 27;
    if (subtitle) {
      page.drawText(safeText(subtitle), { x: MARGIN + 13, y: y - 5, size: 7.5, font: regular, color: muted });
      y -= 16;
    }
  }

  function drawEntry(title: string, meta: string, body?: string) {
    const bodyLines = body ? wrap(body, regular, 8, CONTENT_WIDTH - 24) : [];
    const height = 34 + bodyLines.length * 10;
    ensure(height + 8);
    page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, color: panel, borderColor: line, borderWidth: 0.6 });
    page.drawText(safeText(title), { x: MARGIN + 12, y: y - 16, size: 9.5, font: bold, color: ink });
    const cleanMeta = safeText(meta);
    page.drawText(cleanMeta, { x: PAGE_WIDTH - MARGIN - 12 - regular.widthOfTextAtSize(cleanMeta, 7.2), y: y - 15, size: 7.2, font: regular, color: muted });
    bodyLines.forEach((text, index) => page.drawText(text, { x: MARGIN + 12, y: y - 31 - index * 10, size: 8, font: regular, color: muted }));
    y -= height + 7;
  }

  newPage();
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 142, width: PAGE_WIDTH, height: 142, color: ink });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 142, width: 8, height: 142, color: red });
  page.drawText("Z7", { x: MARGIN, y: PAGE_HEIGHT - 45, size: 22, font: mono, color: rgb(1, 1, 1) });
  page.drawText("ZONA 7 / TERMINAL", { x: MARGIN + 43, y: PAGE_HEIGHT - 40, size: 8, font: mono, color: rgb(0.76, 0.78, 0.82) });
  page.drawText(input.audience === "master" ? "FICHA COMPLETA DO MESTRE" : "FICHA AUTORIZADA DO JOGADOR", { x: MARGIN, y: PAGE_HEIGHT - 67, size: 7.5, font: mono, color: rgb(0.94, 0.42, 0.48) });
  page.drawText(safeText(input.character.name), { x: MARGIN, y: PAGE_HEIGHT - 102, size: 25, font: bold, color: rgb(1, 1, 1) });
  const identity = [
    fieldAllowed(input, "codename") ? input.character.codename : null,
    fieldAllowed(input, "origin") ? input.character.origin : null,
    fieldAllowed(input, "class") ? input.character.className : null,
    fieldAllowed(input, "path") ? input.character.path : null,
  ].filter(Boolean).join(" | ");
  if (identity) page.drawText(safeText(identity), { x: MARGIN, y: PAGE_HEIGHT - 122, size: 8, font: regular, color: rgb(0.74, 0.76, 0.8) });

  if (portrait) {
    const box = 94;
    const scale = Math.min(box / portrait.width, box / portrait.height);
    const width = portrait.width * scale;
    const height = portrait.height * scale;
    page.drawRectangle({ x: PAGE_WIDTH - MARGIN - box, y: PAGE_HEIGHT - 124, width: box, height: box, color: rgb(0.08, 0.09, 0.11) });
    page.drawImage(portrait, { x: PAGE_WIDTH - MARGIN - box + (box - width) / 2, y: PAGE_HEIGHT - 124 + (box - height) / 2, width, height });
    page.drawRectangle({ x: PAGE_WIDTH - MARGIN - box, y: PAGE_HEIGHT - 124, width: box, height: box, borderColor: red, borderWidth: 2 });
  } else if (fieldAllowed(input, "portrait")) {
    page.drawRectangle({ x: PAGE_WIDTH - MARGIN - 82, y: PAGE_HEIGHT - 118, width: 82, height: 82, color: rgb(0.15, 0.16, 0.19), borderColor: red, borderWidth: 1.2 });
    const initials = safeText(input.character.name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    page.drawText(initials, { x: PAGE_WIDTH - MARGIN - 41 - bold.widthOfTextAtSize(initials, 20) / 2, y: PAGE_HEIGHT - 85, size: 20, font: bold, color: rgb(0.92, 0.93, 0.95) });
  }
  y = PAGE_HEIGHT - 170;

  if (sectionAllowed(input, "resources")) {
    drawSectionTitle("Estado atual", "Recursos e parâmetros disponibilizados na ficha");
    const resources = Object.values(input.character.resources);
    const resourceWidth = (CONTENT_WIDTH - 12) / 3;
    resources.forEach((resource, index) => {
      const x = MARGIN + index * (resourceWidth + 6);
      page.drawRectangle({ x, y: y - 44, width: resourceWidth, height: 44, color: panel, borderColor: line, borderWidth: 0.6 });
      page.drawText(resource.kind.toUpperCase(), { x: x + 10, y: y - 15, size: 7, font: mono, color: red });
      page.drawText(`${resource.current} / ${resource.maximum}`, { x: x + 10, y: y - 34, size: 15, font: bold, color: ink });
    });
    y -= 60;
  }

  if (fieldAllowed(input, "attributes")) {
    const attributes = Object.entries(input.character.attributes);
    const width = (CONTENT_WIDTH - 16) / 5;
    attributes.forEach(([key, value], index) => {
      const x = MARGIN + index * (width + 4);
      page.drawRectangle({ x, y: y - 36, width, height: 36, color: rgb(0.965, 0.96, 0.95), borderColor: line, borderWidth: 0.6 });
      page.drawText(key.toUpperCase(), { x: x + 8, y: y - 14, size: 6.5, font: mono, color: muted });
      page.drawText(String(value), { x: x + 8, y: y - 30, size: 13, font: bold, color: ink });
    });
    y -= 49;
  }

  const facts = [
    fieldAllowed(input, "nex") ? `NEX ${input.character.nex}%` : null,
    fieldAllowed(input, "defense") ? `DEFESA ${input.character.defense}` : null,
    fieldAllowed(input, "movement") ? `DESLOCAMENTO ${input.character.movement ?? 0} m` : null,
    fieldAllowed(input, "status") ? `STATUS ${safeText(input.character.status).toUpperCase()}` : null,
    fieldAllowed(input, "meter") ? `${safeText(input.character.meter.name).toUpperCase()} ${input.character.meter.value}` : null,
  ].filter(Boolean).join("   |   ");
  if (facts) {
    ensure(28);
    page.drawText(facts, { x: MARGIN, y: y - 9, size: 7.3, font: mono, color: muted });
    y -= 28;
  }

  if (sectionAllowed(input, "skills") && input.details.skills.length) {
    drawSectionTitle("Perícias");
    input.details.skills.forEach((skill) => drawEntry(skill.name, `${skill.attribute} | +${skill.bonus} | ${skill.training}`, skill.notes));
  }
  if (sectionAllowed(input, "combat") && input.details.actions.length) {
    drawSectionTitle("Combate e ações");
    input.details.actions.forEach((action) => drawEntry(action.name, `${action.test} | ${action.damage} | ${action.range} | ${action.type}`, action.description));
  }
  if (sectionAllowed(input, "abilities") && input.details.abilities.length) {
    drawSectionTitle("Habilidades");
    input.details.abilities.forEach((ability) => {
      const costs = Object.entries(ability.costs).flatMap(([resource, value]) => value ? [`${value} ${resource.toUpperCase()}`] : []).join(", ");
      drawEntry(ability.name, `${ability.actionType} | ${ability.state}${costs ? ` | ${costs}` : ""}${ability.limit ? ` | ${ability.limit}` : ""}`, ability.description);
    });
  }
  if (sectionAllowed(input, "inventory") && input.details.inventory.length) {
    drawSectionTitle("Inventário");
    input.details.inventory.forEach((item) => drawEntry(item.name, item.state, item.detail));
  }
  if (sectionAllowed(input, "weaknesses") && input.details.weaknesses.length) {
    drawSectionTitle("Fraquezas");
    input.details.weaknesses.forEach((weakness) => drawEntry(weakness.name, weakness.active ? "ATIVA" : "INATIVA", weakness.effect));
  }

  const generatedAt = input.generatedAt ?? new Date();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_WIDTH - MARGIN, y: 38 }, thickness: 0.5, color: line });
    currentPage.drawText(`Zona 7 - ${safeText(input.character.name)} - ${generatedAt.toLocaleString("pt-BR")}`, { x: MARGIN, y: 23, size: 6.5, font: regular, color: muted });
    const label = `${index + 1} / ${pages.length}`;
    currentPage.drawText(label, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(label, 6.5), y: 23, size: 6.5, font: regular, color: muted });
  });

  return document.save();
}
