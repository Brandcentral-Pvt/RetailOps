using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class OctoTasks
{
    public string Id { get; set; } = null!;

    public string TaskId { get; set; } = null!;

    public bool? IsAssigned { get; set; }

    public string? SellerId { get; set; }

    public DateTime? LastAssignedAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? TaskName { get; set; }

    public string? GroupName { get; set; }

    public virtual Sellers? Seller { get; set; }
}
