using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsAssignmentRules
{
    public string Id { get; set; } = null!;

    public string TemplateId { get; set; } = null!;

    public string AssignmentMode { get; set; } = null!;

    public string? AutoAssignStrategy { get; set; }

    public string? ReviewerId { get; set; }

    public string? BackupReviewerId { get; set; }

    public int? EscalationHours { get; set; }

    public string? EscalationReviewerId { get; set; }

    public string? ApprovalLevel { get; set; }

    public bool QualityScoreRequired { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual PemsTaskTemplates Template { get; set; } = null!;
}
