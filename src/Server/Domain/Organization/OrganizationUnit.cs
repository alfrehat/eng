using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Organization;

public enum OrganizationUnitType
{
    Directorate = 0,
    Department = 1,
    Section = 2,
    Unit = 3
}

public class OrganizationUnit : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public OrganizationUnitType UnitType { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }

    public Guid? ParentId { get; set; }
    public OrganizationUnit? Parent { get; set; }
    public ICollection<OrganizationUnit> Children { get; set; } = new List<OrganizationUnit>();

    public string? ManagerUserId { get; set; }
}
