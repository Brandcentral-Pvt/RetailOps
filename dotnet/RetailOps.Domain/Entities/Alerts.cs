using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Alerts
{
    public string Id { get; set; } = null!;

    public string SellerId { get; set; } = null!;

    public string? AsinId { get; set; }

    public string? Type { get; set; }

    public string? Severity { get; set; }

    public string? Title { get; set; }

    public string? Message { get; set; }

    public bool? IsResolved { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public string? ResolvedBy { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? RuleId { get; set; }

    public bool? Acknowledged { get; set; }

    public string? AcknowledgedBy { get; set; }

    public DateTime? AcknowledgedAt { get; set; }

    public virtual Asins? Asin { get; set; }

    public virtual Users? ResolvedByNavigation { get; set; }

    public virtual Sellers Seller { get; set; } = null!;
}
