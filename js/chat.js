// chat.js - Custom UI with n8n Chat Trigger Backend
import { CONFIG } from '/webhook/bax-assistent/js/config.js';
import { getCurrentUser } from '/webhook/bax-assistent/js/ui.js';
import { getAuthToken, sendFeedback } from '/webhook/bax-assistent/js/api.js';

let messageHistory = [];
let sessionId = null;
let hasDockedInput = false;

function generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Configure marked for safe rendering
if (window.marked) {
    // Custom renderer to add target="_blank" to all links
    const renderer = new marked.Renderer();
    const originalLinkRenderer = renderer.link.bind(renderer);

    renderer.link = function(href, title, text) {
        const html = originalLinkRenderer(href, title, text);
        return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
    };

    marked.setOptions({
        breaks: true, // Convert \n to <br>
        gfm: true, // GitHub Flavored Markdown
        sanitize: false, // We trust our backend
        headerIds: false,
        mangle: false,
        renderer: renderer
    });
}

// Render markdown to HTML
function renderMarkdown(text) {
    if (!window.marked) {
        // Fallback if marked is not loaded
        return text;
    }
    try {
        return marked.parse(text);
    } catch (error) {
        console.error('Markdown parsing error:', error);
        return text;
    }
}

export function initChat() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messagesArea = document.getElementById('messages-area');

    setInitialInputPosition(messagesArea);
    
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
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

function setInitialInputPosition(messagesArea) {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    const hasMessages = messagesArea?.querySelector('.message');
    const initialState = hasMessages ? 'docked' : 'welcome';
    chatContainer.dataset.inputPosition = initialState;
    hasDockedInput = initialState === 'docked';
}

function dockInputArea() {
    if (hasDockedInput) return;
    const chatContainer = document.querySelector('.chat-container');
    const inputArea = document.querySelector('.input-area');
    if (!chatContainer || !inputArea) return;

    const startRect = inputArea.getBoundingClientRect();

    chatContainer.dataset.inputPosition = 'docked';
    hasDockedInput = true;

    const endRect = inputArea.getBoundingClientRect();
    const deltaX = startRect.left - endRect.left;
    const deltaY = startRect.top - endRect.top;

    if (inputArea.animate) {
        inputArea.animate(
            [
                { transform: `translate(${deltaX}px, ${deltaY}px)` },
                { transform: 'translate(0, 0)' }
            ],
            {
                duration: 400,
                easing: 'ease'
            }
        );
    }
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
    dockInputArea();

    // Add user message to UI
    addMessageToUI('user', messageText);
    
    // Clear input and reset
    messageInput.value = '';
    messageInput.style.height = '80px';
    sendButton.disabled = true;

    // Store in history
    const userMessageId = generateMessageId();
    messageHistory.push({
        id: userMessageId,
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString()
    });

    // Show typing indicator
    showTypingIndicator();

    // Send to n8n Chat Trigger
    sendToN8nChat(messageText);
}

function addMessageToUI(role, content, isTyping = false, messageId = null) {
    const messagesArea = document.getElementById('messages-area');
    const user = getCurrentUser();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }

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
            <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 133 133" role="img" aria-label="logo">
                <g fill="currentColor" stroke="none">
                    <rect x="1.00" y="81.00" width="27.00" height="36.00" rx="13.5" ry="13.5"/>
                    <rect x="35.00" y="16.00" width="28.00" height="101.00" rx="14.0" ry="14.0"/>
                    <rect x="70.00" y="52.00" width="28.00" height="65.00" rx="14.0" ry="14.0"/>
                    <rect x="105.00" y="30.00" width="27.00" height="87.00" rx="13.5" ry="13.5"/>
                </g>
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
        // Render markdown for assistant messages, plain text for user messages
        if (role === 'assistant') {
            bubbleDiv.innerHTML = renderMarkdown(content);
        } else {
            bubbleDiv.textContent = content;
        }

        // Add timestamp and feedback buttons
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatTime(new Date());

        // Add feedback buttons for assistant messages (not typing indicators)
        if (role === 'assistant' && messageId) {
            const feedbackDiv = createFeedbackButtons(messageId);
            timeDiv.appendChild(feedbackDiv);
        }

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
        let assistantMessageId = generateMessageId();

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
                                    messageElement = createStreamingMessage(assistantMessageId);
                                }

                                // Add content
                                fullMessage += data.content;
                                updateStreamingMessage(messageElement, fullMessage);
                            } else if (data.type === 'end' && messageElement && fullMessage) {
                                // Only finalize if we have content
                                finalizeStreamingMessage(messageElement, assistantMessageId);
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
            addMessageToUI('assistant', fullMessage, false, assistantMessageId);
        }

        // Store in history
        if (fullMessage) {
            messageHistory.push({
                id: assistantMessageId,
                role: 'assistant',
                content: fullMessage,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('Chat error:', error);
        hideTypingIndicator();

        // Show error message
        addMessageToUI('assistant', 'Sorry, er is een fout opgetreden. Probeer het opnieuw.');
    }
}

function createStreamingMessage(messageId) {
    const messagesArea = document.getElementById('messages-area');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant-message streaming';
    messageDiv.dataset.streaming = 'true';
    messageDiv.dataset.messageId = messageId;

    // Create avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = `
        <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 133 133" role="img" aria-label="logo">
            <g fill="currentColor" stroke="none">
                <rect x="1.00" y="81.00" width="27.00" height="36.00" rx="13.5" ry="13.5"/>
                <rect x="35.00" y="16.00" width="28.00" height="101.00" rx="14.0" ry="14.0"/>
                <rect x="70.00" y="52.00" width="28.00" height="65.00" rx="14.0" ry="14.0"/>
                <rect x="105.00" y="30.00" width="27.00" height="87.00" rx="13.5" ry="13.5"/>
            </g>
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
        // Render markdown during streaming
        bubbleDiv.innerHTML = renderMarkdown(content);

        // Scroll to bottom
        const messagesArea = document.getElementById('messages-area');
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
}

function finalizeStreamingMessage(messageElement, messageId) {
    // Remove streaming state to stop cursor blinking
    messageElement.dataset.streaming = 'false';
    messageElement.classList.remove('streaming');

    // Add timestamp and feedback buttons
    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv && !contentDiv.querySelector('.message-time')) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatTime(new Date());

        // Add feedback buttons
        const feedbackDiv = createFeedbackButtons(messageId);
        timeDiv.appendChild(feedbackDiv);

        contentDiv.appendChild(timeDiv);
    }
}

