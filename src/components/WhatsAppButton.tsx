import { WhatsappLogo } from '@phosphor-icons/react';
import type { JobView } from '../lib/jobs';
import { jobMessage, normalizeIlPhone, waLink } from '../../shared/whatsapp';
import { cx } from '../ui';

const base =
  'press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-ctl px-4 text-[17px] font-semibold transition-[transform,opacity] duration-150 active:scale-[0.98]';

/** Opens WhatsApp with the job message to the inspector. */
export function WhatsAppButton({ job }: { job: JobView }) {
  const phone = normalizeIlPhone(job.inspector.phone);
  if (!phone) {
    return (
      <div>
        <button type="button" disabled className={cx(base, 'bg-surface-2 text-muted')} data-testid="whatsapp">
          <WhatsappLogo className="size-6" aria-hidden />
          שליחה בוואטסאפ
        </button>
        <p className="mt-1.5 text-sm text-muted">חסר טלפון לבודק. הוסף אותו במשתמשים</p>
      </div>
    );
  }
  const text = jobMessage({
    inspectorName: job.inspector.displayName,
    clientName: job.client.name,
    contactPerson: job.client.contactPerson,
    contactPhone: job.client.phone,
    siteName: job.site.name,
    siteAddress: job.site.address,
    plannedDate: job.plannedDate,
    forms: job.forms.map((f) => f.label),
    note: job.note,
    link: `${location.origin}/jobs/${job.id}`,
  });
  return (
    <a href={waLink(phone, text)} target="_blank" rel="noopener" className={cx(base, 'bg-[#1fa855] text-white')} data-testid="whatsapp">
      <WhatsappLogo className="size-6" weight="fill" aria-hidden />
      שליחה בוואטסאפ ל{job.inspector.displayName}
    </a>
  );
}
