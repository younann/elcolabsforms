import type { Field } from '../../shared/forms/types';
import type { FieldProps } from './fields/inputs';
import { ChoiceField, NoteField, SimpleField } from './fields/SimpleField';
import { CheckField } from './fields/CheckField';
import { EquipmentTableField, RepeatTableField, ScenarioMatrixField, SystemsGridField } from './fields/Tables';
import { ContactAckField, DrawingField, PhotosField, SignatureField } from './fields/Media';

/** Picks the input for a field type. */
export function FieldRenderer(p: FieldProps) {
  const f = p.field;
  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'number':
    case 'date':
    case 'time':
      return <SimpleField {...p} field={f} />;
    case 'choice':
      return <ChoiceField {...p} field={f} />;
    case 'check':
      return <CheckField {...p} field={f} />;
    case 'equipmentTable':
      return <EquipmentTableField {...p} field={f} />;
    case 'repeatTable':
      return <RepeatTableField {...p} field={f} />;
    case 'systemsGrid':
      return <SystemsGridField {...p} field={f} />;
    case 'contactAck':
      return <ContactAckField {...p} field={f} />;
    case 'signature':
      return <SignatureField {...p} field={f} />;
    case 'photos':
      return <PhotosField {...p} field={f} />;
    case 'drawing':
      return <DrawingField {...p} field={f} />;
    case 'scenarioMatrix':
      return <ScenarioMatrixField {...p} field={f} />;
    case 'note':
      return <NoteField text={f.text} />;
    default: {
      const never: never = f;
      return never;
    }
  }
}

export type { Field };
