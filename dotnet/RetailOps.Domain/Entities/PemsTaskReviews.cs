using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsTaskReviews
{
    public string Id { get; set; } = null!;

    public string TaskInstanceId { get; set; } = null!;

    public string ReviewerId { get; set; } = null!;

    public string? ReviewerName { get; set; }

    public string Decision { get; set; } = null!;

    public int? QualityScore { get; set; }

    public string? Feedback { get; set; }

    public string? ReviewChecklist { get; set; }

    public int? ReviewDurationMinutes { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual PemsTaskInstances TaskInstance { get; set; } = null!;
}
