-- ============================================================================
-- Migration 029: Canonical Projects Referential Integrity & Physical Foreign Keys
-- مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
-- ============================================================================
-- الغرض: إنشاء القيود المرجعية المادية (Physical Foreign Keys) لنطاق المشاريع
-- تشمل 15 علاقة داخلية (ON DELETE CASCADE) و 3 علاقات خارجية كانونية (ON DELETE SET NULL)
-- ============================================================================

-- 1. العلاقات الخارجية لنطاق المشاريع (External Canonical Foreign Keys)
DO $$
BEGIN
    -- أ. ربط المشروع بجدول العطاءات الكانوني
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_tender') THEN
        ALTER TABLE public.projects
        ADD CONSTRAINT fk_projects_tender
        FOREIGN KEY (tender_id) REFERENCES public.tenders(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- ب. ربط المشروع بجدول العقود الإنشائية الكانوني
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_contract') THEN
        ALTER TABLE public.projects
        ADD CONSTRAINT fk_projects_contract
        FOREIGN KEY (contract_id) REFERENCES public.contracts(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- ج. ربط المشروع بجدول بنود موازنة المديرية الكانوني
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_budget_line') THEN
        ALTER TABLE public.projects
        ADD CONSTRAINT fk_projects_budget_line
        FOREIGN KEY (budget_line_id) REFERENCES public.directorate_budget_lines(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 2. العلاقات الداخلية لنطاق المشاريع (Internal Projects Domain Foreign Keys)
DO $$
BEGIN
    -- 1. معالم المشروع (Milestones)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_milestones_project') THEN
        ALTER TABLE public.project_milestones
        ADD CONSTRAINT fk_project_milestones_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 2. سجل المخاطر (Risks)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_risks_project') THEN
        ALTER TABLE public.project_risks
        ADD CONSTRAINT fk_project_risks_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 3. سجلات الإنجاز ونسب التقدم (Progress Logs)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_progress_logs_project') THEN
        ALTER TABLE public.project_progress_logs
        ADD CONSTRAINT fk_project_progress_logs_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 4. محفظة المشاريع - ربط المحفظة (Portfolio Projects -> Portfolios)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_portfolio_projects_portfolio') THEN
        ALTER TABLE public.project_portfolio_projects
        ADD CONSTRAINT fk_project_portfolio_projects_portfolio
        FOREIGN KEY (portfolio_id) REFERENCES public.project_portfolios(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 5. محفظة المشاريع - ربط المشروع (Portfolio Projects -> Projects)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_portfolio_projects_project') THEN
        ALTER TABLE public.project_portfolio_projects
        ADD CONSTRAINT fk_project_portfolio_projects_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 6. خطط المشاريع - ربط الخطة (Plan Projects -> Plans)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_plan_projects_plan') THEN
        ALTER TABLE public.project_plan_projects
        ADD CONSTRAINT fk_project_plan_projects_plan
        FOREIGN KEY (plan_id) REFERENCES public.project_plans(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 7. خطط المشاريع - ربط المشروع (Plan Projects -> Projects)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_plan_projects_project') THEN
        ALTER TABLE public.project_plan_projects
        ADD CONSTRAINT fk_project_plan_projects_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 8. درجات الأولوية - ربط المشروع (Priority Scores -> Projects)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_priority_scores_project') THEN
        ALTER TABLE public.project_priority_scores
        ADD CONSTRAINT fk_project_priority_scores_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 9. درجات الأولوية - ربط المعيار (Priority Scores -> Criteria)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_priority_scores_criterion') THEN
        ALTER TABLE public.project_priority_scores
        ADD CONSTRAINT fk_project_priority_scores_criterion
        FOREIGN KEY (criterion_id) REFERENCES public.project_priority_criteria(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 10. نتائج مصفوفة الأولويات (Priority Results -> Projects)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_priority_results_project') THEN
        ALTER TABLE public.project_priority_results
        ADD CONSTRAINT fk_project_priority_results_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 11. البرمجة المالية للمشاريع - ربط الخطة (Financial Programs -> Plans)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_financial_programs_plan') THEN
        ALTER TABLE public.project_financial_programs
        ADD CONSTRAINT fk_project_financial_programs_plan
        FOREIGN KEY (plan_id) REFERENCES public.project_plans(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 12. البرمجة المالية للمشاريع - ربط المشروع (Financial Programs -> Projects)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_financial_programs_project') THEN
        ALTER TABLE public.project_financial_programs
        ADD CONSTRAINT fk_project_financial_programs_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 13. التبعيات الشبكية للمشروع - المشروع السابق (Dependencies -> Predecessor Project)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_dependencies_predecessor') THEN
        ALTER TABLE public.project_dependencies
        ADD CONSTRAINT fk_project_dependencies_predecessor
        FOREIGN KEY (predecessor_project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 14. التبعيات الشبكية للمشروع - المشروع اللاحق (Dependencies -> Successor Project)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_dependencies_successor') THEN
        ALTER TABLE public.project_dependencies
        ADD CONSTRAINT fk_project_dependencies_successor
        FOREIGN KEY (successor_project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- 15. الجداول الزمنية والمسار الحرج (Schedules -> Projects)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_schedules_project') THEN
        ALTER TABLE public.project_schedules
        ADD CONSTRAINT fk_project_schedules_project
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
