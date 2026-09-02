using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Workflow;

public class WorkflowDefinition : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string InitialStateCode { get; set; } = "DRAFT";

    public ICollection<WorkflowState> States { get; set; } = new List<WorkflowState>();
    public ICollection<WorkflowTransition> Transitions { get; set; } = new List<WorkflowTransition>();
}

public class WorkflowState : BaseEntity
{
    public Guid WorkflowDefinitionId { get; set; }
    public WorkflowDefinition WorkflowDefinition { get; set; } = null!;

    public string Code { get; set; } = string.Empty; // e.g. "DRAFT", "REVIEW", "APPROVED"
    public string Name { get; set; } = string.Empty;
    public string? ColorHex { get; set; }
    public bool IsFinal { get; set; } = false;
    public int DisplayOrder { get; set; }
}

public class WorkflowTransition : BaseEntity
{
    public Guid WorkflowDefinitionId { get; set; }
    public WorkflowDefinition WorkflowDefinition { get; set; } = null!;

    public string FromStateCode { get; set; } = string.Empty;
    public string ToStateCode { get; set; } = string.Empty;
    public string ActionName { get; set; } = string.Empty; // e.g. "Submit", "Approve", "Reject"
    public string? RequiredPermissionCode { get; set; }
}
