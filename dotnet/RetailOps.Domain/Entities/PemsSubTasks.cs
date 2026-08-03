using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsSubTasks
{
    public string Id { get; set; } = null!;

    public string TaskInstanceId { get; set; } = null!;

    public string SubTaskCode { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string Status { get; set; } = null!;

    public string? ExpectedOutput { get; set; }

    public int? SortOrder { get; set; }

    public bool IsCompleted { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public decimal? WeightagePct { get; set; }

    public bool IsMandatory { get; set; }

    public bool ReviewRequired { get; set; }

    public string? OwnerType { get; set; }

    public virtual ICollection<PemsActivities> PemsActivities { get; set; } = new List<PemsActivities>();

    public virtual PemsTaskInstances TaskInstance { get; set; } = null!;
}
