using Knm.Enterprise.Domain.Audit;
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
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Knm.Enterprise.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<Permission> Permissions { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<SystemSetting> SystemSettings { get; }
    DbSet<StoredFile> StoredFiles { get; }
    DbSet<SpatialFeature> SpatialFeatures { get; }

    // Phase 02 Zero-Code Entities
    DbSet<SystemModule> SystemModules { get; }
    DbSet<SystemSection> SystemSections { get; }
    DbSet<SystemScreen> SystemScreens { get; }
    DbSet<SystemField> SystemFields { get; }
    DbSet<SystemFieldOption> SystemFieldOptions { get; }
    DbSet<SystemAction> SystemActions { get; }
    DbSet<DynamicRecord> DynamicRecords { get; }
    DbSet<OrganizationUnit> OrganizationUnits { get; }
    DbSet<ReferenceList> ReferenceLists { get; }
    DbSet<ReferenceItem> ReferenceItems { get; }
    DbSet<NumberingDefinition> NumberingDefinitions { get; }
    DbSet<WorkflowDefinition> WorkflowDefinitions { get; }
    DbSet<WorkflowState> WorkflowStates { get; }
    DbSet<WorkflowTransition> WorkflowTransitions { get; }

    // Phase 03 Projects & Planning Entities
    DbSet<Project> Projects { get; }
    DbSet<ProjectMilestone> ProjectMilestones { get; }
    DbSet<Portfolio> Portfolios { get; }
    DbSet<PortfolioItem> PortfolioItems { get; }
    DbSet<PriorityModel> PriorityModels { get; }
    DbSet<PriorityCriterion> PriorityCriteria { get; }
    DbSet<ProjectPriorityScore> ProjectPriorityScores { get; }
    DbSet<FinancialProgram> FinancialPrograms { get; }
    DbSet<BudgetChapter> BudgetChapters { get; }
    DbSet<BudgetItem> BudgetItems { get; }
    DbSet<FundingSource> FundingSources { get; }
    DbSet<ProjectAllocation> ProjectAllocations { get; }
    DbSet<ProjectExpenditure> ProjectExpenditures { get; }
    DbSet<ProjectDependency> ProjectDependencies { get; }
    DbSet<ProjectSchedule> ProjectSchedules { get; }
    DbSet<ScheduleActivity> ScheduleActivities { get; }
    DbSet<ActivityDependency> ActivityDependencies { get; }

    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
