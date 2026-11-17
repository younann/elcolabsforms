import { createContext, useContext } from 'react';
import type { AttachmentRef } from '../../shared/forms/types';

export type Attachment = AttachmentRef & { url: string };
export type FillMode = 'inspector' | 'admin';

export type FillCtx = {
  submissionId: string;
  mode: FillMode;
  readOnly: boolean;
  attachments: Attachment[];
  /** Uploads a blob as an attachment of the field. */
  upload(fieldId: string, kind: AttachmentRef['kind'], blob: Blob, name?: string): Promise<Attachment>;
  remove(id: string): Promise<void>;
};

export const FillContext = createContext<FillCtx | null>(null);

export function useFill(): FillCtx {
  const c = useContext(FillContext);
  if (!c) throw new Error('useFill outside FormFiller');
  return c;
}

export const fieldDomId = (id: string) => `field-${id}`;
export const sectionDomId = (id: string) => `section-${id}`;
