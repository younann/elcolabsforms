import { HttpError } from './http';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX = 8 * 1024 * 1024;

export async function readImage(file: FormDataEntryValue | null): Promise<{ bytes: ArrayBuffer; type: string }> {
  if (!file || typeof file === 'string') throw new HttpError(400, 'חסר קובץ');
  if (!IMAGE_TYPES.includes(file.type)) throw new HttpError(400, 'סוג קובץ לא נתמך');
  if (file.size > MAX) throw new HttpError(413, 'הקובץ גדול מדי');
  return { bytes: await file.arrayBuffer(), type: file.type };
}

export async function readPngBody(req: Request) {
  const form = await req.formData();
  return readImage(form.get('file'));
}
