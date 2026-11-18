import { useState } from 'react';
import { Banner, Button, toast } from '../ui';
import { enablePush, pushSupport } from './push';

const KEY = 'push-card-dismissed';

function dismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Asks inspectors to turn on job notifications. */
export function PushCard() {
  const [support] = useState(pushSupport);
  const [hidden, setHidden] = useState(() => dismissed() || (support === 'ok' && Notification.permission !== 'default'));
  const [busy, setBusy] = useState(false);
  if (hidden || support === 'unsupported') return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // per device only
    }
    setHidden(true);
  }

  async function enable() {
    setBusy(true);
    try {
      if (await enablePush()) toast.success('התראות הופעלו');
      setHidden(true);
    } catch {
      toast.error('לא ניתן להפעיל התראות');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Banner
      tone="info"
      title="התראות על עבודות"
      className="mt-5"
      action={
        support === 'ok' ? (
          <div className="flex gap-2">
            <Button size="md" variant="primary" loading={busy} onClick={enable}>
              הפעלה
            </Button>
            <Button size="md" variant="secondary" onClick={dismiss}>
              לא עכשיו
            </Button>
          </div>
        ) : (
          <Button size="md" variant="secondary" onClick={dismiss}>
            הבנתי
          </Button>
        )
      }
    >
      {support === 'ok' ? 'קבל הודעה כשמשייכים אליך עבודה.' : 'כדי לקבל התראות באייפון, הוסף את האפליקציה למסך הבית ופתח אותה משם.'}
    </Banner>
  );
}
