import { api } from './api';
import type { RequiredOverrides } from '../../shared/forms/required';

const KEY = 'required-overrides';

/** Admin required-field choices; last copy offline, code defaults if none. */
export async function requiredOverrides(): Promise<RequiredOverrides> {
  try {
    const r = await api<{ settings: { requiredOverrides?: RequiredOverrides } }>('/api/settings');
    const o = r.settings.requiredOverrides ?? {};
    try {
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch {
      // storage blocked: fine
    }
    return o;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as RequiredOverrides;
    } catch {
      return {};
    }
  }
}

export const saveRequired = (formId: string, overrides: Record<string, boolean>) =>
  api<{ requiredOverrides: RequiredOverrides }>('/api/settings/required', { method: 'PUT', json: { formId, overrides } }).then((r) => r.requiredOverrides);
