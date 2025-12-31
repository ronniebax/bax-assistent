// debug.js - Debug Panel Module
import { fetchDebugActivity } from '/webhook/bax-assistent/js/api.js';

let debugPanel = null;
let debugToggleBtn = null;
let debugPanelData = null;
let debugPanelEmpty = null;
let debugPanelLoading = null;
let closeDebugBtn = null;
let isPanelOpen = false;
let currentConversationId = null;

export function initDebugPanel() {
    // Get DOM elements
    debugPanel = document.getElementById('debug-panel');
    debugToggleBtn = document.getElementById('debug-toggle-btn');
    debugPanelData = document.getElementById('debug-panel-data');
    debugPanelEmpty = document.getElementById('debug-panel-empty');
    debugPanelLoading = document.getElementById('debug-panel-loading');
    closeDebugBtn = document.getElementById('close-debug-panel');

    if (!debugPanel || !debugToggleBtn) {
        console.error('Debug panel elements not found');
        return;
    }

    // Setup event listeners
    debugToggleBtn.addEventListener('click', togglePanel);
    closeDebugBtn.addEventListener('click', closePanel);

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (isPanelOpen &&
            !debugPanel.contains(e.target) &&
            !debugToggleBtn.contains(e.target)) {
            closePanel();
        }
    });
}

export function togglePanel() {
    if (isPanelOpen) {
        closePanel();
    } else {
        openPanel();
    }
}

export function openPanel() {
    isPanelOpen = true;
    debugPanel.classList.add('open');
    debugToggleBtn.classList.add('active');
}

export function closePanel() {
    isPanelOpen = false;
    debugPanel.classList.remove('open');
    debugToggleBtn.classList.remove('active');
}

export function showLoading() {
    debugPanelEmpty.classList.add('hidden');
    debugPanelData.classList.add('hidden');
    debugPanelLoading.classList.remove('hidden');
}

export function hideLoading() {
    debugPanelLoading.classList.add('hidden');
}

export function showEmpty() {
    debugPanelLoading.classList.add('hidden');
    debugPanelData.classList.add('hidden');
    debugPanelEmpty.classList.remove('hidden');
}

export function displayActivityData(activities) {
    if (!activities || activities.length === 0) {
        showEmpty();
        return;
    }

    hideLoading();
    debugPanelEmpty.classList.add('hidden');
    debugPanelData.classList.remove('hidden');

    // Clear existing data
    debugPanelData.innerHTML = '';

    // Sort activities by timestamp (most recent first)
    const sortedActivities = [...activities].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Render each activity
    sortedActivities.forEach(activity => {
        const activityElement = createActivityElement(activity);
        debugPanelData.appendChild(activityElement);
    });
}

