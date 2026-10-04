// Small dependency-free QR encoder used only for the fixed Memories URL.
// Version 4 / error-correction Q comfortably holds the 34-byte HTTPS URL.
const SIZE = 33;
const VERSION = 4;
const DATA_CODEWORDS = 48;
const BLOCK_DATA = 24;
const EC_CODEWORDS = 26;

function bitsForText(value: string) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 46) throw new Error("The Memories QR URL is too long.");
  const bits: number[] = [0, 1, 0, 0];
  for (let shift = 7; shift >= 0; shift -= 1) bits.push((bytes.length >>> shift) & 1);
  for (const byte of bytes) for (let shift = 7; shift >= 0; shift -= 1) bits.push((byte >>> shift) & 1);
  for (let index = 0; index < 4 && bits.length < DATA_CODEWORDS * 8; index += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const words: number[] = [];
  for (let index = 0; index < bits.length; index += 8) words.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
  for (let pad = 0; words.length < DATA_CODEWORDS; pad += 1) words.push(pad % 2 ? 0x11 : 0xec);
  return words;
}

const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
(() => {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    EXP[index] = value;
    LOG[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) EXP[index] = EXP[index - 255];
})();

function multiply(a: number, b: number) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function reedSolomon(data: number[], degree: number) {
  let generator = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(generator.length + 1).fill(0);
    generator.forEach((coefficient, position) => {
      next[position] ^= coefficient;
      next[position + 1] ^= multiply(coefficient, EXP[index]);
    });
    generator = next;
  }
  const result = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let index = 0; index < degree; index += 1) result[index] ^= multiply(generator[index + 1], factor);
  }
  return result;
}

function codewords(value: string) {
  const words = bitsForText(value);
  const blocks = [words.slice(0, BLOCK_DATA), words.slice(BLOCK_DATA, BLOCK_DATA * 2)];
  const parity = blocks.map((block) => reedSolomon(block, EC_CODEWORDS));
  const result: number[] = [];
  for (let index = 0; index < BLOCK_DATA; index += 1) blocks.forEach((block) => result.push(block[index]));
  for (let index = 0; index < EC_CODEWORDS; index += 1) parity.forEach((block) => result.push(block[index]));
  return result;
}

type Modules = Array<Array<boolean | null>>;

function baseMatrix() {
  const modules: Modules = Array.from({ length: SIZE }, () => Array<boolean | null>(SIZE).fill(null));
  const functionModule = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const set = (row: number, column: number, dark: boolean) => {
    if (row < 0 || column < 0 || row >= SIZE || column >= SIZE) return;
    modules[row][column] = dark;
    functionModule[row][column] = true;
  };
  const finder = (top: number, left: number) => {
    for (let row = -1; row <= 7; row += 1) for (let column = -1; column <= 7; column += 1) {
      const inside = row >= 0 && row <= 6 && column >= 0 && column <= 6;
      const dark = inside && (row === 0 || row === 6 || column === 0 || column === 6 || (row >= 2 && row <= 4 && column >= 2 && column <= 4));
      set(top + row, left + column, dark);
    }
  };
  finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);
  for (let index = 8; index < SIZE - 8; index += 1) {
    if (!functionModule[6][index]) set(6, index, index % 2 === 0);
    if (!functionModule[index][6]) set(index, 6, index % 2 === 0);
  }
  for (let row = -2; row <= 2; row += 1) for (let column = -2; column <= 2; column += 1) set(26 + row, 26 + column, Math.max(Math.abs(row), Math.abs(column)) !== 1);
  for (let index = 0; index <= 5; index += 1) set(index, 8, false);
  set(7, 8, false); set(8, 8, false); set(8, 7, false);
  for (let index = 9; index < 15; index += 1) set(8, 14 - index, false);
  for (let index = 0; index < 8; index += 1) set(8, SIZE - 1 - index, false);
  for (let index = 8; index < 15; index += 1) set(SIZE - 15 + index, 8, false);
  set(SIZE - 8, 8, true);
  return { modules, functionModule };
}

