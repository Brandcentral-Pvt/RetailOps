using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class CategoryMaps
{
    public string Id { get; set; } = null!;

    public string KeepaCategory { get; set; } = null!;

    public string FeeCategory { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }
}
