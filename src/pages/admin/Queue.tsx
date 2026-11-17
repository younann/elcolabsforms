import { Tray } from '@phosphor-icons/react';
import { EmptyState } from '../../ui';

export function Queue() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">ממתינים לאישור</h1>
      <EmptyState icon={<Tray />} title="אין טפסים ממתינים" className="mt-6">
        טפסים שנשלחו לאישור יופיעו כאן.
      </EmptyState>
    </section>
  );
}
