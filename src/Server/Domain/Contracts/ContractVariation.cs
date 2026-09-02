using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Contracts;

public class ContractVariation : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public string VariationNumber { get; set; } = string.Empty; // e.g. "VO-01"
    public string Reason { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string VariationType { get; set; } = "ADDITIONAL_WORKS"; // ADDITIONAL_WORKS, QUANTITY_CHANGE, SPECIFICATION_CHANGE, DELETION
    
    public Guid? ContractItemId { get; set; }
    public ContractItem? ContractItem { get; set; }

    public decimal OriginalQuantity { get; set; } = 0;
    public decimal VariationQuantity { get; set; } = 0;
    public decimal NewQuantity { get; set; } = 0;

    public decimal OriginalUnitPrice { get; set; } = 0;
    public decimal NewUnitPrice { get; set; } = 0;

    public decimal VariationAmount { get; set; } = 0;
    public string Justification { get; set; } = string.Empty;
    
    public string? RequestedBy { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovalDate { get; set; }
    public string Status { get; set; } = "REQUESTED"; // REQUESTED, APPROVED, REJECTED
}
