function encodeAscii(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function concatUint8(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function buildPdfWithJpeg(jpegBytes, width, height) {
  const objects = [];

  objects[1] = encodeAscii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = encodeAscii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");

  const pageW = 792;
  const pageH = 612;
  const margin = 24;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const scale = Math.min(availW / width, availH / height);
  const drawW = Math.max(1, Math.floor(width * scale));
  const drawH = Math.max(1, Math.floor(height * scale));
  const x = Math.floor((pageW - drawW) / 2);
  const y = Math.floor((pageH - drawH) / 2) - 8;

  const stream = `q\n${drawW} 0 0 ${drawH} ${x} ${y} cm\n/Im0 Do\nQ\n`;

  objects[3] = encodeAscii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /ProcSet [/PDF /Text /ImageC] /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");

  const imgHeader = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const imgFooter = "\nendstream";
  objects[4] = concatUint8([encodeAscii(imgHeader), jpegBytes, encodeAscii(imgFooter)]);

  const contentHeader = `<< /Length ${stream.length} >>\nstream\n`;
  const contentFooter = "endstream";
  objects[5] = concatUint8([encodeAscii(contentHeader), encodeAscii(stream), encodeAscii(contentFooter)]);

  const parts = [encodeAscii("%PDF-1.4\n")];
  const offsets = [0];

  for (let i = 1; i <= 5; i += 1) {
    const offset = parts.reduce((sum, p) => sum + p.length, 0);
    offsets[i] = offset;
    parts.push(encodeAscii(`${i} 0 obj\n`));
    parts.push(objects[i]);
    parts.push(encodeAscii("\nendobj\n"));
  }

  const xrefStart = parts.reduce((sum, p) => sum + p.length, 0);
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(encodeAscii(xref));
  parts.push(encodeAscii(trailer));

  return new Blob([concatUint8(parts)], { type: "application/pdf" });
}

export function exportTimingPdfFromCanvas({ canvas, selectedTiming }) {
  if (!selectedTiming) {
    window.alert("Select a timing result first, then export PDF.");
    return;
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.split(",")[1] || "";
  const jpegBytes = base64ToUint8(base64);

  const pdfBlob = buildPdfWithJpeg(jpegBytes, canvas.width, canvas.height);

  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "timing-preview.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
