import { useEffect, useState, type ReactNode } from 'react';
import { DotsThreeOutline, Export, PlusSquare } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { Banner, Button, Sheet } from '../ui';
import { currentInstallMode } from './platform';
import {
  clearSavedPrompt,
  getSavedPrompt,
  isDismissed,
  markDismissed,
  subscribePrompt,
} from './installPrompt';

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-box bg-surface-2 px-4 py-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-ink-fg">
        {n}
      </span>
      <span className="min-w-0 flex-1 text-[15px] leading-relaxed">{children}</span>
      <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-surface text-info" aria-hidden>
        {icon}
      </span>
    </li>
  );
}

/** Asks logged-in users to install the app. */
export function InstallBanner() {
  const { user } = useAuth();
  const [mode] = useState(currentInstallMode);
  const [hidden, setHidden] = useState(isDismissed);
  const [open, setOpen] = useState(false);
  const [, rerender] = useState(0);

  useEffect(() => subscribePrompt(() => rerender((n) => n + 1)), []);

  if (!user || hidden || mode === 'installed' || mode === 'unsupported') return null;

  const prompt = getSavedPrompt();
  // Android only offers install once the browser fires the event
  if (mode === 'android-prompt' && !prompt) return null;

  function dismiss() {
    markDismissed();
    setHidden(true);
    setOpen(false);
  }

  async function install() {
    const p = getSavedPrompt();
    if (!p) return;
    try {
      await p.prompt();
      const { outcome } = await p.userChoice;
      clearSavedPrompt();
      if (outcome === 'accepted') setHidden(true);
      else dismiss();
    } catch {
      clearSavedPrompt();
      rerender((n) => n + 1);
    }
  }

  const ios = mode === 'ios-safari';

  return (
    <>
      <Banner
        tone="info"
        title="התקינו את האפליקציה"
        onDismiss={dismiss}
        className="mb-4 transition-[opacity,transform] duration-200 ease-snap starting:-translate-y-1 starting:opacity-0"
        action={
          mode === 'android-prompt' ? (
            <Button size="md" variant="primary" onClick={install}>
              התקנה
            </Button>
          ) : (
            <Button size="md" variant="primary" onClick={() => setOpen(true)}>
              {ios ? 'איך מתקינים' : 'הוראות'}
            </Button>
          )
        }
      >
        גישה מהירה ממסך הבית, גם בלי קליטה.
      </Banner>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="הוספה למסך הבית"
        footer={
          <Button block variant="secondary" onClick={dismiss}>
            הבנתי, לא להציג שוב
          </Button>
        }
      >
        {ios ? (
          <ol className="flex flex-col gap-2.5">
            <Step n={1} icon={<Export className="size-6" weight="bold" />}>
              לחצו על כפתור השיתוף (Share) בשורת הכלים של Safari
            </Step>
            <Step n={2} icon={<PlusSquare className="size-6" weight="bold" />}>
              גללו ובחרו &quot;הוסף למסך הבית&quot;
            </Step>
            <Step n={3} icon={<DotsThreeOutline className="size-6" weight="fill" />}>
              לחצו &quot;הוסף&quot; בפינה העליונה
            </Step>
          </ol>
        ) : (
          <p className="text-[15px] leading-relaxed">
            כדי להתקין באייפון יש לפתוח את האתר בדפדפן Safari, ואז ללחוץ על Share ובחירה ב&quot;הוסף למסך הבית&quot;.
          </p>
        )}
      </Sheet>
    </>
  );
}
