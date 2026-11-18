import { WhatsappLogo } from '@phosphor-icons/react';
import type { JobView } from '../lib/jobs';
import { jobMessage, normalizeIlPhone, waLink } from '../../shared/whatsapp';
import { cx } from '../ui';

// tinted action tile, icon over label
const base =
  'press flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 rounded-ctl px-3 py-2 text-[13px] font-semibold transition-[transform,opacity] duration-150 active:opacity-60';

/** Opens WhatsApp with the job message to the inspector. */
export function WhatsAppButton({ job }: { job: JobView }) {
  const phone = normalizeIlPhone(job.inspector.phone);
  if (!phone) {
    return (
      <div>
        <button type="button" disabled aria-label="שליחה בוואטסאפ" className={cx(base, 'bg-surface text-muted')} data-testid="whatsapp">
          <WhatsappLogo className="size-6" aria-hidden />
          וואטסאפ
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
    <a
      href={waLink(phone, text)}
      target="_blank"
      rel="noopener"
      aria-label={`שליחה בוואטסאפ ל${job.inspector.displayName}`}
      className={cx(base, 'bg-surface text-success shadow-[var(--shadow-card)]')}
      data-testid="whatsapp"
    >
      <WhatsappLogo className="size-6" weight="fill" aria-hidden />
      וואטסאפ לבודק
    </a>
  );
}
