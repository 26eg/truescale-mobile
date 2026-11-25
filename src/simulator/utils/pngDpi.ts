const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function readU32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>>
    0
  );
}

function writeU32BE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function isPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 33) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) return false;
  }
  return true;
}

/**
 * Injects or replaces a PNG `pHYs` chunk directly after `IHDR` so desktop viewers
 * respect the device's physical DPI when previewing or printing high-res screenshots.
 */
export function injectPngPhysDpi(pngBytes: Uint8Array, dpi: number): Uint8Array {
  if (!isPngSignature(pngBytes) || !Number.isFinite(dpi) || dpi <= 0) {
    return pngBytes;
  }

  const ppm = Math.max(1, Math.round(dpi / 0.0254));
  const physChunk = new Uint8Array(4 + 4 + 9 + 4);
  writeU32BE(physChunk, 0, 9);
  physChunk[4] = 0x70; // p
  physChunk[5] = 0x48; // H
  physChunk[6] = 0x59; // Y
  physChunk[7] = 0x73; // s
  writeU32BE(physChunk, 8, ppm);
  writeU32BE(physChunk, 12, ppm);
  physChunk[16] = 1; // unit specifier: meter
  const crc = crc32(physChunk.subarray(4, 17));
  writeU32BE(physChunk, 17, crc);

  const chunks: Uint8Array[] = [PNG_SIG];
  let inserted = false;
  let offset = 8;

  while (offset + 12 <= pngBytes.length) {
    const dataLen = readU32BE(pngBytes, offset);
    const totalLen = 12 + dataLen;
    if (offset + totalLen > pngBytes.length) {
      return pngBytes;
    }
    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7],
    );

    if (type !== 'pHYs') {
      chunks.push(pngBytes.subarray(offset, offset + totalLen));
      if (type === 'IHDR' && !inserted) {
        chunks.push(physChunk);
        inserted = true;
      }
    }
    offset += totalLen;
  }

  if (!inserted) return pngBytes;

  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalSize);
  let cursor = 0;
  for (const c of chunks) {
    out.set(c, cursor);
    cursor += c.length;
  }
  return out;
}

export function parsePngPhysDpi(
  pngBytes: Uint8Array,
): { xPpm: number; yPpm: number; unitSpecifier: number; dpi: number } | null {
  if (!isPngSignature(pngBytes)) return null;
  let offset = 8;
  while (offset + 12 <= pngBytes.length) {
    const dataLen = readU32BE(pngBytes, offset);
    const totalLen = 12 + dataLen;
    if (offset + totalLen > pngBytes.length) return null;
    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7],
    );
    if (type === 'pHYs' && dataLen === 9) {
      const xPpm = readU32BE(pngBytes, offset + 8);
      const yPpm = readU32BE(pngBytes, offset + 12);
      const unitSpecifier = pngBytes[offset + 16];
      const dpi = unitSpecifier === 1 ? Math.round(xPpm * 0.0254) : 0;
      return { xPpm, yPpm, unitSpecifier, dpi };
    }
    offset += totalLen;
  }
  return null;
}

export async function canvasToExportBlob(
  canvas: HTMLCanvasElement,
  format: 'png' | 'webp' | 'jpeg',
  dpi: number,
): Promise<Blob> {
  const mime =
    format === 'webp' ? 'image/webp' : format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const rawBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to encode canvas image'));
      },
      mime,
      format === 'png' ? undefined : 0.94,
    );
  });

  if (format !== 'png') return rawBlob;
  const buf = new Uint8Array(await rawBlob.arrayBuffer());
  const withDpi = injectPngPhysDpi(buf, dpi);
  const copy = new Uint8Array(withDpi.length);
  copy.set(withDpi);
  return new Blob([copy.buffer], { type: 'image/png' });
}
