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

export type SeatingPdfGuest = {
  name: string;
  seat: number | null;
  meal?: string | null;
  dietary?: string | null;
};

export type SeatingPdfTable = {
  name: string;
  shape: string;
  capacity: number;
  x: number;
  y: number;
  guests: SeatingPdfGuest[];
};

export type SeatingPlanPdfOptions = {
  title: string;
  subtitle: string;
  tables: SeatingPdfTable[];
  guestSafe?: boolean;
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

function circle(command: string[], x: number, y: number, radius: number, fill = "1 0.99 0.98", stroke = "0.47 0.15 0.29") {
  const k = radius * 0.5522848;
  command.push(`${fill} rg ${stroke} RG 0.7 w ${(x + radius).toFixed(1)} ${y.toFixed(1)} m ${(x + radius).toFixed(1)} ${(y + k).toFixed(1)} ${(x + k).toFixed(1)} ${(y + radius).toFixed(1)} ${x.toFixed(1)} ${(y + radius).toFixed(1)} c ${(x - k).toFixed(1)} ${(y + radius).toFixed(1)} ${(x - radius).toFixed(1)} ${(y + k).toFixed(1)} ${(x - radius).toFixed(1)} ${y.toFixed(1)} c ${(x - radius).toFixed(1)} ${(y - k).toFixed(1)} ${(x - k).toFixed(1)} ${(y - radius).toFixed(1)} ${x.toFixed(1)} ${(y - radius).toFixed(1)} c ${(x + k).toFixed(1)} ${(y - radius).toFixed(1)} ${(x + radius).toFixed(1)} ${(y - k).toFixed(1)} ${(x + radius).toFixed(1)} ${y.toFixed(1)} c B`);
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

export function createSeatingPlanPdf({ title, subtitle, tables, guestSafe = false }: SeatingPlanPdfOptions) {
  const pages: string[][] = [];
  const map: string[] = [];
  const seated = tables.reduce((sum, table) => sum + table.guests.length, 0);
  const capacity = tables.reduce((sum, table) => sum + table.capacity, 0);

  rect(map, MARGIN, PAGE_HEIGHT - 70, CONTENT_WIDTH, 30, "0.47 0.15 0.29");
  text(map, "E & H", MARGIN + 12, PAGE_HEIGHT - 60, 19, true, "1 1 1");
  text(map, title, MARGIN + 105, PAGE_HEIGHT - 57, 14, true, "1 1 1");
  text(map, subtitle, MARGIN + 105, PAGE_HEIGHT - 69, 7.5, false, "0.96 0.88 0.90");
  text(map, `${seated} guests seated / ${capacity} places`, MARGIN, PAGE_HEIGHT - 92, 9, true, "0.43 0.16 0.27");

  const roomX = MARGIN + 40;
  const roomY = 72;
  const roomW = CONTENT_WIDTH - 80;
  const roomH = 395;
  rect(map, roomX, roomY, roomW, roomH, "0.985 0.965 0.95");
  line(map, roomX, roomY, roomX + roomW, roomY, "0.47 0.15 0.29", 1);
  line(map, roomX, roomY + roomH, roomX + roomW, roomY + roomH, "0.47 0.15 0.29", 1);
  line(map, roomX, roomY, roomX, roomY + roomH, "0.47 0.15 0.29", 1);
  line(map, roomX + roomW, roomY, roomX + roomW, roomY + roomH, "0.47 0.15 0.29", 1);
  rect(map, roomX + roomW * .36, roomY + roomH - 34, roomW * .28, 24, "0.88 0.81 0.80");
  text(map, "LED STAGE", roomX + roomW * .46, roomY + roomH - 26, 7, true, "0.35 0.28 0.30");
  rect(map, roomX + roomW * .455, roomY + 12, roomW * .09, roomH - 58, "0.96 0.76 0.80");
  text(map, "AISLE", roomX + roomW * .485, roomY + roomH * .47, 7, true, "0.47 0.15 0.29");
  rect(map, roomX + roomW * .41, roomY + 8, roomW * .18, 30, "0.91 0.69 0.75");
  text(map, "DANCE FLOOR", roomX + roomW * .46, roomY + 20, 7, true, "0.35 0.20 0.25");

  for (const table of tables) {
    const x = roomX + roomW * Math.max(.06, Math.min(.94, table.x / 100));
    const y = roomY + roomH * (1 - Math.max(.08, Math.min(.92, table.y / 100)));
    if (table.shape === "banquet") {
      rect(map, x - 22, y - 43, 44, 86, "1 0.99 0.98");
      line(map, x - 22, y - 43, x - 22, y + 43, "0.47 0.15 0.29");
      line(map, x + 22, y - 43, x + 22, y + 43, "0.47 0.15 0.29");
    } else if (table.shape === "rectangular") {
      rect(map, x - 28, y - 17, 56, 34, "1 0.99 0.98");
    } else {
      circle(map, x, y, 22);
    }
    text(map, table.name, x - Math.min(30, table.name.length * 2.1), y + 2, 6.5, true, "0.32 0.22 0.26");
    text(map, `${table.guests.length}/${table.capacity}`, x - 8, y - 9, 6, false, "0.47 0.15 0.29");
  }
  line(map, MARGIN, 28, MARGIN + CONTENT_WIDTH, 28, "0.82 0.72 0.75");
  text(map, "Elaine & Haykal - 7 November 2026", MARGIN, 16, 7, false, "0.40 0.34 0.36");
  text(map, "Floor plan", PAGE_WIDTH - MARGIN - 48, 16, 7, false, "0.40 0.34 0.36");
  pages.push(map);

  for (const table of tables.filter((item) => item.guests.length > 0)) {
    const columns = guestSafe
      ? [{ label: "Guest", width: CONTENT_WIDTH }]
      : [
          { label: "Seat", width: 54 },
          { label: "Guest", width: 205 },
          { label: "Main course", width: 165 },
          { label: "Dietary requirements / allergies", width: CONTENT_WIDTH - 424 },
        ];
    let commands: string[] = [];
    let y = 0;
    let tablePage = 0;
    const startRosterPage = () => {
      commands = [];
      tablePage += 1;
      rect(commands, MARGIN, PAGE_HEIGHT - 70, CONTENT_WIDTH, 30, "0.47 0.15 0.29");
      text(commands, "E & H", MARGIN + 12, PAGE_HEIGHT - 60, 19, true, "1 1 1");
      text(commands, tablePage === 1 ? table.name : `${table.name} - continued`, MARGIN + 105, PAGE_HEIGHT - 57, 14, true, "1 1 1");
      text(commands, `${table.guests.length} guests / ${table.capacity} places`, MARGIN + 105, PAGE_HEIGHT - 69, 7.5, false, "0.96 0.88 0.90");
      y = PAGE_HEIGHT - 96;
      rect(commands, MARGIN, y - 24, CONTENT_WIDTH, 24, "0.96 0.91 0.91");
      let headerX = MARGIN;
      columns.forEach((column) => {
        text(commands, column.label.toUpperCase(), headerX + 6, y - 16, 7.3, true, "0.43 0.16 0.27");
        headerX += column.width;
        line(commands, headerX, y, headerX, y - 24);
      });
      y -= 24;
    };
    const finishRosterPage = () => {
      line(commands, MARGIN, 28, MARGIN + CONTENT_WIDTH, 28, "0.82 0.72 0.75");
      text(commands, guestSafe ? "Guest-facing seating chart" : "Grand Hyatt banquet seating plan", MARGIN, 16, 7, false, "0.40 0.34 0.36");
      text(commands, `Page ${pages.length + 1}`, PAGE_WIDTH - MARGIN - 38, 16, 7, false, "0.40 0.34 0.36");
      pages.push(commands);
    };
    const ordered = [...table.guests].sort((a, b) => Number(a.seat ?? 999) - Number(b.seat ?? 999) || a.name.localeCompare(b.name));
    const rows = ordered.map((guest) => guestSafe
      ? [guest.name]
      : [guest.seat ?? "-", guest.name, guest.meal || "-", guest.dietary || "-"]);
    startRosterPage();
    for (const row of rows) {
      const cells = columns.map((column, index) => wrap(row[index], column.width - 12, 8.5));
      const rowHeight = Math.max(25, Math.max(...cells.map((cell) => cell.length)) * 10 + 8);
      if (y - rowHeight < 40) {
        finishRosterPage();
        startRosterPage();
      }
      let x = MARGIN;
      cells.forEach((cell, index) => {
        cell.forEach((entry, lineIndex) => text(commands, entry, x + 6, y - 14 - lineIndex * 10, 8.5));
        x += columns[index].width;
        line(commands, x, y, x, y - rowHeight);
      });
      line(commands, MARGIN, y - rowHeight, MARGIN + CONTENT_WIDTH, y - rowHeight);
      y -= rowHeight;
    }
    finishRosterPage();
  }

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
