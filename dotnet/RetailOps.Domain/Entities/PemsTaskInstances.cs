using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsTaskInstances
{
    public string Id { get; set; } = null!;

    public string InstanceCode { get; set; } = null!;

    public string TemplateId { get; set; } = null!;

    public string? SellerId { get; set; }

    public string? SellerName { get; set; }

    public string? AssignedTo { get; set; }

    public string? AssigneeName { get; set; }

    public string? ReviewerId { get; set; }

    public string? ReviewerName { get; set; }

    public string Status { get; set; } = null!;

    public string ReviewStatus { get; set; } = null!;

    public string Frequency { get; set; } = null!;

    public string? Title { get; set; }

    public string? Description { get; set; }

    public string Priority { get; set; } = null!;

    public decimal? Target { get; set; }

    public decimal? Achievement { get; set; }

    public decimal? AchievementPct { get; set; }

    public decimal? Variance { get; set; }

    public string SLAStatus { get; set; } = null!;

    public int? SLAHours { get; set; }

    public DateTime? DueDate { get; set; }

    public DateTime? AssignedAt { get; set; }

    public DateTime? AcceptedAt { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime? SubmittedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public int? ReworkCount { get; set; }

    public string? SubmissionRemarks { get; set; }

    public string? ReviewRemarks { get; set; }

    public string? Tags { get; set; }

    public string? Attachments { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string Department { get; set; } = null!;

    public int? SubTaskCount { get; set; }

    public int? ActivityCount { get; set; }

    public int? CompletedSubTasks { get; set; }

    public decimal? ProgressPct { get; set; }

    public string? ApprovalLevel { get; set; }

    public string? BackupReviewerId { get; set; }

    public int? ApproverCount { get; set; }

    public int? RequiredApprovals { get; set; }

    public decimal? WeightedProgressPct { get; set; }

    public virtual ICollection<PemsActivities> PemsActivities { get; set; } = new List<PemsActivities>();

    public virtual ICollection<PemsEvidence> PemsEvidence { get; set; } = new List<PemsEvidence>();

    public virtual ICollection<PemsNotifications> PemsNotifications { get; set; } = new List<PemsNotifications>();

    public virtual ICollection<PemsSubTasks> PemsSubTasks { get; set; } = new List<PemsSubTasks>();

    public virtual ICollection<PemsTaskAuditLogs> PemsTaskAuditLogs { get; set; } = new List<PemsTaskAuditLogs>();

    public virtual ICollection<PemsTaskReviews> PemsTaskReviews { get; set; } = new List<PemsTaskReviews>();

    public virtual PemsTaskTemplates Template { get; set; } = null!;
}
