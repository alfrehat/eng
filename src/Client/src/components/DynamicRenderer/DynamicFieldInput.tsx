import React from 'react';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldMeta {
  id: string;
  fieldName: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  isReadonly?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: FieldOption[];
}

interface Props {
  field: FieldMeta;
  value: any;
  onChange: (fieldName: string, val: any) => void;
  error?: string;
}

export const DynamicFieldInput: React.FC<Props> = ({ field, value, onChange, error }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    if (target.type === 'checkbox') {
      onChange(field.fieldName, (target as HTMLInputElement).checked);
    } else if (target.type === 'number') {
      onChange(field.fieldName, target.value === '' ? null : Number(target.value));
    } else {
      onChange(field.fieldName, target.value);
    }
  };

  const renderInput = () => {
    switch (field.fieldType?.toLowerCase()) {
      case 'textarea':
        return (
          <textarea
            value={value ?? ''}
            onChange={handleChange}
            placeholder={field.placeholder || `أدخل ${field.label}`}
            disabled={field.isReadonly}
            rows={3}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        );

      case 'select':
        return (
          <select
            value={value ?? ''}
            onChange={handleChange}
            disabled={field.isReadonly}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#ffffff' }}
          >
            <option value="">-- اختر {field.label} --</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'boolean':
      case 'checkbox':
        return (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={handleChange}
              disabled={field.isReadonly}
              style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
            />
            <span>{field.label}</span>
          </label>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value ?? ''}
            onChange={handleChange}
            disabled={field.isReadonly}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value ?? ''}
            onChange={handleChange}
            disabled={field.isReadonly}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        );

      case 'number':
      case 'decimal':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={handleChange}
            placeholder={field.placeholder || '0'}
            disabled={field.isReadonly}
            step={field.fieldType.toLowerCase() === 'decimal' ? '0.01' : '1'}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        );

      default: // Text, Email, Phone, etc.
        return (
          <input
            type={field.fieldType?.toLowerCase() === 'email' ? 'email' : 'text'}
            value={value ?? ''}
            onChange={handleChange}
            placeholder={field.placeholder || `أدخل ${field.label}`}
            disabled={field.isReadonly}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {field.fieldType?.toLowerCase() !== 'checkbox' && field.fieldType?.toLowerCase() !== 'boolean' && (
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
          {field.label} {field.isRequired && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      {renderInput()}
      {error && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>{error}</span>}
    </div>
  );
};
