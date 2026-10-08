// PDF de un contrato (texto ya renderizado con el formato de src/lib/contracts.ts:
// "# Título", "## Sección", "**negrita**", párrafos separados por línea en blanco),
// con bloque de firmas y, si se firmó electrónicamente, el registro de la firma.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

export interface ContractPdfInput {
  title: string;
  body: string;
  orgName: string;
  includeSignatures: boolean;
  customerName: string;
  customerDocument?: string | null;
  /** Presente solo si se firmó electrónicamente. */
  digital?: {
    signerName: string;
    signerDocument: string;
    signedAt: string;
    ip?: string | null;
    userAgent?: string | null;
    sha256: string;
    signaturePng?: Uint8Array | null;
    timeZone?: string | null;
  } | null;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 68;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 72;
const BODY_SIZE = 11;
const LINE = 15.5;
const TEXT = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.35, 0.35, 0.35);

// Las fuentes estándar solo codifican WinAnsi: se descarta lo demás (emoji, etc.).
function sanitize(s: string): string {
  return s
    .replace(/[\u2010-\u2012]/g, "-")
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, "");
}

interface Run { text: string; bold: boolean }
/** Palabra = runs pegados (p. ej. "**Gómez**," es negrita + coma sin espacio). */
type Word = Run[];

function toWords(line: string, forceBold = false): Word[] {
  const words: Word[] = [];
  let spaceBefore = true;
  line.split("**").forEach((chunk, i) => {
    const bold = forceBold || i % 2 === 1;
    const clean = sanitize(chunk);
    for (const m of clean.matchAll(/\S+/g)) {
      const leading = m.index! > 0 || spaceBefore;
      const run = { text: m[0], bold };
      if (leading || words.length === 0) words.push([run]);
      else words[words.length - 1].push(run);
      spaceBefore = false;
    }
    spaceBefore = clean.length === 0 ? spaceBefore : /\s$/.test(clean);
  });
  return words;
}

class Writer {
  doc: PDFDocument;
  page!: PDFPage;
  y = 0;
  regular: PDFFont;
  bold: PDFFont;

  constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.newPage();
  }

  get width() { return PAGE_W - MARGIN_X * 2; }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_TOP;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN_BOTTOM) this.newPage();
  }

  font(bold: boolean) { return bold ? this.bold : this.regular; }

  wordWidth(w: Word, size: number) {
    return w.reduce((sum, r) => sum + this.font(r.bold).widthOfTextAtSize(r.text, size), 0);
  }

  /** Párrafo justificado con palabras en negrita. */
  paragraph(words: Word[], size = BODY_SIZE, opts: { center?: boolean; justify?: boolean } = {}) {
    const space = this.regular.widthOfTextAtSize(" ", size);
    const lines: Word[][] = [];
    let current: Word[] = [];
    let width = 0;
    for (const w of words) {
      const ww = this.wordWidth(w, size);
      const add = current.length ? space + ww : ww;
      if (current.length && width + add > this.width) {
        lines.push(current);
        current = [w];
        width = ww;
      } else {
        current.push(w);
        width += add;
      }
    }
    if (current.length) lines.push(current);

    const lineH = size * 1.42;
    lines.forEach((line, idx) => {
      this.ensure(lineH);
      const widths = line.map((w) => this.wordWidth(w, size));
      const natural = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
      const isLast = idx === lines.length - 1;
      let x = MARGIN_X;
      let gap = space;
      if (opts.center) x = MARGIN_X + (this.width - natural) / 2;
      else if (opts.justify !== false && !isLast && line.length > 1) {
        gap = space + (this.width - natural) / (line.length - 1);
      }
      line.forEach((w, i) => {
        let rx = x;
        for (const r of w) {
          const f = this.font(r.bold);
          this.page.drawText(r.text, { x: rx, y: this.y - size, size, font: f, color: TEXT });
          rx += f.widthOfTextAtSize(r.text, size);
        }
        x += widths[i] + gap;
      });
      this.y -= lineH;
    });
  }

  gap(h: number) { this.y -= h; }
}

