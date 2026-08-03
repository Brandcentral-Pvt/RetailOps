using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Objectives
{
    public string Id { get; set; } = null!;

    public string? GoalId { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string? OwnerId { get; set; }

    public string? Status { get; set; }

    public decimal? Progress { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public string? SellerId { get; set; }

    public string? Type { get; set; }

    public string? CreatedBy { get; set; }

    public bool? AutoGenerateWeekly { get; set; }

    public virtual ICollection<Actions> Actions { get; set; } = new List<Actions>();

    public virtual Goals? Goal { get; set; }

    public virtual ICollection<KeyResults> KeyResults { get; set; } = new List<KeyResults>();

    public virtual Users? Owner { get; set; }
}
