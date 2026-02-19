import { CometChatTextFormatter } from '@cometchat/chat-uikit-react';

export class TaskMentionFormatter extends CometChatTextFormatter {
    constructor() {
        super();
        this.setTrackingCharacter('#');
    }

    getFormattedText(text: string): string {
        if (!text) return '';

        // Regex to find #123 pattern
        // The pattern needs to be careful not to break other things, but #\d+ is standard
        // We replace it with a span that looks like a link
        // Since we can't easily inject react components here (it expects string/html), 
        // we use an anchor tag.
        const taskRegex = /#(\d+)/g;

        return text.replace(taskRegex, (match, id) => {
            // We use a custom class 'task-mention-link' that we can style or attach events to if needed
            // For now, a simple href that opens in valid way
            // Note: In React apps, simple hrefs cause page reloads. 
            // We might need to listen to clicks globally or use a specialized protocol if we want to avoid reload.
            // However, standard <a> with query param is the most robust string-only solution.
            return `<a href="/actions?id=${id}" class="task-mention-link" style="color: #3366CC; text-decoration: none; font-weight: bold;">${match}</a>`;
        });
    }

    getCaretPosition(text: string, caretPos: number): number {
        return caretPos;
    }
}
