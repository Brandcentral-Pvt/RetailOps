using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Roles
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? DisplayName { get; set; }

    public string? Description { get; set; }

    public int? Level { get; set; }

    public string? Color { get; set; }

    public bool? IsSystem { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<Users> Users { get; set; } = new List<Users>();

    public virtual ICollection<Permissions> Permission { get; set; } = new List<Permissions>();
}
