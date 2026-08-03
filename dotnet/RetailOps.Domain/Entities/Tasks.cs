using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Tasks
{
    public string Id { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string? Category { get; set; }

    public string? Priority { get; set; }

    public string? Status { get; set; }

    public string? Type { get; set; }

    public string? AsinId { get; set; }

    public string? AsinCode { get; set; }

    public string? SellerId { get; set; }

    public string? SellerName { get; set; }

    public string? AssignedTo { get; set; }

    public string? CreatedBy { get; set; }

    public string? CompletedBy { get; set; }

    public int? ImpactScore { get; set; }

    public string? EffortEstimate { get; set; }

    public bool? IsAIGenerated { get; set; }

    public string? AIReasoning { get; set; }

    public DateTime? StartTime { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? CompletionRemarks { get; set; }

    public string? Tags { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DueDate { get; set; }

    public string? SourceRule { get; set; }
}
