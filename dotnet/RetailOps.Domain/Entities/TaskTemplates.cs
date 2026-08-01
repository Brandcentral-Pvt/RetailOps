using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class TaskTemplates
{
    public string Id { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string? Category { get; set; }

    public string? Priority { get; set; }

    public string? Type { get; set; }

    public int? TimeLimit { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
