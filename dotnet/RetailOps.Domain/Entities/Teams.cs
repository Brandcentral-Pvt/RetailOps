using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Teams
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string? ManagerId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Users? Manager { get; set; }

    public virtual ICollection<TeamMembers> TeamMembers { get; set; } = new List<TeamMembers>();
}
