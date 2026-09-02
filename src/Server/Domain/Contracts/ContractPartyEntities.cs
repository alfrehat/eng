using Knm.Enterprise.Domain.Common;
using Knm.Enterprise.Domain.Tenders;

namespace Knm.Enterprise.Domain.Contracts;

public class ContractParty : AuditableEntity
{
    public string PartyType { get; set; } = "COMPANY"; // COMPANY, INDIVIDUAL, GOVERNMENT
    public string Name { get; set; } = string.Empty;
    public string? NationalNumber { get; set; }
    public string? RegistrationNumber { get; set; }
    public string? TaxNumber { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? ContactPerson { get; set; }

    // Direct Single Source of Truth link to Bidder
    public Guid? BidderId { get; set; }
    public Bidder? Bidder { get; set; }

    public ICollection<ContractPartyRole> Roles { get; set; } = new List<ContractPartyRole>();
}

public class ContractPartyRole : AuditableEntity
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = null!;

    public Guid ContractPartyId { get; set; }
    public ContractParty ContractParty { get; set; } = null!;

    public string Role { get; set; } = "CONTRACTOR"; // OWNER, CONTRACTOR, SUPPLIER, CONSULTANT, SUPERVISOR, ENGINEER
    public bool IsPrimary { get; set; } = true;
}