function maskBit(mask: number, row: number, column: number) {
  if (mask === 0) return (row + column) % 2 === 0;
  if (mask === 1) return row % 2 === 0;
  if (mask === 2) return column % 3 === 0;
  if (mask === 3) return (row + column) % 3 === 0;
  if (mask === 4) return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
  if (mask === 5) return (row * column) % 2 + (row * column) % 3 === 0;
  if (mask === 6) return ((row * column) % 2 + (row * column) % 3) % 2 === 0;
  return ((row + column) % 2 + (row * column) % 3) % 2 === 0;
}

function formatBits(modules: Modules, mask: number) {
  const data = (3 << 3) | mask;
  let remainder = data;
  for (let index = 0; index < 10; index += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const bit = (index: number) => ((bits >>> index) & 1) !== 0;
  for (let index = 0; index <= 5; index += 1) modules[index][8] = bit(index);
  modules[7][8] = bit(6); modules[8][8] = bit(7); modules[8][7] = bit(8);
  for (let index = 9; index < 15; index += 1) modules[8][14 - index] = bit(index);
  for (let index = 0; index < 8; index += 1) modules[8][SIZE - 1 - index] = bit(index);
  for (let index = 8; index < 15; index += 1) modules[SIZE - 15 + index][8] = bit(index);
  modules[SIZE - 8][8] = true;
}

function penalty(modules: Modules) {
  let score = 0;
  for (let direction = 0; direction < 2; direction += 1) for (let outer = 0; outer < SIZE; outer += 1) {
    const sequence = Array.from({ length: SIZE }, (_, inner) => Boolean(direction ? modules[inner][outer] : modules[outer][inner]));
    let run = 1;
    for (let index = 1; index < SIZE; index += 1) {
      if (sequence[index] === sequence[index - 1]) run += 1;
      else { if (run >= 5) score += 3 + run - 5; run = 1; }
    }
    if (run >= 5) score += 3 + run - 5;
    const text = sequence.map((dark) => dark ? "1" : "0").join("");
    score += ((text.match(/10111010000/g) ?? []).length + (text.match(/00001011101/g) ?? []).length) * 40;
  }
  for (let row = 0; row < SIZE - 1; row += 1) for (let column = 0; column < SIZE - 1; column += 1) {
    const colour = modules[row][column];
    if (modules[row + 1][column] === colour && modules[row][column + 1] === colour && modules[row + 1][column + 1] === colour) score += 3;
  }
  const dark = modules.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - SIZE * SIZE * 10) / (SIZE * SIZE)) * 10;
  return score;
}

export function qrModules(value: string) {
  const words = codewords(value);
  const dataBits = words.flatMap((word) => Array.from({ length: 8 }, (_, index) => (word >>> (7 - index)) & 1));
  let best: Modules | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const { modules, functionModule } = baseMatrix();
    let bitIndex = 0;
    let upward = true;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < SIZE; vertical += 1) {
        const row = upward ? SIZE - 1 - vertical : vertical;
        for (let offset = 0; offset < 2; offset += 1) {
          const column = right - offset;
          if (functionModule[row][column]) continue;
          const raw = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
          modules[row][column] = raw !== maskBit(mask, row, column);
          bitIndex += 1;
        }
      }
      upward = !upward;
    }
    formatBits(modules, mask);
    const currentPenalty = penalty(modules);
    if (currentPenalty < bestPenalty) { bestPenalty = currentPenalty; best = modules; }
  }
  return best as Array<Array<boolean>>;
}

export function qrSvg(value: string) {
  const modules = qrModules(value);
  const quiet = 4;
  const dimension = SIZE + quiet * 2;
  const paths: string[] = [];
  modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) paths.push(`M${x + quiet},${y + quiet}h1v1h-1z`); }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${value}"><rect width="${dimension}" height="${dimension}" fill="#fffdf9"/><path d="${paths.join("")}" fill="#6f2945"/></svg>`;
}
