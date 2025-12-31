// api.js - API Communication Module
import { CONFIG } from '/webhook/bax-assistent/js/config.js';

let authToken = null;

export function setAuthToken(token) {
    authToken = token;
}

export function getAuthToken() {
    return authToken;
}

function getSessionFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
}

export async function apiCall(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
    }

    return response.json();
}

export async function sendFeedback(feedbackData) {
    const sessionId = getSessionFromUrl();

    if (!sessionId) {
        throw new Error('No session ID found');
    }

    const response = await fetch(CONFIG.FEEDBACK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionId}`
        },
        body: JSON.stringify(feedbackData)
    });

    if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
        throw new Error(`Feedback failed: ${response.status}`);
    }

    return { success: true };
}

export async function fetchDebugActivity(conversationId) {
    const sessionId = getSessionFromUrl();

    if (!sessionId) {
        throw new Error('No session ID found');
    }

    if (!conversationId) {
        throw new Error('No conversation ID provided');
    }

    const response = await fetch(CONFIG.DEBUG_ACTIVITY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionId}`
        },
        body: JSON.stringify({ conversationId })
    });

    if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
        throw new Error(`Debug activity fetch failed: ${response.status}`);
    }

    return response.json();
}
