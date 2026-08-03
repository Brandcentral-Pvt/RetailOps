using System;
using System.Collections.Generic;

namespace RetailOps.Domain.Entities;

public partial class Conversations
{
    public string Id { get; set; } = null!;

    public string? Type { get; set; }

    public string? Title { get; set; }

    public bool? IsActive { get; set; }

    public string? LastMessageId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<CallLogs> CallLogs { get; set; } = new List<CallLogs>();

    public virtual ICollection<ConversationParticipants> ConversationParticipants { get; set; } = new List<ConversationParticipants>();

    public virtual ICollection<Messages> Messages { get; set; } = new List<Messages>();
}
