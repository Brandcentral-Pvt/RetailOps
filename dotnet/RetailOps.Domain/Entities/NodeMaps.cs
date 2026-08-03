using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class NodeMaps
{
    public string Id { get; set; } = null!;

    public string NodeId { get; set; } = null!;

    public string? Category { get; set; }

    public DateTime? CreatedAt { get; set; }
}