function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function createFeedbackButtons(messageId) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'feedback-buttons';

    const thumbsUpBtn = document.createElement('button');
    thumbsUpBtn.className = 'feedback-btn feedback-btn-up';
    thumbsUpBtn.setAttribute('aria-label', 'Goed antwoord');
    thumbsUpBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
    `;

    const thumbsDownBtn = document.createElement('button');
    thumbsDownBtn.className = 'feedback-btn feedback-btn-down';
    thumbsDownBtn.setAttribute('aria-label', 'Slecht antwoord');
    thumbsDownBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
        </svg>
    `;

    thumbsUpBtn.onclick = () => handleFeedback(messageId, 'up');
    thumbsDownBtn.onclick = () => handleFeedback(messageId, 'down');

    feedbackDiv.appendChild(thumbsUpBtn);
    feedbackDiv.appendChild(thumbsDownBtn);

    return feedbackDiv;
}

async function handleFeedback(messageId, vote) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    const feedbackButtons = messageElement.querySelector('.feedback-buttons');
    if (!feedbackButtons) return;

    // Check if already voted
    if (feedbackButtons.dataset.voted === 'true') {
        return;
    }

    // Mark as voted and disable buttons
    feedbackButtons.dataset.voted = 'true';
    const buttons = feedbackButtons.querySelectorAll('.feedback-btn');
    buttons.forEach(btn => btn.disabled = true);

    // Highlight the selected button
    const selectedButton = feedbackButtons.querySelector(`.feedback-btn-${vote}`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }

    // Find the message in history
    const messageData = messageHistory.find(msg => msg.id === messageId);
    if (!messageData) return;

    // Find the preceding user message
    const messageIndex = messageHistory.findIndex(msg => msg.id === messageId);
    let userQuery = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
        if (messageHistory[i].role === 'user') {
            userQuery = messageHistory[i];
            break;
        }
    }

    const user = getCurrentUser();

    // Build feedback payload
    const feedbackData = {
        feedback_id: `feedback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        vote: vote,
        message: {
            id: messageData.id,
            role: messageData.role,
            content: messageData.content,
            timestamp: messageData.timestamp
        },
        user_query: userQuery ? {
            content: userQuery.content,
            timestamp: userQuery.timestamp
        } : null,
        chat_history: messageHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
        })),
        user: {
            email: user?.email || '',
            name: user?.name || ''
        },
        session_id: sessionId,
        feedback_timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
    };

    try {
        // Show loading state
        selectedButton.classList.add('loading');

        await sendFeedback(feedbackData);

        // Remove loading state
        selectedButton.classList.remove('loading');

        // If thumbs down, show comment modal
        if (vote === 'down') {
            showFeedbackModal(feedbackData.feedback_id);
        } else {
            // Only show toast for thumbs up
            showToast('Bedankt voor je feedback!');
        }

    } catch (error) {
        console.error('Feedback error:', error);

        // Re-enable buttons on error
        feedbackButtons.dataset.voted = 'false';
        buttons.forEach(btn => btn.disabled = false);
        selectedButton.classList.remove('active');
        selectedButton.classList.remove('loading');

        if (error.message === 'UNAUTHORIZED') {
            showToast('Je bent niet geautoriseerd. Log opnieuw in.', 'error');
        } else {
            showToast('Er is iets misgegaan. Probeer het opnieuw.', 'error');
        }
    }
}

function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.feedback-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `feedback-toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 2 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function showFeedbackModal(feedbackId) {
    const modal = document.getElementById('feedback-modal');
    const textarea = document.getElementById('feedback-comment');
    const submitBtn = document.getElementById('submit-feedback');
    const skipBtn = document.getElementById('skip-feedback');
    const closeBtn = document.getElementById('close-feedback-modal');

    if (!modal) return;

    // Store feedback ID on modal
    modal.dataset.feedbackId = feedbackId;

    // Clear textarea
    textarea.value = '';

    // Show modal
    modal.classList.add('show');

    // Focus textarea
    setTimeout(() => textarea.focus(), 100);

    // Setup event listeners
    const handleSubmit = async () => {
        const comment = textarea.value.trim();
        if (!comment) {
            textarea.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Verzenden...';

        try {
            await sendFeedback({
                feedback_id: feedbackId,
                comment: comment
            });

            showToast('Bedankt voor je toelichting!');
            closeModal();

        } catch (error) {
            console.error('Comment submission error:', error);
            showToast('Er is iets misgegaan. Probeer het opnieuw.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Verstuur toelichting';
        }
    };

    const closeModal = () => {
        modal.classList.remove('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verstuur toelichting';
        // Remove event listeners
        submitBtn.removeEventListener('click', handleSubmit);
        skipBtn.removeEventListener('click', closeModal);
        closeBtn.removeEventListener('click', closeModal);
    };

    submitBtn.addEventListener('click', handleSubmit);
    skipBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}
