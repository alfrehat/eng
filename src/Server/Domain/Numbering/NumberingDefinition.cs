using Knm.Enterprise.Domain.Common;

namespace Knm.Enterprise.Domain.Numbering;

public class NumberingDefinition : AuditableEntity
{
    public string Code { get; set; } = string.Empty; // e.g. "TEN_SEQ", "VEHICLE_SEQ"
    public string Name { get; set; } = string.Empty;
    public string Prefix { get; set; } = string.Empty; // e.g. "TEN-"
    public string? Suffix { get; set; }
    public string YearFormat { get; set; } = "YYYY"; // NONE, YY, YYYY
    public int SequencePadding { get; set; } = 4; // e.g. 4 -> "0001"
    public long CurrentValue { get; set; } = 0;
    public string ResetPeriod { get; set; } = "YEARLY"; // NEVER, YEARLY, MONTHLY
    public int LastResetYear { get; set; } = DateTime.UtcNow.Year;

    public string GenerateNextFormatted()
    {
        CurrentValue++;
        var yearPart = YearFormat switch
        {
            "YYYY" => DateTime.UtcNow.Year.ToString(),
            "YY" => (DateTime.UtcNow.Year % 100).ToString("D2"),
            _ => string.Empty
        };

        var seqPart = CurrentValue.ToString().PadLeft(SequencePadding, '0');
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(Prefix)) parts.Add(Prefix.TrimEnd('-'));
        if (!string.IsNullOrWhiteSpace(yearPart)) parts.Add(yearPart);
        parts.Add(seqPart);
        if (!string.IsNullOrWhiteSpace(Suffix)) parts.Add(Suffix.TrimStart('-'));

        return string.Join("-", parts);
    }
}
