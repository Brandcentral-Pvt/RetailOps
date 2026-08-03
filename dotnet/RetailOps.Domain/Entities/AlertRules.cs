using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class AlertRules
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Type { get; set; } = null!;

    public string? Condition { get; set; }

    public string? Severity { get; set; }

    public bool? IsActive { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? SellerId { get; set; }

    public string? Execution { get; set; }

    public string? Actions { get; set; }

    public virtual Users? CreatedByNavigation { get; set; }
}
