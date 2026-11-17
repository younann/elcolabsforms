import type { Config } from '@netlify/functions';
import { handle, json } from '../../server/http';
import { requireUser, toPublic } from '../../server/auth';

export default handle(async (req) => json({ user: toPublic(await requireUser(req)) }));

export const config: Config = { path: '/api/auth/me' };
