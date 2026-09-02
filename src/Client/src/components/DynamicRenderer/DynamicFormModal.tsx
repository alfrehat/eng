import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { DynamicFieldInput, FieldMeta } from './DynamicFieldInput';
import { apiClient } from '../../api/apiClient';

interface Props {
  screenCode: string;
  screenTitle: string;
  fields: FieldMeta[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DynamicFormModal: React.FC<Props> = ({
  screenCode,
  screenTitle,
  fields,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleFieldChange = (name: string, val: any) => {
    setFormData(prev => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side Validation
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.isRequired) {
        const val = formData[field.fieldName];
        if (val === undefined || val === null || val === '') {
          newErrors[field.fieldName] = `حقل ${field.label} إلزامي`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post(`/api/system/data/${screenCode}`, formData);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        alert(res.errorMessage || 'فشل حفظ السجل');
      }
    } catch (err: any) {
      alert(err.errorMessage || 'حدث خطأ أثناء حفظ السجل');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '18px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              إضافة سجل جديد: {screenTitle}
            </h3>
            <p style={{ fontSize: '0.72rem', color: '#64748b' }}>إدخال البيانات وفق تعريفات الحقول الديناميكية</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {fields.map(field => (
            <DynamicFieldInput
              key={field.id || field.fieldName}
              field={field}
              value={formData[field.fieldName]}
              onChange={handleFieldChange}
              error={errors[field.fieldName]}
            />
          ))}

          {/* Footer Submit inside form */}
          <div style={{ gridColumn: '1 / -1', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.82rem', cursor: 'pointer' }}>
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.55rem 1.25rem' }}>
              <Save style={{ width: '16px', height: '16px' }} />
              {submitting ? 'جاري الحفظ...' : 'حفظ السجل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
