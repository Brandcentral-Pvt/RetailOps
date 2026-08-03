using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class GoalTemplates
{
    public string Id { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public string? OwnerId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? Goals { get; set; }

    public virtual Users? Owner { get; set; }
}
