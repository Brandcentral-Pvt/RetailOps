using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class TagsHistory
{
    public string Id { get; set; } = null!;

    public string AsinId { get; set; } = null!;

    public string? UserId { get; set; }

    public string? UserName { get; set; }

    public string? PreviousTags { get; set; }

    public string? NewTags { get; set; }

    public string? AddedTags { get; set; }

    public string? RemovedTags { get; set; }

    public string? Action { get; set; }

    public string? Source { get; set; }

    public string? Notes { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Asins Asin { get; set; } = null!;
}
