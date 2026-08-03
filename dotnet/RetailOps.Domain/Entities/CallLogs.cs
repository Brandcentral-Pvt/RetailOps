using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class CallLogs
{
    public string Id { get; set; } = null!;

    public string ConversationId { get; set; } = null!;

    public string CallerId { get; set; } = null!;

    public string ReceiverId { get; set; } = null!;

    public string? Type { get; set; }

    public string? Status { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public int? Duration { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Users Caller { get; set; } = null!;

    public virtual Conversations Conversation { get; set; } = null!;

    public virtual Users Receiver { get; set; } = null!;
}
