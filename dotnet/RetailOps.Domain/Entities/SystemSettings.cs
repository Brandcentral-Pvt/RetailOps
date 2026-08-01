using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class SystemSettings
{
    public int Id { get; set; }

    public string Key { get; set; } = null!;

    public string? Value { get; set; }

    public string? Description { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
