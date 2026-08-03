using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Webhooks
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string Url { get; set; } = null!;

    public string? Events { get; set; }

    public string? Description { get; set; }

    public bool? IsActive { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
