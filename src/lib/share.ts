/** Name from a content-disposition header, preferring the UTF-8 form. */
export function dispositionName(header: string | null, fallback: string): string {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (star) {
    try {
      return decodeURIComponent(star);
    } catch {
      /* bad encoding, try the plain form */
    }
  }
  return header?.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
}

/** True where the native share sheet accepts PDF files. */
export function canShareFiles(): boolean {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

export async function fetchFile(url: string, fallback: string): Promise<File> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new File([blob], dispositionName(res.headers.get('content-disposition'), fallback), { type: blob.type || 'application/pdf' });
}
