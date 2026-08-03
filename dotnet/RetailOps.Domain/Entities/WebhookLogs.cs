using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class WebhookLogs
{
    public string Id { get; set; } = null!;

    public string? WebhookId { get; set; }

    public string? Event { get; set; }

    public int? HttpStatus { get; set; }

    public int? DurationMs { get; set; }

    public string? Response { get; set; }

    public int? Attempt { get; set; }

    public bool? Success { get; set; }

    public DateTime? CreatedAt { get; set; }
}
