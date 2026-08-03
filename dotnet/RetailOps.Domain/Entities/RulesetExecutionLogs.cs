using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class RulesetExecutionLogs
{
    public string Id { get; set; } = null!;

    public string RulesetId { get; set; } = null!;

    public string? TriggeredBy { get; set; }

    public string? Status { get; set; }

    public int? MatchedCount { get; set; }

    public int? ActionedCount { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTime? ExecutedAt { get; set; }

    public virtual Rulesets Ruleset { get; set; } = null!;
}
