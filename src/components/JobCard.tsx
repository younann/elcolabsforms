import { Link } from 'react-router-dom';
import { CalendarBlank, MapPin, Phone } from '@phosphor-icons/react';
import { jobDate, type JobSummary } from '../lib/jobs';
import { rowHref } from '../lib/submissions';
import { StatusBadge } from '../ui';

/** Inspector home: one open job with its forms. */
export function JobCard({ job }: { job: JobSummary }) {
  return (
    <article className="rounded-box border border-border bg-surface" data-testid="job-card">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-2">
          <Link to={`/jobs/${job.id}`} className="min-w-0 flex-1 text-[17px] font-semibold leading-snug hover:underline">
            {job.client.name} · {job.site.name}
          </Link>
          {job.state === 'cancelled-open' && <span className="shrink-0 rounded-full bg-danger-soft px-2.5 py-0.5 text-[13px] font-semibold text-danger">בוטלה</span>}
        </div>
        <div className="mt-2 flex flex-col gap-1.5 text-[15px] text-muted">
          <span className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {job.site.address}
          </span>
          <span className="flex items-center gap-2">
            <CalendarBlank className="size-4 shrink-0" aria-hidden />
            {jobDate(job.plannedDate)}
          </span>
          {(job.client.contactPerson || job.client.phone) && (
            <span className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden />
              {job.client.contactPerson}
              {job.client.phone && (
                <a href={`tel:${job.client.phone}`} dir="ltr" className="font-medium text-accent">
                  {job.client.phone}
                </a>
              )}
            </span>
          )}
        </div>
        {job.note && <p className="mt-3 rounded-ctl bg-surface-2 px-3 py-2 text-[15px] leading-relaxed whitespace-pre-line">{job.note}</p>}
      </div>
      <ul className="border-t border-border">
        {job.forms.map((f) => (
          <li key={f.id} className="border-b border-border last:border-b-0">
            <Link to={rowHref(f, 'inspector')} className="press flex min-h-13 items-center gap-3 px-4 py-2 hover:bg-surface-2/60">
              <span className="min-w-0 flex-1 truncate font-medium">{f.label}</span>
              <StatusBadge status={f.status} />
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
