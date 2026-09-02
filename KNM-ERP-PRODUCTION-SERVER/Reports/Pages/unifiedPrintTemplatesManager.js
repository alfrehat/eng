/**
 * Reports/Pages/unifiedPrintTemplatesManager.js
 * محرر قوالب النماذج والطباعة الرسمية الموحد (Unified Official Print Templates Suite v4.0 Enterprise)
 * المملكة الأردنية الهاشمية - بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * ─────────────────────────────────────────────────────────────────────────────
 * الميزات والمعايير المعمارية المطبقة:
 * 1. توحيد شاشة وتبويب "محرر قوالب النماذج والطباعة الرسمية" و "قوالب الطباعة الرسمية".
 * 2. دعم كامل للوضع الداكن (Dark Mode) والوضع النهاري (Light Mode).
 * 3. لوحة تحكم وإحصائيات KPI متقدمة.
 * 4. نافذة تصميم مخصصة واسعة (Dedicated Modal Overlay) متعددة التبويبات مع تبديل سلس وسريع:
 *    - 📋 بيانات وهوية القالب (Metadata & Orientation)
 *    - ✍️ محرر المحتوى البصري المباشر (WYSIWYG Live Canvas with Dynamic Variables Toolbar)
 *    - 🖋️ إدارة سلاسل التواقيع والاعتماد الرسمية (Interactive Signatures Chain)
 *    - 👁️ معاينة الطباعة الحية A4 (Live A4 Preview Sheet)
 * 5. طباعة معتمدة بدون أي تكرار أو أشرطة مشوهة عبر printStandardDocument.
 * 6. ربط كامل بالخادم API مع حفظ وتراجع محلي في LocalStorage.
 */

