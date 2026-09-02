using System.Reflection;
using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Audit;
using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Configuration;
using Knm.Enterprise.Domain.DynamicData;
using Knm.Enterprise.Domain.GIS;
using Knm.Enterprise.Domain.Identity;
using Knm.Enterprise.Domain.Metadata;
using Knm.Enterprise.Domain.Numbering;
using Knm.Enterprise.Domain.Organization;
using Knm.Enterprise.Domain.Projects;
using Knm.Enterprise.Domain.ReferenceData;
using Knm.Enterprise.Domain.Storage;
using Knm.Enterprise.Domain.Workflow;
using Microsoft.EntityFrameworkCore;

namespace Knm.Enterprise.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    private readonly ICurrentUserService? _currentUserService;
    private readonly IDateTimeService? _dateTimeService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentUserService? currentUserService = null,
        IDateTimeService? dateTimeService = null) : base(options)
    {
        _currentUserService = currentUserService;
        _dateTimeService = dateTimeService;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<SpatialFeature> SpatialFeatures => Set<SpatialFeature>();

    // Phase 02 Zero-Code Entities
    public DbSet<SystemModule> SystemModules => Set<SystemModule>();
    public DbSet<SystemSection> SystemSections => Set<SystemSection>();
    public DbSet<SystemScreen> SystemScreens => Set<SystemScreen>();
    public DbSet<SystemField> SystemFields => Set<SystemField>();
    public DbSet<SystemFieldOption> SystemFieldOptions => Set<SystemFieldOption>();
    public DbSet<SystemAction> SystemActions => Set<SystemAction>();
    public DbSet<DynamicRecord> DynamicRecords => Set<DynamicRecord>();
    public DbSet<OrganizationUnit> OrganizationUnits => Set<OrganizationUnit>();
    public DbSet<ReferenceList> ReferenceLists => Set<ReferenceList>();
    public DbSet<ReferenceItem> ReferenceItems => Set<ReferenceItem>();
    public DbSet<NumberingDefinition> NumberingDefinitions => Set<NumberingDefinition>();
    public DbSet<WorkflowDefinition> WorkflowDefinitions => Set<WorkflowDefinition>();
    public DbSet<WorkflowState> WorkflowStates => Set<WorkflowState>();
    public DbSet<WorkflowTransition> WorkflowTransitions => Set<WorkflowTransition>();

    // Phase 03 Projects & Planning Entities
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMilestone> ProjectMilestones => Set<ProjectMilestone>();
    public DbSet<Portfolio> Portfolios => Set<Portfolio>();
    public DbSet<PortfolioItem> PortfolioItems => Set<PortfolioItem>();
    public DbSet<PriorityModel> PriorityModels => Set<PriorityModel>();
    public DbSet<PriorityCriterion> PriorityCriteria => Set<PriorityCriterion>();
    public DbSet<ProjectPriorityScore> ProjectPriorityScores => Set<ProjectPriorityScore>();
    public DbSet<FinancialProgram> FinancialPrograms => Set<FinancialProgram>();
    public DbSet<BudgetChapter> BudgetChapters => Set<BudgetChapter>();
    public DbSet<BudgetItem> BudgetItems => Set<BudgetItem>();
    public DbSet<FundingSource> FundingSources => Set<FundingSource>();
    public DbSet<ProjectAllocation> ProjectAllocations => Set<ProjectAllocation>();
    public DbSet<ProjectExpenditure> ProjectExpenditures => Set<ProjectExpenditure>();
    public DbSet<ProjectDependency> ProjectDependencies => Set<ProjectDependency>();
    public DbSet<ProjectSchedule> ProjectSchedules => Set<ProjectSchedule>();
    public DbSet<ScheduleActivity> ScheduleActivities => Set<ScheduleActivity>();
    public DbSet<ActivityDependency> ActivityDependencies => Set<ActivityDependency>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 1. Enable PostGIS Extension
        modelBuilder.HasPostgresExtension("postgis");

        // 2. Apply Soft Delete Global Filters
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(ISoftDeletable).IsAssignableFrom(entityType.ClrType))
            {
                var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "e");
                var property = System.Linq.Expressions.Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted));
                var falseConstant = System.Linq.Expressions.Expression.Constant(false);
                var lambda = System.Linq.Expressions.Expression.Lambda(
                    System.Linq.Expressions.Expression.Equal(property, falseConstant),
                    parameter);

                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
            }
        }

        // 3. Identity Configurations
        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasKey(u => u.Id);
            b.HasIndex(u => u.Username).IsUnique();
            b.HasIndex(u => u.Email);
            b.Property(u => u.Username).HasMaxLength(100).IsRequired();
            b.Property(u => u.FullName).HasMaxLength(200).IsRequired();
            b.Property(u => u.Email).HasMaxLength(200).IsRequired();
        });

        modelBuilder.Entity<Role>(b =>
        {
            b.ToTable("roles");
            b.HasKey(r => r.Id);
            b.HasIndex(r => r.NormalizedName).IsUnique();
            b.Property(r => r.Name).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Permission>(b =>
        {
            b.ToTable("permissions");
            b.HasKey(p => p.Id);
            b.HasIndex(p => p.Code).IsUnique();
            b.Property(p => p.Code).HasMaxLength(100).IsRequired();
            b.Property(p => p.Module).HasMaxLength(100).IsRequired();
            b.Property(p => p.Name).HasMaxLength(200).IsRequired();
        });

        modelBuilder.Entity<UserRole>(b =>
        {
            b.ToTable("user_roles");
            b.HasKey(ur => new { ur.UserId, ur.RoleId });
            b.HasOne(ur => ur.User)
             .WithMany(u => u.UserRoles)
             .HasForeignKey(ur => ur.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(ur => ur.Role)
             .WithMany(r => r.UserRoles)
             .HasForeignKey(ur => ur.RoleId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RolePermission>(b =>
        {
            b.ToTable("role_permissions");
            b.HasKey(rp => new { rp.RoleId, rp.PermissionId });
            b.HasOne(rp => rp.Role)
             .WithMany(r => r.RolePermissions)
             .HasForeignKey(rp => rp.RoleId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(rp => rp.Permission)
             .WithMany(p => p.RolePermissions)
             .HasForeignKey(rp => rp.PermissionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // 4. Audit Log
        modelBuilder.Entity<AuditLog>(b =>
        {
            b.ToTable("audit_logs");
            b.HasKey(a => a.Id);
            b.HasIndex(a => a.Timestamp);
            b.HasIndex(a => a.EntityName);
            b.HasIndex(a => a.CorrelationId);
            b.Property(a => a.Action).HasMaxLength(50).IsRequired();
            b.Property(a => a.EntityName).HasMaxLength(100).IsRequired();
        });

        // 5. System Settings
        modelBuilder.Entity<SystemSetting>(b =>
        {
            b.ToTable("system_settings");
            b.HasKey(s => s.Id);
            b.HasIndex(s => new { s.Category, s.Key }).IsUnique();
            b.Property(s => s.Category).HasMaxLength(50).IsRequired();
            b.Property(s => s.Key).HasMaxLength(100).IsRequired();
        });

        // 6. Stored Files
        modelBuilder.Entity<StoredFile>(b =>
        {
            b.ToTable("stored_files");
            b.HasKey(f => f.Id);
            b.HasIndex(f => f.Sha256Hash);
            b.Property(f => f.OriginalFileName).HasMaxLength(255).IsRequired();
            b.Property(f => f.StoredFileName).HasMaxLength(255).IsRequired();
            b.Property(f => f.ContentType).HasMaxLength(100).IsRequired();
        });

        // 7. Spatial Features (PostGIS)
        modelBuilder.Entity<SpatialFeature>(b =>
        {
            b.ToTable("spatial_features");
            b.HasKey(sf => sf.Id);
            b.Property(sf => sf.FeatureType).HasMaxLength(50).IsRequired();
            b.Property(sf => sf.Name).HasMaxLength(200).IsRequired();
            b.Property(sf => sf.Geometry).HasColumnType("geometry").IsRequired();
            b.HasIndex(sf => sf.Geometry).HasMethod("GIST");
        });

        // 8. Phase 02 Metadata
        modelBuilder.Entity<SystemModule>(b =>
        {
            b.ToTable("system_modules");
            b.HasKey(m => m.Id);
            b.HasIndex(m => m.Code).IsUnique();
            b.Property(m => m.Code).HasMaxLength(50).IsRequired();
            b.Property(m => m.Name).HasMaxLength(150).IsRequired();
        });

        modelBuilder.Entity<SystemSection>(b =>
        {
            b.ToTable("system_sections");
            b.HasKey(s => s.Id);
            b.HasIndex(s => new { s.ModuleId, s.Code }).IsUnique();
            b.Property(s => s.Code).HasMaxLength(50).IsRequired();
            b.Property(s => s.Name).HasMaxLength(150).IsRequired();
            b.HasOne(s => s.Module)
             .WithMany(m => m.Sections)
             .HasForeignKey(s => s.ModuleId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SystemScreen>(b =>
        {
            b.ToTable("system_screens");
            b.HasKey(sc => sc.Id);
            b.HasIndex(sc => sc.Code).IsUnique();
            b.Property(sc => sc.Code).HasMaxLength(50).IsRequired();
            b.Property(sc => sc.Title).HasMaxLength(150).IsRequired();
            b.HasOne(sc => sc.Section)
             .WithMany(s => s.Screens)
             .HasForeignKey(sc => sc.SectionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SystemField>(b =>
        {
            b.ToTable("system_fields");
            b.HasKey(f => f.Id);
            b.HasIndex(f => new { f.ScreenId, f.FieldName }).IsUnique();
            b.Property(f => f.FieldName).HasMaxLength(100).IsRequired();
            b.Property(f => f.Label).HasMaxLength(150).IsRequired();
            b.Property(f => f.FieldType).HasMaxLength(50).IsRequired();
            b.HasOne(f => f.Screen)
             .WithMany(sc => sc.Fields)
             .HasForeignKey(f => f.ScreenId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SystemFieldOption>(b =>
        {
            b.ToTable("system_field_options");
            b.HasKey(o => o.Id);
            b.Property(o => o.Value).HasMaxLength(100).IsRequired();
            b.Property(o => o.Label).HasMaxLength(150).IsRequired();
            b.HasOne(o => o.Field)
             .WithMany(f => f.Options)
             .HasForeignKey(o => o.FieldId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SystemAction>(b =>
        {
            b.ToTable("system_actions");
            b.HasKey(a => a.Id);
            b.Property(a => a.ActionType).HasMaxLength(50).IsRequired();
            b.Property(a => a.Label).HasMaxLength(100).IsRequired();
            b.HasOne(a => a.Screen)
             .WithMany(sc => sc.Actions)
             .HasForeignKey(a => a.ScreenId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DynamicRecord>(b =>
        {
            b.ToTable("dynamic_records");
            b.HasKey(dr => dr.Id);
            b.Property(dr => dr.DataJson).HasColumnType("jsonb").IsRequired();
            b.HasIndex(dr => dr.ScreenId);
            b.HasIndex(dr => dr.ReferenceNumber);
            b.HasIndex(dr => dr.DataJson).HasMethod("GIN");
            b.HasOne(dr => dr.Screen)
             .WithMany()
             .HasForeignKey(dr => dr.ScreenId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationUnit>(b =>
        {
            b.ToTable("organization_units");
            b.HasKey(ou => ou.Id);
            b.HasIndex(ou => ou.Code).IsUnique();
            b.Property(ou => ou.Code).HasMaxLength(50).IsRequired();
            b.Property(ou => ou.Name).HasMaxLength(150).IsRequired();
            b.HasOne(ou => ou.Parent)
             .WithMany(p => p.Children)
             .HasForeignKey(ou => ou.ParentId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ReferenceList>(b =>
        {
            b.ToTable("reference_lists");
            b.HasKey(rl => rl.Id);
            b.HasIndex(rl => rl.Code).IsUnique();
            b.Property(rl => rl.Code).HasMaxLength(50).IsRequired();
            b.Property(rl => rl.Name).HasMaxLength(150).IsRequired();
        });

        modelBuilder.Entity<ReferenceItem>(b =>
        {
            b.ToTable("reference_items");
            b.HasKey(ri => ri.Id);
            b.HasIndex(ri => new { ri.ReferenceListId, ri.Value }).IsUnique();
            b.Property(ri => ri.Value).HasMaxLength(100).IsRequired();
            b.Property(ri => ri.Label).HasMaxLength(150).IsRequired();
            b.HasOne(ri => ri.ReferenceList)
             .WithMany(rl => rl.Items)
             .HasForeignKey(ri => ri.ReferenceListId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<NumberingDefinition>(b =>
        {
            b.ToTable("numbering_definitions");
            b.HasKey(nd => nd.Id);
            b.HasIndex(nd => nd.Code).IsUnique();
            b.Property(nd => nd.Code).HasMaxLength(50).IsRequired();
            b.Property(nd => nd.Name).HasMaxLength(150).IsRequired();
        });

        modelBuilder.Entity<WorkflowDefinition>(b =>
        {
            b.ToTable("workflow_definitions");
            b.HasKey(w => w.Id);
            b.HasIndex(w => w.Code).IsUnique();
            b.Property(w => w.Code).HasMaxLength(50).IsRequired();
            b.Property(w => w.Name).HasMaxLength(150).IsRequired();
        });

        modelBuilder.Entity<WorkflowState>(b =>
        {
            b.ToTable("workflow_states");
            b.HasKey(ws => ws.Id);
            b.HasIndex(ws => new { ws.WorkflowDefinitionId, ws.Code }).IsUnique();
            b.Property(ws => ws.Code).HasMaxLength(50).IsRequired();
            b.Property(ws => ws.Name).HasMaxLength(100).IsRequired();
            b.HasOne(ws => ws.WorkflowDefinition)
             .WithMany(w => w.States)
             .HasForeignKey(ws => ws.WorkflowDefinitionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkflowTransition>(b =>
        {
            b.ToTable("workflow_transitions");
            b.HasKey(wt => wt.Id);
            b.Property(wt => wt.ActionName).HasMaxLength(50).IsRequired();
            b.HasOne(wt => wt.WorkflowDefinition)
             .WithMany(w => w.Transitions)
             .HasForeignKey(wt => wt.WorkflowDefinitionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ==========================================
        // 9. PHASE 03: Projects & Planning Mappings
        // ==========================================

        modelBuilder.Entity<Project>(b =>
        {
            b.ToTable("projects");
            b.HasKey(p => p.Id);
            b.HasIndex(p => p.ProjectNumber).IsUnique();
            b.HasIndex(p => p.Status);
            b.HasIndex(p => p.ProjectTypeCode);
            b.Property(p => p.ProjectNumber).HasMaxLength(50).IsRequired();
            b.Property(p => p.Name).HasMaxLength(250).IsRequired();
            b.Property(p => p.ProjectTypeCode).HasMaxLength(50).IsRequired();
            b.Property(p => p.CategoryCode).HasMaxLength(50).IsRequired();
            b.Property(p => p.PriorityLevel).HasMaxLength(20).IsRequired();
            b.Property(p => p.EstimatedCost).HasPrecision(18, 3);
            b.Property(p => p.ContractValue).HasPrecision(18, 3);
            b.Property(p => p.ActualExpenditure).HasPrecision(18, 3);
            b.Property(p => p.ProgressPercentage).HasPrecision(5, 2);

            // PostGIS Geometry for project location (Point / LineString / Polygon)
            b.Property(p => p.LocationGeometry).HasColumnType("geometry");
            b.HasIndex(p => p.LocationGeometry).HasMethod("GIST");

            b.HasOne(p => p.OrganizationUnit)
             .WithMany()
             .HasForeignKey(p => p.OrganizationUnitId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ProjectMilestone>(b =>
        {
            b.ToTable("project_milestones");
            b.HasKey(m => m.Id);
            b.Property(m => m.Name).HasMaxLength(150).IsRequired();
            b.HasOne(m => m.Project)
             .WithMany(p => p.Milestones)
             .HasForeignKey(m => m.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Portfolio>(b =>
        {
            b.ToTable("portfolios");
            b.HasKey(p => p.Id);
            b.HasIndex(p => p.Code).IsUnique();
            b.Property(p => p.Code).HasMaxLength(50).IsRequired();
            b.Property(p => p.Name).HasMaxLength(150).IsRequired();
            b.Property(p => p.TotalBudget).HasPrecision(18, 3);
        });

        modelBuilder.Entity<PortfolioItem>(b =>
        {
            b.ToTable("portfolio_items");
            b.HasKey(pi => pi.Id);
            b.HasIndex(pi => new { pi.PortfolioId, pi.ProjectId }).IsUnique();
            b.Property(pi => pi.AllocatedAmount).HasPrecision(18, 3);

            b.HasOne(pi => pi.Portfolio)
             .WithMany(p => p.Items)
             .HasForeignKey(pi => pi.PortfolioId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(pi => pi.Project)
             .WithMany(p => p.PortfolioItems)
             .HasForeignKey(pi => pi.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PriorityModel>(b =>
        {
            b.ToTable("priority_models");
            b.HasKey(pm => pm.Id);
            b.HasIndex(pm => pm.Code).IsUnique();
            b.Property(pm => pm.Code).HasMaxLength(50).IsRequired();
            b.Property(pm => pm.Name).HasMaxLength(150).IsRequired();
        });

        modelBuilder.Entity<PriorityCriterion>(b =>
        {
            b.ToTable("priority_criteria");
            b.HasKey(pc => pc.Id);
            b.Property(pc => pc.Name).HasMaxLength(150).IsRequired();
            b.Property(pc => pc.WeightPercentage).HasPrecision(5, 2);

            b.HasOne(pc => pc.PriorityModel)
             .WithMany(pm => pm.Criteria)
             .HasForeignKey(pc => pc.PriorityModelId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectPriorityScore>(b =>
        {
            b.ToTable("project_priority_scores");
            b.HasKey(pps => pps.Id);
            b.HasIndex(pps => new { pps.ProjectId, pps.PriorityCriterionId }).IsUnique();
            b.Property(pps => pps.RawScore).HasPrecision(5, 2);
            b.Property(pps => pps.WeightedScore).HasPrecision(5, 2);

            b.HasOne(pps => pps.Project)
             .WithMany(p => p.PriorityScores)
             .HasForeignKey(pps => pps.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(pps => pps.PriorityCriterion)
             .WithMany()
             .HasForeignKey(pps => pps.PriorityCriterionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FinancialProgram>(b =>
        {
            b.ToTable("financial_programs");
            b.HasKey(fp => fp.Id);
            b.HasIndex(fp => fp.Code).IsUnique();
            b.Property(fp => fp.Code).HasMaxLength(50).IsRequired();
            b.Property(fp => fp.Name).HasMaxLength(150).IsRequired();
            b.Property(fp => fp.TotalBudget).HasPrecision(18, 3);
        });

        modelBuilder.Entity<BudgetChapter>(b =>
        {
            b.ToTable("budget_chapters");
            b.HasKey(bc => bc.Id);
            b.HasIndex(bc => new { bc.FinancialProgramId, bc.Code }).IsUnique();
            b.Property(bc => bc.Code).HasMaxLength(50).IsRequired();
            b.Property(bc => bc.Name).HasMaxLength(150).IsRequired();

            b.HasOne(bc => bc.FinancialProgram)
             .WithMany(fp => fp.Chapters)
             .HasForeignKey(bc => bc.FinancialProgramId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BudgetItem>(b =>
        {
            b.ToTable("budget_items");
            b.HasKey(bi => bi.Id);
            b.HasIndex(bi => new { bi.BudgetChapterId, bi.Code }).IsUnique();
            b.Property(bi => bi.Code).HasMaxLength(50).IsRequired();
            b.Property(bi => bi.Name).HasMaxLength(150).IsRequired();
            b.Property(bi => bi.AllocatedAmount).HasPrecision(18, 3);

            b.HasOne(bi => bi.BudgetChapter)
             .WithMany(bc => bc.Items)
             .HasForeignKey(bi => bi.BudgetChapterId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FundingSource>(b =>
        {
            b.ToTable("funding_sources");
            b.HasKey(fs => fs.Id);
            b.HasIndex(fs => fs.Code).IsUnique();
            b.Property(fs => fs.Code).HasMaxLength(50).IsRequired();
            b.Property(fs => fs.Name).HasMaxLength(150).IsRequired();
        });

        modelBuilder.Entity<ProjectAllocation>(b =>
        {
            b.ToTable("project_allocations");
            b.HasKey(pa => pa.Id);
            b.Property(pa => pa.AllocatedAmount).HasPrecision(18, 3);
            b.Property(pa => pa.CommittedAmount).HasPrecision(18, 3);

            b.HasOne(pa => pa.Project)
             .WithMany(p => p.Allocations)
             .HasForeignKey(pa => pa.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(pa => pa.BudgetItem)
             .WithMany()
             .HasForeignKey(pa => pa.BudgetItemId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(pa => pa.FundingSource)
             .WithMany()
             .HasForeignKey(pa => pa.FundingSourceId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ProjectExpenditure>(b =>
        {
            b.ToTable("project_expenditures");
            b.HasKey(pe => pe.Id);
            b.Property(pe => pe.Amount).HasPrecision(18, 3);
            b.Property(pe => pe.VoucherNumber).HasMaxLength(100).IsRequired();

            b.HasOne(pe => pe.Project)
             .WithMany(p => p.Expenditures)
             .HasForeignKey(pe => pe.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(pe => pe.ProjectAllocation)
             .WithMany()
             .HasForeignKey(pe => pe.ProjectAllocationId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ProjectDependency>(b =>
        {
            b.ToTable("project_dependencies");
            b.HasKey(pd => pd.Id);
            b.HasIndex(pd => new { pd.PredecessorProjectId, pd.SuccessorProjectId }).IsUnique();

            b.HasOne(pd => pd.PredecessorProject)
             .WithMany()
             .HasForeignKey(pd => pd.PredecessorProjectId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(pd => pd.SuccessorProject)
             .WithMany()
             .HasForeignKey(pd => pd.SuccessorProjectId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProjectSchedule>(b =>
        {
            b.ToTable("project_schedules");
            b.HasKey(ps => ps.Id);

            b.HasOne(ps => ps.Project)
             .WithMany(p => p.Schedules)
             .HasForeignKey(ps => ps.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ScheduleActivity>(b =>
        {
            b.ToTable("schedule_activities");
            b.HasKey(sa => sa.Id);
            b.HasIndex(sa => new { sa.ProjectScheduleId, sa.ActivityCode }).IsUnique();
            b.Property(sa => sa.ActivityCode).HasMaxLength(50).IsRequired();
            b.Property(sa => sa.Name).HasMaxLength(200).IsRequired();
            b.Property(sa => sa.ProgressPercent).HasPrecision(5, 2);

            b.HasOne(sa => sa.ProjectSchedule)
             .WithMany(ps => ps.Activities)
             .HasForeignKey(sa => sa.ProjectScheduleId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ActivityDependency>(b =>
        {
            b.ToTable("activity_dependencies");
            b.HasKey(ad => ad.Id);
            b.HasIndex(ad => new { ad.ProjectScheduleId, ad.PredecessorActivityId, ad.SuccessorActivityId }).IsUnique();

            b.HasOne(ad => ad.ProjectSchedule)
             .WithMany(ps => ps.Dependencies)
             .HasForeignKey(ad => ad.ProjectScheduleId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(ad => ad.PredecessorActivity)
             .WithMany(sa => sa.Successors)
             .HasForeignKey(ad => ad.PredecessorActivityId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(ad => ad.SuccessorActivity)
             .WithMany(sa => sa.Predecessors)
             .HasForeignKey(ad => ad.SuccessorActivityId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var currentUserId = _currentUserService?.UserId ?? "SYSTEM";
        var now = _dateTimeService?.UtcNow ?? DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<IAuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.CreatedBy = currentUserId;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                entry.Entity.UpdatedBy = currentUserId;
            }
        }

        foreach (var entry in ChangeTracker.Entries<ISoftDeletable>())
        {
            if (entry.State == EntityState.Deleted)
            {
                entry.State = EntityState.Modified;
                entry.Entity.IsDeleted = true;
                entry.Entity.DeletedAt = now;
                entry.Entity.DeletedBy = currentUserId;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
