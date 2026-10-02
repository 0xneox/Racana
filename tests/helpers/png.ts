// Minimal PNG codec for the QA gate — decode (unfilter + inflate) and encode
// (filter 0 rows + deflate).  Supports the color types Typst emits: RGBA (6),
// RGB (2) and grayscale (0), 8-bit depth.

import zlib from "zlib";

export interface PngImage {
  width: number;
  height: number;
  /** RGBA pixel data, row-major, 4 bytes per pixel. */
  data: Uint8Array;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodePng(buf: Buffer): PngImage {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error("not a PNG");
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!ch) throw new Error(`unsupported color type ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const px = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = raw.subarray(pos, pos + stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    const out = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      out[x] = v;
    }
    pos += stride;
  }

  // Expand to RGBA.
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (ch === 4) {
      rgba.set(px.subarray(i * 4, i * 4 + 4), i * 4);
    } else if (ch === 3) {
      rgba.set([px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255], i * 4);
    } else {
      rgba.set([px[i], px[i], px[i], 255], i * 4);
    }
  }
  return { width, height, data: rgba };
}

export function encodePng(img: PngImage): Buffer {
  const { width, height, data } = img;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    data.subarray(y * stride, (y + 1) * stride).forEach((v, i) => {
      raw[y * (stride + 1) + 1 + i] = v;
    });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const chunk = (type: string, payload: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(payload.length);
    const t = Buffer.concat([Buffer.from(type), payload]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(zlib.crc32 ? zlib.crc32(t) : crc32(t));
    return Buffer.concat([len, t, crcBuf]);
  };
  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// CRC32 fallback if zlib.crc32 isn't exposed on this Node version.
function crc32(buf: Buffer): number {
  let c: number, table: number[] = (crc32 as any).t;
  if (!table) {
    table = (crc32 as any).t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function crop(img: PngImage, x: number, y: number, w: number, h: number): PngImage {
  const out = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * img.width + x) * 4;
    out.set(img.data.subarray(src, src + w * 4), row * w * 4);
  }
  return { width: w, height: h, data: out };
}

/** Mean absolute per-channel difference, 0–255. */
export function meanAbsDiff(a: PngImage, b: PngImage): number {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    sum +=
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return sum / (a.width * a.height * 3);
}
