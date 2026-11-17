import { FormPicker } from '../components/FormPicker';

export function NewForm() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">טופס חדש</h1>
      <p className="mt-1 text-[15px] text-muted">בחר את סוג הבדיקה</p>
      <div className="mt-5">
        <FormPicker replace />
      </div>
    </section>
  );
}
