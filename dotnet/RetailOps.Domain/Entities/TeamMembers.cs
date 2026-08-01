using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class TeamMembers
{
    public string TeamId { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public string? Role { get; set; }

    public string? ResourceAccess { get; set; }

    public virtual Teams Team { get; set; } = null!;

    public virtual Users User { get; set; } = null!;
}
