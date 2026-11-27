import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { deleteBlob, getBlob, putBlob } from '../../server/blobs';
import { listStandards, partKey, saveStandards, standardView, stdKey, STD_MAX, updateStandard } from '../../server/standards';
import { StandardPatch, StandardSave } from '../../shared/ai';

const Id = z.uuid();
const PART_MAX = 4 * 1024 * 1024;

export default handle(async (req) => {
  const url = new URL(req.url);
  const [, , , id, sub] = url.pathname.split('/'); // ['', 'api', 'standards', id, sub]

  // any user may open a standard
  if (id && sub === 'pdf' && req.method === 'GET') {
    await requireUser(req);
    if (!Id.safeParse(id).success) throw new HttpError(404, 'התקן לא נמצא');
    const s = (await listStandards()).find((x) => x.id === id);
    const b = s && (await getBlob(stdKey(id)));
    if (!s || !b) throw new HttpError(404, 'התקן לא נמצא');
    return new Response(b.data, {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="standard.pdf"; filename*=UTF-8''${encodeURIComponent(s.name)}.pdf`, 'cache-control': 'private, no-store' },
    });
  }

  await requireUser(req, 'admin');

  if (!id) {
    if (req.method === 'GET') return json({ standards: (await listStandards()).map(standardView) });
    if (req.method === 'POST') {
      // parts were uploaded first; join them into one pdf
      const b = await parseBody(req, StandardSave);
      const chunks: Uint8Array[] = [];
      for (let n = 0; n < b.parts; n++) {
        const p = await getBlob(partKey(b.id, n));
        if (!p) throw new HttpError(400, 'הקובץ לא הועלה במלואו. נסו שוב');
        chunks.push(new Uint8Array(p.data));
      }
      const pdf = Buffer.concat(chunks);
      if (pdf.length > STD_MAX) throw new HttpError(413, 'הקובץ גדול מ-50MB');
      if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(400, 'יש לבחור קובץ PDF');
      await putBlob(stdKey(b.id), pdf, 'application/pdf');
      await Promise.all(chunks.map((_, n) => deleteBlob(partKey(b.id, n)).catch(() => {})));
      const s = { id: b.id, name: b.name, formIds: b.formIds, size: pdf.length, createdAt: new Date().toISOString() };
      await saveStandards([...(await listStandards()).filter((x) => x.id !== b.id), s]);
      return json({ standard: s }, 201);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (!Id.safeParse(id).success) throw new HttpError(404, 'התקן לא נמצא');

  if (sub === 'part' && req.method === 'PUT') {
    const n = Number(url.searchParams.get('n'));
    if (!Number.isInteger(n) || n < 0 || n >= 20) throw new HttpError(400, 'נתונים לא תקינים');
    const data = new Uint8Array(await req.arrayBuffer());
    if (!data.length || data.length > PART_MAX) throw new HttpError(413, 'חלק גדול מדי');
    await putBlob(partKey(id, n), data, 'application/octet-stream');
    return json({ ok: true });
  }

  const s = (await listStandards()).find((x) => x.id === id);
  if (!s) throw new HttpError(404, 'התקן לא נמצא');

  if (!sub && req.method === 'PATCH') {
    const b = await parseBody(req, StandardPatch);
    await updateStandard(id, b);
    return json({ standard: standardView({ ...s, ...b }) });
  }

  if (!sub && req.method === 'DELETE') {
    await saveStandards((await listStandards()).filter((x) => x.id !== id));
    await deleteBlob(stdKey(id)).catch(() => {});
    return json({ ok: true });
  }

  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: ['/api/standards', '/api/standards/:id', '/api/standards/:id/part', '/api/standards/:id/pdf'] };
