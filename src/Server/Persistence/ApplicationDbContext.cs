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

    // Phase 04 Tenders Entities
    public DbSet<Knm.Enterprise.Domain.Tenders.Tender> Tenders => Set<Knm.Enterprise.Domain.Tenders.Tender>();
    public DbSet<Knm.Enterprise.Domain.Tenders.TenderDocument> TenderDocuments => Set<Knm.Enterprise.Domain.Tenders.TenderDocument>();
    public DbSet<Knm.Enterprise.Domain.Tenders.TenderDocumentRequirement> TenderDocumentRequirements => Set<Knm.Enterprise.Domain.Tenders.TenderDocumentRequirement>();
    public DbSet<Knm.Enterprise.Domain.Tenders.TenderBoq> TenderBoqs => Set<Knm.Enterprise.Domain.Tenders.TenderBoq>();
    public DbSet<Knm.Enterprise.Domain.Tenders.TenderBoqItem> TenderBoqItems => Set<Knm.Enterprise.Domain.Tenders.TenderBoqItem>();
    public DbSet<Knm.Enterprise.Domain.Tenders.Bidder> Bidders => Set<Knm.Enterprise.Domain.Tenders.Bidder>();
    public DbSet<Knm.Enterprise.Domain.Tenders.Bid> Bids => Set<Knm.Enterprise.Domain.Tenders.Bid>();
    public DbSet<Knm.Enterprise.Domain.Tenders.BidItem> BidItems => Set<Knm.Enterprise.Domain.Tenders.BidItem>();
    public DbSet<Knm.Enterprise.Domain.Tenders.BidGuarantee> BidGuarantees => Set<Knm.Enterprise.Domain.Tenders.BidGuarantee>();
    public DbSet<Knm.Enterprise.Domain.Tenders.TenderOpening> TenderOpenings => Set<Knm.Enterprise.Domain.Tenders.TenderOpening>();
    public DbSet<Knm.Enterprise.Domain.Tenders.TenderOpeningEntry> TenderOpeningEntries => Set<Knm.Enterprise.Domain.Tenders.TenderOpeningEntry>();
    public DbSet<Knm.Enterprise.Domain.Tenders.EvaluationCommittee> EvaluationCommittees => Set<Knm.Enterprise.Domain.Tenders.EvaluationCommittee>();
    public DbSet<Knm.Enterprise.Domain.Tenders.EvaluationMember> EvaluationMembers => Set<Knm.Enterprise.Domain.Tenders.EvaluationMember>();
    public DbSet<Knm.Enterprise.Domain.Tenders.EvaluationCriteria> EvaluationCriteriaList => Set<Knm.Enterprise.Domain.Tenders.EvaluationCriteria>();
    public DbSet<Knm.Enterprise.Domain.Tenders.EvaluationResult> EvaluationResults => Set<Knm.Enterprise.Domain.Tenders.EvaluationResult>();
    public DbSet<Knm.Enterprise.Domain.Tenders.AwardRecommendation> AwardRecommendations => Set<Knm.Enterprise.Domain.Tenders.AwardRecommendation>();
    public DbSet<Knm.Enterprise.Domain.Tenders.AwardDecision> AwardDecisions => Set<Knm.Enterprise.Domain.Tenders.AwardDecision>();

    // Phase 05 Contracts Entities
    public DbSet<Knm.Enterprise.Domain.Contracts.Contract> Contracts => Set<Knm.Enterprise.Domain.Contracts.Contract>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractParty> ContractParties => Set<Knm.Enterprise.Domain.Contracts.ContractParty>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractPartyRole> ContractPartyRoles => Set<Knm.Enterprise.Domain.Contracts.ContractPartyRole>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractTemplate> ContractTemplates => Set<Knm.Enterprise.Domain.Contracts.ContractTemplate>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractClause> ContractClauses => Set<Knm.Enterprise.Domain.Contracts.ContractClause>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractTemplateClause> ContractTemplateClauses => Set<Knm.Enterprise.Domain.Contracts.ContractTemplateClause>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractBoq> ContractBoqs => Set<Knm.Enterprise.Domain.Contracts.ContractBoq>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractItem> ContractItems => Set<Knm.Enterprise.Domain.Contracts.ContractItem>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractGuarantee> ContractGuarantees => Set<Knm.Enterprise.Domain.Contracts.ContractGuarantee>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractExtension> ContractExtensions => Set<Knm.Enterprise.Domain.Contracts.ContractExtension>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractVariation> ContractVariations => Set<Knm.Enterprise.Domain.Contracts.ContractVariation>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractMilestone> ContractMilestones => Set<Knm.Enterprise.Domain.Contracts.ContractMilestone>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractNotice> ContractNotices => Set<Knm.Enterprise.Domain.Contracts.ContractNotice>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractSignature> ContractSignatures => Set<Knm.Enterprise.Domain.Contracts.ContractSignature>();
    public DbSet<Knm.Enterprise.Domain.Contracts.ContractPaymentLink> ContractPaymentLinks => Set<Knm.Enterprise.Domain.Contracts.ContractPaymentLink>();

    // Phase 06 Claims & Financial Execution Entities
    public DbSet<Knm.Enterprise.Domain.Claims.ContractClaim> ContractClaims => Set<Knm.Enterprise.Domain.Claims.ContractClaim>();
    public DbSet<Knm.Enterprise.Domain.Claims.ClaimItem> ClaimItems => Set<Knm.Enterprise.Domain.Claims.ClaimItem>();
    public DbSet<Knm.Enterprise.Domain.Claims.MeasurementRecord> MeasurementRecords => Set<Knm.Enterprise.Domain.Claims.MeasurementRecord>();
    public DbSet<Knm.Enterprise.Domain.Claims.MeasurementItem> MeasurementItems => Set<Knm.Enterprise.Domain.Claims.MeasurementItem>();
    public DbSet<Knm.Enterprise.Domain.Claims.ProgressRecord> ProgressRecords => Set<Knm.Enterprise.Domain.Claims.ProgressRecord>();
    public DbSet<Knm.Enterprise.Domain.Claims.PaymentCertificate> PaymentCertificates => Set<Knm.Enterprise.Domain.Claims.PaymentCertificate>();
    public DbSet<Knm.Enterprise.Domain.Claims.CertificateDeduction> CertificateDeductions => Set<Knm.Enterprise.Domain.Claims.CertificateDeduction>();
    public DbSet<Knm.Enterprise.Domain.Claims.RetentionRecord> RetentionRecords => Set<Knm.Enterprise.Domain.Claims.RetentionRecord>();
    public DbSet<Knm.Enterprise.Domain.Claims.AdvanceRecovery> AdvanceRecoveries => Set<Knm.Enterprise.Domain.Claims.AdvanceRecovery>();
    public DbSet<Knm.Enterprise.Domain.Claims.ClaimAdjustment> ClaimAdjustments => Set<Knm.Enterprise.Domain.Claims.ClaimAdjustment>();
    public DbSet<Knm.Enterprise.Domain.Claims.ClaimDocument> ClaimDocuments => Set<Knm.Enterprise.Domain.Claims.ClaimDocument>();
    public DbSet<Knm.Enterprise.Domain.Claims.ClaimPaymentLink> ClaimPaymentLinks => Set<Knm.Enterprise.Domain.Claims.ClaimPaymentLink>();

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

        // ==========================================
        // 10. PHASE 04: Tenders Engine Mappings
        // ==========================================

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.Tender>(b =>
        {
            b.ToTable("tenders");
            b.HasKey(t => t.Id);
            b.HasIndex(t => t.TenderNumber).IsUnique();
            b.HasIndex(t => t.Status);
            b.HasIndex(t => t.ProjectId);
            b.Property(t => t.TenderNumber).HasMaxLength(50).IsRequired();
            b.Property(t => t.Title).HasMaxLength(250).IsRequired();
            b.Property(t => t.TenderTypeCode).HasMaxLength(50).IsRequired();
            b.Property(t => t.TenderMethodCode).HasMaxLength(50).IsRequired();
            b.Property(t => t.CategoryCode).HasMaxLength(50).IsRequired();
            b.Property(t => t.EstimatedValue).HasPrecision(18, 3);
            b.Property(t => t.Currency).HasMaxLength(10).IsRequired();

            b.HasOne(t => t.Project)
             .WithMany()
             .HasForeignKey(t => t.ProjectId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(t => t.OrganizationUnit)
             .WithMany()
             .HasForeignKey(t => t.OrganizationUnitId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.TenderDocument>(b =>
        {
            b.ToTable("tender_documents");
            b.HasKey(td => td.Id);
            b.Property(td => td.Title).HasMaxLength(200).IsRequired();
            b.Property(td => td.DocumentTypeCode).HasMaxLength(50).IsRequired();

            b.HasOne(td => td.Tender)
             .WithMany(t => t.Documents)
             .HasForeignKey(td => td.TenderId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(td => td.StoredFile)
             .WithMany()
             .HasForeignKey(td => td.StoredFileId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.TenderDocumentRequirement>(b =>
        {
            b.ToTable("tender_document_requirements");
            b.HasKey(tr => tr.Id);
            b.HasIndex(tr => new { tr.TenderTypeCode, tr.DocumentTypeCode }).IsUnique();
            b.Property(tr => tr.TenderTypeCode).HasMaxLength(50).IsRequired();
            b.Property(tr => tr.DocumentTypeCode).HasMaxLength(50).IsRequired();
            b.Property(tr => tr.Title).HasMaxLength(200).IsRequired();
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.TenderBoq>(b =>
        {
            b.ToTable("tender_boqs");
            b.HasKey(tb => tb.Id);
            b.Property(tb => tb.Title).HasMaxLength(200).IsRequired();
            b.Property(tb => tb.SubTotal).HasPrecision(18, 3);
            b.Property(tb => tb.TaxRatePercent).HasPrecision(5, 2);
            b.Property(tb => tb.TaxAmount).HasPrecision(18, 3);
            b.Property(tb => tb.GrandTotal).HasPrecision(18, 3);

            b.HasOne(tb => tb.Tender)
             .WithMany(t => t.Boqs)
             .HasForeignKey(tb => tb.TenderId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.TenderBoqItem>(b =>
        {
            b.ToTable("tender_boq_items");
            b.HasKey(tbi => tbi.Id);
            b.HasIndex(tbi => new { tbi.TenderBoqId, tbi.ItemNumber }).IsUnique();
            b.Property(tbi => tbi.Description).HasMaxLength(500).IsRequired();
            b.Property(tbi => tbi.Unit).HasMaxLength(30).IsRequired();
            b.Property(tbi => tbi.Quantity).HasPrecision(18, 3);
            b.Property(tbi => tbi.EstimatedUnitPrice).HasPrecision(18, 3);
            b.Property(tbi => tbi.EstimatedTotal).HasPrecision(18, 3);

            b.HasOne(tbi => tbi.TenderBoq)
             .WithMany(tb => tb.Items)
             .HasForeignKey(tbi => tbi.TenderBoqId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.Bidder>(b =>
        {
            b.ToTable("bidders");
            b.HasKey(bd => bd.Id);
            b.HasIndex(bd => bd.CommercialRegisterNumber).IsUnique();
            b.Property(bd => bd.Name).HasMaxLength(200).IsRequired();
            b.Property(bd => bd.CommercialRegisterNumber).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.Bid>(b =>
        {
            b.ToTable("bids");
            b.HasKey(bd => bd.Id);
            b.HasIndex(bd => new { bd.TenderId, bd.BidderId }).IsUnique();
            b.Property(bd => bd.OfferedAmount).HasPrecision(18, 3);
            b.Property(bd => bd.Status).HasMaxLength(50).IsRequired();

            b.HasOne(bd => bd.Tender)
             .WithMany(t => t.Bids)
             .HasForeignKey(bd => bd.TenderId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(bd => bd.Bidder)
             .WithMany(bdr => bdr.Bids)
             .HasForeignKey(bd => bd.BidderId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.BidItem>(b =>
        {
            b.ToTable("bid_items");
            b.HasKey(bi => bi.Id);
            b.Property(bi => bi.OfferedUnitPrice).HasPrecision(18, 3);
            b.Property(bi => bi.OfferedTotal).HasPrecision(18, 3);

            b.HasOne(bi => bi.Bid)
             .WithMany(b => b.Items)
             .HasForeignKey(bi => bi.BidId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(bi => bi.TenderBoqItem)
             .WithMany()
             .HasForeignKey(bi => bi.TenderBoqItemId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.BidGuarantee>(b =>
        {
            b.ToTable("bid_guarantees");
            b.HasKey(bg => bg.Id);
            b.HasIndex(bg => bg.GuaranteeNumber);
            b.Property(bg => bg.GuaranteeTypeCode).HasMaxLength(50).IsRequired();
            b.Property(bg => bg.GuaranteeNumber).HasMaxLength(100).IsRequired();
            b.Property(bg => bg.BankName).HasMaxLength(150).IsRequired();
            b.Property(bg => bg.Amount).HasPrecision(18, 3);
            b.Property(bg => bg.Currency).HasMaxLength(10).IsRequired();
            b.Property(bg => bg.Status).HasMaxLength(50).IsRequired();

            b.HasOne(bg => bg.Bid)
             .WithMany(b => b.Guarantees)
             .HasForeignKey(bg => bg.BidId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.TenderOpening>(b =>
        {
            b.ToTable("tender_openings");
            b.HasKey(to => to.Id);
            b.Property(to => to.ConductedBy).HasMaxLength(150).IsRequired();

            b.HasOne(to => to.Tender)
             .WithMany(t => t.Openings)
             .HasForeignKey(to => to.TenderId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.TenderOpeningEntry>(b =>
        {
            b.ToTable("tender_opening_entries");
            b.HasKey(toe => toe.Id);
            b.Property(toe => toe.ReadOutAmount).HasPrecision(18, 3);

            b.HasOne(toe => toe.TenderOpening)
             .WithMany(to => to.Entries)
             .HasForeignKey(toe => toe.TenderOpeningId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(toe => toe.Bid)
             .WithMany()
             .HasForeignKey(toe => toe.BidId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.EvaluationCommittee>(b =>
        {
            b.ToTable("evaluation_committees");
            b.HasKey(ec => ec.Id);
            b.Property(ec => ec.CommitteeName).HasMaxLength(150).IsRequired();
            b.Property(ec => ec.HeadOfCommittee).HasMaxLength(150).IsRequired();

            b.HasOne(ec => ec.Tender)
             .WithMany(t => t.EvaluationCommittees)
             .HasForeignKey(ec => ec.TenderId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.EvaluationMember>(b =>
        {
            b.ToTable("evaluation_members");
            b.HasKey(em => em.Id);
            b.Property(em => em.FullName).HasMaxLength(150).IsRequired();
            b.Property(em => em.RoleOrTitle).HasMaxLength(100).IsRequired();

            b.HasOne(em => em.EvaluationCommittee)
             .WithMany(ec => ec.Members)
             .HasForeignKey(em => em.EvaluationCommitteeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.EvaluationCriteria>(b =>
        {
            b.ToTable("evaluation_criteria");
            b.HasKey(ecr => ecr.Id);
            b.Property(ecr => ecr.CriterionName).HasMaxLength(150).IsRequired();
            b.Property(ecr => ecr.MaxScore).HasPrecision(5, 2);
            b.Property(ecr => ecr.WeightPercentage).HasPrecision(5, 2);

            b.HasOne(ecr => ecr.EvaluationCommittee)
             .WithMany(ec => ec.Criteria)
             .HasForeignKey(ecr => ecr.EvaluationCommitteeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.EvaluationResult>(b =>
        {
            b.ToTable("evaluation_results");
            b.HasKey(er => er.Id);
            b.HasIndex(er => new { er.EvaluationCriteriaId, er.BidId }).IsUnique();
            b.Property(er => er.ScoreGiven).HasPrecision(5, 2);

            b.HasOne(er => er.EvaluationCriteria)
             .WithMany()
             .HasForeignKey(er => er.EvaluationCriteriaId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(er => er.Bid)
             .WithMany()
             .HasForeignKey(er => er.BidId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.AwardRecommendation>(b =>
        {
            b.ToTable("award_recommendations");
            b.HasKey(ar => ar.Id);
            b.Property(ar => ar.RecommendedAmount).HasPrecision(18, 3);
            b.Property(ar => ar.Justification).HasMaxLength(500).IsRequired();
            b.Property(ar => ar.Status).HasMaxLength(50).IsRequired();

            b.HasOne(ar => ar.Tender)
             .WithMany(t => t.AwardRecommendations)
             .HasForeignKey(ar => ar.TenderId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(ar => ar.SelectedBid)
             .WithMany()
             .HasForeignKey(ar => ar.SelectedBidId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Tenders.AwardDecision>(b =>
        {
            b.ToTable("award_decisions");
            b.HasKey(ad => ad.Id);
            b.Property(ad => ad.CouncilDecisionNumber).HasMaxLength(100).IsRequired();
            b.Property(ad => ad.DecisionStatus).HasMaxLength(50).IsRequired();
            b.Property(ad => ad.FinalAwardedAmount).HasPrecision(18, 3);

            b.HasOne(ad => ad.AwardRecommendation)
             .WithMany(ar => ar.Decisions)
             .HasForeignKey(ad => ad.AwardRecommendationId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ==========================================
        // 11. PHASE 05: Contracts Engine Mappings
        // ==========================================

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.Contract>(b =>
        {
            b.ToTable("contracts");
            b.HasKey(c => c.Id);
            b.HasIndex(c => c.ContractNumber).IsUnique();
            b.HasIndex(c => c.ContractStatus);
            b.HasIndex(c => c.ProjectId);
            b.HasIndex(c => c.TenderId);

            b.Property(c => c.ContractNumber).HasMaxLength(50).IsRequired();
            b.Property(c => c.Title).HasMaxLength(250).IsRequired();
            b.Property(c => c.ContractTypeCode).HasMaxLength(50).IsRequired();
            b.Property(c => c.OriginalValue).HasPrecision(18, 3);
            b.Property(c => c.TaxAmount).HasPrecision(18, 3);
            b.Property(c => c.TotalValue).HasPrecision(18, 3);
            b.Property(c => c.CurrentContractValue).HasPrecision(18, 3);
            b.Property(c => c.Currency).HasMaxLength(10).IsRequired();

            b.HasOne(c => c.Project)
             .WithMany()
             .HasForeignKey(c => c.ProjectId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(c => c.Tender)
             .WithMany()
             .HasForeignKey(c => c.TenderId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(c => c.AwardRecommendation)
             .WithMany()
             .HasForeignKey(c => c.AwardRecommendationId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(c => c.AwardDecision)
             .WithMany()
             .HasForeignKey(c => c.AwardDecisionId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(c => c.ContractorParty)
             .WithMany()
             .HasForeignKey(c => c.ContractorPartyId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractParty>(b =>
        {
            b.ToTable("contract_parties");
            b.HasKey(cp => cp.Id);
            b.Property(cp => cp.Name).HasMaxLength(200).IsRequired();
            b.Property(cp => cp.PartyType).HasMaxLength(50).IsRequired();
            b.Property(cp => cp.RegistrationNumber).HasMaxLength(100);

            b.HasOne(cp => cp.Bidder)
             .WithMany()
             .HasForeignKey(cp => cp.BidderId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractPartyRole>(b =>
        {
            b.ToTable("contract_party_roles");
            b.HasKey(cpr => cpr.Id);
            b.Property(cpr => cpr.Role).HasMaxLength(50).IsRequired();

            b.HasOne(cpr => cpr.Contract)
             .WithMany(c => c.PartyRoles)
             .HasForeignKey(cpr => cpr.ContractId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(cpr => cpr.ContractParty)
             .WithMany(cp => cp.Roles)
             .HasForeignKey(cpr => cpr.ContractPartyId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractTemplate>(b =>
        {
            b.ToTable("contract_templates");
            b.HasKey(ct => ct.Id);
            b.HasIndex(ct => ct.Code).IsUnique();
            b.Property(ct => ct.Code).HasMaxLength(50).IsRequired();
            b.Property(ct => ct.Name).HasMaxLength(200).IsRequired();
            b.Property(ct => ct.ContractTypeCode).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractClause>(b =>
        {
            b.ToTable("contract_clauses");
            b.HasKey(cc => cc.Id);
            b.Property(cc => cc.ClauseNumber).HasMaxLength(30).IsRequired();
            b.Property(cc => cc.Title).HasMaxLength(200).IsRequired();
            b.Property(cc => cc.Category).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractTemplateClause>(b =>
        {
            b.ToTable("contract_template_clauses");
            b.HasKey(ctc => ctc.Id);

            b.HasOne(ctc => ctc.ContractTemplate)
             .WithMany(ct => ct.Clauses)
             .HasForeignKey(ctc => ctc.ContractTemplateId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(ctc => ctc.ContractClause)
             .WithMany()
             .HasForeignKey(ctc => ctc.ContractClauseId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractBoq>(b =>
        {
            b.ToTable("contract_boqs");
            b.HasKey(cb => cb.Id);
            b.Property(cb => cb.Title).HasMaxLength(200).IsRequired();
            b.Property(cb => cb.OriginalSubTotal).HasPrecision(18, 3);
            b.Property(cb => cb.CurrentSubTotal).HasPrecision(18, 3);
            b.Property(cb => cb.TaxRatePercent).HasPrecision(5, 2);
            b.Property(cb => cb.TaxAmount).HasPrecision(18, 3);
            b.Property(cb => cb.GrandTotal).HasPrecision(18, 3);

            b.HasOne(cb => cb.Contract)
             .WithMany(c => c.Boqs)
             .HasForeignKey(cb => cb.ContractId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractItem>(b =>
        {
            b.ToTable("contract_items");
            b.HasKey(ci => ci.Id);
            b.Property(ci => ci.ItemCode).HasMaxLength(50).IsRequired();
            b.Property(ci => ci.Description).HasMaxLength(500).IsRequired();
            b.Property(ci => ci.Unit).HasMaxLength(30).IsRequired();
            b.Property(ci => ci.OriginalQuantity).HasPrecision(18, 3);
            b.Property(ci => ci.OriginalUnitPrice).HasPrecision(18, 3);
            b.Property(ci => ci.OriginalAmount).HasPrecision(18, 3);
            b.Property(ci => ci.CurrentQuantity).HasPrecision(18, 3);
            b.Property(ci => ci.CurrentUnitPrice).HasPrecision(18, 3);
            b.Property(ci => ci.CurrentAmount).HasPrecision(18, 3);

            b.HasOne(ci => ci.ContractBoq)
             .WithMany(cb => cb.Items)
             .HasForeignKey(ci => ci.ContractBoqId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractGuarantee>(b =>
        {
            b.ToTable("contract_guarantees");
            b.HasKey(cg => cg.Id);
            b.Property(cg => cg.GuaranteeType).HasMaxLength(50).IsRequired();
            b.Property(cg => cg.ReferenceNumber).HasMaxLength(100).IsRequired();
            b.Property(cg => cg.BankName).HasMaxLength(150).IsRequired();
            b.Property(cg => cg.Amount).HasPrecision(18, 3);
            b.Property(cg => cg.Currency).HasMaxLength(10).IsRequired();
            b.Property(cg => cg.Status).HasMaxLength(50).IsRequired();

            b.HasOne(cg => cg.Contract)
             .WithMany(c => c.Guarantees)
             .HasForeignKey(cg => cg.ContractId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractExtension>(b =>
        {
            b.ToTable("contract_extensions");
            b.HasKey(ce => ce.Id);
            b.Property(ce => ce.ExtensionNumber).HasMaxLength(50).IsRequired();
            b.Property(ce => ce.Reason).HasMaxLength(500).IsRequired();
            b.Property(ce => ce.Status).HasMaxLength(50).IsRequired();

            b.HasOne(ce => ce.Contract)
             .WithMany(c => c.Extensions)
             .HasForeignKey(ce => ce.ContractId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractVariation>(b =>
        {
            b.ToTable("contract_variations");
            b.HasKey(cv => cv.Id);
            b.Property(cv => cv.VariationNumber).HasMaxLength(50).IsRequired();
            b.Property(cv => cv.Reason).HasMaxLength(250).IsRequired();
            b.Property(cv => cv.VariationType).HasMaxLength(50).IsRequired();
            b.Property(cv => cv.OriginalQuantity).HasPrecision(18, 3);
            b.Property(cv => cv.VariationQuantity).HasPrecision(18, 3);
            b.Property(cv => cv.NewQuantity).HasPrecision(18, 3);
            b.Property(cv => cv.OriginalUnitPrice).HasPrecision(18, 3);
            b.Property(cv => cv.NewUnitPrice).HasPrecision(18, 3);
            b.Property(cv => cv.VariationAmount).HasPrecision(18, 3);
            b.Property(cv => cv.Status).HasMaxLength(50).IsRequired();

            b.HasOne(cv => cv.Contract)
             .WithMany(c => c.Variations)
             .HasForeignKey(cv => cv.ContractId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(cv => cv.ContractItem)
             .WithMany()
             .HasForeignKey(cv => cv.ContractItemId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractMilestone>(b =>
        {
            b.ToTable("contract_milestones");
            b.HasKey(cm => cm.Id);
            b.Property(cm => cm.Name).HasMaxLength(200).IsRequired();
            b.Property(cm => cm.MilestoneType).HasMaxLength(50).IsRequired();
            b.Property(cm => cm.Percentage).HasPrecision(5, 2);
            b.Property(cm => cm.Status).HasMaxLength(50).IsRequired();

            b.HasOne(cm => cm.Contract)
             .WithMany(c => c.Milestones)
             .HasForeignKey(cm => cm.ContractId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractNotice>(b =>
        {
            b.ToTable("contract_notices");
            b.HasKey(cn => cn.Id);
            b.Property(cn => cn.NoticeType).HasMaxLength(50).IsRequired();
            b.Property(cn => cn.ReferenceNumber).HasMaxLength(100).IsRequired();
            b.Property(cn => cn.Subject).HasMaxLength(250).IsRequired();
            b.Property(cn => cn.Status).HasMaxLength(50).IsRequired();

            b.HasOne(cn => cn.Contract)
             .WithMany(c => c.Notices)
             .HasForeignKey(cn => cn.ContractId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractSignature>(b =>
        {
            b.ToTable("contract_signatures");
            b.HasKey(cs => cs.Id);
            b.Property(cs => cs.SignerName).HasMaxLength(150).IsRequired();
            b.Property(cs => cs.SignerRole).HasMaxLength(50).IsRequired();
            b.Property(cs => cs.HashAlgorithm).HasMaxLength(30).IsRequired();
            b.Property(cs => cs.DocumentHash).HasMaxLength(128).IsRequired();
            b.Property(cs => cs.SignatureStatus).HasMaxLength(50).IsRequired();

            b.HasOne(cs => cs.Contract)
             .WithMany(c => c.Signatures)
             .HasForeignKey(cs => cs.ContractId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Contracts.ContractPaymentLink>(b =>
        {
            b.ToTable("contract_payment_links");
            b.HasKey(cpl => cpl.Id);
            b.Property(cpl => cpl.ReferenceType).HasMaxLength(50).IsRequired();
            b.Property(cpl => cpl.PaymentClaimReference).HasMaxLength(100).IsRequired();
            b.Property(cpl => cpl.Amount).HasPrecision(18, 3);
            b.Property(cpl => cpl.Status).HasMaxLength(50).IsRequired();

            b.HasOne(cpl => cpl.Contract)
             .WithMany(c => c.PaymentLinks)
             .HasForeignKey(cpl => cpl.ContractId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ==========================================
        // 12. PHASE 06: Claims & Financial Execution Mappings
        // ==========================================

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.ContractClaim>(b =>
        {
            b.ToTable("contract_claims");
            b.HasKey(c => c.Id);
            b.HasIndex(c => c.ClaimNumber).IsUnique();
            b.HasIndex(c => c.ContractId);
            b.HasIndex(c => c.Status);

            b.Property(c => c.ClaimNumber).HasMaxLength(50).IsRequired();
            b.Property(c => c.ClaimTypeCode).HasMaxLength(50).IsRequired();
            b.Property(c => c.GrossAmount).HasPrecision(18, 3);
            b.Property(c => c.DeductionAmount).HasPrecision(18, 3);
            b.Property(c => c.NetAmount).HasPrecision(18, 3);
            b.Property(c => c.PreviousCertifiedAmount).HasPrecision(18, 3);
            b.Property(c => c.CurrentCertifiedAmount).HasPrecision(18, 3);
            b.Property(c => c.CumulativeCertifiedAmount).HasPrecision(18, 3);

            b.HasOne(c => c.Contract)
             .WithMany()
             .HasForeignKey(c => c.ContractId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.ClaimItem>(b =>
        {
            b.ToTable("claim_items");
            b.HasKey(ci => ci.Id);
            b.Property(ci => ci.Unit).HasMaxLength(30).IsRequired();
            b.Property(ci => ci.PreviousQuantity).HasPrecision(18, 3);
            b.Property(ci => ci.CurrentQuantity).HasPrecision(18, 3);
            b.Property(ci => ci.CumulativeQuantity).HasPrecision(18, 3);
            b.Property(ci => ci.UnitPrice).HasPrecision(18, 3);
            b.Property(ci => ci.CurrentAmount).HasPrecision(18, 3);
            b.Property(ci => ci.CumulativeAmount).HasPrecision(18, 3);

            b.HasOne(ci => ci.Claim)
             .WithMany(c => c.Items)
             .HasForeignKey(ci => ci.ClaimId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(ci => ci.ContractItem)
             .WithMany()
             .HasForeignKey(ci => ci.ContractItemId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(ci => ci.MeasurementRecord)
             .WithMany()
             .HasForeignKey(ci => ci.MeasurementRecordId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.MeasurementRecord>(b =>
        {
            b.ToTable("measurement_records");
            b.HasKey(mr => mr.Id);
            b.HasIndex(mr => mr.MeasurementNumber).IsUnique();
            b.Property(mr => mr.MeasurementNumber).HasMaxLength(50).IsRequired();
            b.Property(mr => mr.Location).HasMaxLength(250).IsRequired();
            b.Property(mr => mr.Engineer).HasMaxLength(150).IsRequired();
            b.Property(mr => mr.Status).HasMaxLength(50).IsRequired();

            b.HasOne(mr => mr.Contract)
             .WithMany()
             .HasForeignKey(mr => mr.ContractId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(mr => mr.Claim)
             .WithMany(c => c.Measurements)
             .HasForeignKey(mr => mr.ClaimId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.MeasurementItem>(b =>
        {
            b.ToTable("measurement_items");
            b.HasKey(mi => mi.Id);
            b.Property(mi => mi.Description).HasMaxLength(500).IsRequired();
            b.Property(mi => mi.Unit).HasMaxLength(30).IsRequired();
            b.Property(mi => mi.MeasuredQuantity).HasPrecision(18, 3);

            b.HasOne(mi => mi.MeasurementRecord)
             .WithMany(mr => mr.Items)
             .HasForeignKey(mi => mi.MeasurementRecordId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(mi => mi.ContractItem)
             .WithMany()
             .HasForeignKey(mi => mi.ContractItemId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.ProgressRecord>(b =>
        {
            b.ToTable("progress_records");
            b.HasKey(pr => pr.Id);
            b.Property(pr => pr.PhysicalProgress).HasPrecision(5, 2);
            b.Property(pr => pr.FinancialProgress).HasPrecision(5, 2);
            b.Property(pr => pr.OverallProgress).HasPrecision(5, 2);
            b.Property(pr => pr.Status).HasMaxLength(50).IsRequired();

            b.HasOne(pr => pr.Contract)
             .WithMany()
             .HasForeignKey(pr => pr.ContractId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(pr => pr.Claim)
             .WithMany(c => c.ProgressRecords)
             .HasForeignKey(pr => pr.ClaimId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.PaymentCertificate>(b =>
        {
            b.ToTable("payment_certificates");
            b.HasKey(pc => pc.Id);
            b.HasIndex(pc => pc.CertificateNumber).IsUnique();
            b.Property(pc => pc.CertificateNumber).HasMaxLength(50).IsRequired();
            b.Property(pc => pc.GrossCertified).HasPrecision(18, 3);
            b.Property(pc => pc.PreviousCertified).HasPrecision(18, 3);
            b.Property(pc => pc.CurrentCertified).HasPrecision(18, 3);
            b.Property(pc => pc.CumulativeCertified).HasPrecision(18, 3);
            b.Property(pc => pc.DeductionsTotal).HasPrecision(18, 3);
            b.Property(pc => pc.NetCertified).HasPrecision(18, 3);
            b.Property(pc => pc.Status).HasMaxLength(50).IsRequired();

            b.HasOne(pc => pc.ContractClaim)
             .WithMany(c => c.Certificates)
             .HasForeignKey(pc => pc.ContractClaimId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.CertificateDeduction>(b =>
        {
            b.ToTable("certificate_deductions");
            b.HasKey(cd => cd.Id);
            b.Property(cd => cd.DeductionTypeCode).HasMaxLength(50).IsRequired();
            b.Property(cd => cd.Description).HasMaxLength(250).IsRequired();
            b.Property(cd => cd.Rate).HasPrecision(5, 2);
            b.Property(cd => cd.Amount).HasPrecision(18, 3);

            b.HasOne(cd => cd.ContractClaim)
             .WithMany(c => c.Deductions)
             .HasForeignKey(cd => cd.ContractClaimId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(cd => cd.PaymentCertificate)
             .WithMany(pc => pc.Deductions)
             .HasForeignKey(cd => cd.PaymentCertificateId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.RetentionRecord>(b =>
        {
            b.ToTable("retention_records");
            b.HasKey(rr => rr.Id);
            b.Property(rr => rr.Rate).HasPrecision(5, 2);
            b.Property(rr => rr.Amount).HasPrecision(18, 3);
            b.Property(rr => rr.CumulativeRetention).HasPrecision(18, 3);
            b.Property(rr => rr.ReleasedAmount).HasPrecision(18, 3);
            b.Property(rr => rr.RemainingRetention).HasPrecision(18, 3);

            b.HasOne(rr => rr.Contract)
             .WithMany()
             .HasForeignKey(rr => rr.ContractId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(rr => rr.PaymentCertificate)
             .WithMany(pc => pc.RetentionRecords)
             .HasForeignKey(rr => rr.PaymentCertificateId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.AdvanceRecovery>(b =>
        {
            b.ToTable("advance_recoveries");
            b.HasKey(ar => ar.Id);
            b.Property(ar => ar.OriginalAdvance).HasPrecision(18, 3);
            b.Property(ar => ar.RecoveredToDate).HasPrecision(18, 3);
            b.Property(ar => ar.CurrentRecovery).HasPrecision(18, 3);
            b.Property(ar => ar.RemainingAdvance).HasPrecision(18, 3);

            b.HasOne(ar => ar.Contract)
             .WithMany()
             .HasForeignKey(ar => ar.ContractId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(ar => ar.PaymentCertificate)
             .WithMany(pc => pc.AdvanceRecoveries)
             .HasForeignKey(ar => ar.PaymentCertificateId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.ClaimAdjustment>(b =>
        {
            b.ToTable("claim_adjustments");
            b.HasKey(ca => ca.Id);
            b.Property(ca => ca.AdjustmentType).HasMaxLength(50).IsRequired();
            b.Property(ca => ca.Description).HasMaxLength(250).IsRequired();
            b.Property(ca => ca.Amount).HasPrecision(18, 3);
            b.Property(ca => ca.Reason).HasMaxLength(500).IsRequired();

            b.HasOne(ca => ca.ContractClaim)
             .WithMany(c => c.Adjustments)
             .HasForeignKey(ca => ca.ContractClaimId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.ClaimDocument>(b =>
        {
            b.ToTable("claim_documents");
            b.HasKey(cd => cd.Id);
            b.Property(cd => cd.DocumentType).HasMaxLength(50).IsRequired();
            b.Property(cd => cd.Title).HasMaxLength(200).IsRequired();

            b.HasOne(cd => cd.ContractClaim)
             .WithMany()
             .HasForeignKey(cd => cd.ContractClaimId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(cd => cd.StoredFile)
             .WithMany()
             .HasForeignKey(cd => cd.StoredFileId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Knm.Enterprise.Domain.Claims.ClaimPaymentLink>(b =>
        {
            b.ToTable("claim_payment_links");
            b.HasKey(cpl => cpl.Id);
            b.Property(cpl => cpl.Reference).HasMaxLength(100).IsRequired();
            b.Property(cpl => cpl.PaymentStatus).HasMaxLength(50).IsRequired();
            b.Property(cpl => cpl.Amount).HasPrecision(18, 3);

            b.HasOne(cpl => cpl.PaymentCertificate)
             .WithMany(pc => pc.PaymentLinks)
             .HasForeignKey(cpl => cpl.PaymentCertificateId)
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