(function (global) {
  'use strict';

  class UnifiedPrintTemplatesManager {
    constructor(containerId) {
      this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      this.templates = [];
      this.activeFilter = 'ALL';
      this.searchQuery = '';
      this.currentViewMode = 'gallery'; // 'gallery' | 'table'
      this.editingTemplate = null;
      this.modalActiveTab = 'general'; // 'general' | 'content' | 'signatures' | 'preview'
      this.currentUser = this._getCurrentUser();

      this.init();
    }

    _getCurrentUser() {
      try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : { role: 'admin', fullName: 'مدير النظام' };
      } catch (e) {
        return { role: 'admin', fullName: 'مدير النظام' };
      }
    }

    /* ── القوالب الجاهزة المعتمدة تلقائياً لبلدية كفرنجة ─────────────────── */
    getDefaultSystemTemplates() {
      return [
        {
          id: 'TMPL-LETTER-01',
          name: 'كتاب إداري رسمي موجه (Official Letter)',
          module: 'LETTER',
          category_ar: 'الكتب الرسمية والمخاطبات',
          is_default: true,
          orientation: 'portrait',
          updated_at: new Date().toISOString(),
          description: 'النموذج المعتمد للمخاطبات والكتب الرسمية الصادرة من مديرية الأشغال والخدمات الهندسية إلى الدوائر والمؤسسات.',
          signatures_config: [
            { roleName: 'المهندس المنظم', signLabel: 'إعداد وتنظيم' },
            { roleName: 'رئيس القسم', signLabel: 'تدقيق فني' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'اعتماد وتنسيب' },
            { roleName: 'عطوفة رئيس بلدية كفرنجة الجديدة', signLabel: 'المصادقة والتوقيع الرسمي' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif; line-height:1.8; font-size:1.02rem; color:#0f172a; padding:8px;">
              <div style="margin-bottom:18px; font-weight:bold;">
                <p style="margin:4px 0;"><b>دولة / عطوفة / سعادة:</b> \${recipientName}</p>
                <p style="margin:4px 0;"><b>الموضوع:</b> \${subject}</p>
              </div>
              <p style="text-indent:25px; text-align:justify; margin-bottom:14px;">
                تحية طيبة وبعد،،،<br>
                بالإشارة إلى المعاملة رقم (<b>\${refNumber}</b>) والمؤرخة بتاريخ (<b>\${date}</b>) المتعلقة بـ <b>\${details}</b>، نود إعلامكم بالآتي:
              </p>
              <div style="background:#f8fafc; border-right:4px solid #1e3a8a; padding:12px 16px; margin:16px 0; border-radius:6px; font-size:0.95rem; border:1px solid #e2e8f0; border-right-width:4px;">
                \${contentBody}
              </div>
              <p style="text-align:justify; margin-top:16px;">
                يرجى التكرم بالاطلاع والتوجيه بما يلزم لاستكمال الإجراءات أصولاً.
              </p>
              <p style="text-align:center; margin-top:28px; font-weight:bold; color:#1e3a8a; font-size:1.05rem;">
                واقبلوا فائق الاحترام والتقدير،،،
              </p>
            </div>
          `
        },
        {
          id: 'TMPL-TENDER-01',
          name: 'قرار لجنة دراسة وتحليل عطاء وتوصية الترسية',
          module: 'TENDERS',
          category_ar: 'العطاءات والمشاريع',
          is_default: true,
          orientation: 'portrait',
          updated_at: new Date().toISOString(),
          description: 'قرار لجنة دراسة وتدقيق العروض الفنية والمالية وتوصية ترسية العطاء على المناقص الفائز.',
          signatures_config: [
            { roleName: 'رئيس اللجنة الفنية', signLabel: 'تدقيق وتوصية' },
            { roleName: 'عضو اللجنة - مالي', signLabel: 'تدقيق مالي' },
            { roleName: 'عضو اللجنة - مهندس', signLabel: 'تدقيق هندسي' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'المصادقة الفنية' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif; line-height:1.7; font-size:0.96rem; color:#0f172a;">
              <div style="background:#1e3a8a; color:#ffffff; padding:10px 14px; text-align:center; font-weight:bold; border-radius:6px; margin-bottom:14px;">
                محضر اجتماع لجنة دراسة وتحليل عروض العطاء رقم (<b>\${tenderNo}</b>)
              </div>
              <table style="width:100%; border-collapse:collapse; margin-bottom:14px; border:1px solid #cbd5e1;">
                <tr>
                  <th style="padding:8px; background:#f1f5f9; border:1px solid #cbd5e1; width:25%; color:#1e3a8a;">اسم العطاء:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;" colspan="3">\${tenderName}</td>
                </tr>
                <tr>
                  <th style="padding:8px; background:#f1f5f9; border:1px solid #cbd5e1; color:#1e3a8a;">المناقص الفائز:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1; color:#0284c7; font-weight:bold;">\${contractorName}</td>
                  <th style="padding:8px; background:#f1f5f9; border:1px solid #cbd5e1; color:#1e3a8a;">قيمة الإحالة:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1; color:#16a34a; font-weight:bold;">\${totalAmount} دينار أردني</td>
                </tr>
                <tr>
                  <th style="padding:8px; background:#f1f5f9; border:1px solid #cbd5e1; color:#1e3a8a;">مدة التنفيذ:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1;">\${executionPeriod}</td>
                  <th style="padding:8px; background:#f1f5f9; border:1px solid #cbd5e1; color:#1e3a8a;">تاريخ الجلسة:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1;">\${sessionDate}</td>
                </tr>
              </table>
              <p style="margin-bottom:12px; text-align:justify;">
                اجتمعت اللجنة الفنية المشكلة واطلعت على العروض المالية والفنية المقدمة، وبعد الدراسة والتدقيق الفني والمعاينة الميدانية تبين مطابقة عرض المناقص المذكور أعلى لكافة الشروط والمواصفات الفنية المعتمدة.
              </p>
              <div style="border:1px solid #0284c7; background:#e0f2fe; padding:12px; border-radius:6px; font-weight:bold; color:#0369a1; text-align:center;">
                توصي اللجنة بترسية العطاء المذكور وإبلاغ المناقص بتقديم كفالة حسن التنفيذ وقيمتها (10%) خلال 10 أيام من تاريخ التبليغ.
              </div>
            </div>
          `
        },
        {
          id: 'TMPL-CLAIM-01',
          name: 'محضر كشف وصرف مطالبة مالية (Financial Claim)',
          module: 'CLAIMS',
          category_ar: 'المطالبات والمالية',
          is_default: true,
          orientation: 'portrait',
          updated_at: new Date().toISOString(),
          description: 'شهادة استحقاق ودفع كشف مطالبة جارية أو ختامية لمشروع هندسي معتمد.',
          signatures_config: [
            { roleName: 'المهندس المشرف', signLabel: 'تدقيق الأعمال المنجزة' },
            { roleName: 'رئيس القسم', signLabel: 'تدقيق فني وحسابي' },
            { roleName: 'رئيس القسم المالي', signLabel: 'تدقيق المخصصات والإنفاق' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'الاعتماد الفني للصرف' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif; line-height:1.7; font-size:0.95rem;">
              <table style="width:100%; border-collapse:collapse; margin-bottom:14px; border:1px solid #cbd5e1;">
                <tr style="background:#0f172a; color:#fff;">
                  <th colspan="4" style="padding:10px; text-align:center; font-size:1.05rem;">شهادة استحقاق كشف مطالبة مالية رقم (<b>\${claimNo}</b>)</th>
                </tr>
                <tr>
                  <th style="padding:8px; background:#f8fafc; border:1px solid #cbd5e1; width:22%; color:#1e3a8a;">اسم المقاول:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">\${contractorName}</td>
                  <th style="padding:8px; background:#f8fafc; border:1px solid #cbd5e1; width:22%; color:#1e3a8a;">رقم العطاء:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1;">\${tenderNo}</td>
                </tr>
                <tr>
                  <th style="padding:8px; background:#f8fafc; border:1px solid #cbd5e1; color:#1e3a8a;">إجمالي الأعمال المنفذة:</th>
                  <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e3a8a;">\${grossAmount} د.أ</td>
                  <th style="padding:8px; background:#f8fafc; border:1px solid #cbd5e1; color:#1e3a8a;">الاحتباسات والكفالات (10%):</th>
                  <td style="padding:8px; border:1px solid #cbd5e1; color:#dc2626;">\${retentionAmount} د.أ</td>
                </tr>
                <tr>
                  <th style="padding:10px; background:#f8fafc; border:1px solid #cbd5e1; color:#1e3a8a;">الدفعة الصافية المستحقة:</th>
                  <td colspan="3" style="padding:10px; border:1px solid #cbd5e1; background:#f0fdf4; font-size:1.15rem; color:#16a34a; font-weight:bold;">\${netPayable} دينار أردني فقط لا غير</td>
                </tr>
              </table>
              <p style="font-size:0.9rem; color:#334155; margin-bottom:10px;">
                تشهد مديرية الأشغال بأن الأعمال التراكمية الموضحة بالكشف المرفق قد تم تنفيذها طبقاً للمواصفات الهندسية والمخططات المعتمدة وتم التدقيق الميداني والقياسات المساحية أصولاً.
              </p>
            </div>
          `
        },
        {
          id: 'TMPL-COMMITTEE-01',
          name: 'شهادة استلام ابتدائي / نهائي لمشروع هندسي',
          module: 'COMMITTEES',
          category_ar: 'تقارير اللجان والاستلام',
          is_default: true,
          orientation: 'portrait',
          updated_at: new Date().toISOString(),
          description: 'محضر لجنة الاستلام الابتدائي أو النهائي للمشاريع المنفذة من المقاولين.',
          signatures_config: [
            { roleName: 'رئيس لجنة الاستلام', signLabel: 'المعاينة والاستلام' },
            { roleName: 'عضو اللجنة الفنية', signLabel: 'المعاينة الهندسية' },
            { roleName: 'ممثل ديوان المحاسبة / الرقابة', signLabel: 'تدقيق ورقابة' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'المصادقة والاعتماد' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif; line-height:1.7;">
              <h3 style="text-align:center; color:#1e3a8a; font-weight:bold; margin-bottom:14px;">محضر لجنة الاستلام الابتدائي لمشروع (<b>\${projectName}</b>)</h3>
              <p style="text-align:justify; margin-bottom:12px;">
                في يوم <b>\${dayName}</b> الموافق <b>\${date}</b>، قامت لجنة الاستلام المشكلة بالمعاينة الميدانية للمشروع المذكور أعلاه والمنفذ من قبل المقاول (<b>\${contractorName}</b>).\n              </p>
              <div style="background:#f8fafc; padding:14px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:14px;">
                <b style="color:#1e3a8a;">نتائج المعاينة والملاحظات الفنية:</b>
                <p style="margin-top:6px; color:#334155;">\${inspectionNotes}</p>
              </div>
              <p style="font-weight:bold; color:#16a34a; text-align:center;">توصي اللجنة بقبول الاستلام الابتدائي وبدء فترة الصيانة من تاريخه أصولاً.</p>
            </div>
          `
        },
        {
          id: 'TMPL-PERMIT-01',
          name: 'تصريح حفر وإعادة أوضاع شبكات الخدمات',
          module: 'PERMITS',
          category_ar: 'تصاريح الحفر وتزويد الخدمات',
          is_default: true,
          orientation: 'portrait',
          updated_at: new Date().toISOString(),
          description: 'تصريح رسمي صادر للشركات والمواطنين لأعمال حفر الشوارع وتوصيل خطوط الخدمة وإعادة الأوضاع.',
          signatures_config: [
            { roleName: 'مراقب الأبنية والحفريات', signLabel: 'الكشف الميداني' },
            { roleName: 'رئيس قسم الطرق والمرور', signLabel: 'التدقيق والموافقة' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'إصدار التصريح' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif;">
              <div style="border:2px solid #ea580c; padding:12px; border-radius:8px; background:#fff7ed; margin-bottom:14px;">
                <h3 style="margin:0 0 6px 0; color:#c2410c; text-align:center;">تصريح حفر طريق وإعادة أوضاع رقم (<b>\${permitNo}</b>)</h3>
                <p style="margin:0; text-align:center; font-size:0.88rem; color:#9a3412;">يسمح بموجب هذا التصريح للجهة الطالبة بالحفر ضمن الشروط الهندسية المحددة أدناه</p>
              </div>
              <table style="width:100%; border-collapse:collapse; margin-bottom:12px; border:1px solid #fed7aa;">
                <tr>
                  <th style="padding:8px; background:#ffedd5; width:25%; color:#9a3412;">الجهة الطالبة:</th>
                  <td style="padding:8px; border:1px solid #fed7aa; font-weight:bold;">\${applicantName}</td>
                  <th style="padding:8px; background:#ffedd5; width:25%; color:#9a3412;">موقع الحفر:</th>
                  <td style="padding:8px; border:1px solid #fed7aa;">\${streetLocation}</td>
                </tr>
                <tr>
                  <th style="padding:8px; background:#ffedd5; color:#9a3412;">نوع الخدمة:</th>
                  <td style="padding:8px; border:1px solid #fed7aa;">\${serviceType}</td>
                  <th style="padding:8px; background:#ffedd5; color:#9a3412;">مبلغ التأمين المسترد:</th>
                  <td style="padding:8px; border:1px solid #fed7aa; font-weight:bold; color:#c2410c;">\${depositAmount} د.أ</td>
                </tr>
              </table>
              <div style="font-size:0.85rem; color:#475569; border-top:1px dashed #cbd5e1; padding-top:8px;">
                * الالتزام التام بالسلامة المرورية ودك الطبقات وإعادة التعبيد بالإسفلت المعتمد خلال 48 ساعة من إنجاز العمل.
              </div>
            </div>
          `
        },
        {
          id: 'TMPL-PAVING-01',
          name: 'مستند احتساب عوائد تعبيد وتحققات مالية',
          module: 'PAVING',
          category_ar: 'عوائد التعبيد والتحققات',
          is_default: true,
          orientation: 'portrait',
          updated_at: new Date().toISOString(),
          description: 'مستند تقدير واحتساب عوائد التعبيد والأرصفة المفروضة على القطع والشوارع التنظيمية.',
          signatures_config: [
            { roleName: 'المساح المنظم', signLabel: 'الرفع المساحي' },
            { roleName: 'رئيس قسم التخطيط والمساحة', signLabel: 'التدقيق المساحي' },
            { roleName: 'المدقق المالي', signLabel: 'احتساب الرسوم' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'الاعتماد الرسمي' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif;">
              <h3 style="text-align:center; color:#15803d; border-bottom:2px solid #15803d; padding-bottom:6px; margin-bottom:14px;">مستند احتساب عوائد تعبيد وأرصفة</h3>
              <table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
                <tr>
                  <th style="padding:8px; background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d;">اسم مالك القطعة:</th>
                  <td style="padding:8px; border:1px solid #bbf7d0; font-weight:bold;">\${ownerName}</td>
                  <th style="padding:8px; background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d;">رقم القطعة / الحوض:</th>
                  <td style="padding:8px; border:1px solid #bbf7d0;">\${parcelNo}</td>
                </tr>
                <tr>
                  <th style="padding:8px; background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d;">طول الواجهة (متر):</th>
                  <td style="padding:8px; border:1px solid #bbf7d0;">\${frontageMeters} م</td>
                  <th style="padding:8px; background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d;">عرض الشارع (متر):</th>
                  <td style="padding:8px; border:1px solid #bbf7d0;">\${streetWidth} م</td>
                </tr>
                <tr>
                  <th style="padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d;">إجمالي التحققات المطلوبة:</th>
                  <td colspan="3" style="padding:10px; border:1px solid #bbf7d0; font-weight:bold; font-size:1.15rem; color:#15803d;">\${totalAssessment} دينار أردني</td>
                </tr>
              </table>
            </div>
          `
        },
        {
          id: 'TMPL-RAMS-01',
          name: 'تقرير معاينة وفحص شبكة الطرق (RAMS - PCI)',
          module: 'ROADS',
          category_ar: 'شبكة الطرق والقياس الجغرافي',
          is_default: true,
          orientation: 'landscape',
          updated_at: new Date().toISOString(),
          description: 'تقرير فحص حالة الطريق وتأهيل الرصفات مع حالة مؤشر PCI وخطة الصيانة الوقائية والتصحيحية.',
          signatures_config: [
            { roleName: 'مهندس الطرق والمشاريع', signLabel: 'المعاينة الميدانية' },
            { roleName: 'رئيس قسم الطرق', signLabel: 'التدقيق الهندسي' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'المصادقة الفنية' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif;">
              <h3 style="text-align:center; color:#1e3a8a; margin-bottom:14px;">تقرير تقييم حالة الطريق والمجلس الإسفلتي (Pavement Condition Index - RAMS)</h3>
              <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1;">
                <tr style="background:#1e3a8a; color:#fff;">
                  <th style="padding:8px;">معرف الطريق</th>
                  <th style="padding:8px;">اسم الشارع / المنطقة</th>
                  <th style="padding:8px;">مؤشر PCI</th>
                  <th style="padding:8px;">نوع العيوب والتخسفات</th>
                  <th style="padding:8px;">التوصية الفنية والهندسية</th>
                </tr>
                <tr>
                  <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-family:monospace; font-weight:bold;">\${roadId}</td>
                  <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">\${roadName}</td>
                  <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#0284c7;">\${pciScore}/100</td>
                  <td style="padding:8px; border:1px solid #cbd5e1;">\${distressType}</td>
                  <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#16a34a;">\${recommendation}</td>
                </tr>
              </table>
            </div>
          `
        },
        {
          id: 'TMPL-CONTRACT-01',
          name: 'عقد وتعهد تنفيذ وإشراف مشروع هندسي',
          module: 'CONTRACTS',
          category_ar: 'العقود والضمانات',
          is_default: true,
          orientation: 'portrait',
          updated_at: new Date().toISOString(),
          description: 'عقد مقاولة رسمي لتنفيذ المشاريع والأشغال مع شروط الكفالات والضمانات البنكية وغرامات التأخير.',
          signatures_config: [
            { roleName: 'الفريق الأول - رئيس البلدية', signLabel: 'عن صاحب العمل' },
            { roleName: 'الفريق الثاني - المقاول المنفذ', signLabel: 'عن المقاول' },
            { roleName: 'المستشار القانوني', signLabel: 'التدقيق القانوني' },
            { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'الإشراف والاعتماد' }
          ],
          html_template: `
            <div style="font-family:'Tajawal',sans-serif; line-height:1.7;">
              <h2 style="text-align:center; color:#0f172a; margin-bottom:14px;">عقد مقاولة وتنفيذ مشروع (<b>\${contractTitle}</b>)</h2>
              <p style="text-align:justify;">
                إنه في يوم <b>\${contractDate}</b> تم الاتفاق بين <b>بلدية كفرنجة الجديدة</b> (الفريق الأول) و<b>شركة \${contractorName}</b> (الفريق الثاني) على تنفيذ أعمال المشروع بقيمة إجمالية قدرها (<b>\${contractValue}</b>) دينار أردني.
              </p>
              <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:6px; margin:14px 0;">
                <b style="color:#1e3a8a;">الكفالات المقدمة:</b> كفالة حسن تنفيذ رقم (<b>\${guaranteeNo}</b>) الصادرة من (<b>\${bankName}</b>) بمبلغ (<b>\${guaranteeAmount}</b>) د.أ والصالحة لغاية (<b>\${guaranteeExpiry}</b>).
              </div>
            </div>
          `
        }
      ];
    }

    /* ── التحميل والتهيئة ─────────────────────────────────────────────────── */
    async init() {
      this.render();
      await this.fetchTemplates();
    }

    async fetchTemplates() {
      try {
        const res = await fetch('/api/v4/print-templates', {
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('token') } : {})
          }
        }).catch(() => null);

        let remoteData = null;
        if (res && res.ok) {
          const json = await res.json();
          remoteData = json.data;
        }

        const defaults = this.getDefaultSystemTemplates();
        let stored = [];
        try {
          const s = localStorage.getItem('system_print_templates');
          if (s) stored = JSON.parse(s);
        } catch (e) {}

        if (Array.isArray(remoteData) && remoteData.length > 0) {
          const map = new Map();
          defaults.forEach(t => map.set(t.id, t));
          remoteData.forEach(t => map.set(t.id, { ...map.get(t.id), ...t }));
          this.templates = Array.from(map.values());
        } else if (Array.isArray(stored) && stored.length > 0) {
          const map = new Map();
          defaults.forEach(t => map.set(t.id, t));
          stored.forEach(t => map.set(t.id, { ...map.get(t.id), ...t }));
          this.templates = Array.from(map.values());
        } else {
          this.templates = defaults;
        }

        this.saveLocalBackup();
        this.render();
        this.updateBadgeCount();
      } catch (err) {
        console.warn('⚠️ Print templates fallback loaded:', err.message);
        this.templates = this.getDefaultSystemTemplates();
        this.render();
        this.updateBadgeCount();
      }
    }

    saveLocalBackup() {
      try {
        localStorage.setItem('system_print_templates', JSON.stringify(this.templates));
      } catch (e) {}
    }

    updateBadgeCount() {
      const b = document.getElementById('badge-print-templates');
      if (b) b.textContent = this.templates.length;
    }

    /* ── رسم الهيكل الموحد للواجهة الرئيسيـة ─────────────────────────────── */
    render() {
      if (!this.container) {
        this.container = document.getElementById('print-templates-tab-container') || document.getElementById('page-print-templates');
      }
      if (!this.container) return;

      const filtered = this.getFilteredTemplates();
      const defaultCount = this.templates.filter(t => t.is_default).length;
      const modulesCount = new Set(this.templates.map(t => t.module)).size;
      const customCount = this.templates.filter(t => !String(t.id).startsWith('TMPL-')).length;

      this.container.innerHTML = `
        <div class="print-templates-suite-wrapper" style="direction:rtl; font-family:'Tajawal',sans-serif; padding:4px 0 24px 0; color:var(--text, #0f172a); width:100%; box-sizing:border-box; overflow-x:hidden;">
          
          <!-- Modern Executive Top Header -->
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:20px; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:14px; width:100%;">
            <div style="flex:1; min-width:260px;">
              <h2 style="font-size:1.38rem; font-weight:800; color:var(--text, #0f172a); margin:0 0 4px 0; display:flex; align-items:center; gap:10px;">
                <span>🖨️</span> <span>محرر قوالب النماذج والطباعة الرسمية</span>
              </h2>
              <p style="margin:0; font-size:0.85rem; color:var(--text-muted, #64748b);">
                إدارة وتصميم الهوية البصرية، النماذج المعتمدة، سلاسل التواقيع والاعتماد لكافة قطاعات الأشغال الهندسية
              </p>
            </div>
            
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-primary" onclick="window.unifiedPrintTemplatesManager.openMasterConfigModal()" style="display:flex; align-items:center; gap:6px; font-weight:bold; font-size:0.86rem; padding:8px 16px; background:linear-gradient(135deg, #1e3a8a, #0f766e); border:none; color:#fff; box-shadow:0 3px 12px rgba(30,58,138,0.25);">
                <span>⚙️</span> <span>تخصيص النموذج العام للنظام</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.openTemplateModal()" style="display:flex; align-items:center; gap:6px; font-weight:bold; font-size:0.86rem; padding:8px 16px;">
                <span>✨</span> <span>إنشاء قالب جديد</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.printCatalog()" style="display:flex; align-items:center; gap:6px; font-size:0.84rem; padding:8px 14px;">
                <span>🖨️</span> <span>طباعة كشف القوالب</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.exportToCSV()" style="display:flex; align-items:center; gap:6px; font-size:0.84rem; padding:8px 14px;">
                <span>📥</span> <span>تصدير Excel</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.resetToDefaults()" style="display:flex; align-items:center; gap:6px; font-size:0.84rem; padding:8px 14px;" title="إعادة ضبط القوالب الأساسية">
                <span>🔄</span> <span>الافتراضي</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.fetchTemplates()" style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; padding:0;" title="تحديث">
                <span>⚡</span>
              </button>
            </div>
          </div>

          <!-- KPI Summary Cards -->
          <div class="stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin-bottom:22px;">
            
            <div class="stat-card" style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 3px 10px rgba(0,0,0,0.03);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(30,58,138,0.12); color:#1e3a8a; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                📄
              </div>
              <div>
                <div style="font-size:1.35rem; font-weight:800; color:var(--text, #0f172a); line-height:1.2;">${this.templates.length}</div>
                <div style="font-size:0.76rem; color:var(--text-muted, #64748b);">إجمالي قوالب النماذج</div>
              </div>
            </div>

            <div class="stat-card" style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 3px 10px rgba(0,0,0,0.03);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(22,163,74,0.12); color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                ⭐
              </div>
              <div>
                <div style="font-size:1.35rem; font-weight:800; color:var(--text, #0f172a); line-height:1.2;">${defaultCount}</div>
                <div style="font-size:0.76rem; color:var(--text-muted, #64748b);">قوالب معتمدة مفعلة</div>
              </div>
            </div>

            <div class="stat-card" style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 3px 10px rgba(0,0,0,0.03);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(2,132,199,0.12); color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                🏛️
              </div>
              <div>
                <div style="font-size:1.35rem; font-weight:800; color:var(--text, #0f172a); line-height:1.2;">${modulesCount}</div>
                <div style="font-size:0.76rem; color:var(--text-muted, #64748b);">قطاعات وموديولات مشمولة</div>
              </div>
            </div>

            <div class="stat-card" style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 3px 10px rgba(0,0,0,0.03);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(217,119,6,0.12); color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                🎨
              </div>
              <div>
                <div style="font-size:1.35rem; font-weight:800; color:var(--text, #0f172a); line-height:1.2;">${customCount}</div>
                <div style="font-size:0.76rem; color:var(--text-muted, #64748b);">قوالب مخصصة من المستخدم</div>
              </div>
            </div>

          </div>

          <!-- Filters & View Switcher Toolbar -->
          <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px 18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            
            <!-- Category Filter Tabs -->
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-sm ${this.activeFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('ALL')">الكل (${this.templates.length})</button>
              <button class="btn btn-sm ${this.activeFilter === 'LETTER' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('LETTER')">✉️ الكتب الرسمية</button>
              <button class="btn btn-sm ${this.activeFilter === 'TENDERS' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('TENDERS')">📋 العطاءات</button>
              <button class="btn btn-sm ${this.activeFilter === 'CLAIMS' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('CLAIMS')">📝 المطالبات</button>
              <button class="btn btn-sm ${this.activeFilter === 'COMMITTEES' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('COMMITTEES')">👥 اللجان</button>
              <button class="btn btn-sm ${this.activeFilter === 'PERMITS' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('PERMITS')">🚜 تصاريح الحفر</button>
              <button class="btn btn-sm ${this.activeFilter === 'PAVING' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('PAVING')">💰 عوائد التعبيد</button>
              <button class="btn btn-sm ${this.activeFilter === 'ROADS' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('ROADS')">🛣️ الطرق RAMS</button>
              <button class="btn btn-sm ${this.activeFilter === 'CONTRACTS' ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setFilter('CONTRACTS')">📜 العقود</button>
            </div>

            <!-- Right Controls: Search Box & View Mode Toggle -->
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <div style="position:relative; width:220px;">
                <input type="text" placeholder="بحث سريع في القوالب..." value="${this.searchQuery}" oninput="window.unifiedPrintTemplatesManager.setSearchQuery(this.value)" style="width:100%; padding:6px 28px 6px 10px; border-radius:8px; border:1px solid var(--border, #cbd5e1); font-size:0.82rem; background:var(--bg, #fff); color:var(--text, #000);" />
                <span style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:0.85rem; color:#94a3b8;">🔍</span>
              </div>

              <div style="display:flex; border:1px solid var(--border, #cbd5e1); border-radius:8px; overflow:hidden;">
                <button onclick="window.unifiedPrintTemplatesManager.setViewMode('gallery')" style="padding:6px 12px; background:${this.currentViewMode === 'gallery' ? 'var(--primary, #1e3a8a)' : 'transparent'}; color:${this.currentViewMode === 'gallery' ? '#fff' : 'var(--text)'}; border:none; cursor:pointer; font-size:0.82rem; font-weight:bold;" title="عرض البطاقات">
                  🖼️ معرض
                </button>
                <button onclick="window.unifiedPrintTemplatesManager.setViewMode('table')" style="padding:6px 12px; background:${this.currentViewMode === 'table' ? 'var(--primary, #1e3a8a)' : 'transparent'}; color:${this.currentViewMode === 'table' ? '#fff' : 'var(--text)'}; border:none; cursor:pointer; font-size:0.82rem; font-weight:bold;" title="عرض الجدول">
                  📊 جدول
                </button>
              </div>
            </div>

          </div>

          <!-- Main Content Area -->
          <div id="print-templates-main-content">
            ${this.renderMainContent(filtered)}
          </div>

        </div>
      `;
    }

    /* ── التصفية والبحث ───────────────────────────────────────────────────── */
    getFilteredTemplates() {
      return this.templates.filter(t => {
        const matchesFilter = this.activeFilter === 'ALL' || t.module === this.activeFilter;
        const q = this.searchQuery.toLowerCase().trim();
        const matchesSearch = !q || (
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.id && t.id.toLowerCase().includes(q)) ||
          (t.category_ar && t.category_ar.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
        );
        return matchesFilter && matchesSearch;
      });
    }

    setFilter(filter) {
      this.activeFilter = filter;
      this.render();
    }

    setSearchQuery(q) {
      this.searchQuery = q;
      this.render();
    }

    setViewMode(mode) {
      this.currentViewMode = mode;
      this.render();
    }

    /* ── رسم المحتوى ──────────────────────────────────────────────────────── */
    renderMainContent(filtered) {
      if (!filtered.length) {
        return `
          <div style="text-align:center; padding:48px 16px; background:var(--bg-card, #fff); border:1px dashed var(--border, #cbd5e1); border-radius:12px; color:var(--text-muted, #64748b);">
            <div style="font-size:3rem; margin-bottom:12px;">📄</div>
            <h3 style="margin:0 0 6px 0; font-size:1.1rem; color:var(--text);">لا توجد قوالب طباعة مطابقة لخيارات التصفية</h3>
            <p style="margin:0 0 16px 0; font-size:0.85rem;">يمكنك تصميم قالب جديد أو إعادة ضبط القوالب الافتراضية للنظام.</p>
            <button class="btn btn-primary btn-sm" onclick="window.unifiedPrintTemplatesManager.openTemplateModal()">+ إنشاء قالب جديد</button>
          </div>
        `;
      }

      if (this.currentViewMode === 'gallery') {
        return `
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
            ${filtered.map(t => this.renderTemplateCard(t)).join('')}
          </div>
        `;
      }

      return this.renderTemplateTable(filtered);
    }

    /* ── بطاقة القالب (Gallery Card View) ────────────────────────────────── */
    renderTemplateCard(t) {
      const moduleBadgeColors = {
        LETTER: '#1e3a8a',
        TENDERS: '#0284c7',
        CLAIMS: '#16a34a',
        COMMITTEES: '#d97706',
        PERMITS: '#ea580c',
        PAVING: '#059669',
        ROADS: '#7c3aed',
        CONTRACTS: '#0f172a'
      };

      const bgHeader = moduleBadgeColors[t.module] || '#1e3a8a';

      return `
        <div class="template-card" style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.2s, box-shadow 0.2s; box-shadow:0 3px 10px rgba(0,0,0,0.03);">
          
          <div>
            <!-- Card Banner -->
            <div style="background:${bgHeader}; color:#fff; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-size:0.72rem; background:rgba(255,255,255,0.22); padding:2px 8px; border-radius:10px; font-weight:bold;">${t.category_ar || t.module}</span>
                <h4 style="margin:6px 0 0 0; font-size:0.95rem; font-weight:bold; color:#fff; line-height:1.3;">${t.name}</h4>
              </div>
              ${t.is_default ? '<span style="font-size:1.15rem;" title="القالب الافتراضي المعتمد">⭐</span>' : ''}
            </div>

            <!-- Card Body -->
            <div style="padding:14px;">
              <p style="margin:0 0 12px 0; font-size:0.82rem; color:var(--text-muted, #475569); min-height:36px; line-height:1.5; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                ${t.description || 'قالب طباعة معتمد ونموذج رسمي لبلدية كفرنجة الجديدة.'}
              </p>

              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted, #64748b); border-top:1px solid var(--border, #f1f5f9); padding-top:8px;">
                <span>المعرف: <b style="font-family:monospace; color:var(--text);">${t.id}</b></span>
                <span>الاتجاه: <b>${t.orientation === 'landscape' ? 'أفقي (A4)' : 'عمودي (A4)'}</b></span>
              </div>
            </div>
          </div>

          <!-- Card Footer Actions -->
          <div style="background:var(--bg-surface, #f8fafc); border-top:1px solid var(--border, #e2e8f0); padding:10px 14px; display:flex; gap:6px; flex-wrap:wrap; justify-content:space-between; align-items:center;">
            <div style="display:flex; gap:4px;">
              <button class="btn btn-sm btn-primary" onclick="window.unifiedPrintTemplatesManager.previewTemplate('${t.id}')" style="font-size:0.76rem; padding:4px 10px;">
                👁️ معاينة
              </button>
              <button class="btn btn-sm btn-outline" onclick="window.unifiedPrintTemplatesManager.printTestTemplate('${t.id}')" style="font-size:0.76rem; padding:4px 10px;">
                🖨️ طباعة
              </button>
            </div>

            <div style="display:flex; gap:4px;">
              <button class="btn btn-sm btn-outline" onclick="window.unifiedPrintTemplatesManager.openTemplateModal('${t.id}')" style="font-size:0.76rem; padding:4px 8px;" title="تعديل وتصميم القالب">
                ✏️
              </button>
              <button class="btn btn-sm btn-outline" onclick="window.unifiedPrintTemplatesManager.duplicateTemplate('${t.id}')" style="font-size:0.76rem; padding:4px 8px;" title="نسخ القالب">
                📋
              </button>
              ${!t.is_default ? `
                <button class="btn btn-sm btn-outline" onclick="window.unifiedPrintTemplatesManager.setDefaultTemplate('${t.id}')" style="font-size:0.76rem; padding:4px 8px; color:#16a34a;" title="تعيين كافتراضي">
                  ⭐
                </button>
                <button class="btn btn-sm btn-outline" onclick="window.unifiedPrintTemplatesManager.deleteTemplate('${t.id}')" style="font-size:0.76rem; padding:4px 8px; color:#dc2626;" title="حذف">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>

        </div>
      `;
    }

    /* ── جدول القوالب (Data Table View) ─────────────────────────────────── */
    renderTemplateTable(filtered) {
      return `
        <div class="table-container" style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; overflow:hidden;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border, #cbd5e1); text-align:right;">
                <th style="padding:10px 14px; font-size:0.85rem;">المعرف</th>
                <th style="padding:10px 14px; font-size:0.85rem;">اسم القالب الرسمي</th>
                <th style="padding:10px 14px; font-size:0.85rem;">الموديول التابع</th>
                <th style="padding:10px 14px; font-size:0.85rem;">الاتجاه</th>
                <th style="padding:10px 14px; font-size:0.85rem;">حالة الاعتماد</th>
                <th style="padding:10px 14px; font-size:0.85rem;">تاريخ التحديث</th>
                <th style="padding:10px 14px; font-size:0.85rem; text-align:center;">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(t => `
                <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
                  <td style="padding:10px 14px; font-family:monospace; font-weight:bold; font-size:0.82rem; color:var(--primary);">${t.id}</td>
                  <td style="padding:10px 14px; font-weight:bold; font-size:0.88rem;">${t.name}</td>
                  <td style="padding:10px 14px;"><span class="badge" style="font-size:0.75rem; background:rgba(30,58,138,0.1); color:#1e3a8a; padding:2px 8px; border-radius:6px; font-weight:bold;">${t.category_ar || t.module}</span></td>
                  <td style="padding:10px 14px; font-size:0.82rem;">${t.orientation === 'landscape' ? '📐 أفقي (Landscape)' : '📏 عمودي (Portrait)'}</td>
                  <td style="padding:10px 14px;">${t.is_default ? '<span style="color:#16a34a; font-weight:bold;">⭐ افتراضي مفعل</span>' : '<span style="color:var(--text-muted);">عادي</span>'}</td>
                  <td style="padding:10px 14px; font-size:0.8rem; color:var(--text-muted);">${new Date(t.updated_at || Date.now()).toLocaleDateString('ar-JO')}</td>
                  <td style="padding:10px 14px; text-align:center;">
                    <div style="display:inline-flex; gap:4px;">
                      <button class="btn btn-sm btn-outline" onclick="window.unifiedPrintTemplatesManager.previewTemplate('${t.id}')">👁️ معاينة</button>
                      <button class="btn btn-sm btn-primary" onclick="window.unifiedPrintTemplatesManager.openTemplateModal('${t.id}')">✏️ تصميم</button>
                      <button class="btn btn-sm btn-outline" onclick="window.unifiedPrintTemplatesManager.printTestTemplate('${t.id}')">🖨️ طباعة</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    /* ── نافذة إضافة وتصميم قالب متطورة (Dedicated Enterprise Modal) ───────── */
    openTemplateModal(templateId = null) {
      let t = null;
      if (templateId) {
        t = this.templates.find(item => item.id === templateId);
      }

      const master = (typeof getMasterPrintConfig === 'function') ? getMasterPrintConfig() : {};

      this.editingTemplate = t ? JSON.parse(JSON.stringify(t)) : {
        id: 'TMPL-' + Date.now().toString(36).toUpperCase(),
        name: 'قالب رسمي جديد',
        module: 'LETTER',
        category_ar: 'الكتب الرسمية والمخاطبات',
        is_default: false,
        orientation: 'portrait',
        updated_at: new Date().toISOString(),
        description: 'قالب طباعة وتوثيق جديد مصمم لبلدية كفرنجة الجديدة.',
        header_config: {
          use_custom: false,
          logoPosition: master.logoPosition || 'center',
          logoSize: master.logoSize || 105,
          logoUrl: master.logoUrl || '/logo.png',
          countryName: master.countryName || 'المملكة الأردنية الهاشمية',
          ministryName: master.ministryName || 'وزارة الإدارة المحلية',
          municipalityName: master.municipalityName || 'بلدية كفرنجة الجديدة',
          directorateName: master.directorateName || 'مديرية الأشغال والخدمات الهندسية',
          show_qr: master.qrEnabled !== false,
          custom_header_html: ''
        },
        footer_config: {
          use_custom: false,
          showPageNumbers: master.showPageNumbers !== false,
          showTimestamp: master.showPrintTimestamp !== false,
          showUserName: master.showUserName !== false,
          marginTopMm: master.marginTopMm || 8,
          marginBottomMm: master.marginBottomMm || 8,
          marginLeftMm: master.marginLeftMm || 10,
          marginRightMm: master.marginRightMm || 10,
          fontFamily: master.fontFamily || "'Tajawal', sans-serif",
          fontSizeBase: master.fontSizeBase || 12,
          lineHeight: master.lineHeight || 1.6,
          primaryColor: master.primaryColor || '#1e3a8a',
          watermarkEnabled: master.watermarkEnabled !== false,
          watermarkType: master.watermarkType || 'logo',
          watermarkText: master.watermarkText || 'وثيقة رسمية معتمدة',
          watermarkOpacity: master.watermarkOpacity || 0.04,
          custom_footer_html: ''
        },
        signatures_config: [
          { roleName: 'المهندس المنظم', signLabel: 'إعداد وتنظيم' },
          { roleName: 'رئيس القسم', signLabel: 'تدقيق فني' },
          { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'اعتماد وتنسيب' }
        ],
        html_template: '<div style="font-family:\'Tajawal\',sans-serif; padding:12px; line-height:1.7;"><p>أدخل نص وقرارات النموذج والبنود الفنية هنا...</p></div>'
      };

      if (!this.editingTemplate.header_config) {
        this.editingTemplate.header_config = {
          use_custom: false,
          logoPosition: master.logoPosition || 'center',
          logoSize: master.logoSize || 75,
          logoUrl: master.logoUrl || '/logo.png',
          countryName: master.countryName || 'المملكة الأردنية الهاشمية',
          ministryName: master.ministryName || 'وزارة الإدارة المحلية',
          municipalityName: master.municipalityName || 'بلدية كفرنجة الجديدة',
          directorateName: master.directorateName || 'مديرية الأشغال والخدمات الهندسية',
          show_qr: master.qrEnabled !== false,
          custom_header_html: ''
        };
      }

      if (!this.editingTemplate.footer_config) {
        this.editingTemplate.footer_config = {
          use_custom: false,
          showPageNumbers: master.showPageNumbers !== false,
          showTimestamp: master.showPrintTimestamp !== false,
          showUserName: master.showUserName !== false,
          marginTopMm: master.marginTopMm || 8,
          marginBottomMm: master.marginBottomMm || 8,
          marginLeftMm: master.marginLeftMm || 10,
          marginRightMm: master.marginRightMm || 10,
          fontFamily: master.fontFamily || "'Tajawal', sans-serif",
          fontSizeBase: master.fontSizeBase || 12,
          lineHeight: master.lineHeight || 1.6,
          primaryColor: master.primaryColor || '#1e3a8a',
          watermarkEnabled: master.watermarkEnabled !== false,
          watermarkType: master.watermarkType || 'logo',
          watermarkText: master.watermarkText || 'وثيقة رسمية معتمدة',
          watermarkOpacity: master.watermarkOpacity || 0.04,
          custom_footer_html: ''
        };
      }

      this.modalActiveTab = 'general';

      let modal = document.getElementById('print-template-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'print-template-modal';
        modal.style.cssText = 'display:flex; position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.75); backdrop-filter:blur(5px); align-items:center; justify-content:center; padding:16px; direction:rtl;';
        document.body.appendChild(modal);
      }

      modal.style.display = 'flex';
      this.renderDedicatedModal();
    }

    closeDedicatedModal() {
      const modal = document.getElementById('print-template-modal');
      if (modal) modal.style.display = 'none';
    }

    switchModalTab(tabKey) {
      this.syncFormData();
      this.modalActiveTab = tabKey;
      this.renderDedicatedModal();
    }

    setSignaturesLayout(layout) {
      this.syncFormData();
      if (this.editingTemplate) {
        this.editingTemplate.signatures_layout = layout;
      }
      this.renderDedicatedModal();
    }

    syncFormData() {
      if (!this.editingTemplate) return;
      const idInput = document.getElementById('tpl-id');
      const nameInput = document.getElementById('tpl-name');
      const moduleInput = document.getElementById('tpl-module');
      const descInput = document.getElementById('tpl-desc');
      const orientInput = document.getElementById('tpl-orientation');
      const defInput = document.getElementById('tpl-isDefault');
      const canvas = document.getElementById('tpl-visual-canvas');

      if (idInput) this.editingTemplate.id = idInput.value.trim();
      if (nameInput) this.editingTemplate.name = nameInput.value.trim();
      if (moduleInput) {
        this.editingTemplate.module = moduleInput.value;
        const catMap = {
          LETTER: 'الكتب الرسمية والمخاطبات',
          TENDERS: 'العطاءات والمشاريع',
          CLAIMS: 'المطالبات والمالية',
          COMMITTEES: 'تقارير اللجان والاستلام',
          PERMITS: 'تصاريح الحفر وتزويد الخدمات',
          PAVING: 'عوائد التعبيد والتحققات',
          ROADS: 'شبكة الطرق والقياس الجغرافي',
          CONTRACTS: 'العقود والضمانات'
        };
        this.editingTemplate.category_ar = catMap[moduleInput.value] || moduleInput.value;
      }
      if (descInput) this.editingTemplate.description = descInput.value.trim();
      if (orientInput) this.editingTemplate.orientation = orientInput.value;
      if (defInput) this.editingTemplate.is_default = defInput.checked;
      if (canvas) this.editingTemplate.html_template = canvas.innerHTML;

      // Header tab sync
      const hCustom = document.getElementById('tpl-hdr-custom');
      if (hCustom) {
        this.editingTemplate.header_config = {
          use_custom: hCustom.checked,
          countryName: document.getElementById('tpl-hdr-country')?.value || 'المملكة الأردنية الهاشمية',
          ministryName: document.getElementById('tpl-hdr-ministry')?.value || 'وزارة الإدارة المحلية',
          municipalityName: document.getElementById('tpl-hdr-municipality')?.value || 'بلدية كفرنجة الجديدة',
          directorateName: document.getElementById('tpl-hdr-directorate')?.value || 'مديرية الأشغال والخدمات الهندسية',
          logoPosition: document.getElementById('tpl-hdr-logopos')?.value || 'center',
          logoSize: parseInt(document.getElementById('tpl-hdr-logosize')?.value || '75', 10),
          logoUrl: document.getElementById('tpl-hdr-logourl')?.value || '/logo.png',
          show_qr: document.getElementById('tpl-hdr-showqr')?.checked !== false,
          custom_header_html: document.getElementById('tpl-hdr-customhtml')?.value || ''
        };
      }

      // Header tab sync
      const countryEl = document.getElementById('tpl-hdr-country');
      if (countryEl) {
        this.editingTemplate.header_config = {
          countryName: countryEl.value.trim() || 'المملكة الأردنية الهاشمية',
          ministryName: document.getElementById('tpl-hdr-ministry')?.value.trim() || 'وزارة الإدارة المحلية',
          municipalityName: document.getElementById('tpl-hdr-municipality')?.value.trim() || 'بلدية كفرنجة الجديدة',
          directorateName: document.getElementById('tpl-hdr-directorate')?.value.trim() || 'مديرية الأشغال والخدمات الهندسية',
          logoPosition: document.getElementById('tpl-hdr-logopos')?.value || 'center',
          logoSize: parseInt(document.getElementById('tpl-hdr-logosize')?.value || '75', 10),
          logoUrl: document.getElementById('tpl-hdr-logourl')?.value.trim() || '/logo.png',
          show_qr: document.getElementById('tpl-hdr-showqr')?.checked !== false,
          custom_header_html: document.getElementById('tpl-hdr-customhtml')?.value || ''
        };
      }

      // Footer tab sync
      const pagenumEl = document.getElementById('tpl-ftr-pagenum');
      if (pagenumEl) {
        this.editingTemplate.footer_config = {
          showPageNumbers: pagenumEl.checked !== false,
          showTimestamp: document.getElementById('tpl-ftr-timestamp')?.checked !== false,
          showUserName: document.getElementById('tpl-ftr-username')?.checked !== false,
          marginTopMm: parseInt(document.getElementById('tpl-ftr-margintop')?.value || '8', 10),
          marginBottomMm: parseInt(document.getElementById('tpl-ftr-marginbottom')?.value || '8', 10),
          marginRightMm: parseInt(document.getElementById('tpl-ftr-marginright')?.value || '10', 10),
          marginLeftMm: parseInt(document.getElementById('tpl-ftr-marginleft')?.value || '10', 10),
          fontFamily: document.getElementById('tpl-ftr-fontfamily')?.value || "'Tajawal', sans-serif",
          fontSizeBase: parseInt(document.getElementById('tpl-ftr-fontsize')?.value || '12', 10),
          lineHeight: parseFloat(document.getElementById('tpl-ftr-lineheight')?.value || '1.6'),
          primaryColor: document.getElementById('tpl-ftr-color')?.value || '#1e3a8a',
          watermarkEnabled: document.getElementById('tpl-ftr-wmenabled')?.checked !== false,
          watermarkType: document.getElementById('tpl-ftr-wmtype')?.value || 'logo',
          watermarkText: document.getElementById('tpl-ftr-wmtext')?.value || 'وثيقة رسمية معتمدة',
          watermarkOpacity: (parseInt(document.getElementById('tpl-ftr-wmopacity')?.value || '4', 10)) / 100,
          custom_footer_html: document.getElementById('tpl-ftr-customhtml')?.value || ''
        };
      }

      this.syncSignaturesFromRows();
    }

    handleTemplateLogoFile(input) {
      if (!input || !input.files || !input.files[0]) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const urlInput = document.getElementById('tpl-hdr-logourl');
        if (urlInput) urlInput.value = dataUrl;
        const imgPrev = document.getElementById('tpl-hdr-logo-preview-img');
        if (imgPrev) imgPrev.src = dataUrl;
        if (this.editingTemplate && this.editingTemplate.header_config) {
          this.editingTemplate.header_config.logoUrl = dataUrl;
        }
        showToast('✅ تم تحميل وتعيين الشعار بنجاح');
      };
      reader.readAsDataURL(file);
    }

    renderDedicatedModal() {
      const modal = document.getElementById('print-template-modal');
      if (!modal) return;

      const isEdit = this.templates.some(t => t.id === this.editingTemplate.id);
      const signatures = Array.isArray(this.editingTemplate.signatures_config) ? this.editingTemplate.signatures_config : [];
      const hCfg = this.editingTemplate.header_config || {};
      const fCfg = this.editingTemplate.footer_config || {};

      modal.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:16px; width:100%; max-width:1080px; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(0,0,0,0.6); overflow:hidden; font-family:'Tajawal',sans-serif; color:var(--text, #f8fafc); animation:fadeIn 0.2s ease;">
          
          <!-- Top Modal Banner -->
          <div style="background:linear-gradient(135deg, #1e3a8a, #0284c7); color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:10px; font-weight:800; font-size:1.08rem;">
              <span>🖨️</span> <span>${isEdit ? `تعديل وتصميم القالب: ${this.editingTemplate.name}` : 'تصميم وبناء قالب طباعة رسمي جديد'}</span>
            </div>
            <button onclick="window.unifiedPrintTemplatesManager.closeDedicatedModal()" style="background:none; border:none; color:#fff; font-size:1.3rem; cursor:pointer; padding:4px 8px;" title="إغلاق">✕</button>
          </div>

          <!-- Modal Tabs Bar with all 6 Dedicated Tabs -->
          <div style="background:var(--bg-surface, #0f172a); border-bottom:1px solid var(--border, #334155); padding:10px 20px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; flex-shrink:0; overflow-x:auto;">
            <button type="button" onclick="window.unifiedPrintTemplatesManager.switchModalTab('general')" style="display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; font-size:0.84rem; transition:all 0.2s; background:${this.modalActiveTab === 'general' ? '#0284c7' : 'rgba(255,255,255,0.08)'}; color:#ffffff;">
              <span>📋</span> <span>بيانات وهوية القالب</span>
            </button>

            <button type="button" onclick="window.unifiedPrintTemplatesManager.switchModalTab('header')" style="display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; font-size:0.84rem; transition:all 0.2s; background:${this.modalActiveTab === 'header' ? '#0284c7' : 'rgba(255,255,255,0.08)'}; color:#ffffff;">
              <span>🏛️</span> <span>الترويسة والشعار والرأس</span>
            </button>

            <button type="button" onclick="window.unifiedPrintTemplatesManager.switchModalTab('content')" style="display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; font-size:0.84rem; transition:all 0.2s; background:${this.modalActiveTab === 'content' ? '#0284c7' : 'rgba(255,255,255,0.08)'}; color:#ffffff;">
              <span>✍️</span> <span>محرر المحتوى البصري</span>
            </button>

            <button type="button" onclick="window.unifiedPrintTemplatesManager.switchModalTab('signatures')" style="display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; font-size:0.84rem; transition:all 0.2s; background:${this.modalActiveTab === 'signatures' ? '#0284c7' : 'rgba(255,255,255,0.08)'}; color:#ffffff;">
              <span>🖋️</span> <span>سلاسل التواقيع والاعتماد (${signatures.length})</span>
            </button>

            <button type="button" onclick="window.unifiedPrintTemplatesManager.switchModalTab('footer')" style="display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; font-size:0.84rem; transition:all 0.2s; background:${this.modalActiveTab === 'footer' ? '#0284c7' : 'rgba(255,255,255,0.08)'}; color:#ffffff;">
              <span>📄</span> <span>التذييل والترقيم والهوامش</span>
            </button>

            <button type="button" onclick="window.unifiedPrintTemplatesManager.switchModalTab('preview')" style="display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; font-size:0.84rem; transition:all 0.2s; background:${this.modalActiveTab === 'preview' ? '#0284c7' : 'rgba(255,255,255,0.08)'}; color:#ffffff;">
              <span>👁️</span> <span>معاينة الطباعة الحية A4</span>
            </button>
          </div>

          <!-- Modal Body Content Container -->
          <div style="padding:20px; overflow-y:auto; flex:1; max-height:calc(92vh - 140px);">
            
            <!-- TAB 1: GENERAL INFO -->
            <div id="tab-pane-general" style="display:${this.modalActiveTab === 'general' ? 'block' : 'none'};">
              <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:12px; padding:18px; margin-bottom:16px;">
                <div style="font-weight:bold; font-size:0.92rem; color:#38bdf8; margin-bottom:14px; display:flex; align-items:center; gap:6px;">
                  <span>📌</span> <span>المعلومات الأساسية والهوية الإدارية:</span>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-bottom:14px;">
                  <div>
                    <label style="display:block; font-size:0.82rem; font-weight:bold; margin-bottom:6px;">معرف القالب (ID) <span style="color:#ef4444;">*</span></label>
                    <input type="text" id="tpl-id" value="${this.editingTemplate.id}" ${isEdit ? 'readonly style="background:rgba(255,255,255,0.05); color:#94a3b8;"' : ''} style="width:100%; padding:9px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.88rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc); font-family:monospace;" />
                  </div>

                  <div>
                    <label style="display:block; font-size:0.82rem; font-weight:bold; margin-bottom:6px;">اسم القالب الرسمي <span style="color:#ef4444;">*</span></label>
                    <input type="text" id="tpl-name" value="${this.editingTemplate.name || ''}" placeholder="مثال: كتاب إداري رسمي موجه" style="width:100%; padding:9px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.88rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                  </div>

                  <div>
                    <label style="display:block; font-size:0.82rem; font-weight:bold; margin-bottom:6px;">الموديول والقطاع التابع <span style="color:#ef4444;">*</span></label>
                    <select id="tpl-module" style="width:100%; padding:9px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.88rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);">
                      <option value="LETTER" ${this.editingTemplate.module === 'LETTER' ? 'selected' : ''}>✉️ الكتب الرسمية والمخاطبات</option>
                      <option value="TENDERS" ${this.editingTemplate.module === 'TENDERS' ? 'selected' : ''}>📋 العطاءات والمشاريع</option>
                      <option value="CLAIMS" ${this.editingTemplate.module === 'CLAIMS' ? 'selected' : ''}>📝 المطالبات والمالية</option>
                      <option value="COMMITTEES" ${this.editingTemplate.module === 'COMMITTEES' ? 'selected' : ''}>👥 اللجان واستلام المشاريع</option>
                      <option value="PERMITS" ${this.editingTemplate.module === 'PERMITS' ? 'selected' : ''}>🚜 تصاريح الحفر وتزويد الخدمات</option>
                      <option value="PAVING" ${this.editingTemplate.module === 'PAVING' ? 'selected' : ''}>💰 عوائد التعبيد والتحققات</option>
                      <option value="ROADS" ${this.editingTemplate.module === 'ROADS' ? 'selected' : ''}>🛣️ شبكة الطرق والقياس RAMS</option>
                      <option value="CONTRACTS" ${this.editingTemplate.module === 'CONTRACTS' ? 'selected' : ''}>📜 العقود والضمانات البنكية</option>
                    </select>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:14px;">
                  <div>
                    <label style="display:block; font-size:0.82rem; font-weight:bold; margin-bottom:6px;">وصف القالب والغرض منه</label>
                    <input type="text" id="tpl-desc" value="${this.editingTemplate.description || ''}" placeholder="وصف مقتضب لاستخدامات النموذج..." style="width:100%; padding:9px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.88rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                  </div>

                  <div>
                    <label style="display:block; font-size:0.82rem; font-weight:bold; margin-bottom:6px;">اتجاه الطباعة (Orientation)</label>
                    <select id="tpl-orientation" style="width:100%; padding:9px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.88rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);">
                      <option value="portrait" ${this.editingTemplate.orientation === 'portrait' ? 'selected' : ''}>📏 عمودي (A4 Portrait)</option>
                      <option value="landscape" ${this.editingTemplate.orientation === 'landscape' ? 'selected' : ''}>📐 أفقي (A4 Landscape)</option>
                    </select>
                  </div>

                  <div style="display:flex; align-items:center; padding-top:24px;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:bold; font-size:0.86rem; color:#38bdf8;">
                      <input type="checkbox" id="tpl-isDefault" ${this.editingTemplate.is_default ? 'checked' : ''} style="width:20px; height:20px; accent-color:#16a34a; cursor:pointer;" />
                      <span>تعيين كقالب افتراضي مفعل</span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            <!-- TAB 2: HEADER & LOGO CONFIGURATION (100% ACTIVE & INTERACTIVE) -->
            <div id="tab-pane-header" style="display:${this.modalActiveTab === 'header' ? 'block' : 'none'};">
              <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:12px; padding:18px; margin-bottom:16px;">
                <div style="font-weight:bold; font-size:0.92rem; color:#38bdf8; margin-bottom:14px; display:flex; align-items:center; gap:6px;">
                  <span>🏛️</span> <span>التحكم الدقيق بالترويسة والرأس والشعار الرسمي لهذا القالب:</span>
                </div>

                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:16px;">
                  <!-- Header Texts Form -->
                  <div style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                      <label style="font-size:0.82rem; font-weight:bold; display:block; margin-bottom:4px; color:#94a3b8;">اسم الدولة / الترويسة العليا</label>
                      <input type="text" id="tpl-hdr-country" value="${hCfg.countryName || 'المملكة الأردنية الهاشمية'}" style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; background:var(--bg-card, #1e293b); color:#fff; font-size:0.88rem;">
                    </div>
                    <div>
                      <label style="font-size:0.82rem; font-weight:bold; display:block; margin-bottom:4px; color:#94a3b8;">اسم الوزارة</label>
                      <input type="text" id="tpl-hdr-ministry" value="${hCfg.ministryName || 'وزارة الإدارة المحلية'}" style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; background:var(--bg-card, #1e293b); color:#fff; font-size:0.88rem;">
                    </div>
                    <div>
                      <label style="font-size:0.82rem; font-weight:bold; display:block; margin-bottom:4px; color:#94a3b8;">اسم البلدية المعتمد</label>
                      <input type="text" id="tpl-hdr-municipality" value="${hCfg.municipalityName || 'بلدية كفرنجة الجديدة'}" style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; background:var(--bg-card, #1e293b); color:#fff; font-size:0.88rem;">
                    </div>
                    <div>
                      <label style="font-size:0.82rem; font-weight:bold; display:block; margin-bottom:4px; color:#94a3b8;">اسم المديرية المصدرة</label>
                      <input type="text" id="tpl-hdr-directorate" value="${hCfg.directorateName || 'مديرية الأشغال والخدمات الهندسية'}" style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; background:var(--bg-card, #1e293b); color:#fff; font-size:0.88rem;">
                    </div>
                  </div>

                  <!-- Logo & Position Box -->
                  <div style="background:var(--bg-card, #1e293b); border:1px solid #334155; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <h4 style="margin:0; font-size:0.9rem; color:#38bdf8; font-weight:bold;">🖼️ موضع ومقاس الشعار المعتمد</h4>
                      <div style="width:56px; height:56px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; overflow:hidden; border:2px solid #0284c7; padding:2px;">
                        <img id="tpl-hdr-logo-preview-img" src="${hCfg.logoUrl || '/logo.png'}" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='/logo.png';">
                      </div>
                    </div>
                    
                    <div>
                      <label style="font-size:0.8rem; font-weight:bold; display:block; margin-bottom:4px; color:#94a3b8;">موضع الشعار في الترويسة</label>
                      <select id="tpl-hdr-logopos" style="width:100%; padding:8px 12px; border:1px solid #334155; border-radius:8px; background:var(--bg, #0f172a); color:#fff; font-size:0.85rem;">
                        <option value="center" ${hCfg.logoPosition === 'center' ? 'selected' : ''}>المنتصف الدقيق (50% Exact Center - رسمي معتمد)</option>
                        <option value="right" ${hCfg.logoPosition === 'right' ? 'selected' : ''}>الجانب الأيمن (مع الترويسة العليا)</option>
                        <option value="left" ${hCfg.logoPosition === 'left' ? 'selected' : ''}>الجانب الأيسر (مع باركود التحقق الرقمي)</option>
                      </select>
                    </div>

                    <div>
                      <label style="font-size:0.8rem; font-weight:bold; display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:#94a3b8;">مقاس الشعار بالبكسل (تكبير وتصغير الشعار):</span>
                        <span id="tpl-hdr-logosize-lbl" style="color:#38bdf8; font-weight:bold; font-size:0.95rem;">${hCfg.logoSize || 105}px</span>
                      </label>
                      <input type="range" id="tpl-hdr-logosize" min="50" max="220" step="5" value="${hCfg.logoSize || 105}" oninput="document.getElementById('tpl-hdr-logosize-lbl').textContent=this.value+'px'; const el=document.getElementById('live-preview-logo-img'); if(el){el.style.width=this.value+'px'; el.style.height=this.value+'px';}" style="width:100%; accent-color:#0284c7; cursor:pointer;">
                    </div>

                    <div>
                      <label style="font-size:0.8rem; font-weight:bold; display:block; margin-bottom:4px; color:#94a3b8;">تحديد أو رفع الشعار</label>
                      <div style="display:flex; gap:8px; align-items:center;">
                        <input type="text" id="tpl-hdr-logourl" value="${hCfg.logoUrl || '/logo.png'}" placeholder="/logo.png أو رابط..." style="flex:1; padding:7px 10px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.8rem;" oninput="document.getElementById('tpl-hdr-logo-preview-img').src=this.value; const lp=document.getElementById('live-preview-logo-img'); if(lp) lp.src=this.value;">
                        <button type="button" class="btn btn-sm btn-primary" onclick="document.getElementById('tpl-hdr-logofile').click()" style="white-space:nowrap; font-size:0.78rem; padding:6px 12px;">📁 رفع ملف</button>
                        <input type="file" id="tpl-hdr-logofile" accept="image/*" style="display:none;" onchange="window.unifiedPrintTemplatesManager.handleTemplateLogoFile(this)">
                      </div>
                    </div>

                    <div style="border-top:1px solid #334155; padding-top:8px;">
                      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.84rem; color:#fff;">
                        <input type="checkbox" id="tpl-hdr-showqr" ${hCfg.show_qr !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#0284c7;">
                        <span style="font-weight:bold; color:#38bdf8;">إظهار رمز QR للتحقق الرقمي التلقائي المشفر</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 3: VISUAL CONTENT EDITOR -->
            <div id="tab-pane-content" style="display:${this.modalActiveTab === 'content' ? 'block' : 'none'};">
              
              <!-- Dynamic Variables Insertion Toolbar -->
              <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:12px; margin-bottom:12px;">
                <div style="font-weight:bold; font-size:0.82rem; color:#38bdf8; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                  <span>⚡ إدراج المتغيرات الديناميكية تلقائياً (Variables Toolbar):</span>
                  <span style="font-size:0.75rem; color:#94a3b8;">انقر على المتغير لدمجه مباشرة في موضع المؤشر داخل المحرر</span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${refNumber}')">+ رقم المرجع</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${date}')">+ التاريخ</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${recipientName}')">+ اسم الجهة الموجه لها</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${subject}')">+ الموضوع</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${contractorName}')">+ اسم المقاول</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${tenderNo}')">+ رقم العطاء</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${tenderName}')">+ اسم العطاء</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${grossAmount}')">+ المبلغ الإجمالي</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${netPayable}')">+ الصافي المستحق</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${sessionDate}')">+ تاريخ الجلسة</button>
                  <button type="button" class="btn btn-sm btn-outline" style="font-size:0.78rem; padding:4px 10px;" onclick="window.unifiedPrintTemplatesManager.insertVarPlaceholder('\${details}')">+ نص التفاصيل</button>
                </div>
              </div>

              <!-- Formatting Actions Toolbar -->
              <div style="display:flex; gap:6px; margin-bottom:10px; background:var(--bg, #0f172a); border:1px solid var(--border, #334155); padding:8px; border-radius:8px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="btn btn-sm btn-outline" onclick="document.execCommand('bold')" title="عريض"><b>B</b></button>
                <button type="button" class="btn btn-sm btn-outline" onclick="document.execCommand('italic')" title="مائل"><i>I</i></button>
                <button type="button" class="btn btn-sm btn-outline" onclick="document.execCommand('underline')" title="تسطير"><u>U</u></button>
                <div style="width:1px; height:20px; background:#334155; margin:0 4px;"></div>
                <button type="button" class="btn btn-sm btn-outline" onclick="document.execCommand('justifyRight')" title="محاذاة لليمين">➡️ يمين</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="document.execCommand('justifyCenter')" title="توسيط">↔️ وسط</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="document.execCommand('justifyLeft')" title="محاذاة لليسار">⬅️ يسار</button>
                <div style="width:1px; height:20px; background:#334155; margin:0 4px;"></div>
                <button type="button" class="btn btn-sm btn-primary" onclick="window.unifiedPrintTemplatesManager.insertTableToCanvas()" style="font-size:0.78rem; padding:4px 10px;">📊 إدراج جدول بنود رسمي</button>
              </div>

              <!-- Visual Canvas -->
              <div id="tpl-visual-canvas" contenteditable="true" style="background:#ffffff; color:#0f172a; padding:20px; border:2px dashed #0284c7; border-radius:10px; min-height:280px; max-height:420px; overflow-y:auto; font-size:0.96rem; line-height:1.7; outline:none; box-shadow:inset 0 2px 6px rgba(0,0,0,0.05);" oninput="window.unifiedPrintTemplatesManager.syncCanvasOutput()">
                ${this.editingTemplate.html_template}
              </div>
            </div>

            <!-- TAB 4: SIGNATURES CONFIGURATION & POSITIONING -->
            <div id="tab-pane-signatures" style="display:${this.modalActiveTab === 'signatures' ? 'block' : 'none'};">
              <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:12px; padding:18px;">
                
                <!-- Signatures Layout & Position Toolbar with Direct Click Buttons -->
                <div style="background:var(--bg-card, #1e293b); border:1px solid #334155; border-radius:10px; padding:16px 18px; margin-bottom:16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                    <label style="font-weight:bold; font-size:0.9rem; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                      <span>📍</span> <span>تحديد موقع ومحاذاة التوقيع في أسفل الوثيقة:</span>
                    </label>
                    <button type="button" class="btn btn-sm btn-primary" onclick="window.unifiedPrintTemplatesManager.addSignatureRow()" style="font-weight:bold; padding:6px 14px; font-size:0.82rem; display:flex; align-items:center; gap:6px;">
                      <span>➕</span> <span>إضافة خانة توقيع</span>
                    </button>
                  </div>

                  <!-- Direct Visual Layout Selector Buttons -->
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${(() => {
                      const curLay = this.editingTemplate.signatures_layout || (this.editingTemplate.module === 'LETTER' || signatures.length === 1 ? 'left' : 'grid');
                      const layouts = [
                        { key: 'left', label: 'الجانب الأيسر (رسمي للمخاطبات والكتب)', icon: '⬅️' },
                        { key: 'center', label: 'في المنتصف الدقيق', icon: '↔️' },
                        { key: 'right', label: 'الجانب الأيمن', icon: '➡️' },
                        { key: 'grid', label: 'توزيع متساوي (شبكة للجان)', icon: '📊' },
                        { key: 'split', label: 'ثنائي الأطراف (منظم يميناً ومعتمد يساراً)', icon: '⚖️' }
                      ];
                      return layouts.map(l => `
                        <button type="button" class="btn btn-sm ${curLay === l.key ? 'btn-primary' : 'btn-outline'}" onclick="window.unifiedPrintTemplatesManager.setSignaturesLayout('${l.key}')" style="font-weight:bold; font-size:0.83rem; padding:8px 14px; display:flex; align-items:center; gap:6px; cursor:pointer; ${curLay === l.key ? 'box-shadow:0 0 0 2px #38bdf8; background:#0284c7; color:#fff;' : ''}">
                          <span>${l.icon}</span> <span>${l.label}</span>
                        </button>
                      `).join('');
                    })()}
                  </div>
                </div>

                <div id="signatures-rows-container" style="display:flex; flex-direction:column; gap:10px;">
                  ${signatures.map((sig, sidx) => `
                    <div class="sig-row" style="display:grid; grid-template-columns:auto 1.3fr 1.3fr 1.1fr auto; gap:12px; align-items:center; background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); padding:12px 14px; border-radius:10px;">
                      <span style="font-weight:bold; font-size:0.86rem; color:#38bdf8; width:28px;">#${sidx + 1}</span>
                      <div>
                        <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:3px;">المسمى الوظيفي للموقع</label>
                        <input type="text" class="sig-role-input" value="${sig.roleName || ''}" placeholder="مثال: المهندس المشرف" style="width:100%; padding:7px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
                      </div>
                      <div>
                        <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:3px;">نص الاعتماد / الإجراء</label>
                        <input type="text" class="sig-label-input" value="${sig.signLabel || 'التوقيع والتاريخ'}" placeholder="التوقيع والتاريخ" style="width:100%; padding:7px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
                      </div>
                      <div>
                        <label style="font-size:0.75rem; color:#38bdf8; font-weight:bold; display:block; margin-bottom:3px;">📍 موضع الخانة</label>
                        <select class="sig-pos-select" onchange="window.unifiedPrintTemplatesManager.syncSignaturesFromRows()" style="width:100%; padding:7px 8px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
                          <option value="auto" ${!sig.position || sig.position === 'auto' ? 'selected' : ''}>تلقائي (حسب توزيع النموذج)</option>
                          <option value="left" ${sig.position === 'left' ? 'selected' : ''}>⬅️ يسار (Left)</option>
                          <option value="center" ${sig.position === 'center' ? 'selected' : ''}>↔️ وسط (Center)</option>
                          <option value="right" ${sig.position === 'right' ? 'selected' : ''}>➡️ يمين (Right)</option>
                        </select>
                      </div>
                      <button type="button" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem; padding:4px;" onclick="this.closest('.sig-row').remove(); window.unifiedPrintTemplatesManager.syncSignaturesFromRows();" title="حذف">✕</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- TAB 5: FOOTER, MARGINS & PAGINATION ENGINE (100% ACTIVE & INTERACTIVE) -->
            <div id="tab-pane-footer" style="display:${this.modalActiveTab === 'footer' ? 'block' : 'none'};">
              <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:12px; padding:18px; margin-bottom:16px;">
                <div style="font-weight:bold; font-size:0.92rem; color:#38bdf8; margin-bottom:14px; display:flex; align-items:center; gap:6px;">
                  <span>📄</span> <span>التذييل ومحرك الترقيم الديناميكي (صفحة X من Y) والهوامش:</span>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                  
                  <div style="background:var(--bg-card, #1e293b); border:1px solid #334155; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <h4 style="margin:0; font-size:0.9rem; color:#38bdf8; font-weight:bold;">📄 خيارات التذييل والترقيم الأمني</h4>
                    
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                      <input type="checkbox" id="tpl-ftr-pagenum" ${fCfg.showPageNumbers !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#0284c7;">
                      <span style="font-weight:600;">تفعيل محرك الترقيم الديناميكي ("صفحة X من إجمالي Y صفحة")</span>
                    </label>

                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                      <input type="checkbox" id="tpl-ftr-timestamp" ${fCfg.showTimestamp !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#0284c7;">
                      <span>إظهار تاريخ ووقت الطباعة الدقيق بالثواني بالتذييل</span>
                    </label>

                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                      <input type="checkbox" id="tpl-ftr-username" ${fCfg.showUserName !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#0284c7;">
                      <span>إظهار اسم الموظف المنظم للمعاملة</span>
                    </label>

                    <div style="border-top:1px solid #334155; padding-top:12px; margin-top:4px;">
                      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.84rem; font-weight:bold; color:#38bdf8;">
                        <input type="checkbox" id="tpl-ftr-wmenabled" ${fCfg.watermarkEnabled !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#0284c7;">
                        <span>تفعيل العلامة المائية في الخلفية</span>
                      </label>
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
                        <select id="tpl-ftr-wmtype" style="padding:7px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.82rem;">
                          <option value="logo" ${fCfg.watermarkType === 'logo' ? 'selected' : ''}>شعار البلدية باهت</option>
                          <option value="text" ${fCfg.watermarkType === 'text' ? 'selected' : ''}>نص أمني مائل</option>
                        </select>
                        <input type="text" id="tpl-ftr-wmtext" value="${fCfg.watermarkText || 'وثيقة رسمية معتمدة'}" placeholder="نص العلامة..." style="padding:7px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.82rem;">
                      </div>
                    </div>
                  </div>

                  <div style="background:var(--bg-card, #1e293b); border:1px solid #334155; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                    <h4 style="margin:0; font-size:0.9rem; color:#38bdf8; font-weight:bold;">📏 هوامش الصفحة والخطوط (Margins & Typography)</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                      <div>
                        <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:2px;">الهامش العلوي (Top mm)</label>
                        <input type="number" id="tpl-ftr-margintop" min="2" max="30" value="${fCfg.marginTopMm || 8}" style="width:100%; padding:7px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.85rem;">
                      </div>
                      <div>
                        <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:2px;">الهامش السفلي (Bottom mm)</label>
                        <input type="number" id="tpl-ftr-marginbottom" min="2" max="30" value="${fCfg.marginBottomMm || 8}" style="width:100%; padding:7px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.85rem;">
                      </div>
                      <div>
                        <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:2px;">الهامش الأيمن (Right mm)</label>
                        <input type="number" id="tpl-ftr-marginright" min="2" max="30" value="${fCfg.marginRightMm || 10}" style="width:100%; padding:7px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.85rem;">
                      </div>
                      <div>
                        <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:2px;">الهامش الأيسر (Left mm)</label>
                        <input type="number" id="tpl-ftr-marginleft" min="2" max="30" value="${fCfg.marginLeftMm || 10}" style="width:100%; padding:7px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.85rem;">
                      </div>
                    </div>

                    <div style="border-top:1px solid #334155; padding-top:10px;">
                      <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">الخط العربي ولون الهوية الرسمية</label>
                      <div style="display:flex; gap:8px; align-items:center;">
                        <select id="tpl-ftr-fontfamily" style="flex:1; padding:7px; border:1px solid #334155; border-radius:6px; background:var(--bg, #0f172a); color:#fff; font-size:0.82rem;">
                          <option value="'Tajawal', sans-serif">Tajawal (تجوال - معتمد)</option>
                          <option value="'Cairo', sans-serif">Cairo (القاهرة)</option>
                          <option value="Arial, sans-serif">Arial / Traditional</option>
                        </select>
                        <input type="color" id="tpl-ftr-color" value="${fCfg.primaryColor || '#1e3a8a'}" title="اللون الأساسي" style="width:42px; height:34px; border:none; cursor:pointer; border-radius:6px; background:none;">
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <!-- TAB 6: LIVE A4 PREVIEW -->
            <div id="tab-pane-preview" style="display:${this.modalActiveTab === 'preview' ? 'block' : 'none'};">
              <div style="background:#525659; padding:24px; border-radius:12px; display:flex; justify-content:center; overflow-x:auto;">
                <div style="background:#ffffff; color:#0f172a; width:100%; max-width:800px; min-height:600px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.35); border-radius:4px; box-sizing:border-box;">
                  
                  <!-- Dynamic Rendered Header in Live Preview -->
                  <div style="border-bottom:2px double ${fCfg.primaryColor || '#1e3a8a'}; padding-bottom:10px; margin-bottom:16px;">
                    <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; width:100%;">
                      <div style="text-align:right; font-size:0.8rem; line-height:1.4; color:${fCfg.primaryColor || '#1e3a8a'};">
                        <div style="font-weight:800; font-size:0.92rem; color:#0f172a;">${hCfg.countryName || 'المملكة الأردنية الهاشمية'}</div>
                        <div style="font-weight:bold;">${hCfg.ministryName || 'وزارة الإدارة المحلية'}</div>
                        <div style="font-weight:800; font-size:0.88rem; color:${fCfg.primaryColor || '#1e3a8a'};">${hCfg.municipalityName || 'بلدية كفرنجة الجديدة'}</div>
                        <div style="font-size:0.78rem; color:#475569;">${hCfg.directorateName || 'مديرية الأشغال والخدمات الهندسية'}</div>
                      </div>
                      <div style="text-align:center; padding:0 12px;">
                        <img id="live-preview-logo-img" src="${hCfg.logoUrl || '/logo.png'}" onerror="this.outerHTML='<div id=\\'live-preview-logo-img\\' style=\\'width:${hCfg.logoSize || 105}px;height:${hCfg.logoSize || 105}px;border-radius:50%;background:${fCfg.primaryColor || '#1e3a8a'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;margin:0 auto;\\'>🏛️</div>'" style="width:${hCfg.logoSize || 105}px; height:${hCfg.logoSize || 105}px; max-width:220px; max-height:220px; object-fit:contain; border-radius:50%; border:2px solid ${fCfg.primaryColor || '#1e3a8a'}; padding:3px; display:block; margin:0 auto; box-shadow:0 2px 8px rgba(0,0,0,0.08);" />
                      </div>
                      <div style="display:flex; align-items:center; gap:8px; direction:ltr; justify-content:flex-end;">
                        <div style="text-align:left; font-size:0.72rem; line-height:1.4; color:#334155;">
                          <div><b>Ref:</b> <span style="color:${fCfg.primaryColor || '#1e3a8a'}; font-weight:bold;">KJ-2026-8785</span></div>
                          <div><b>Date:</b> ${new Date().toLocaleDateString('ar-JO')}</div>
                          <div style="font-size:0.6rem; color:#64748b;">Sec: SHA256-OK</div>
                        </div>
                        ${hCfg.show_qr !== false ? `<div style="width:44px; height:44px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; display:flex; align-items:center; justify-content:center; font-size:0.55rem; font-weight:bold; color:${fCfg.primaryColor || '#1e3a8a'};">QR Code</div>` : ''}
                      </div>
                    </div>
                  </div>

                  <!-- Template Content Rendered -->
                  <div style="min-height:260px; font-family:${fCfg.fontFamily || "'Tajawal', sans-serif"}; font-size:${fCfg.fontSizeBase || 12}px; line-height:${fCfg.lineHeight || 1.6};">
                    ${this.generateSimulatedHtml(this.editingTemplate.html_template)}
                  </div>

                  <!-- Signatures Layout Rendered -->
                  <div style="margin-top:30px; border-top:1px dashed #cbd5e1; padding-top:16px;">
                    <div style="${(() => {
                      const lay = this.editingTemplate.signatures_layout || (this.editingTemplate.module === 'LETTER' || signatures.length === 1 ? 'left' : 'grid');
                      if (lay === 'left') return 'display:flex; justify-content:flex-end; width:100%; text-align:center; direction:rtl;';
                      if (lay === 'right') return 'display:flex; justify-content:flex-start; width:100%; text-align:center; direction:rtl;';
                      if (lay === 'center') return 'display:flex; justify-content:center; width:100%; text-align:center; direction:rtl;';
                      if (lay === 'split') return 'display:flex; justify-content:space-between; width:100%; text-align:center; direction:rtl;';
                      return `display:grid; grid-template-columns:repeat(${Math.min(signatures.length || 1, 4)}, 1fr); gap:16px; text-align:center; width:100%; direction:rtl;`;
                    })()}">
                      ${signatures.map(s => {
                        const lay = this.editingTemplate.signatures_layout || (this.editingTemplate.module === 'LETTER' || signatures.length === 1 ? 'left' : 'grid');
                        const isLeft = (s.position === 'left' || (!s.position || s.position === 'auto') && lay === 'left');
                        const isRight = (s.position === 'right' || (!s.position || s.position === 'auto') && lay === 'right');
                        return `
                          <div style="min-width:200px; max-width:280px; text-align:center; ${isLeft ? 'margin-right:auto; margin-left:0;' : isRight ? 'margin-left:auto; margin-right:0;' : ''}">
                            <div style="font-weight:bold; font-size:0.86rem; color:${fCfg.primaryColor || '#1e3a8a'}; margin-bottom:28px;">${s.roleName}</div>
                            <div style="border-top:1.5px solid #334155; font-size:0.75rem; color:#64748b; padding-top:4px;">${s.signLabel || 'التوقيع والاعتماد'}</div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>

                    <!-- Dynamic Footer Live Preview -->
                    <div style="margin-top:20px; display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:#64748b; border-top:1px solid #e2e8f0; padding-top:6px;">
                      <span>${hCfg.municipalityName || 'بلدية كفرنجة الجديدة'} — ${hCfg.directorateName || 'مديرية الأشغال'}</span>
                      ${fCfg.showTimestamp !== false ? `<span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-JO')}</span>` : ''}
                      ${fCfg.showPageNumbers !== false ? `<span style="font-weight:bold; color:${fCfg.primaryColor || '#1e3a8a'};">صفحة 1 من 1</span>` : ''}
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>

          <!-- Bottom Actions Bar -->
          <div style="background:var(--bg-surface, #0f172a); border-top:1px solid var(--border, #334155); padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
            <button type="button" class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.printTestTemplate(window.unifiedPrintTemplatesManager.editingTemplate.id)" style="display:flex; align-items:center; gap:6px; font-size:0.85rem;">
              <span>🖨️</span> <span>تجربة الطباعة الرسمية</span>
            </button>

            <div style="display:flex; gap:10px;">
              <button type="button" class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.closeDedicatedModal()">إلغاء</button>
              <button type="button" class="btn btn-primary" onclick="window.unifiedPrintTemplatesManager.saveTemplateFromForm(event)" style="font-weight:bold; padding:8px 24px; display:flex; align-items:center; gap:6px; background:linear-gradient(135deg, #1e3a8a, #0284c7); border:none;">
                <span>💾</span> <span>حفظ وتعميم القالب</span>
              </button>
            </div>
          </div>

        </div>
      `;
    }


    addSignatureRow() {
      const container = document.getElementById('signatures-rows-container');
      if (!container) return;
      const count = container.children.length + 1;
      const div = document.createElement('div');
      div.className = 'sig-row';
      div.style.cssText = 'display:grid; grid-template-columns:auto 1.3fr 1.3fr 1.1fr auto; gap:12px; align-items:center; background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); padding:12px 14px; border-radius:10px;';
      div.innerHTML = `
        <span style="font-weight:bold; font-size:0.86rem; color:#38bdf8; width:28px;">#${count}</span>
        <div>
          <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:3px;">المسمى الوظيفي للموقع</label>
          <input type="text" class="sig-role-input" value="عضو لجنة التدقيق" placeholder="مثال: المهندس المشرف" style="width:100%; padding:7px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
        </div>
        <div>
          <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:3px;">نص الاعتماد / الإجراء</label>
          <input type="text" class="sig-label-input" value="التوقيع والتاريخ" placeholder="التوقيع والتاريخ" style="width:100%; padding:7px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
        </div>
        <div>
          <label style="font-size:0.75rem; color:#38bdf8; font-weight:bold; display:block; margin-bottom:3px;">📍 موضع الخانة</label>
          <select class="sig-pos-select" onchange="window.unifiedPrintTemplatesManager.syncSignaturesFromRows()" style="width:100%; padding:7px 8px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
            <option value="auto">تلقائي (حسب توزيع النموذج)</option>
            <option value="right">➡️ يمين (Right)</option>
            <option value="center">↔️ وسط (Center)</option>
            <option value="left">⬅️ يسار (Left)</option>
          </select>
        </div>
        <button type="button" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem; padding:4px;" onclick="this.closest('.sig-row').remove(); window.unifiedPrintTemplatesManager.syncSignaturesFromRows();" title="حذف">✕</button>
      `;
      container.appendChild(div);
      this.syncSignaturesFromRows();
    }

    syncSignaturesFromRows() {
      const rows = document.querySelectorAll('.sig-row');
      const sigs = [];
      rows.forEach(r => {
        const role = r.querySelector('.sig-role-input')?.value.trim();
        const label = r.querySelector('.sig-label-input')?.value.trim();
        const pos = r.querySelector('.sig-pos-select')?.value || 'auto';
        if (role) sigs.push({ roleName: role, signLabel: label || 'التوقيع والتاريخ', position: pos });
      });
      const layout = document.getElementById('tpl-sig-layout')?.value || 'grid';
      if (this.editingTemplate) {
        this.editingTemplate.signatures_config = sigs;
        this.editingTemplate.signatures_layout = layout;
      }
    }

    insertTableToCanvas() {
      const canvas = document.getElementById('tpl-visual-canvas');
      if (!canvas) return;
      const tableHtml = `
        <table style="width:100%; border-collapse:collapse; margin:12px 0; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f8fafc; color:#1e3a8a;">
              <th style="padding:6px; border:1px solid #cbd5e1;">م</th>
              <th style="padding:6px; border:1px solid #cbd5e1;">البند الفني / الوصف</th>
              <th style="padding:6px; border:1px solid #cbd5e1;">الكمية</th>
              <th style="padding:6px; border:1px solid #cbd5e1;">الملاحظات والقرار</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:6px; border:1px solid #cbd5e1; text-align:center;">1</td>
              <td style="padding:6px; border:1px solid #cbd5e1;">أشغال الخرسانة المسلحة وتأهيل الأرصفة</td>
              <td style="padding:6px; border:1px solid #cbd5e1; text-align:center;">100 م.ط</td>
              <td style="padding:6px; border:1px solid #cbd5e1; color:#16a34a; font-weight:bold;">مطابق للمواصفات</td>
            </tr>
          </tbody>
        </table>
      `;
      document.execCommand('insertHTML', false, tableHtml);
      this.syncCanvasOutput();
    }

    insertVarPlaceholder(text) {
      const canvas = document.getElementById('tpl-visual-canvas');
      if (canvas) {
        canvas.focus();
        document.execCommand('insertText', false, text);
        this.syncCanvasOutput();
      }
    }

    syncCanvasOutput() {
      const canvas = document.getElementById('tpl-visual-canvas');
      if (canvas && this.editingTemplate) {
        this.editingTemplate.html_template = canvas.innerHTML;
      }
      this.syncSignaturesFromRows();
    }

    generateSimulatedHtml(rawHtml, customData = null) {
      const defaultValues = {
        refNumber: 'KJ-2026-8785',
        date: new Date().toLocaleDateString('ar-JO'),
        recipientName: 'مدير دائرة الخدمات المحترمة',
        subject: 'كتاب رسمي ومستند اعتماد بلدي رسمي',
        contractorName: 'شركة النجم الذهبي للمقاولات والهندسة',
        tenderNo: 'T-2026-08',
        tenderName: 'مشروع إنشاء وجدران استنادية في كفرنجة',
        grossAmount: '45,800.000',
        retentionAmount: '4,580.000',
        netPayable: '41,220.000',
        executionPeriod: '60 يوماً',
        totalAmount: '120,000.000',
        sessionDate: new Date().toLocaleDateString('ar-JO'),
        decisionNo: '14/2026',
        claimNo: '1',
        projectName: 'مشروع إنشاء وجدران استنادية في كفرنجة',
        dayName: 'الأحد',
        inspectionNotes: 'تمت المعاينة والتدقيق الميداني وتبين مطابقة التنفيذ للمواصفات الفنية المعتمدة.',
        applicantName: 'شركة الكهرباء الوطنية',
        streetLocation: 'شارع قلعة كفرنجة الرئيسي',
        serviceType: 'خط مياه وألياف ضوئية',
        depositAmount: '500.000',
        ownerName: 'محمد أحمد بني نصر',
        parcelNo: '452 حوض 3',
        frontageMeters: '24.5',
        streetWidth: '12',
        totalAssessment: '1,470.000',
        roadId: 'RD-104',
        roadName: 'طريق الحرس - كفرنجة',
        pciScore: '85',
        distressType: 'شقوق طفيفة عادية',
        recommendation: 'صيانة وقائية وإسطح دك',
        contractTitle: 'عقد إنشاء وتعبيد شوارع تنظيمية',
        contractDate: new Date().toLocaleDateString('ar-JO'),
        contractValue: '85,000.000',
        guaranteeNo: 'BG-998822',
        bankName: 'البنك العربي',
        guaranteeAmount: '8,500.000',
        guaranteeExpiry: '2027-12-31',
        contentBody: 'تأكيد الالتزام الكامل بالتعليمات والمواصفات الفنية المعتمدة لمديرية الأشغال والخدمات الهندسية.',
        details: 'أعمال ومشاريع بلدية كفرنجة الجديدة'
      };

      const data = { ...defaultValues, ...(customData || {}) };
      let renderedHtml = rawHtml || '';

      // 1. استبدال المتغيرات المحددة
      Object.keys(data).forEach(key => {
        const val = data[key];
        const regex = new RegExp(`\\\\?\\$\\{${key}(\\s*\\|\\|[^}]*)?\\}`, 'g');
        renderedHtml = renderedHtml.replace(regex, val);
      });

      // 2. تنظيف أي متغيرات متبقية لها قيم افتراضية
      renderedHtml = renderedHtml.replace(/\\?\$\{([a-zA-Z0-9_]+)\s*\|\|\s*['"]?([^'"}]+)['"]?\}/g, '$2');

      // 3. استبدال أي تعبيرات متبقية بقيمة فارغة أو — لمنع ظهور كود خام نهائياً
      renderedHtml = renderedHtml.replace(/\\?\$\{([^}]+)\}/g, '—');

      return renderedHtml;
    }

    /* ── حفظ القالب ────────────────────────────────────────────────────────── */
    async saveTemplateFromForm(e) {
      if (e) e.preventDefault();
      this.syncFormData();

      if (!this.editingTemplate.name || !this.editingTemplate.name.trim()) {
        showToast('⚠️ يرجى إدخال اسم القالب الرسمي.');
        return;
      }

      if (!this.editingTemplate.html_template || !this.editingTemplate.html_template.trim()) {
        showToast('⚠️ يرجى كتابة نص أو تصميم عناصر القالب قبل الحفظ.');
        return;
      }

      const templateData = {
        id: this.editingTemplate.id,
        name: this.editingTemplate.name,
        module: this.editingTemplate.module,
        category_ar: this.editingTemplate.category_ar,
        description: this.editingTemplate.description,
        orientation: this.editingTemplate.orientation,
        is_default: this.editingTemplate.is_default,
        header_config: this.editingTemplate.header_config,
        footer_config: this.editingTemplate.footer_config,
        signatures_config: this.editingTemplate.signatures_config,
        signatures_layout: this.editingTemplate.signatures_layout || 'grid',
        html_template: this.editingTemplate.html_template,
        updated_at: new Date().toISOString()
      };

      try {
        await fetch('/api/v4/print-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('token') } : {})
          },
          body: JSON.stringify(templateData)
        }).catch(() => null);

        const idx = this.templates.findIndex(t => t.id === templateData.id);
        if (templateData.is_default) {
          this.templates.forEach(t => {
            if (t.module === templateData.module) t.is_default = false;
          });
        }

        if (idx >= 0) {
          this.templates[idx] = { ...this.templates[idx], ...templateData };
        } else {
          this.templates.unshift(templateData);
        }

        this.saveLocalBackup();
        showToast('✅ تم حفظ وتعميم قالب الطباعة بنجاح');
        this.closeDedicatedModal();
        this.render();
        this.updateBadgeCount();
      } catch (err) {
        showToast('❌ حدث خطأ أثناء الحفظ: ' + err.message);
      }
    }

    /* ── معاينة القالب فورياً ──────────────────────────────────────────────── */
    previewTemplate(templateId) {
      const t = this.templates.find(item => item.id === templateId);
      if (!t) return;

      const renderedHtml = this.generateSimulatedHtml(t.html_template);
      const signatures = Array.isArray(t.signatures_config) ? t.signatures_config : [];

      let viewModal = document.getElementById('print-template-preview-modal');
      if (!viewModal) {
        viewModal = document.createElement('div');
        viewModal.id = 'print-template-preview-modal';
        viewModal.style.cssText = 'display:flex; position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.8); backdrop-filter:blur(5px); align-items:center; justify-content:center; padding:16px; direction:rtl;';
        document.body.appendChild(viewModal);
      }

      viewModal.style.display = 'flex';
      viewModal.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:16px; width:100%; max-width:880px; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(0,0,0,0.6); overflow:hidden; font-family:'Tajawal',sans-serif; color:var(--text, #f8fafc);">
          
          <div style="background:linear-gradient(135deg, #1e3a8a, #0284c7); color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:1.05rem;">👁️ معاينة قالب: ${t.name}</div>
            <button onclick="document.getElementById('print-template-preview-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:1.3rem; cursor:pointer;">✕</button>
          </div>

          <div style="padding:20px; overflow-y:auto; flex:1; background:#525659;">
            <div style="background:#ffffff; color:#0f172a; padding:30px; border-radius:4px; box-shadow:0 5px 20px rgba(0,0,0,0.3); max-width:750px; margin:0 auto;">
              
              <!-- Header -->
              <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; border-bottom:2px double #1e3a8a; padding-bottom:12px; margin-bottom:18px;">
                <div style="text-align:right; font-size:0.82rem; line-height:1.5; color:#1e3a8a;">
                  <div style="font-weight:800; font-size:0.92rem; color:#0f172a;">${(t.header_config && t.header_config.countryName) || 'المملكة الأردنية الهاشمية'}</div>
                  <div style="font-weight:bold;">${(t.header_config && t.header_config.ministryName) || 'وزارة الإدارة المحلية'}</div>
                  <div style="font-weight:800; color:#1e3a8a;">${(t.header_config && t.header_config.municipalityName) || 'بلدية كفرنجة الجديدة'}</div>
                  <div style="font-size:0.78rem; color:#475569;">${(t.header_config && t.header_config.directorateName) || 'مديرية الأشغال والخدمات الهندسية'}</div>
                </div>
                <div style="text-align:center; padding:0 14px;">
                  <img src="${(t.header_config && t.header_config.logoUrl) || '/logo.png'}" onerror="this.outerHTML='<div style=\\'width:${(t.header_config && t.header_config.logoSize) || 105}px;height:${(t.header_config && t.header_config.logoSize) || 105}px;border-radius:50%;background:#1e3a8a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;margin:0 auto;\\'>🏛️</div>'" style="width:${(t.header_config && t.header_config.logoSize) || 105}px; height:${(t.header_config && t.header_config.logoSize) || 105}px; max-width:220px; max-height:220px; object-fit:contain; border-radius:50%; border:2px solid #1e3a8a; padding:3px; display:block; margin:0 auto; box-shadow:0 2px 8px rgba(0,0,0,0.08);" />
                </div>
                <div style="text-align:left; font-size:0.75rem; line-height:1.5; font-family:monospace; color:#334155; direction:ltr;">
                  <div><b style="color:#0f172a;">Ref:</b> <span style="font-weight:bold; color:#1e3a8a;">KJ-2026-8785</span></div>
                  <div><b style="color:#0f172a;">Date:</b> ${new Date().toLocaleDateString('ar-JO')}</div>
                  <div style="font-size:0.62rem; color:#64748b;">Sec: SHA256-VALID</div>
                </div>
              </div>

              <!-- Body -->
              <div style="min-height:220px;">
                ${renderedHtml}
              </div>

              <!-- Signatures Layout Rendered -->
              <div style="margin-top:30px; border-top:1px dashed #cbd5e1; padding-top:16px;">
                <div style="${(() => {
                  const lay = t.signatures_layout || (t.module === 'LETTER' || signatures.length === 1 ? 'left' : 'grid');
                  if (lay === 'left') return 'display:flex; justify-content:flex-end; width:100%; text-align:center; direction:rtl;';
                  if (lay === 'right') return 'display:flex; justify-content:flex-start; width:100%; text-align:center; direction:rtl;';
                  if (lay === 'center') return 'display:flex; justify-content:center; width:100%; text-align:center; direction:rtl;';
                  if (lay === 'split') return 'display:flex; justify-content:space-between; width:100%; text-align:center; direction:rtl;';
                  return `display:grid; grid-template-columns:repeat(${Math.min(signatures.length || 1, 4)}, 1fr); gap:12px; text-align:center; width:100%; direction:rtl;`;
                })()}">
                  ${signatures.map(s => {
                    const lay = t.signatures_layout || (t.module === 'LETTER' || signatures.length === 1 ? 'left' : 'grid');
                    const isLeft = (s.position === 'left' || (!s.position || s.position === 'auto') && lay === 'left');
                    const isRight = (s.position === 'right' || (!s.position || s.position === 'auto') && lay === 'right');
                    return `
                      <div style="min-width:180px; max-width:260px; text-align:center; ${isLeft ? 'margin-right:auto; margin-left:0;' : isRight ? 'margin-left:auto; margin-right:0;' : ''}">
                        <div style="font-weight:bold; font-size:0.82rem; color:#1e3a8a;">${s.roleName}</div>
                        <div style="font-size:0.72rem; color:#64748b; margin-bottom:24px;">${s.signLabel || 'التوقيع'}</div>
                        <div style="border-bottom:1px solid #94a3b8; width:75%; margin:0 auto;"></div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

            </div>
          </div>

          <div style="background:var(--bg-surface, #0f172a); border-top:1px solid var(--border, #334155); padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
            <button class="btn btn-primary" onclick="window.unifiedPrintTemplatesManager.printTestTemplate('${t.id}')">🖨️ طباعة المستند المعتمد</button>
            <button class="btn btn-outline" onclick="document.getElementById('print-template-preview-modal').style.display='none'">إغلاق</button>
          </div>

        </div>
      `;
    }

    /* ── تشغيل محرك الطباعة الرسمي المعتمد ────────────────────────────────── */
    printTestTemplate(templateId) {
      if (document.getElementById('print-template-modal')?.style.display === 'flex') {
        this.syncFormData();
      }

      const t = (templateId && templateId !== this.editingTemplate?.id) 
        ? (this.templates.find(item => item.id === templateId) || this.editingTemplate)
        : this.editingTemplate;

      if (!t) return;

      const hCfg = t.header_config || {};
      const fCfg = t.footer_config || {};

      if (typeof global.printStandardDocument === 'function') {
        global.printStandardDocument({
          title: t.name,
          subtitle: `نموذج رسمي معتمد - ${t.category_ar || t.module}`,
          documentType: t.module,
          orientation: t.orientation || 'portrait',
          html: this.generateSimulatedHtml(t.html_template),
          signatures: true,
          showApprovalChain: false,
          signatures_layout: t.signatures_layout || 'grid',
          customWorkflow: Array.isArray(t.signatures_config) && t.signatures_config.length > 0 ? t.signatures_config : undefined,
          customSignatures: Array.isArray(t.signatures_config) && t.signatures_config.length > 0 ? t.signatures_config : undefined,
          countryName: hCfg.countryName,
          ministryName: hCfg.ministryName,
          municipalityName: hCfg.municipalityName,
          directorateName: hCfg.directorateName,
          logoPosition: hCfg.logoPosition,
          logoSize: hCfg.logoSize,
          logoUrl: hCfg.logoUrl,
          qrEnabled: hCfg.show_qr !== false,
          showPageNumbers: fCfg.showPageNumbers !== false,
          showPrintTimestamp: fCfg.showTimestamp !== false,
          showUserName: fCfg.showUserName !== false,
          marginTopMm: fCfg.marginTopMm,
          marginBottomMm: fCfg.marginBottomMm,
          marginRightMm: fCfg.marginRightMm,
          marginLeftMm: fCfg.marginLeftMm,
          fontFamily: fCfg.fontFamily,
          fontSizeBase: fCfg.fontSizeBase,
          lineHeight: fCfg.lineHeight,
          primaryColor: fCfg.primaryColor,
          watermarkEnabled: fCfg.watermarkEnabled !== false,
          watermarkType: fCfg.watermarkType,
          watermarkText: fCfg.watermarkText,
          watermarkOpacity: fCfg.watermarkOpacity,
          customHeaderHtml: hCfg.custom_header_html,
          customFooterHtml: fCfg.custom_footer_html
        });
      } else {
        showToast('⚠️ جاري تشغيل نافذة الطباعة...');
        window.print();
      }
    }

    /* ── طباعة كشف القوالب المعتمدة (Catalog Print) ───────────────────────── */
    printCatalog() {
      const filtered = this.getFilteredTemplates();
      if (!filtered.length) {
        showToast('⚠️ لا توجد قوالب للطباعة');
        return;
      }

      const rowsHtml = filtered.map((t, idx) => `
        <tr>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; font-family:monospace; font-weight:bold; color:#1e3a8a;">${t.id}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; font-weight:bold;">${t.name}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1;">${t.category_ar || t.module}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">${t.orientation === 'landscape' ? 'أفقي' : 'عمودي'}</td>
          <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center; color:${t.is_default ? '#16a34a' : '#64748b'}; font-weight:bold;">${t.is_default ? '⭐ افتراضي' : 'عادي'}</td>
        </tr>
      `).join('');

      const catalogHtml = `
        <div style="font-family:'Tajawal',sans-serif; direction:rtl;">
          <h3 style="text-align:center; color:#1e3a8a; margin-bottom:14px; font-weight:bold;">كشف وفهرس قوالب النماذج والطباعة الرسمية المعتمدة</h3>
          <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
            <thead>
              <tr style="background:#1e3a8a; color:#fff;">
                <th style="padding:6px; border:1px solid #94a3b8;">م</th>
                <th style="padding:6px; border:1px solid #94a3b8;">المعرف</th>
                <th style="padding:6px; border:1px solid #94a3b8;">اسم القالب الرسمي</th>
                <th style="padding:6px; border:1px solid #94a3b8;">القطاع / الموديول</th>
                <th style="padding:6px; border:1px solid #94a3b8;">الاتجاه</th>
                <th style="padding:6px; border:1px solid #94a3b8;">حالة الاعتماد</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;

      if (typeof global.printStandardDocument === 'function') {
        global.printStandardDocument({
          title: 'كشف قوالب النماذج والطباعة الرسمية',
          subtitle: 'مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة',
          html: catalogHtml,
          signatures: true,
          showApprovalChain: false
        });
      }
    }

    /* ── تصدير إلى Excel (CSV with UTF-8 BOM) ─────────────────────────────── */
    exportToCSV() {
      const filtered = this.getFilteredTemplates();
      if (!filtered.length) {
        showToast('⚠️ لا توجد قوالب للتصدير');
        return;
      }

      const headers = ['المعرف', 'اسم القالب الرسمي', 'الموديول التابع', 'القطاع بالعربية', 'الاتجاه', 'افتراضي', 'الوصف', 'تاريخ التحديث'];
      const rows = filtered.map(t => [
        `"${t.id}"`,
        `"${t.name.replace(/"/g, '""')}"`,
        `"${t.module}"`,
        `"${t.category_ar || t.module}"`,
        `"${t.orientation}"`,
        `"${t.is_default ? 'نعم' : 'لا'}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${new Date(t.updated_at || Date.now()).toLocaleDateString('ar-JO')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `قوالب_الطباعة_الرسمية_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('📥 تم تصدير كشف القوالب بنجاح');
    }

    /* ── إجراءات القالب (تعيين افتراضي / نسخ / حذف / إعادة ضبط) ──────────── */
    async setDefaultTemplate(templateId) {
      const t = this.templates.find(item => item.id === templateId);
      if (!t) return;

      try {
        await fetch(`/api/v4/print-templates/${encodeURIComponent(templateId)}/default`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('token') } : {})
          }
        }).catch(() => null);

        this.templates.forEach(item => {
          if (item.module === t.module) item.is_default = false;
        });
        t.is_default = true;
        t.updated_at = new Date().toISOString();

        this.saveLocalBackup();
        showToast(`⭐ تم تعيين (${t.name}) كقالب افتراضي لقطاع ${t.category_ar || t.module}`);
        this.render();
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
      }
    }

    async duplicateTemplate(templateId) {
      const t = this.templates.find(item => item.id === templateId);
      if (!t) return;

      try {
        const res = await fetch(`/api/v4/print-templates/${encodeURIComponent(templateId)}/duplicate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('token') } : {})
          }
        }).catch(() => null);

        let dup = null;
        if (res && res.ok) {
          const json = await res.json();
          dup = json.data;
        }

        if (!dup) {
          dup = {
            ...JSON.parse(JSON.stringify(t)),
            id: 'TMPL-' + Date.now().toString(36).toUpperCase(),
            name: `${t.name} (نسخة مخصصة)`,
            is_default: false,
            updated_at: new Date().toISOString()
          };
        }

        this.templates.unshift(dup);
        this.saveLocalBackup();
        showToast('📋 تم نسخ القالب بنجاح.');
        this.render();
        this.updateBadgeCount();
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
      }
    }

    async deleteTemplate(templateId) {
      const t = this.templates.find(item => item.id === templateId);
      if (!t) return;
      if (t.is_default) {
        showToast('⚠️ لا يمكن حذف القالب الافتراضي المعتمد للنظام!');
        return;
      }

      if (!confirm(`هل أنت متأكد من حذف القالب المخصص (${t.name})؟`)) return;

      try {
        await fetch(`/api/v4/print-templates/${encodeURIComponent(templateId)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('token') } : {})
          }
        }).catch(() => null);

        this.templates = this.templates.filter(item => item.id !== templateId);
        this.saveLocalBackup();
        showToast('🗑️ تم حذف القالب بنجاح.');
        this.render();
        this.updateBadgeCount();
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
      }
    }

    async resetToDefaults() {
      if (!confirm('هل أنت متأكد من استرجاع القوالب الافتراضية المعتمدة لبلدية كفرنجة الجديدة؟')) return;

      try {
        await fetch('/api/v4/print-templates/reset-defaults', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('token') } : {})
          }
        }).catch(() => null);

        this.templates = this.getDefaultSystemTemplates();
        this.saveLocalBackup();
        showToast('🔄 تم استرجاع كافة القوالب الافتراضية للنظام.');
        this.render();
        this.updateBadgeCount();
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
      }
    }

    /* ══════════════════════════════════════════════════════════════════════════
       🎨 محرر ومخصص النموذج العام للطباعة والهوية الرسمية (Master Print Customizer)
       ══════════════════════════════════════════════════════════════════════════ */
    openMasterConfigModal() {
      const cfg = (typeof getMasterPrintConfig === 'function') 
        ? getMasterPrintConfig() 
        : {
            logoUrl: '/logo.png',
            logoSize: 75,
            logoPosition: 'center',
            countryName: 'المملكة الأردنية الهاشمية',
            ministryName: 'وزارة الإدارة المحلية',
            municipalityName: 'بلدية كفرنجة الجديدة',
            directorateName: 'مديرية الأشغال والخدمات الهندسية',
            primaryColor: '#1e3a8a',
            secondaryColor: '#0f766e',
            fontFamily: "'Tajawal', 'Cairo', Arial, sans-serif",
            fontSizeBase: 12,
            lineHeight: 1.6,
            pageSize: 'A4',
            marginTopMm: 8,
            marginBottomMm: 8,
            marginLeftMm: 10,
            marginRightMm: 10,
            watermarkEnabled: true,
            watermarkType: 'logo',
            watermarkText: 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة',
            watermarkOpacity: 0.04,
            watermarkScale: 260,
            qrEnabled: true,
            qrPosition: 'left',
            showPageNumbers: true,
            showPrintTimestamp: true,
            showUserName: true,
            showSecuritySeal: true
          };

      this.masterModalTab = 'header';

      let modalEl = document.getElementById('master-print-config-modal');
      if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'master-print-config-modal';
        modalEl.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.8); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; direction:rtl; font-family:"Tajawal",sans-serif;';
        document.body.appendChild(modalEl);
      }

      modalEl.innerHTML = `
        <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:16px; width:100%; max-width:1100px; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(0,0,0,0.35); overflow:hidden;">
          
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--border, #e2e8f0); background:linear-gradient(135deg, rgba(30,58,138,0.06), rgba(15,118,110,0.06));">
            <div>
              <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:var(--text, #0f172a); display:flex; align-items:center; gap:8px;">
                <span>⚙️</span> <span>محرر ومخصص النموذج العام للطباعة والهوية الرسمية</span>
              </h3>
              <p style="margin:2px 0 0 0; font-size:0.82rem; color:var(--text-muted, #64748b);">
                التحكم الشامل بالشعار الرسمي، ترويسة الدولة والبلدية، الهوامش، مناطق الكتابة، العلامة المائية، ومحرك الترقيم الديناميكي
              </p>
            </div>
            <button onclick="window.unifiedPrintTemplatesManager.closeMasterConfigModal()" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--text-muted, #64748b); padding:4px 8px;">✕</button>
          </div>

          <!-- Tabs Header -->
          <div style="display:flex; gap:6px; padding:8px 24px; background:var(--bg-hover, #f8fafc); border-bottom:1px solid var(--border, #e2e8f0); overflow-x:auto;">
            <button class="master-tab-btn" id="mtab-btn-header" onclick="window.unifiedPrintTemplatesManager.switchMasterTab('header')" style="padding:8px 16px; border-radius:8px; border:none; font-weight:bold; font-size:0.85rem; cursor:pointer; background:#1e3a8a; color:#fff; display:flex; align-items:center; gap:6px;">
              <span>🏛️</span> <span>الترويسة والشعار الرسمي</span>
            </button>
            <button class="master-tab-btn" id="mtab-btn-geometry" onclick="window.unifiedPrintTemplatesManager.switchMasterTab('geometry')" style="padding:8px 16px; border-radius:8px; border:none; font-weight:bold; font-size:0.85rem; cursor:pointer; background:transparent; color:var(--text, #334155); display:flex; align-items:center; gap:6px;">
              <span>📏</span> <span>أبعاد وهوامش الصفحة</span>
            </button>
            <button class="master-tab-btn" id="mtab-btn-typography" onclick="window.unifiedPrintTemplatesManager.switchMasterTab('typography')" style="padding:8px 16px; border-radius:8px; border:none; font-weight:bold; font-size:0.85rem; cursor:pointer; background:transparent; color:var(--text, #334155); display:flex; align-items:center; gap:6px;">
              <span>✍️</span> <span>مناطق الكتابة والخطوط</span>
            </button>
            <button class="master-tab-btn" id="mtab-btn-footer" onclick="window.unifiedPrintTemplatesManager.switchMasterTab('footer')" style="padding:8px 16px; border-radius:8px; border:none; font-weight:bold; font-size:0.85rem; cursor:pointer; background:transparent; color:var(--text, #334155); display:flex; align-items:center; gap:6px;">
              <span>📄</span> <span>التذييل والترقيم (صفحة X من Y)</span>
            </button>
            <button class="master-tab-btn" id="mtab-btn-security" onclick="window.unifiedPrintTemplatesManager.switchMasterTab('security')" style="padding:8px 16px; border-radius:8px; border:none; font-weight:bold; font-size:0.85rem; cursor:pointer; background:transparent; color:var(--text, #334155); display:flex; align-items:center; gap:6px;">
              <span>🛡️</span> <span>العلامة المائية والـ QR</span>
            </button>
            <button class="master-tab-btn" id="mtab-btn-preview" onclick="window.unifiedPrintTemplatesManager.switchMasterTab('preview')" style="padding:8px 16px; border-radius:8px; border:none; font-weight:bold; font-size:0.85rem; cursor:pointer; background:transparent; color:var(--text, #334155); display:flex; align-items:center; gap:6px;">
              <span>👁️</span> <span>المعاينة الحية الفورية A4</span>
            </button>
          </div>

          <!-- Body Content -->
          <div style="flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px;">
            
            <!-- TAB 1: HEADER & IDENTITY -->
            <div id="mtab-content-header" class="master-tab-content">
              <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:20px;">
                <div style="display:flex; flex-direction:column; gap:14px;">
                  <div>
                    <label style="font-weight:bold; font-size:0.86rem; color:var(--text, #0f172a); display:block; margin-bottom:4px;">اسم الدولة / الترويسة العليا</label>
                    <input type="text" id="mcfg-country" value="${cfg.countryName}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px 12px; border:1px solid var(--border, #cbd5e1); border-radius:8px; font-family:'Tajawal';">
                  </div>
                  <div>
                    <label style="font-weight:bold; font-size:0.86rem; color:var(--text, #0f172a); display:block; margin-bottom:4px;">اسم الوزارة المعنية</label>
                    <input type="text" id="mcfg-ministry" value="${cfg.ministryName}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px 12px; border:1px solid var(--border, #cbd5e1); border-radius:8px; font-family:'Tajawal';">
                  </div>
                  <div>
                    <label style="font-weight:bold; font-size:0.86rem; color:var(--text, #0f172a); display:block; margin-bottom:4px;">اسم البلدية المعتمد</label>
                    <input type="text" id="mcfg-municipality" value="${cfg.municipalityName}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px 12px; border:1px solid var(--border, #cbd5e1); border-radius:8px; font-family:'Tajawal';">
                  </div>
                  <div>
                    <label style="font-weight:bold; font-size:0.86rem; color:var(--text, #0f172a); display:block; margin-bottom:4px;">اسم المديرية / الجهة المصدرة</label>
                    <input type="text" id="mcfg-directorate" value="${cfg.directorateName}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px 12px; border:1px solid var(--border, #cbd5e1); border-radius:8px; font-family:'Tajawal';">
                  </div>
                </div>

                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">🖼️ إعدادات الشعار وموضعه</h4>
                  
                  <div>
                    <label style="font-weight:bold; font-size:0.82rem; display:block; margin-bottom:4px;">موضع الشعار في الترويسة</label>
                    <select id="mcfg-logopos" onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-family:'Tajawal';">
                      <option value="center" ${cfg.logoPosition === 'center' ? 'selected' : ''}>المنتصف الدقيق (50% Exact Center - المعتمد رسمياً)</option>
                      <option value="right" ${cfg.logoPosition === 'right' ? 'selected' : ''}>الجانب الأيمن (مع الترويسة)</option>
                      <option value="left" ${cfg.logoPosition === 'left' ? 'selected' : ''}>الجانب الأيسر (مع الباركود)</option>
                    </select>
                  </div>

                  <div>
                    <label style="font-weight:bold; font-size:0.82rem; display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span>مقاس الشعار بالبكسل (تكبير وتصغير):</span>
                      <span id="mcfg-logosize-val" style="color:#1e3a8a; font-weight:bold; font-size:0.95rem;">${cfg.logoSize || 105}px</span>
                    </label>
                    <input type="range" id="mcfg-logosize" min="50" max="220" step="5" value="${cfg.logoSize || 105}" oninput="document.getElementById('mcfg-logosize-val').textContent=this.value+'px'; window.unifiedPrintTemplatesManager.updateMasterPreviewLive();" style="width:100%; accent-color:#1e3a8a; cursor:pointer;">
                  </div>

                  <div>
                    <label style="font-weight:bold; font-size:0.82rem; display:block; margin-bottom:4px;">رابط الشعار أو تحميل ملف</label>
                    <input type="text" id="mcfg-logourl" value="${cfg.logoUrl}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-family:monospace; font-size:0.8rem; margin-bottom:6px;">
                    <input type="file" id="mcfg-logofile" accept="image/*" onchange="window.unifiedPrintTemplatesManager.handleMasterLogoFile(event)" style="font-size:0.8rem;">
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 2: GEOMETRY & MARGINS -->
            <div id="mtab-content-geometry" class="master-tab-content" style="display:none;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">📐 قياس الورقة والاتجاه</h4>
                  <div>
                    <label style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">حجم الصفحة القياسي</label>
                    <select id="mcfg-pagesize" onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-family:'Tajawal';">
                      <option value="A4" ${cfg.pageSize === 'A4' ? 'selected' : ''}>A4 (210 × 297 mm - القياسي)</option>
                      <option value="A3" ${cfg.pageSize === 'A3' ? 'selected' : ''}>A3 (297 × 420 mm - للمخططات الكبيرة)</option>
                      <option value="Letter" ${cfg.pageSize === 'Letter' ? 'selected' : ''}>Letter (216 × 279 mm)</option>
                    </select>
                  </div>
                </div>

                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:10px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">📏 هوامش الصفحة بالمليمتر (Margins)</h4>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div>
                      <label style="font-size:0.8rem; font-weight:bold; display:block;">الهامش العلوي (Top mm)</label>
                      <input type="number" id="mcfg-margin-top" min="2" max="30" value="${cfg.marginTopMm || 8}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    <div>
                      <label style="font-size:0.8rem; font-weight:bold; display:block;">الهامش السفلي (Bottom mm)</label>
                      <input type="number" id="mcfg-margin-bottom" min="2" max="30" value="${cfg.marginBottomMm || 8}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    <div>
                      <label style="font-size:0.8rem; font-weight:bold; display:block;">الهامش الأيمن (Right mm)</label>
                      <input type="number" id="mcfg-margin-right" min="2" max="30" value="${cfg.marginRightMm || 10}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    <div>
                      <label style="font-size:0.8rem; font-weight:bold; display:block;">الهامش الأيسر (Left mm)</label>
                      <input type="number" id="mcfg-margin-left" min="2" max="30" value="${cfg.marginLeftMm || 10}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 3: TYPOGRAPHY & COLORS -->
            <div id="mtab-content-typography" class="master-tab-content" style="display:none;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div style="display:flex; flex-direction:column; gap:12px;">
                  <div>
                    <label style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">نوع الخط العربي المعتمد</label>
                    <select id="mcfg-fontfamily" onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-family:'Tajawal';">
                      <option value="'Tajawal', sans-serif" ${cfg.fontFamily.includes('Tajawal') ? 'selected' : ''}>Tajawal (تجوال - هندسي حديث)</option>
                      <option value="'Cairo', sans-serif" ${cfg.fontFamily.includes('Cairo') ? 'selected' : ''}>Cairo (القاهرة - رسمي)</option>
                      <option value="Arial, sans-serif" ${cfg.fontFamily.includes('Arial') && !cfg.fontFamily.includes('Tajawal') ? 'selected' : ''}>Arial / Traditional Arabic</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-weight:bold; font-size:0.85rem; display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span>حجم الخط الأساسي:</span>
                      <span id="mcfg-fontsize-val" style="color:#1e3a8a; font-weight:bold;">${cfg.fontSizeBase || 12}px</span>
                    </label>
                    <input type="range" id="mcfg-fontsize" min="10" max="16" value="${cfg.fontSizeBase || 12}" oninput="document.getElementById('mcfg-fontsize-val').textContent=this.value+'px'; window.unifiedPrintTemplatesManager.updateMasterPreviewLive();" style="width:100%;">
                  </div>
                  <div>
                    <label style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">تباعد الأسطر (Line Height)</label>
                    <select id="mcfg-lineheight" onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px;">
                      <option value="1.4" ${cfg.lineHeight == 1.4 ? 'selected' : ''}>مضغوط (1.4)</option>
                      <option value="1.6" ${cfg.lineHeight == 1.6 ? 'selected' : ''}>قياسي ومريح (1.6)</option>
                      <option value="1.8" ${cfg.lineHeight == 1.8 ? 'selected' : ''}>متباعد للكتب الرسمية (1.8)</option>
                    </select>
                  </div>
                </div>

                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:14px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">🎨 ألوان الهوية البصرية للطباعة</h4>
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <label style="font-weight:bold; font-size:0.85rem;">اللون الرئيسي للترويسة والحدود:</label>
                    <input type="color" id="mcfg-primary-color" value="${cfg.primaryColor || '#1e3a8a'}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:50px; height:36px; border:none; cursor:pointer; border-radius:6px;">
                  </div>
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <label style="font-weight:bold; font-size:0.85rem;">اللون الثانوي للعناوين الفرعية:</label>
                    <input type="color" id="mcfg-secondary-color" value="${cfg.secondaryColor || '#0f766e'}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:50px; height:36px; border:none; cursor:pointer; border-radius:6px;">
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 4: FOOTER & PAGINATION -->
            <div id="mtab-content-footer" class="master-tab-content" style="display:none;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:14px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">📄 محرك الترقيم وتعدد الصفحات</h4>
                  
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:bold; font-size:0.88rem;">
                    <input type="checkbox" id="mcfg-show-pagenum" ${cfg.showPageNumbers !== false ? 'checked' : ''} onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:18px; height:18px;">
                    <span>تفعيل ترقيم الصفحات الديناميكي ("صفحة X من إجمالي Y صفحة")</span>
                  </label>

                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:bold; font-size:0.88rem;">
                    <input type="checkbox" id="mcfg-show-timestamp" ${cfg.showPrintTimestamp !== false ? 'checked' : ''} onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:18px; height:18px;">
                    <span>إظهار تاريخ وتوقيت الطباعة الدقيق في التذييل</span>
                  </label>

                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:bold; font-size:0.88rem;">
                    <input type="checkbox" id="mcfg-show-username" ${cfg.showUserName !== false ? 'checked' : ''} onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:18px; height:18px;">
                    <span>إظهار اسم المستخدم / الموظف المنظم للمعاملة</span>
                  </label>
                </div>

                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">🖋️ كليشة التذييل المعتمدة</h4>
                  <p style="margin:0; font-size:0.8rem; color:#64748b; line-height:1.5;">
                    يتم توليد تذييل الصفحة رسمياً وتثبيته في أسفل كل ورقة مع منع انقسام شبكة التواقيع والاعتمادات عبر خاصية <code>break-inside: avoid</code>.
                  </p>
                </div>
              </div>
            </div>

            <!-- TAB 5: WATERMARK & SECURITY -->
            <div id="mtab-content-security" class="master-tab-content" style="display:none;">
              <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:20px;">
                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">🛡️ العلامة المائية الرسمية (Watermark)</h4>
                  
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:bold; font-size:0.88rem;">
                    <input type="checkbox" id="mcfg-watermark-enabled" ${cfg.watermarkEnabled ? 'checked' : ''} onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:18px; height:18px;">
                    <span>تفعيل العلامة المائية في خلفية المستندات المطبوعة</span>
                  </label>

                  <div>
                    <label style="font-weight:bold; font-size:0.82rem; display:block; margin-bottom:4px;">نوع العلامة المائية</label>
                    <select id="mcfg-watermark-type" onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px;">
                      <option value="logo" ${cfg.watermarkType === 'logo' ? 'selected' : ''}>شعار البلدية باهت في المركز</option>
                      <option value="text" ${cfg.watermarkType === 'text' ? 'selected' : ''}>نص أمني مائل بزاوية 35- درجة</option>
                    </select>
                  </div>

                  <div>
                    <label style="font-weight:bold; font-size:0.82rem; display:block; margin-bottom:4px;">نص العلامة المائية (إن تم اختيار نص)</label>
                    <input type="text" id="mcfg-watermark-text" value="${cfg.watermarkText || 'وثيقة رسمية معتمدة'}" oninput="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px;">
                  </div>

                  <div>
                    <label style="font-weight:bold; font-size:0.82rem; display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span>نسبة الشفافية (Opacity):</span>
                      <span id="mcfg-wm-opacity-val" style="color:#1e3a8a; font-weight:bold;">${Math.round((cfg.watermarkOpacity || 0.04) * 100)}%</span>
                    </label>
                    <input type="range" id="mcfg-watermark-opacity" min="1" max="15" value="${Math.round((cfg.watermarkOpacity || 0.04) * 100)}" oninput="document.getElementById('mcfg-wm-opacity-val').textContent=this.value+'%'; window.unifiedPrintTemplatesManager.updateMasterPreviewLive();" style="width:100%;">
                  </div>
                </div>

                <div style="background:var(--bg-hover, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
                  <h4 style="margin:0; font-size:0.95rem; font-weight:bold; color:#1e3a8a;">📱 التحقق الرقمي والباركود QR</h4>
                  <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:bold; font-size:0.88rem;">
                    <input type="checkbox" id="mcfg-qr-enabled" ${cfg.qrEnabled ? 'checked' : ''} onchange="window.unifiedPrintTemplatesManager.updateMasterPreviewLive()" style="width:18px; height:18px;">
                    <span>إظهار رمز QR للتحقق الرقمي التلقائي في الترويسة</span>
                  </label>
                  <p style="margin:0; font-size:0.8rem; color:#64748b; line-height:1.5;">
                    يربط الرمز مباشرة ببوابة التحقق الرقمية العامة <code>/verify.html?id=RefNo</code> للتحقق الفوري من صحة الأختام والتواقيع.
                  </p>
                </div>
              </div>
            </div>

            <!-- TAB 6: LIVE INTERACTIVE A4 PREVIEW -->
            <div id="mtab-content-preview" class="master-tab-content" style="display:none;">
              <div style="display:flex; justify-content:center; background:#475569; padding:20px; border-radius:12px; overflow-x:auto;">
                <div id="master-live-preview-sheet" style="background:#ffffff; width:720px; min-height:880px; box-shadow:0 10px 30px rgba(0,0,0,0.4); padding:24px 30px; position:relative; box-sizing:border-box; color:#0f172a; border-radius:4px;">
                  <!-- Live Preview Injected Here -->
                </div>
              </div>
            </div>

          </div>

          <!-- Footer Actions -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-top:1px solid var(--border, #e2e8f0); background:var(--bg-hover, #f8fafc);">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.resetMasterConfigToDefaults()" style="color:#dc2626; border-color:#fca5a5;">
                <span>🔄</span> <span>استعادة الضبط الرسمي المعتمد</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.testMasterPrint()">
                <span>🖨️</span> <span>تجربة الطباعة الفعلية</span>
              </button>
            </div>
            
            <div style="display:flex; gap:10px;">
              <button class="btn btn-outline" onclick="window.unifiedPrintTemplatesManager.closeMasterConfigModal()">
                <span>إلغاء</span>
              </button>
              <button class="btn btn-primary" onclick="window.unifiedPrintTemplatesManager.saveMasterConfigFromModal()" style="font-weight:bold; padding:10px 24px; background:linear-gradient(135deg, #1e3a8a, #0f766e); border:none; box-shadow:0 4px 14px rgba(30,58,138,0.3);">
                <span>💾</span> <span>حفظ وتطبيق على كافة مخرجات النظام</span>
              </button>
            </div>
          </div>

        </div>
      `;

      this.updateMasterPreviewLive();
    }

    closeMasterConfigModal() {
      const el = document.getElementById('master-print-config-modal');
      if (el) el.remove();
    }

    switchMasterTab(tabName) {
      this.masterModalTab = tabName;
      document.querySelectorAll('.master-tab-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text, #334155)';
      });
      const activeBtn = document.getElementById(`mtab-btn-${tabName}`);
      if (activeBtn) {
        activeBtn.style.background = '#1e3a8a';
        activeBtn.style.color = '#ffffff';
      }

      document.querySelectorAll('.master-tab-content').forEach(c => c.style.display = 'none');
      const activeContent = document.getElementById(`mtab-content-${tabName}`);
      if (activeContent) activeContent.style.display = 'block';

      if (tabName === 'preview') {
        this.updateMasterPreviewLive();
      }
    }

    handleMasterLogoFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('mcfg-logourl').value = e.target.result;
        this.updateMasterPreviewLive();
        showToast('🖼️ تم تحميل الشعار ومعاينته بنجاح');
      };
      reader.readAsDataURL(file);
    }

    getMasterModalValues() {
      return {
        countryName: document.getElementById('mcfg-country')?.value || 'المملكة الأردنية الهاشمية',
        ministryName: document.getElementById('mcfg-ministry')?.value || 'وزارة الإدارة المحلية',
        municipalityName: document.getElementById('mcfg-municipality')?.value || 'بلدية كفرنجة الجديدة',
        directorateName: document.getElementById('mcfg-directorate')?.value || 'مديرية الأشغال والخدمات الهندسية',
        logoPosition: document.getElementById('mcfg-logopos')?.value || 'center',
        logoSize: parseInt(document.getElementById('mcfg-logosize')?.value || '75', 10),
        logoUrl: document.getElementById('mcfg-logourl')?.value || '/logo.png',
        pageSize: document.getElementById('mcfg-pagesize')?.value || 'A4',
        marginTopMm: parseInt(document.getElementById('mcfg-margin-top')?.value || '8', 10),
        marginBottomMm: parseInt(document.getElementById('mcfg-margin-bottom')?.value || '8', 10),
        marginRightMm: parseInt(document.getElementById('mcfg-margin-right')?.value || '10', 10),
        marginLeftMm: parseInt(document.getElementById('mcfg-margin-left')?.value || '10', 10),
        fontFamily: document.getElementById('mcfg-fontfamily')?.value || "'Tajawal', sans-serif",
        fontSizeBase: parseInt(document.getElementById('mcfg-fontsize')?.value || '12', 10),
        lineHeight: parseFloat(document.getElementById('mcfg-lineheight')?.value || '1.6'),
        primaryColor: document.getElementById('mcfg-primary-color')?.value || '#1e3a8a',
        secondaryColor: document.getElementById('mcfg-secondary-color')?.value || '#0f766e',
        showPageNumbers: document.getElementById('mcfg-show-pagenum')?.checked !== false,
        showPrintTimestamp: document.getElementById('mcfg-show-timestamp')?.checked !== false,
        showUserName: document.getElementById('mcfg-show-username')?.checked !== false,
        watermarkEnabled: document.getElementById('mcfg-watermark-enabled')?.checked !== false,
        watermarkType: document.getElementById('mcfg-watermark-type')?.value || 'logo',
        watermarkText: document.getElementById('mcfg-watermark-text')?.value || 'وثيقة رسمية معتمدة',
        watermarkOpacity: (parseInt(document.getElementById('mcfg-watermark-opacity')?.value || '4', 10)) / 100,
        qrEnabled: document.getElementById('mcfg-qr-enabled')?.checked !== false
      };
    }

    updateMasterPreviewLive() {
      const previewContainer = document.getElementById('master-live-preview-sheet');
      if (!previewContainer) return;

      const cfg = this.getMasterModalValues();

      let headerHtml = '';
      const logoEl = `
        <div style="text-align:center; padding:0 12px; display:flex; align-items:center; justify-content:center;">
          <img src="${cfg.logoUrl}" alt="شعار" style="width:${cfg.logoSize || 105}px; height:${cfg.logoSize || 105}px; max-width:220px; max-height:220px; object-fit:contain; border-radius:50%; border:2px solid ${cfg.primaryColor}; background:#fff; padding:3px; display:block; margin:0 auto; box-shadow:0 2px 8px rgba(0,0,0,0.08);" onerror="this.outerHTML='<div style=&quot;width:${cfg.logoSize || 105}px;height:${cfg.logoSize || 105}px;background:${cfg.primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;margin:0 auto;&quot;>🏛️</div>';">
        </div>
      `;

      const textEl = `
        <div style="text-align:right; font-size:0.8rem; line-height:1.4; color:${cfg.primaryColor};">
          <div style="font-weight:800; font-size:0.92rem; color:#0f172a;">${cfg.countryName}</div>
          <div style="font-weight:bold;">${cfg.ministryName}</div>
          <div style="font-weight:800; font-size:0.88rem; color:${cfg.primaryColor};">${cfg.municipalityName}</div>
          <div style="font-size:0.78rem; color:#475569;">${cfg.directorateName}</div>
        </div>
      `;

      const metaEl = `
        <div style="display:flex; align-items:center; gap:8px; direction:ltr; justify-content:flex-end;">
          <div style="text-align:left; font-size:0.72rem; line-height:1.4; color:#334155;">
            <div><b>Ref:</b> <span style="color:${cfg.primaryColor}; font-weight:bold;">KJ-2026-8842</span></div>
            <div><b>Date:</b> ${new Date().toLocaleDateString('ar-JO')}</div>
            <div style="font-size:0.6rem; color:#64748b;">Sec: SHA256-OK</div>
          </div>
          ${cfg.qrEnabled ? `<div style="width:48px; height:48px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:bold; color:${cfg.primaryColor};">QR Code</div>` : ''}
        </div>
      `;

      if (cfg.logoPosition === 'right') {
        headerHtml = `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px double ${cfg.primaryColor}; padding-bottom:8px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:12px;">${logoEl}${textEl}</div>
            <div>${metaEl}</div>
          </div>
        `;
      } else if (cfg.logoPosition === 'left') {
        headerHtml = `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px double ${cfg.primaryColor}; padding-bottom:8px; margin-bottom:14px;">
            <div>${textEl}</div>
            <div style="display:flex; align-items:center; gap:12px;">${metaEl}${logoEl}</div>
          </div>
        `;
      } else {
        headerHtml = `
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; border-bottom:2px double ${cfg.primaryColor}; padding-bottom:8px; margin-bottom:14px;">
            <div style="justify-self:start;">${textEl}</div>
            <div style="justify-self:center;">${logoEl}</div>
            <div style="justify-self:end;">${metaEl}</div>
          </div>
        `;
      }

      previewContainer.style.fontFamily = cfg.fontFamily;
      previewContainer.style.fontSize = `${cfg.fontSizeBase}px`;
      previewContainer.style.lineHeight = cfg.lineHeight;

      previewContainer.innerHTML = `
        ${headerHtml}
        
        <div style="text-align:center; margin:12px 0;">
          <h2 style="color:${cfg.primaryColor}; font-size:1.15rem; font-weight:bold; margin:0; border-bottom:2px solid ${cfg.primaryColor}; display:inline-block; padding-bottom:2px;">
            نموذج معاينة الطباعة الحية - مديرية الأشغال
          </h2>
          <p style="margin:4px 0 0 0; color:#64748b; font-size:0.8rem;">وثيقة تجريبية توضح ضبط الأبعاد والهوامش والترويسة والتذييل</p>
        </div>

        <table style="width:100%; border-collapse:collapse; margin:14px 0; border:1px solid #cbd5e1;">
          <tr style="background:${cfg.primaryColor}; color:#fff;">
            <th style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem;">رقم المشروع</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem;">اسم المشروع / العطاء</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem;">الجهة المنفذة</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem;">نسبة الإنجاز</th>
          </tr>
          <tr>
            <td style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem;">T-2026-04</td>
            <td style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem; font-weight:bold;">تأهيل وتعبيد خلطات إسفلتية ساخنة</td>
            <td style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem;">شركة صخور عجلون للمقاولات</td>
            <td style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.8rem; color:#16a34a; font-weight:bold;">85%</td>
          </tr>
        </table>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-right:4px solid ${cfg.primaryColor}; padding:10px 14px; border-radius:6px; margin:14px 0; font-size:0.85rem;">
          تم تدقيق كافة البيانات الفنية والمطابقة الميدانية أصولاً حسب التعليمات الصادرة عن وزارة الإدارة المحلية.
        </div>

        <div style="margin-top:24px; padding-top:12px; border-top:1px solid #e2e8f0;">
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; text-align:center;">
            <div>
              <div style="font-weight:bold; font-size:0.8rem; color:${cfg.primaryColor}; margin-bottom:28px;">المهندس المنظم</div>
              <div style="border-top:1px solid #64748b; font-size:0.72rem; color:#64748b; padding-top:3px;">التوقيع والتاريخ</div>
            </div>
            <div>
              <div style="font-weight:bold; font-size:0.8rem; color:${cfg.primaryColor}; margin-bottom:28px;">رئيس القسم الهندسي</div>
              <div style="border-top:1px solid #64748b; font-size:0.72rem; color:#64748b; padding-top:3px;">التدقيق والاعتماد</div>
            </div>
            <div>
              <div style="font-weight:bold; font-size:0.8rem; color:${cfg.primaryColor}; margin-bottom:28px;">مدير الأشغال الهندسية</div>
              <div style="border-top:1px solid #64748b; font-size:0.72rem; color:#64748b; padding-top:3px;">المصادقة الفنية</div>
            </div>
          </div>

          <div style="margin-top:18px; display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:#64748b; border-top:1px solid #e2e8f0; padding-top:6px;">
            <span>${cfg.municipalityName} — ${cfg.directorateName}</span>
            ${cfg.showPrintTimestamp ? `<span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-JO')}</span>` : ''}
            ${cfg.showPageNumbers ? `<span style="font-weight:bold; color:${cfg.primaryColor};">صفحة 1 من 1</span>` : ''}
          </div>
        </div>
      `;
    }

    saveMasterConfigFromModal() {
      const cfg = this.getMasterModalValues();
      if (typeof saveMasterPrintConfig === 'function') {
        saveMasterPrintConfig(cfg);
      } else {
        localStorage.setItem('system_master_print_config', JSON.stringify(cfg));
      }
      showToast('✅ تم حفظ وتطبيق إعدادات النموذج العام للطباعة بنجاح على كافة مخرجات النظام!');
      this.closeMasterConfigModal();
    }

    resetMasterConfigToDefaults() {
      if (!confirm('هل أنت متأكد من استعادة الإعدادات النموذجية الرسمية لبلدية كفرنجة؟')) return;
      if (typeof resetMasterPrintConfig === 'function') {
        resetMasterPrintConfig();
      } else {
        localStorage.removeItem('system_master_print_config');
      }
      showToast('🔄 تم استعادة الإعدادات النموذجية المعتمدة.');
      this.openMasterConfigModal();
    }

    testMasterPrint() {
      const cfg = this.getMasterModalValues();
      if (typeof printStandardDocument === 'function') {
        printStandardDocument({
          title: 'تجربة طباعة النموذج العام المطور',
          subtitle: 'مديرية الأشغال والخدمات الهندسية - فحص الترويسة والتذييل والترقيم',
          refNumber: 'KJ-TEST-2026',
          type: 'single',
          fields: [
            { label: 'نوع الاختبار', value: 'فحص مخصصات النموذج العام للطباعة' },
            { label: 'حالة محرك الترقيم', value: 'صفحة 1 من 1 (نشط وتلقائي)' },
            { label: 'العلامة المائية', value: cfg.watermarkEnabled ? 'مفعلة' : 'معطلة' },
            { label: 'الباركود الرقمي', value: cfg.qrEnabled ? 'مفعل ومشفر' : 'معطل' }
          ],
          ...cfg
        });
      }
    }
  }

  /* تسجيل المحرك عالمياً */
  global.UnifiedPrintTemplatesManager = UnifiedPrintTemplatesManager;

}(window));

