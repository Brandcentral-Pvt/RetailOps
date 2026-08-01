using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsTaskTemplates
{
    public string Id { get; set; } = null!;

    public string TaskCode { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string Category { get; set; } = null!;

    public string? Department { get; set; }

    public string Frequency { get; set; } = null!;

    public string? CustomCron { get; set; }

    public int? SLAHours { get; set; }

    public int? TATHours { get; set; }

    public string Priority { get; set; } = null!;

    public string TargetType { get; set; } = null!;

    public decimal? DefaultTarget { get; set; }

    public string? ExpectedOutput { get; set; }

    public string? ReviewerId { get; set; }

    public string? AssigneeRole { get; set; }

    public string? Activities { get; set; }

    public string? SubTaskDefinitions { get; set; }

    public string? Tags { get; set; }

    public bool IsActive { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int TemplateVersion { get; set; }

    public string? ExecutionComplexity { get; set; }

    public int? EstimatedExecutionMinutes { get; set; }

    public bool AutoAssignEnabled { get; set; }

    public bool ReviewRequired { get; set; }

    public int? EscalationHours { get; set; }

    public int? CriticalityScore { get; set; }

    public bool AutomationEligible { get; set; }

    public string? TemplateOwnerId { get; set; }

    public virtual ICollection<PemsAssignmentRules> PemsAssignmentRules { get; set; } = new List<PemsAssignmentRules>();

    public virtual ICollection<PemsTaskInstances> PemsTaskInstances { get; set; } = new List<PemsTaskInstances>();
}
