using Knm.Enterprise.Domain.Audit;
using Knm.Enterprise.Domain.Configuration;
using Knm.Enterprise.Domain.DynamicData;
using Knm.Enterprise.Domain.GIS;
using Knm.Enterprise.Domain.Identity;
using Knm.Enterprise.Domain.Metadata;
using Knm.Enterprise.Domain.Numbering;
using Knm.Enterprise.Domain.Organization;
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

    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
