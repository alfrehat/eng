using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Contracts;

public class ContractTemplate : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ContractTypeCode { get; set; } = "WORKS";
    public string Description { get; set; } = string.Empty;
    public string? HeaderText { get; set; }
    public string? FooterText { get; set; }
    public string? BodyTemplate { get; set; }

    public ICollection<ContractTemplateClause> Clauses { get; set; } = new List<ContractTemplateClause>();
}

public class ContractClause : AuditableEntity
{
    public string ClauseNumber { get; set; } = "1.1";
    public string Title { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Category { get; set; } = "GENERAL_CONDITIONS"; // GENERAL_CONDITIONS, SPECIAL_CONDITIONS, LEGAL, FINANCIAL
    public bool IsMandatory { get; set; } = true;
    public int DisplayOrder { get; set; } = 1;
}

public class ContractTemplateClause : AuditableEntity
{
    public Guid ContractTemplateId { get; set; }
    public ContractTemplate ContractTemplate { get; set; } = null!;

    public Guid ContractClauseId { get; set; }
    public ContractClause ContractClause { get; set; } = null!;

    public int DisplayOrder { get; set; }
}
