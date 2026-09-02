using System.Reflection;
using Knm.Enterprise.Application.Common.Interfaces;
using Knm.Enterprise.Domain.Audit;
using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Configuration;
using Knm.Enterprise.Domain.GIS;
using Knm.Enterprise.Domain.Identity;
using Knm.Enterprise.Domain.Storage;
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

        // 3. User & Identity Configurations
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

        // 4. Audit Log Configuration
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

        // 5. System Settings Configuration
        modelBuilder.Entity<SystemSetting>(b =>
        {
            b.ToTable("system_settings");
            b.HasKey(s => s.Id);
            b.HasIndex(s => new { s.Category, s.Key }).IsUnique();
            b.Property(s => s.Category).HasMaxLength(50).IsRequired();
            b.Property(s => s.Key).HasMaxLength(100).IsRequired();
        });

        // 6. Stored Files Configuration
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
            b.HasIndex(sf => sf.Geometry).HasMethod("GIST"); // PostGIS GiST Index
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
