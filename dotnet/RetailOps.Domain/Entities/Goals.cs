using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Goals
{
    public string Id { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string? OwnerId { get; set; }

    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public string? Status { get; set; }

    public decimal? Progress { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<Actions> Actions { get; set; } = new List<Actions>();

    public virtual ICollection<Objectives> Objectives { get; set; } = new List<Objectives>();

    public virtual Users? Owner { get; set; }
}
