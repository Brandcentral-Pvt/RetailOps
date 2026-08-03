using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Rulesets
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string? Rules { get; set; }

    public string? Conditions { get; set; }

    public string? Actions { get; set; }

    public bool? IsActive { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? Type { get; set; }

    public string? SellerId { get; set; }

    public string? UsingDataFrom { get; set; }

    public string? ExcludeDays { get; set; }

    public bool? IsAutomated { get; set; }

    public string? RunFrequency { get; set; }

    public string? RunTime { get; set; }

    public string? Scope { get; set; }

    public string? ConflictResolution { get; set; }

    public bool? EmailOnRun { get; set; }

    public bool? EmailOnAction { get; set; }

    public string? EmailAddress { get; set; }

    public DateTime? LastRunAt { get; set; }

    public int? TotalRunCount { get; set; }

    public string? LastRunSummary { get; set; }

    public virtual Users? CreatedByNavigation { get; set; }

    public virtual ICollection<RulesetExecutionLogs> RulesetExecutionLogs { get; set; } = new List<RulesetExecutionLogs>();
}