/** Encabezados son líneas sueltas; las demás líneas seguidas forman un párrafo. */
export function parseBlocks(text: string): { kind: "h1" | "h2" | "p"; lines: string[] }[] {
  const blocks: { kind: "h1" | "h2" | "p"; lines: string[] }[] = [];
  let para: string[] | null = null;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { para = null; continue; }
    if (line.startsWith("## ") || line.startsWith("# ")) {
      const h2 = line.startsWith("## ");
      blocks.push({ kind: h2 ? "h2" : "h1", lines: [line.slice(h2 ? 3 : 2)] });
      para = null;
      continue;
    }
    if (!para) { para = []; blocks.push({ kind: "p", lines: para }); }
    para.push(line);
  }
  return blocks;
}

function formatDateTime(iso: string, timeZone?: string | null) {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: timeZone || "America/Bogota",
      dateStyle: "long",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export async function buildContractPdf(input: ContractPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitize(input.title));
  doc.setAuthor(sanitize(input.orgName));
  doc.setCreator("Tails Up");
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const w = new Writer(doc, regular, bold);

  for (const block of parseBlocks(input.body)) {
    if (block.kind === "h1") {
      w.paragraph(toWords(block.lines[0].toUpperCase(), true), 13.5, { center: true });
      w.gap(10);
    } else if (block.kind === "h2") {
      w.gap(4);
      w.ensure(LINE * 2);
      w.paragraph(toWords(block.lines[0], true), 11.5, { justify: false });
      w.gap(2);
    } else {
      for (const line of block.lines) w.paragraph(toWords(line));
      w.gap(7);
    }
  }

  // ── Firmas ──
  if (input.includeSignatures) {
    w.gap(28);
    w.ensure(110);
    const colW = (w.width - 40) / 2;
    const lineY = w.y - 70;
    const cols = [
      { x: MARGIN_X, name: input.orgName, role: "El prestador", detail: "" },
      {
        x: MARGIN_X + colW + 40,
        name: input.digital?.signerName ?? input.customerName,
        role: "El propietario",
        detail: (input.digital?.signerDocument ?? input.customerDocument) ? `Doc. ${input.digital?.signerDocument ?? input.customerDocument}` : "",
      },
    ];
    if (input.digital?.signaturePng) {
      try {
        const img = await doc.embedPng(input.digital.signaturePng);
        const scale = Math.min(colW / img.width, 60 / img.height, 1);
        w.page.drawImage(img, { x: cols[1].x, y: lineY + 4, width: img.width * scale, height: img.height * scale });
      } catch { /* firma ilegible: queda la línea */ }
    }
    for (const c of cols) {
      w.page.drawLine({ start: { x: c.x, y: lineY }, end: { x: c.x + colW, y: lineY }, thickness: 0.8, color: TEXT });
      w.page.drawText(sanitize(c.name), { x: c.x, y: lineY - 14, size: 10.5, font: bold, color: TEXT });
      w.page.drawText(sanitize(c.role + (c.detail ? ` · ${c.detail}` : "")), { x: c.x, y: lineY - 27, size: 9.5, font: regular, color: MUTED });
    }
    w.y = lineY - 40;
  }

  // ── Registro de firma electrónica ──
  if (input.digital) {
    const d = input.digital;
    w.gap(24);
    w.ensure(150);
    w.page.drawLine({ start: { x: MARGIN_X, y: w.y }, end: { x: PAGE_W - MARGIN_X, y: w.y }, thickness: 0.5, color: MUTED });
    w.gap(12);
    w.paragraph(toWords("Registro de firma electrónica", true), 10.5, { justify: false });
    const rows = [
      `Firmante: ${d.signerName} · Documento: ${d.signerDocument}`,
      `Fecha y hora: ${formatDateTime(d.signedAt, d.timeZone)}`,
      d.ip ? `Dirección IP: ${d.ip}` : "",
      d.userAgent ? `Navegador: ${d.userAgent.slice(0, 140)}` : "",
      `Huella SHA-256 del texto firmado: ${d.sha256}`,
      "El firmante aceptó este documento mediante un enlace personal enviado a su correo electrónico, verificó su identidad con su número de documento y consignó su firma manuscrita digital, conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012.",
    ].filter(Boolean);
    for (const r of rows) w.paragraph(toWords(r), 9, { justify: false });
  }

  // ── Pie de página ──
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const title = input.title.length > 80 ? `${input.title.slice(0, 79)}…` : input.title;
    const text = sanitize(`${title} · Página ${i + 1} de ${pages.length}`);
    const size = 8.5;
    const tw = regular.widthOfTextAtSize(text, size);
    p.drawText(text, { x: (PAGE_W - tw) / 2, y: 36, size, font: regular, color: MUTED });
  });

  return await doc.save();
}
