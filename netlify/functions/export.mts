import type { Config } from '@netlify/functions';
import { handle, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { monthSheets } from '../../server/export';
import { xlsx } from '../../server/xlsx';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export default handle(async (req) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
  await requireUser(req, 'admin');
  const month = new URL(req.url).searchParams.get('month') ?? '';
  if (!MONTH.test(month)) throw new HttpError(400, 'חודש לא תקין');
  const sheets = await monthSheets(month);
  return new Response(Buffer.from(xlsx(sheets)), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="elco-${month}.xlsx"`,
      'cache-control': 'private, no-store',
    },
  });
});

export const config: Config = { path: ['/api/export'] };
