using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class ActionHistory
{
    public long Id { get; set; }

    public string ActionId { get; set; } = null!;

    public string? StatusFrom { get; set; }

    public string? StatusTo { get; set; }

    public string? ChangedBy { get; set; }

    public DateTime? ChangedAt { get; set; }

    public string? Comment { get; set; }

    public virtual Actions Action { get; set; } = null!;

    public virtual Users? ChangedByNavigation { get; set; }
}
