export type PdfColumn = {
  label: string;
  width: number;
};

export type TablePdfOptions = {
  title: string;
  subtitle: string;
  columns: PdfColumn[];
  rows: Array<Array<unknown>>;
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function ascii(value: unknown) {
  const source = value == null || value === "" ? "-" : String(value);
  return source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?");
}

function pdfString(value: unknown) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: unknown, width: number, fontSize: number) {
  const text = ascii(value);
  const max = Math.max(4, Math.floor(width / (fontSize * .52)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words.length ? words : ["-"]) {
    if (word.length > max) {
      if (line) { lines.push(line); line = ""; }
      for (let start = 0; start < word.length; start += max) lines.push(word.slice(start, start + max));
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

function text(command: string[], value: unknown, x: number, y: number, size = 9, bold = false, colour = "0.20 0.17 0.18") {
  command.push(`${colour} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfString(value)}) Tj ET`);
}

function line(command: string[], x1: number, y1: number, x2: number, y2: number, colour = "0.86 0.79 0.80", width = .5) {
  command.push(`${colour} RG ${width} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
}

function rect(command: string[], x: number, y: number, width: number, height: number, colour: string) {
  command.push(`${colour} rg ${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re f`);
}

function normaliseWidths(columns: PdfColumn[]) {
  const total = columns.reduce((sum, column) => sum + Math.max(1, column.width), 0);
  return columns.map((column) => ({ ...column, width: CONTENT_WIDTH * Math.max(1, column.width) / total }));
}

export function createTablePdf({ title, subtitle, columns, rows }: TablePdfOptions) {
  const fitted = normaliseWidths(columns);
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const drawHeader = () => {
    rect(commands, MARGIN, PAGE_HEIGHT - 70, CONTENT_WIDTH, 30, "0.47 0.15 0.29");
    text(commands, "E & H", MARGIN + 12, PAGE_HEIGHT - 60, 19, true, "1 1 1");
    text(commands, title, MARGIN + 105, PAGE_HEIGHT - 57, 14, true, "1 1 1");
    text(commands, subtitle, MARGIN + 105, PAGE_HEIGHT - 69, 7.5, false, "0.96 0.88 0.90");
    y = PAGE_HEIGHT - 92;
    rect(commands, MARGIN, y - 24, CONTENT_WIDTH, 24, "0.96 0.91 0.91");
    let x = MARGIN;
    fitted.forEach((column) => {
      text(commands, column.label.toUpperCase(), x + 6, y - 16, 7.5, true, "0.43 0.16 0.27");
      x += column.width;
      line(commands, x, y, x, y - 24);
    });
    line(commands, MARGIN, y, MARGIN + CONTENT_WIDTH, y);
    line(commands, MARGIN, y - 24, MARGIN + CONTENT_WIDTH, y - 24);
    y -= 24;
  };

  const finishPage = () => {
    const pageNumber = pages.length + 1;
    line(commands, MARGIN, 28, MARGIN + CONTENT_WIDTH, 28, "0.82 0.72 0.75");
    text(commands, "Elaine & Haykal - 7 November 2026", MARGIN, 16, 7, false, "0.40 0.34 0.36");
    text(commands, `Page ${pageNumber}`, PAGE_WIDTH - MARGIN - 38, 16, 7, false, "0.40 0.34 0.36");
    pages.push(commands);
    commands = [];
  };

  drawHeader();
  for (const row of rows) {
    const cells = fitted.map((column, index) => wrap(row[index], column.width - 12, 8.5));
    const rowHeight = Math.max(25, Math.max(...cells.map((cell) => cell.length)) * 10 + 8);
    if (y - rowHeight < 40) {
      finishPage();
      drawHeader();
    }
    let x = MARGIN;
    cells.forEach((cell, index) => {
      cell.forEach((entry, lineIndex) => text(commands, entry, x + 6, y - 14 - lineIndex * 10, 8.5));
      x += fitted[index].width;
      line(commands, x, y, x, y - rowHeight);
    });
    line(commands, MARGIN, y - rowHeight, MARGIN + CONTENT_WIDTH, y - rowHeight);
    y -= rowHeight;
  }
  if (!rows.length) text(commands, "No guests match this report.", MARGIN + 6, y - 20, 10, false, "0.40 0.34 0.36");
  finishPage();
  return buildPdf(pages);
}

function buildPdf(pages: string[][]) {
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const stream = page.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let output = "%PDF-1.4\n% E&H Manager\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = output.length;
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export async function savePdfOnDevice(filename: string, bytes: Uint8Array) {
  const pdfBytes = new Uint8Array(bytes.byteLength);
  pdfBytes.set(bytes);
  const blob = new Blob([pdfBytes.buffer], { type: "application/pdf" });
  const file = new File([blob], filename, { type: "application/pdf" });
  const canShare = typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] })
    && window.matchMedia("(pointer: coarse)").matches;
  if (canShare) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
