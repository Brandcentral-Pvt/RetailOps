using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Asins_Backup_DealBadge
{
    public string Id { get; set; } = null!;

    public string? DealBadge { get; set; }
}
