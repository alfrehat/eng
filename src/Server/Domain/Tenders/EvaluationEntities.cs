using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Tenders;

public class EvaluationCommittee : AuditableEntity
{
    public Guid TenderId { get; set; }
    public Tender Tender { get; set; } = null!;

    public string CommitteeName { get; set; } = "لجنة التقييم الفني والمالي";
    public DateTime FormationDate { get; set; } = DateTime.UtcNow;
    public string HeadOfCommittee { get; set; } = string.Empty;

    public ICollection<EvaluationMember> Members { get; set; } = new List<EvaluationMember>();
    public ICollection<EvaluationCriteria> Criteria { get; set; } = new List<EvaluationCriteria>();
}

public class EvaluationMember : AuditableEntity
{
    public Guid EvaluationCommitteeId { get; set; }
    public EvaluationCommittee EvaluationCommittee { get; set; } = null!;

    public string FullName { get; set; } = string.Empty;
    public string RoleOrTitle { get; set; } = "عضو لجنة فنية";
}

public class EvaluationCriteria : AuditableEntity
{
    public Guid EvaluationCommitteeId { get; set; }
    public EvaluationCommittee EvaluationCommittee { get; set; } = null!;

    public string CriterionName { get; set; } = string.Empty;
    public decimal MaxScore { get; set; } = 100;
    public decimal WeightPercentage { get; set; } = 25;
    public int DisplayOrder { get; set; }
}

public class EvaluationResult : AuditableEntity
{
    public Guid EvaluationCriteriaId { get; set; }
    public EvaluationCriteria EvaluationCriteria { get; set; } = null!;

    public Guid BidId { get; set; }
    public Bid Bid { get; set; } = null!;

    public decimal ScoreGiven { get; set; } = 0;
    public string? EvaluatorNotes { get; set; }
}
