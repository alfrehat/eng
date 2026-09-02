import React, { useEffect, useState } from 'react';
import { 
  Layers, Plus, CheckCircle, Network, ListTree, Hash, Send
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { LoadingState } from '../../components/UIStates';

export const AdminStudioPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'screens' | 'org' | 'ref' | 'numbering'>('screens');

  // Screens State
  const [modules, setModules] = useState<any[]>([]);
  const [loadingScreens, setLoadingScreens] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<any | null>(null);

  // New Screen Form
  const [newModuleCode, setNewModuleCode] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [newSectionCode, setNewSectionCode] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');

  const [newScreenCode, setNewScreenCode] = useState('');
  const [newScreenTitle, setNewScreenTitle] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  // New Field Form
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('Text');
  const [isRequired, setIsRequired] = useState(false);
  const [fieldOptionsText, setFieldOptionsText] = useState('');

  // Org State
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState(0); // 0=Directorate, 1=Department, 2=Section, 3=Unit

  // Ref Data State
  const [refLists, setRefLists] = useState<any[]>([]);
  const [newRefCode, setNewRefCode] = useState('');
  const [newRefName, setNewRefName] = useState('');
  const [newRefItemsText, setNewRefItemsText] = useState('');

  // Numbering State
  const [numberings, setNumberings] = useState<any[]>([]);
  const [newNumCode, setNewNumCode] = useState('');
  const [newNumName, setNewNumName] = useState('');
  const [newNumPrefix, setNewNumPrefix] = useState('');

  const [message, setMessage] = useState<string | null>(null);

  const fetchModules = () => {
    setLoadingScreens(true);
    apiClient.get<any[]>('/api/system/metadata/modules')
      .then(res => {
        if (res.success && res.data) {
          setModules(res.data);
          if (res.data.length > 0 && !selectedModuleId) {
            setSelectedModuleId(res.data[0].id);
          }
        }
      })
      .finally(() => setLoadingScreens(false));
  };

  const fetchOrg = () => {
    apiClient.get<any[]>('/api/system/organization')
      .then(res => res.success && setOrgUnits(res.data || []));
  };

  const fetchRef = () => {
    apiClient.get<any[]>('/api/system/reference-data')
      .then(res => res.success && setRefLists(res.data || []));
  };

  const fetchNum = () => {
    apiClient.get<any[]>('/api/system/numbering')
      .then(res => res.success && setNumberings(res.data || []));
  };

  useEffect(() => {
    fetchModules();
    fetchOrg();
    fetchRef();
    fetchNum();
  }, []);

  // Handlers
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleCode || !newModuleName) return;
    const res = await apiClient.post('/api/system/metadata/modules', {
      code: newModuleCode,
      name: newModuleName,
      displayOrder: modules.length + 1
    });
    if (res.success) {
      setNewModuleCode('');
      setNewModuleName('');
      fetchModules();
      setMessage('تم إنشاء الموديول بنجاح');
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModuleId || !newSectionCode || !newSectionName) return;
    const res = await apiClient.post('/api/system/metadata/sections', {
      moduleId: selectedModuleId,
      code: newSectionCode,
      name: newSectionName,
      displayOrder: 1
    });
    if (res.success) {
      setNewSectionCode('');
      setNewSectionName('');
      fetchModules();
      setMessage('تم إنشاء القسم بنجاح');
    }
  };

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionId || !newScreenCode || !newScreenTitle) return;
    const res = await apiClient.post('/api/system/metadata/screens', {
      sectionId: selectedSectionId,
      code: newScreenCode,
      title: newScreenTitle,
      displayOrder: 1
    });
    if (res.success) {
      setNewScreenCode('');
      setNewScreenTitle('');
      fetchModules();
      setMessage('تم إنشاء الشاشة كمسودة (Draft)');
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScreen || !fieldName || !fieldLabel) return;

    let options: any[] | undefined = undefined;
    if (fieldOptionsText.trim()) {
      options = fieldOptionsText.split('\n').map(l => {
        const parts = l.split(':');
        return {
          value: parts[0]?.trim() || l.trim(),
          label: parts[1]?.trim() || parts[0]?.trim() || l.trim()
        };
      });
    }

    const res = await apiClient.post(`/api/system/metadata/screens/${selectedScreen.id}/fields`, {
      fieldName,
      label: fieldLabel,
      fieldType,
      isRequired,
      displayOrder: (selectedScreen.fields?.length || 0) + 1,
      options
    });

    if (res.success) {
      setFieldName('');
      setFieldLabel('');
      setFieldOptionsText('');
      setIsRequired(false);
      // Refresh screen details
      const screenRes = await apiClient.get<any>(`/api/system/metadata/screens/${selectedScreen.code}`);
      if (screenRes.success) setSelectedScreen(screenRes.data);
      fetchModules();
      setMessage('تمت إضافة الحقل للشاشة');
    }
  };

  const handleAddDefaultActions = async () => {
    if (!selectedScreen) return;
    const actions = [
      { actionType: 'Create', label: 'إضافة', icon: 'Plus' },
      { actionType: 'View', label: 'عرض', icon: 'Eye' },
      { actionType: 'Edit', label: 'تعديل', icon: 'Edit' },
      { actionType: 'Delete', label: 'حذف', icon: 'Trash2' },
      { actionType: 'Print', label: 'طباعة', icon: 'Printer' }
    ];

    for (let i = 0; i < actions.length; i++) {
      await apiClient.post(`/api/system/metadata/screens/${selectedScreen.id}/actions`, {
        actionType: actions[i].actionType,
        label: actions[i].label,
        icon: actions[i].icon,
        displayOrder: i + 1
      });
    }

    const screenRes = await apiClient.get<any>(`/api/system/metadata/screens/${selectedScreen.code}`);
    if (screenRes.success) setSelectedScreen(screenRes.data);
    setMessage('تم إضافة الإجراءات الأساسية للشاشة');
  };

  const handlePublishScreen = async () => {
    if (!selectedScreen) return;
    const res = await apiClient.post(`/api/system/metadata/screens/${selectedScreen.id}/publish`);
    if (res.success) {
      setMessage(`تم نشر الشاشة (${selectedScreen.title}) وتفعيلها بنجاح في النظام!`);
      const screenRes = await apiClient.get<any>(`/api/system/metadata/screens/${selectedScreen.code}`);
      if (screenRes.success) setSelectedScreen(screenRes.data);
      fetchModules();
    } else {
      alert(res.errorMessage || 'فشل النشر');
    }
  };

  const handleCreateOrgUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgCode || !newOrgName) return;
    const res = await apiClient.post('/api/system/organization', {
      code: newOrgCode,
      name: newOrgName,
      unitType: Number(newOrgType),
      displayOrder: orgUnits.length + 1
    });
    if (res.success) {
      setNewOrgCode('');
      setNewOrgName('');
      fetchOrg();
      setMessage('تم إنشاء الوحدة التنظيمية');
    }
  };

  const handleCreateRefList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefCode || !newRefName) return;
    const items = newRefItemsText.split('\n').filter(Boolean).map(l => {
      const parts = l.split(':');
      return { value: parts[0]?.trim(), label: parts[1]?.trim() || parts[0]?.trim() };
    });

    const res = await apiClient.post('/api/system/reference-data', {
      code: newRefCode,
      name: newRefName,
      items
    });
    if (res.success) {
      setNewRefCode('');
      setNewRefName('');
      setNewRefItemsText('');
      fetchRef();
      setMessage('تم حفظ القائمة المرجعية');
    }
  };

  const handleCreateNumbering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumCode || !newNumName) return;
    const res = await apiClient.post('/api/system/numbering', {
      code: newNumCode,
      name: newNumName,
      prefix: newNumPrefix,
      yearFormat: 'YYYY',
      sequencePadding: 4,
      resetPeriod: 'YEARLY'
    });
    if (res.success) {
      setNewNumCode('');
      setNewNumName('');
      setNewNumPrefix('');
      fetchNum();
      setMessage('تم حفظ قالب الترقيم التلقائي');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
          استوديو الإدارة المركزية بدون كود (Zero-Code Studio)
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
          بناء وتوليد الشاشات، النماذج، الحقول، الهيكل التنظيمي، الترقيم والقوائم المرجعية أثناء التشغيل.
        </p>
      </div>

      {message && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{message}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('screens')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: activeTab === 'screens' ? '#2563eb' : '#f1f5f9', color: activeTab === 'screens' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Layers style={{ width: '16px', height: '16px' }} />
          مصمم الشاشات والنماذج
        </button>

        <button
          onClick={() => setActiveTab('org')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: activeTab === 'org' ? '#2563eb' : '#f1f5f9', color: activeTab === 'org' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Network style={{ width: '16px', height: '16px' }} />
          الهيكل التنظيمي
        </button>

        <button
          onClick={() => setActiveTab('ref')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: activeTab === 'ref' ? '#2563eb' : '#f1f5f9', color: activeTab === 'ref' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ListTree style={{ width: '16px', height: '16px' }} />
          القوائم المرجعية (Lookups)
        </button>

        <button
          onClick={() => setActiveTab('numbering')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: activeTab === 'numbering' ? '#2563eb' : '#f1f5f9', color: activeTab === 'numbering' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Hash style={{ width: '16px', height: '16px' }} />
          محرك الترقيم التلقائي
        </button>
      </div>

      {/* Tab 1: Screen & Form Designer */}
      {activeTab === 'screens' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left: Modules & Screens Tree */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>موديولات وشاشات النظام</h3>

            {loadingScreens && <LoadingState message="جاري التحميل..." />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
              {modules.map(mod => (
                <div key={mod.id} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>{mod.name} ({mod.code})</p>
                  {mod.sections?.map((sec: any) => (
                    <div key={sec.id} style={{ paddingRight: '0.75rem', marginTop: '0.4rem' }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>↳ {sec.name}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {sec.screens?.map((sc: any) => (
                          <button
                            key={sc.id}
                            onClick={async () => {
                              const res = await apiClient.get<any>(`/api/system/metadata/screens/${sc.code}`);
                              if (res.success) setSelectedScreen(res.data);
                            }}
                            style={{
                              textAlign: 'right',
                              padding: '0.35rem 0.6rem',
                              borderRadius: '6px',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: selectedScreen?.id === sc.id ? 700 : 500,
                              background: selectedScreen?.id === sc.id ? '#dbeafe' : 'transparent',
                              color: selectedScreen?.id === sc.id ? '#1d4ed8' : '#334155'
                            }}
                          >
                            📄 {sc.title} <span style={{ fontSize: '0.65rem', color: sc.status === 1 ? '#16a34a' : '#ea580c' }}>({sc.status === 1 ? 'منشور' : 'مسودة'})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Form to create Module */}
            <form onSubmit={handleCreateModule} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>إضافة موديول جديد</p>
              <input placeholder="رمز الموديول (e.g. LAB)" value={newModuleCode} onChange={e => setNewModuleCode(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input placeholder="اسم الموديول (e.g. المختبر)" value={newModuleName} onChange={e => setNewModuleName(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" className="btn-primary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}><Plus style={{ width: '14px', height: '14px' }} /> حفظ الموديول</button>
            </form>

            {/* Form to create Section */}
            <form onSubmit={handleCreateSection} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>إضافة قسم تابع لموديول</p>
              <select value={selectedModuleId} onChange={e => setSelectedModuleId(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="">-- اختر الموديول --</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                ))}
              </select>
              <input placeholder="رمز القسم (e.g. TESTS)" value={newSectionCode} onChange={e => setNewSectionCode(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input placeholder="اسم القسم (e.g. الفحوصات)" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" className="btn-primary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}><Plus style={{ width: '14px', height: '14px' }} /> حفظ القسم</button>
            </form>

            {/* Form to create Screen */}
            <form onSubmit={handleCreateScreen} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>إضافة شاشة جديدة</p>
              <select value={selectedSectionId} onChange={e => setSelectedSectionId(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="">-- اختر القسم التابع --</option>
                {modules.flatMap(m => m.sections || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
              <input placeholder="رمز الشاشة (e.g. VEHICLES)" value={newScreenCode} onChange={e => setNewScreenCode(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input placeholder="عنوان الشاشة (e.g. بيانات المركبات)" value={newScreenTitle} onChange={e => setNewScreenTitle(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" className="btn-primary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}><Plus style={{ width: '14px', height: '14px' }} /> إنشاء الشاشة</button>
            </form>
          </div>

          {/* Right: Selected Screen Editor */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {selectedScreen ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', background: selectedScreen.status === 1 ? '#dcfce7' : '#ffedd5', color: selectedScreen.status === 1 ? '#15803d' : '#c2410c', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      {selectedScreen.status === 1 ? 'منشور (Active)' : 'مسودة (Draft)'}
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px' }}>
                      {selectedScreen.title} ({selectedScreen.code})
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {selectedScreen.actions?.length === 0 && (
                      <button onClick={handleAddDefaultActions} style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.75rem', cursor: 'pointer' }}>
                        إضافة إجراءات افتراضية
                      </button>
                    )}
                    <button onClick={handlePublishScreen} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', background: '#16a34a' }}>
                      <Send style={{ width: '14px', height: '14px' }} />
                      نشر الشاشة (Publish)
                    </button>
                  </div>
                </div>

                {/* Fields Table */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    حقول الشاشة ({selectedScreen.fields?.length || 0})
                  </h4>
                  {selectedScreen.fields?.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>لا توجد حقول بعد. أضف أول حقل بالأسفل.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>الاسم البرمجي</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>الاسم الظاهر</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>النوع</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>إلزامي</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>الخيارات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedScreen.fields.map((f: any) => (
                          <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{f.fieldName}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{f.label}</td>
                            <td style={{ padding: '8px 10px', color: '#2563eb' }}>{f.fieldType}</td>
                            <td style={{ padding: '8px 10px' }}>{f.isRequired ? '✅ نعم' : '—'}</td>
                            <td style={{ padding: '8px 10px', fontSize: '0.72rem', color: '#64748b' }}>
                              {f.options?.map((o: any) => o.label).join(', ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Add Field Form */}
                <form onSubmit={handleAddField} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '3px' }}>الاسم البرمجي (Field Name)</label>
                    <input placeholder="e.g. plateNumber" value={fieldName} onChange={e => setFieldName(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '3px' }}>الاسم الظاهر (Label)</label>
                    <input placeholder="e.g. رقم اللوحة" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '3px' }}>نوع الحقل (Type)</label>
                    <select value={fieldType} onChange={e => setFieldType(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <option value="Text">نص (Text)</option>
                      <option value="Textarea">نص متعدد الأسطر (Textarea)</option>
                      <option value="Number">رقم صحيح (Number)</option>
                      <option value="Decimal">رقم عشري (Decimal)</option>
                      <option value="Date">تاريخ (Date)</option>
                      <option value="DateTime">تاريخ ووقت (DateTime)</option>
                      <option value="Boolean">خانة اختيار (Boolean)</option>
                      <option value="Select">قائمة منسدلة (Select)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', height: '36px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} />
                      <span>حقل إلزامي</span>
                    </label>
                  </div>

                  {fieldType === 'Select' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '3px' }}>الخيارات (كل سطر: قيمة:اسم e.g. ACTIVE:نشط)</label>
                      <textarea rows={2} value={fieldOptionsText} onChange={e => setFieldOptionsText(e.target.value)} placeholder="NEW:جديد&#10;DONE:مكتمل" style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                  )}

                  <button type="submit" className="btn-primary" style={{ height: '36px', justifyContent: 'center' }}>
                    <Plus style={{ width: '14px', height: '14px' }} />
                    إضافة الحقل
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <p>اختر شاشة من القائمة الجانبية أو قم بإنشاء شاشة جديدة لبدء التصميم.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Organization Hierarchy */}
      {activeTab === 'org' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
          <form onSubmit={handleCreateOrgUnit} className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>إضافة وحدة في الهيكل</h3>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600 }}>المستوى التنظيمي</label>
              <select value={newOrgType} onChange={e => setNewOrgType(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value={0}>مديرية (Directorate)</option>
                <option value={1}>قسم (Department)</option>
                <option value={2}>شعبة (Section)</option>
                <option value={3}>وحدة (Unit)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600 }}>الرمز</label>
              <input value={newOrgCode} onChange={e => setNewOrgCode(e.target.value)} placeholder="e.g. DEPT_STUDIES" style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600 }}>الاسم</label>
              <input value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="e.g. قسم الدراسات والتصميم" style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            </div>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              حفظ الوحدة
            </button>
          </form>

          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>الهيكل التنظيمي المعتمد</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {orgUnits.map(u => (
                <div key={u.id} style={{ padding: '0.6rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, marginLeft: '6px' }}>
                      {['مديرية', 'قسم', 'شعبة', 'وحدة'][u.unitType]}
                    </span>
                    <strong style={{ fontSize: '0.85rem' }}>{u.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginRight: '6px' }}>({u.code})</span>
                  </div>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#16a34a' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Reference Lookups */}
      {activeTab === 'ref' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
          <form onSubmit={handleCreateRefList} className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>إضافة قائمة مرجعية</h3>
            <input placeholder="رمز القائمة (e.g. TENDER_STATUS)" value={newRefCode} onChange={e => setNewRefCode(e.target.value)} style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            <input placeholder="اسم القائمة (e.g. حالات العطاء)" value={newRefName} onChange={e => setNewRefName(e.target.value)} style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            <textarea placeholder="عناصر القائمة (كل سطر: كود:اسم)&#10;DRAFT:مسودة&#10;APPROVED:معتمد" value={newRefItemsText} onChange={e => setNewRefItemsText(e.target.value)} rows={4} style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              حفظ القائمة
            </button>
          </form>

          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>القوائم المرجعية المعرفة</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {refLists.map(rl => (
                <div key={rl.id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>{rl.name} ({rl.code})</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    {rl.items?.map((i: any) => (
                      <span key={i.id} style={{ background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.72rem' }}>
                        {i.label} ({i.value})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Numbering Engine */}
      {activeTab === 'numbering' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
          <form onSubmit={handleCreateNumbering} className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>قالب ترقيم جديد</h3>
            <input placeholder="رمز القالب (e.g. TEN_SEQ)" value={newNumCode} onChange={e => setNewNumCode(e.target.value)} style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            <input placeholder="اسم القالب (e.g. ترقيم العطاءات)" value={newNumName} onChange={e => setNewNumName(e.target.value)} style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            <input placeholder="البادئة (e.g. TEN)" value={newNumPrefix} onChange={e => setNewNumPrefix(e.target.value)} style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <p style={{ fontSize: '0.7rem', color: '#64748b' }}>النمط: البادئة - السنة - 0001</p>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              حفظ قالب الترقيم
            </button>
          </form>

          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>قوالب الترقيم النشطة</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {numberings.map(n => (
                <div key={n.id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{n.name} ({n.code})</p>
                    <p style={{ fontSize: '0.72rem', color: '#64748b' }}>القيمة الحالية: {n.currentValue} | التنسيق: {n.prefix}-{n.yearFormat}-0001</p>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace' }}>
                    {n.prefix ? `${n.prefix}-2026-0001` : '2026-0001'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
