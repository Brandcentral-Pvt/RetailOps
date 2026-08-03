using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class SetupWizardProgress
{
    public int Id { get; set; }

    public string UserId { get; set; } = null!;

    public string StepName { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? StepData { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime? CompletedAt { get; set; }
}
