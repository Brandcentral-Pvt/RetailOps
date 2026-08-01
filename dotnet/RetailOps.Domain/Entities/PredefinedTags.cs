using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class PredefinedTags
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Category { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
