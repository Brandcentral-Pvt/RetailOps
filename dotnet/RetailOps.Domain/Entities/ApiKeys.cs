using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class ApiKeys
{
    public string Id { get; set; } = null!;

    public string Key { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string OwnerId { get; set; } = null!;

    public bool? IsActive { get; set; }

    public DateTime? LastUsed { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string ServiceId { get; set; } = null!;

    public string? Category { get; set; }

    public string? Description { get; set; }

    public string? Value { get; set; }

    public virtual Users Owner { get; set; } = null!;
}
