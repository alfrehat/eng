using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Metadata;

public enum ScreenStatus
{
    Draft = 0,
    Published = 1,
    Archived = 2
}

public class SystemModule : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }

    public ICollection<SystemSection> Sections { get; set; } = new List<SystemSection>();
}

public class SystemSection : AuditableEntity
{
    public Guid ModuleId { get; set; }
    public SystemModule Module { get; set; } = null!;

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public int DisplayOrder { get; set; }

    public ICollection<SystemScreen> Screens { get; set; } = new List<SystemScreen>();
}

public class SystemScreen : AuditableEntity
{
    public Guid SectionId { get; set; }
    public SystemSection Section { get; set; } = null!;

    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Description { get; set; }
    public string RoutePath { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public ScreenStatus Status { get; set; } = ScreenStatus.Draft;
    public string? NumberingDefinitionCode { get; set; }
    public bool ShowInMenu { get; set; } = true;

    public ICollection<SystemField> Fields { get; set; } = new List<SystemField>();
    public ICollection<SystemAction> Actions { get; set; } = new List<SystemAction>();
}

public class SystemField : AuditableEntity
{
    public Guid ScreenId { get; set; }
    public SystemScreen Screen { get; set; } = null!;

    public string FieldName { get; set; } = string.Empty; // Code used in JSON (e.g. "vehiclePlate")
    public string Label { get; set; } = string.Empty; // Display label (e.g. "رقم اللوحة")
    public string FieldType { get; set; } = "Text"; // Text, Number, Decimal, Date, DateTime, Boolean, Select, Radio, File, etc.
    public int DisplayOrder { get; set; }
    public bool IsRequired { get; set; } = false;
    public bool IsReadonly { get; set; } = false;
    public bool IsHidden { get; set; } = false;
    public string? DefaultValue { get; set; }
    public string? Placeholder { get; set; }
    public string? ReferenceListCode { get; set; } // Points to dynamic ReferenceList
    public string? ValidationRegex { get; set; }
    public string? ValidationMessage { get; set; }

    public ICollection<SystemFieldOption> Options { get; set; } = new List<SystemFieldOption>();
}

public class SystemFieldOption : BaseEntity
{
    public Guid FieldId { get; set; }
    public SystemField Field { get; set; } = null!;

    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

public class SystemAction : BaseEntity
{
    public Guid ScreenId { get; set; }
    public SystemScreen Screen { get; set; } = null!;

    public string ActionType { get; set; } = "View"; // Create, View, Edit, Delete, Print, Export, Submit, Approve
    public string Label { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? PermissionCode { get; set; }
    public bool IsEnabled { get; set; } = true;
    public int DisplayOrder { get; set; }
}
