import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { WarningOctagon } from '@phosphor-icons/react';
import { api, ApiError } from '../lib/api';
import { preferLocal } from '../lib/autosave';
import { Button, EmptyState } from '../ui';
import { getForm } from '../../shared/forms';
import type { FormData, FormDef } from '../../shared/forms/types';
import { FormFiller, draftKey, type SubmissionRow } from '../fill/FormFiller';
import type { Attachment } from '../fill/context';

type Loaded = { def: FormDef; submission: SubmissionRow; data: FormData; fromLocal: boolean; attachments: Attachment[] };

const EDITABLE = ['draft', 'returned'];

function FillSkeleton() {
  return (
    <div aria-busy="true" aria-label="טוען" className="flex flex-col gap-5">
      <div className="h-5 w-24 rounded-full bg-surface-2" />
      <div className="h-7 w-3/4 rounded-full bg-surface-2" />
      {[0, 1].map((i) => (
        <div key={i} className="rounded-box border border-border bg-surface p-5">
          <div className="h-5 w-40 rounded-full bg-surface-2" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="h-12 rounded-ctl bg-surface-2" />
            <div className="h-12 rounded-ctl bg-surface-2" />
            <div className="h-12 rounded-ctl bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Fill() {
  const { id = '' } = useParams();
  const [state, setState] = useState<Loaded | { error: string } | null>(null);

  const load = useCallback(async () => {
    setState(null);
    try {
      const r = await api<{ submission: SubmissionRow; attachments: Attachment[] }>(`/api/submissions/${id}`);
      const def = getForm(r.submission.formId, r.submission.formVersion);
      const editable = EDITABLE.includes(r.submission.status);
      const picked = editable
        ? preferLocal(draftKey(id), r.submission.data ?? {}, r.submission.updatedAt)
        : { data: r.submission.data ?? {}, fromLocal: false };
      setState({ def, submission: r.submission, data: picked.data, fromLocal: picked.fromLocal, attachments: r.attachments });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      setState({ error: e instanceof Error ? e.message : 'טעינת הטופס נכשלה' });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return <FillSkeleton />;
  if ('error' in state) {
    return (
      <EmptyState icon={<WarningOctagon />} title="לא ניתן לפתוח את הטופס" action={<Button onClick={load}>נסה שוב</Button>}>
        {state.error}
      </EmptyState>
    );
  }

  const s = state.submission;
  const readOnly = !EDITABLE.includes(s.status);
  return (
    <FormFiller
      key={s.id}
      def={state.def}
      submission={s}
      initialData={state.data}
      unsaved={state.fromLocal}
      attachments={state.attachments}
      mode="inspector"
      readOnly={readOnly}
      onSubmitted={() => void load()}
    />
  );
}
