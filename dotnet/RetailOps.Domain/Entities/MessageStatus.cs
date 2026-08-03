using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class MessageStatus
{
    public long Id { get; set; }

    public string MessageId { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public bool? IsRead { get; set; }

    public DateTime? ReadAt { get; set; }

    public virtual Messages Message { get; set; } = null!;

    public virtual Users User { get; set; } = null!;
}
