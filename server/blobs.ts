import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'files', consistency: 'strong' });

export async function putBlob(key: string, data: ArrayBuffer | Uint8Array, contentType: string) {
  await store().set(key, data as ArrayBuffer, { metadata: { contentType } });
}

export async function getBlob(key: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const r = await store().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!r) return null;
  return { data: r.data, contentType: String(r.metadata?.contentType ?? 'application/octet-stream') };
}

export async function deleteBlob(key: string) {
  await store().delete(key);
}

export function dataUrl(b: { data: ArrayBuffer; contentType: string }) {
  return `data:${b.contentType};base64,${Buffer.from(b.data).toString('base64')}`;
}
