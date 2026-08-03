using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsActivities
{
    public string Id { get; set; } = null!;

    public string SubTaskId { get; set; } = null!;

    public string TaskInstanceId { get; set; } = null!;

    public int StepNo { get; set; }

    public string Title { get; set; } = null!;

    public string? Instructions { get; set; }

    public string? ExpectedOutput { get; set; }

    public string? SupportDocuments { get; set; }

    public bool IsMandatory { get; set; }

    public bool IsCompleted { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? CompletedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual PemsSubTasks SubTask { get; set; } = null!;

    public virtual PemsTaskInstances TaskInstance { get; set; } = null!;
}
