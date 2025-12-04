// chat.js - Custom UI with n8n Chat Trigger Backend
import { CONFIG } from '/webhook/bax-assistent/js/config.js';
import { getCurrentUser } from '/webhook/bax-assistent/js/ui.js';
import { getAuthToken } from '/webhook/bax-assistent/js/api.js';

let messageHistory = [];
let sessionId = null;

export function initChat() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    // Generate or retrieve session ID
    sessionId = getAuthToken() || generateSessionId();

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        // Temporarily hide overflow to get accurate scrollHeight
        this.style.overflow = 'hidden';

        // Reset to auto to get natural height
        this.style.height = 'auto';

        // Calculate new height with constraints
        const minHeight = 80;
        const maxHeight = 200;
        const newHeight = Math.max(minHeight, Math.min(this.scrollHeight, maxHeight));

        this.style.height = newHeight + 'px';

        // Restore overflow if needed
        this.style.overflow = newHeight >= maxHeight ? 'auto' : 'hidden';

        // Enable/disable send button
        sendButton.disabled = !this.value.trim();
    });

    // Handle Enter key (without Shift)
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.value.trim()) {
                sendMessage();
            }
        }
    });

    // Handle send button click
    sendButton.addEventListener('click', sendMessage);
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messagesArea = document.getElementById('messages-area');
    
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    // Clear welcome message on first message
    const welcomeMessage = messagesArea.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Add user message to UI
    addMessageToUI('user', messageText);
    
    // Clear input and reset
    messageInput.value = '';
    messageInput.style.height = '80px';
    sendButton.disabled = true;

    // Store in history
    messageHistory.push({
        role: 'user',
        content: messageText
    });

    // Show typing indicator
    showTypingIndicator();

    // Send to n8n Chat Trigger
    sendToN8nChat(messageText);
}

function addMessageToUI(role, content, isTyping = false) {
    const messagesArea = document.getElementById('messages-area');
    const user = getCurrentUser();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    // Create avatar
    const avatarDiv = document.createElement('div');
    if (role === 'user') {
        const avatarImg = document.createElement('img');
        avatarImg.src = user?.picture || '';
        avatarImg.alt = user?.name || 'User';
        avatarImg.className = 'message-avatar';
        avatarDiv.appendChild(avatarImg);
    } else {
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
        `;
    }
    
    // Create content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    if (isTyping) {
        bubbleDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        bubbleDiv.id = 'typing-indicator';
    } else {
        bubbleDiv.textContent = content;
        
        // Add timestamp
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatTime(new Date());
        contentDiv.appendChild(timeDiv);
    }
    
    contentDiv.insertBefore(bubbleDiv, contentDiv.firstChild);
    
    // Assemble message
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    messagesArea.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function showTypingIndicator() {
    addMessageToUI('assistant', '', true);
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        const messageElement = typingIndicator.closest('.message');
        if (messageElement) {
            messageElement.remove();
        }
    }
}

async function sendToN8nChat(message) {
    const user = getCurrentUser();

    // Gebruik de webhook URL uit config of fallback
    const webhookUrl = CONFIG?.CHAT_WEBHOOK_URL || 'https://n8n.bax-ict.nl/webhook/bfb70a44-e665-4b1b-979f-403cf46a4819/chat';

    console.log('Sending to webhook:', webhookUrl); // Debug log

    try {
        // Format volgens n8n Chat Trigger verwachtingen
        const payload = {
            action: 'sendMessage',
            sessionId: sessionId,
            chatInput: message
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullMessage = '';
        let messageElement = null;

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Extract complete JSON objects from buffer
            // JSON objects are separated by newlines or directly concatenated
            let startIndex = 0;
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;

            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];

                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }

                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }

                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                if (inString) continue;

                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;

                    // Complete JSON object found
                    if (braceCount === 0 && startIndex < i) {
                        const jsonStr = buffer.substring(startIndex, i + 1);

                        try {
                            const data = JSON.parse(jsonStr);

                            if (data.type === 'item' && data.content) {
                                // Only create message element when we have actual content
                                if (!messageElement) {
                                    // Remove typing indicator and create streaming message
                                    hideTypingIndicator();
                                    messageElement = createStreamingMessage();
                                }

                                // Add content
                                fullMessage += data.content;
                                updateStreamingMessage(messageElement, fullMessage);
                            } else if (data.type === 'end' && messageElement && fullMessage) {
                                // Only finalize if we have content
                                finalizeStreamingMessage(messageElement);
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse JSON:', jsonStr.substring(0, 100), parseError);
                        }

                        // Move start index past this object
                        startIndex = i + 1;
                    }
                }
            }

            // Keep unparsed data in buffer
            buffer = buffer.substring(startIndex);
        }

        // If no message was streamed, show the full message
        if (!messageElement && fullMessage) {
            addMessageToUI('assistant', fullMessage);
        }

        // Store in history
        if (fullMessage) {
            messageHistory.push({
                role: 'assistant',
                content: fullMessage
            });
        }

    } catch (error) {
        console.error('Chat error:', error);
        hideTypingIndicator();

        // Show error message
        addMessageToUI('assistant', 'Sorry, er is een fout opgetreden. Probeer het opnieuw.');
    }
}

function createStreamingMessage() {
    const messagesArea = document.getElementById('messages-area');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant-message streaming';
    messageDiv.dataset.streaming = 'true';

    // Create avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
    `;

    // Create content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = '';

    contentDiv.appendChild(bubbleDiv);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    messagesArea.appendChild(messageDiv);

    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;

    return messageDiv;
}

function updateStreamingMessage(messageElement, content) {
    const bubbleDiv = messageElement.querySelector('.message-bubble');
    if (bubbleDiv) {
        bubbleDiv.textContent = content;

        // Scroll to bottom
        const messagesArea = document.getElementById('messages-area');
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
}

function finalizeStreamingMessage(messageElement) {
    // Remove streaming state to stop cursor blinking
    messageElement.dataset.streaming = 'false';
    messageElement.classList.remove('streaming');

    // Add timestamp
    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv && !contentDiv.querySelector('.message-time')) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatTime(new Date());
        contentDiv.appendChild(timeDiv);
    }
}

function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
