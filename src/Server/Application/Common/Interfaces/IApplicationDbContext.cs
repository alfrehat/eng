using Knm.Enterprise.Domain.Audit;
using Knm.Enterprise.Domain.Configuration;
using Knm.Enterprise.Domain.GIS;
using Knm.Enterprise.Domain.Identity;
using Knm.Enterprise.Domain.Storage;
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

    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
