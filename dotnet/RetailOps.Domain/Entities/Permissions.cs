using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Permissions
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? DisplayName { get; set; }

    public string? Category { get; set; }

    public string? Action { get; set; }

    public string? Description { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<Roles> Role { get; set; } = new List<Roles>();
}