function createActivityElement(activity) {
    const div = document.createElement('div');
    div.className = 'debug-activity-item';

    // Format timestamp
    const timestamp = formatTimestamp(activity.timestamp);

    // Get tool icon (first letter of tool name)
    const toolIcon = activity.tool_used ? activity.tool_used.charAt(0).toUpperCase() : 'T';

    // Build HTML
    let html = `
        <div class="debug-activity-header">
            <div class="debug-activity-tool">
                <div class="debug-activity-tool-icon">${toolIcon}</div>
                <span class="debug-activity-tool-name">${escapeHtml(activity.tool_used || 'Unknown Tool')}</span>
            </div>
            <span class="debug-activity-timestamp">${timestamp}</span>
        </div>
    `;

    // Add question if available
    if (activity.question) {
        html += `
            <div class="debug-activity-question">
                <div class="debug-activity-label">Vraag</div>
                <div class="debug-activity-text">${escapeHtml(activity.question)}</div>
            </div>
        `;
    }

    // Add query if available
    if (activity.tool_query) {
        html += `
            <div class="debug-activity-query">
                <div class="debug-activity-label">Query</div>
                <div class="debug-activity-query-text">${escapeHtml(activity.tool_query)}</div>
            </div>
        `;
    }

    // Add results if available
    if (activity.tool_result) {
        // Handle single object result (e.g., Websearch)
        if (!Array.isArray(activity.tool_result) && typeof activity.tool_result === 'object') {
            html += `
                <div class="debug-activity-results">
                    <div class="debug-activity-label">Tool Result</div>
                    <div class="debug-activity-result-item">
                        <div class="debug-activity-result-header">
                            <span class="debug-activity-result-title">${escapeHtml(activity.tool_used || 'Result')}</span>
                        </div>
                        <div class="debug-activity-result-content">
                            ${formatObjectResult(activity.tool_result)}
                        </div>
                    </div>
                </div>
            `;
        }
        // Handle array of results (e.g., Product Descriptions)
        else if (Array.isArray(activity.tool_result) && activity.tool_result.length > 0) {
            html += `
                <div class="debug-activity-results">
                    <div class="debug-activity-label">${activity.tool_result.length} Resultaten</div>
            `;

            // Show first 3 results
            const resultsToShow = activity.tool_result.slice(0, 3);
            resultsToShow.forEach(result => {
                const score = result.score ? (result.score * 100).toFixed(0) : '0';
                const content = result.product_s_desc || result.content || result.description || 'Geen content beschikbaar';

                html += `
                    <div class="debug-activity-result-item">
                        <div class="debug-activity-result-header">
                            <span class="debug-activity-result-title">${escapeHtml(result.product_name || result.title || 'Result')}</span>
                            <span class="debug-activity-result-score">${score}%</span>
                        </div>
                        <div class="debug-activity-result-content">${escapeHtml(content)}</div>
                    </div>
                `;
            });

            if (activity.tool_result.length > 3) {
                html += `<p class="debug-activity-text" style="margin-top: 0.5rem; font-size: 0.8125rem; opacity: 0.7;">+${activity.tool_result.length - 3} meer...</p>`;
            }

            html += `</div>`;
        }
    }

    div.innerHTML = html;
    return div;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'Onbekend';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Net nu';
    if (diffMins < 60) return `${diffMins} min geleden`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} uur geleden`;

    // Format as time if today, otherwise show date
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatObjectResult(obj) {
    if (!obj) return 'Geen data beschikbaar';

    // For Websearch results, show key information
    if (obj.searchInformation) {
        const totalResults = obj.searchInformation.formattedTotalResults || '0';
        const searchTime = obj.searchInformation.formattedSearchTime || '0';
        return escapeHtml(`Zoekresultaten: ${totalResults} gevonden in ${searchTime}s`);
    }

    // For other objects, try to extract useful info
    if (obj.product_name) {
        return escapeHtml(obj.product_s_desc || obj.product_name);
    }

    // Generic object display - show first few key-value pairs
    const keys = Object.keys(obj).slice(0, 3);
    if (keys.length === 0) return 'Geen data beschikbaar';

    const summary = keys.map(key => {
        const value = obj[key];
        if (typeof value === 'string' && value.length > 100) {
            return `${key}: ${value.substring(0, 100)}...`;
        }
        if (typeof value === 'object') {
            return `${key}: [object]`;
        }
        return `${key}: ${value}`;
    }).join('<br>');

    return summary;
}

// Load debug activity for a conversation
export async function loadDebugActivity(conversationId) {
    if (!conversationId) {
        console.warn('No conversation ID provided');
        showEmpty();
        return;
    }

    // Store the conversation ID
    currentConversationId = conversationId;

    // Show loading state
    showLoading();

    try {
        const response = await fetchDebugActivity(conversationId);

        // Check if we have activities in the response
        let activities = null;

        if (response && response.data && Array.isArray(response.data)) {
            // Format: { data: [...] }
            activities = response.data;
        } else if (response && response.activities && Array.isArray(response.activities)) {
            // Format: { activities: [...] }
            activities = response.activities;
        } else if (response && Array.isArray(response)) {
            // Format: [...]
            activities = response;
        }

        if (activities && activities.length > 0) {
            displayActivityData(activities);
        } else {
            showEmpty();
        }
    } catch (error) {
        console.error('Failed to load debug activity:', error);
        showEmpty();
    }
}

// Refresh the current conversation's debug data
export function refreshDebugActivity() {
    if (currentConversationId) {
        loadDebugActivity(currentConversationId);
    }
}
