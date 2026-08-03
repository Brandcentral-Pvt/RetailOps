using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Notifications
{
    public string Id { get; set; } = null!;

    public string RecipientId { get; set; } = null!;

    public string Type { get; set; } = null!;

    public string? ReferenceModel { get; set; }

    public string? ReferenceId { get; set; }

    public string Message { get; set; } = null!;

    public bool? IsRead { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Users Recipient { get; set; } = null!;
}
