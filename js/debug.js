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

    // Add results if available - support both tool_result and tool_results
    const results = activity.tool_results || activity.tool_result;

    if (results) {
        // Check if results is an array of Websearch data
        const isWebsearchArray = Array.isArray(results) && results.length > 0 && results[0].searchInformation;

        // Handle Websearch array results
        if (isWebsearchArray) {
            html += `
                <div class="debug-activity-results debug-websearch-results">
                    <div class="debug-activity-label">Zoekresultaten</div>
                    <div class="debug-activity-result-item">
                        <div class="debug-activity-result-content">
                            ${formatObjectResult(results)}
                        </div>
                    </div>
                </div>
            `;
        }
        // Handle single object result (non-Websearch)
        else if (!Array.isArray(results) && typeof results === 'object') {
            html += `
                <div class="debug-activity-results">
                    <div class="debug-activity-label">Tool Result</div>
                    <div class="debug-activity-result-item">
                        <div class="debug-activity-result-content">
                            ${formatObjectResult(results)}
                        </div>
                    </div>
                </div>
            `;
        }
        // Handle array of results (e.g., Product Descriptions)
        else if (Array.isArray(results) && results.length > 0) {
            const resultId = `results-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

            html += `
                <div class="debug-activity-results debug-product-results">
                    <div class="debug-activity-label">${results.length} Resultaten</div>
            `;

            // Show first 3 results
            const resultsToShow = results.slice(0, 3);
            resultsToShow.forEach(result => {
                const score = result.score ? (result.score * 100).toFixed(0) : '0';

                // Get content and filter out meaningless placeholders like "."
                let content = result.product_s_desc || result.content || result.description || '';
                if (!content || content.trim() === '.' || content.trim().length <= 1) {
                    content = 'Geen omschrijving beschikbaar';
                }

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

            // Add collapsible section for remaining results if there are more than 3
            if (results.length > 3) {
                const remainingResults = results.slice(3);

                html += `
                    <button class="debug-show-more-btn" onclick="toggleResults('${resultId}', event)">
                        <span class="show-more-text">Toon ${remainingResults.length} meer resultaten</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div id="${resultId}" class="debug-additional-results hidden">
                `;

                remainingResults.forEach(result => {
                    const score = result.score ? (result.score * 100).toFixed(0) : '0';

                    // Get content and filter out meaningless placeholders like "."
                    let content = result.product_s_desc || result.content || result.description || '';
                    if (!content || content.trim() === '.' || content.trim().length <= 1) {
                        content = 'Geen omschrijving beschikbaar';
                    }

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

                html += `</div>`;
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

    if (diffMins < 1) return 'Nu';
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

    // Handle array of Websearch results (wrapped in array)
    if (Array.isArray(obj) && obj.length > 0) {
        // Take the first item from the array which contains the actual search data
        obj = obj[0];
    }

    // For Websearch results, show search summary and top results
    if (obj.searchInformation) {
        const totalResults = obj.searchInformation.formattedTotalResults || '0';
        const searchTime = obj.searchInformation.formattedSearchTime || '0';

        let output = `<div style="margin-bottom: 0.5rem;"><strong>${totalResults} resultaten</strong> in ${searchTime}s</div>`;

        // Show first 2 search results if available
        if (obj.items && Array.isArray(obj.items) && obj.items.length > 0) {
            output += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';

            obj.items.slice(0, 2).forEach((item) => {
                const title = item.title || 'Geen titel';
                const snippet = item.snippet || 'Geen beschrijving';

                output += `
                    <div style="padding: 0.5rem; background: var(--bg-light); border-radius: 0.25rem; font-size: 0.8125rem;">
                        <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.25rem;">
                            ${escapeHtml(title)}
                        </div>
                        <div style="color: var(--text-gray); line-height: 1.4;">
                            ${escapeHtml(snippet)}
                        </div>
                    </div>
                `;
            });

            output += '</div>';

            if (obj.items.length > 2) {
                output += `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-gray);">+${obj.items.length - 2} meer resultaten</div>`;
            }
        } else {
            output += '<div style="color: var(--text-gray); font-style: italic;">Geen relevante resultaten gevonden</div>';
        }

        return output;
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

// Toggle show more/less results
window.toggleResults = function(resultId, event) {
    const resultsContainer = document.getElementById(resultId);
    const button = event.target.closest('.debug-show-more-btn');

    if (!resultsContainer || !button) return;

    const isHidden = resultsContainer.classList.contains('hidden');
    const textSpan = button.querySelector('.show-more-text');
    const svg = button.querySelector('svg');

    if (isHidden) {
        resultsContainer.classList.remove('hidden');
        textSpan.textContent = 'Toon minder resultaten';
        svg.style.transform = 'rotate(180deg)';
    } else {
        resultsContainer.classList.add('hidden');
        const totalResults = resultsContainer.parentElement.querySelectorAll('.debug-activity-result-item').length;
        const shownResults = 3; // Always show first 3
        textSpan.textContent = `Toon ${totalResults - shownResults} meer resultaten`;
        svg.style.transform = 'rotate(0deg)';
    }
}
