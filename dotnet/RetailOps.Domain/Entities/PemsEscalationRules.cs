using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsEscalationRules
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public int TriggerHoursBefore { get; set; }

    public string NotifyRole { get; set; } = null!;

    public string Channel { get; set; } = null!;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}
