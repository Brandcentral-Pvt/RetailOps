using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PemsNotifications
{
    public string Id { get; set; } = null!;

    public string? TaskInstanceId { get; set; }

    public string UserId { get; set; } = null!;

    public string Type { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? Message { get; set; }

    public bool IsRead { get; set; }

    public string? ActionUrl { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual PemsTaskInstances? TaskInstance { get; set; }
}
