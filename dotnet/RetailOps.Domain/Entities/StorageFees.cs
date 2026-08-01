using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class StorageFees
{
    public string Id { get; set; } = null!;

    public string? Month { get; set; }

    public decimal? Rate { get; set; }

    public DateTime? CreatedAt { get; set; }
}
