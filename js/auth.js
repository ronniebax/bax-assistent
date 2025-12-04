// auth.js - Authentication Module
import { CONFIG } from '/webhook/bax-assistent/js/config.js';
import { showView, showError, hideError, updateUserDisplay, setCurrentUser } from '/webhook/bax-assistent/js/ui.js';
import { setAuthToken } from '/webhook/bax-assistent/js/api.js';

let isAuthenticating = false;

// Session state (in-memory during page load)
let sessionState = {
    sessionId: null,
    user: null,
    lastVerified: null,
    verificationAttempts: 0
};

// Max verification attempts before giving up
const MAX_VERIFICATION_ATTEMPTS = 3;

// Helper function to show login with error
function showLoginWithError(errorMessage) {
    // Remove inline styles that might hide login view (added in index.html to prevent flashing)
    const inlineStyles = document.querySelectorAll('style');
    inlineStyles.forEach(style => {
        if (style.textContent.includes('#login-view { display: none !important')) {
            style.remove();
        }
    });

    showView('login');
    // Use setTimeout to ensure DOM is updated before showing error
    setTimeout(() => {
        showError(errorMessage);
        // Auto-hide error after 3 seconds
        setTimeout(() => hideError(), 3000);
    }, 0);
}

function getSessionFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
}

function ensureSessionInUrl(sessionId) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session') !== sessionId) {
        urlParams.set('session', sessionId);
        const newUrl = window.location.pathname + '?' + urlParams.toString();
        window.history.replaceState({}, '', newUrl);
    }
}

export async function initAuth() {
    // Check for OAuth callback first (hash with id_token)
    const hash = window.location.hash;
    if (hash && hash.includes('id_token')) {
        // Stay on loading view during OAuth processing
        isAuthenticating = true;
        return;
    }
    
    // Check for session parameter in URL
    const sessionId = getSessionFromUrl();
    if (sessionId) {
        // If we already have this session in memory with recent verification, use it
        if (sessionState.sessionId === sessionId && sessionState.user) {
            const timeSinceVerification = Date.now() - (sessionState.lastVerified || 0);
            // If verified within last 5 minutes, skip verification
            if (timeSinceVerification < 5 * 60 * 1000) {
                console.log('Using recently verified session from memory');
                setCurrentUser(sessionState.user);
                setAuthToken(sessionId);
                updateUserDisplay();
                showView('app');
                return true;
            }
        }
        
        // Keep showing loading view while verifying
        showView('loading');
        
        const hasSession = await checkSessionInUrl();
        
        if (hasSession) {
            updateUserDisplay();
            showView('app');
            return true;
        }
        
        // Session verification failed - show login
        showView('login');
        return false;
    }
    
    // No session - show login
    showView('login');
    return false;
}

export function startGoogleLogin() {
    hideError();

    if (!CONFIG.REDIRECT_URI) {
        showError('REDIRECT_URI is niet geconfigureerd.');
        return;
    }

    const scope = 'openid email profile';
    const responseType = 'id_token';
    const nonce = Math.random().toString(36).substring(2);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', CONFIG.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', CONFIG.REDIRECT_URI);
    authUrl.searchParams.set('response_type', responseType);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('hd', CONFIG.ALLOWED_DOMAIN);
    authUrl.searchParams.set('prompt', 'select_account');

    window.location.href = authUrl.toString();
}

export async function handleOAuthCallback(hash) {
    showView('loading');

    try {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        const error = params.get('error');

        if (error) {
            throw new Error(`Google login error: ${error}`);
        }

        if (!idToken) {
            throw new Error('Geen token ontvangen van Google');
        }

        // Exchange Google token for session token
        const loginResponse = await fetch(CONFIG.LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });

        // Always try to parse response body for error details
        let loginData;
        try {
            loginData = await loginResponse.json();
        } catch (parseError) {
            // If response is not JSON, use generic error
            if (!loginResponse.ok) {
                throw new Error(`Login verificatie mislukt (${loginResponse.status})`);
            }
            throw new Error('Invalid response from server');
        }

        // Check for errors (both HTTP status and success flag)
        if (!loginResponse.ok || !loginData.success) {
            const errorMessage = loginData.error || `Login verificatie mislukt (${loginResponse.status})`;
            throw new Error(errorMessage);
        }

        if (!loginData.user) {
            throw new Error('Invalid response from server');
        }

        // Store in memory for immediate next load
        const currentUser = {
            name: loginData.user.name,
            email: loginData.user.email,
            picture: loginData.user.picture,
            hd: loginData.user.domain,
            firstName: loginData.user.user_first_name || loginData.user.name.split(' ')[0],
        };
        sessionState = {
            sessionId: loginData.sessionId,
            user: currentUser,
            lastVerified: Date.now(),
            verificationAttempts: 0
        };

        // Redirect to same URL with session parameter
        const baseUrl = window.location.origin + window.location.pathname;
        const newUrl = `${baseUrl}?session=${loginData.sessionId}`;
        window.location.href = newUrl;

    } catch (err) {
        console.error('Login error:', err.message);
        isAuthenticating = false;
        showLoginWithError(err.message);
    }
}

export function logout() {
    setCurrentUser(null);
    setAuthToken(null);
    sessionState = {
        sessionId: null,
        user: null,
        lastVerified: null,
        verificationAttempts: 0
    };

    // Show login view immediately before redirect
    showView('login');

    const baseUrl = window.location.origin + window.location.pathname;
    window.location.href = baseUrl;
}

// Retry configuration for session verification
const SESSION_VERIFY_RETRIES = 3;
const SESSION_VERIFY_DELAY = 1500; // 1.5 seconds

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkSessionInUrl() {
    const sessionId = getSessionFromUrl();

    if (!sessionId) {
        return false;
    }

    let lastError = null;

    // Retry loop for network resilience
    for (let attempt = 0; attempt <= SESSION_VERIFY_RETRIES; attempt++) {
        try {
            const verifyResponse = await fetch(CONFIG.VERIFY_SESSION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionId}`
                }
            });

            // Server responded - check the result
            if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();

                if (verifyData.valid) {
                    // Session is valid - restore state
                    const user = verifyData.user;

                    const currentUser = {
                        name: user.name,
                        email: user.email,
                        picture: user.picture,
                        hd: user.domain,
                        firstName: user.user_first_name || user.name.split(' ')[0],
                    };

                    setCurrentUser(currentUser);
                    setAuthToken(sessionId);

                    // Store in memory for future page loads
                    sessionState = {
                        sessionId,
                        user: currentUser,
                        lastVerified: Date.now(),
                        verificationAttempts: 0
                    };

                    // Ensure session stays in URL
                    ensureSessionInUrl(sessionId);

                    return true;
                } else {
                    // Server explicitly says session is invalid - clear and show login
                    console.warn('Session invalid/expired');
                    const errorMsg = verifyData.error || 'Sessie is verlopen. Log opnieuw in.';
                    const baseUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, '', baseUrl);
                    showLoginWithError(errorMsg);
                    return false;
                }
            }

            // Server error (5xx) - retry
            if (verifyResponse.status >= 500 && attempt < SESSION_VERIFY_RETRIES) {
                const delay = SESSION_VERIFY_DELAY * Math.pow(2, attempt);
                console.warn(`Server error ${verifyResponse.status}, retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }

            // Client error (4xx) - session invalid ONLY if 401/403
            if (verifyResponse.status === 401 || verifyResponse.status === 403) {
                console.warn('Session rejected by server (401/403)');

                // Try to parse error message from response
                let errorMsg = 'Je bent niet geautoriseerd. Log opnieuw in.';
                try {
                    const errorData = await verifyResponse.json();
                    if (errorData.error) {
                        errorMsg = errorData.error;
                    }
                } catch (e) {
                    // If parsing fails, use default message
                }

                const baseUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, '', baseUrl);
                showLoginWithError(errorMsg);
                return false;
            }

            // Other 4xx errors - keep session, might be temporary issue
            if (verifyResponse.status >= 400 && verifyResponse.status < 500) {
                console.warn('Client error during verification:', verifyResponse.status);
                // If we have a recent in-memory session, trust it
                if (sessionState.sessionId === sessionId && sessionState.user) {
                    const timeSinceVerification = Date.now() - (sessionState.lastVerified || 0);
                    if (timeSinceVerification < 30 * 60 * 1000) { // 30 minutes
                        console.log('Using in-memory session due to verification error');
                        setCurrentUser(sessionState.user);
                        setAuthToken(sessionId);
                        ensureSessionInUrl(sessionId);
                        return true;
                    }
                }
                return false;
            }

            // Unknown error
            return false;

        } catch (err) {
            lastError = err;
            sessionState.verificationAttempts++;

            // Network error - retry with backoff
            if (attempt < SESSION_VERIFY_RETRIES) {
                const delay = SESSION_VERIFY_DELAY * Math.pow(2, attempt);
                console.warn(`Network error during session verify, retrying in ${delay}ms...`, err.message);
                await sleep(delay);
            }
        }
    }

    // All retries failed - check if we can use in-memory session
    console.error('Session verification failed after retries:', lastError?.message);
    
    // If we have recent in-memory session and this is just a temporary network issue, use it
    if (sessionState.sessionId === sessionId && sessionState.user) {
        const timeSinceVerification = Date.now() - (sessionState.lastVerified || 0);
        const maxOfflineTime = 30 * 60 * 1000; // 30 minutes max offline
        
        if (timeSinceVerification < maxOfflineTime && sessionState.verificationAttempts < MAX_VERIFICATION_ATTEMPTS) {
            console.warn('Using in-memory session due to network issues (offline mode)');
            setCurrentUser(sessionState.user);
            setAuthToken(sessionId);
            ensureSessionInUrl(sessionId);
            showError('Verbinding tijdelijk niet beschikbaar. Je blijft ingelogd.');
            // Clear error after 5 seconds
            setTimeout(hideError, 5000);
            return true;
        }
    }
    
    // Give up - too many failures
    const baseUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', baseUrl);
    showLoginWithError('Kan sessie niet verifiëren. Log opnieuw in.');

    return false;
}

// Setup OAuth callback handler
export function setupOAuthCallback() {
    const hash = window.location.hash;
    
    if (hash && hash.includes('id_token')) {
        isAuthenticating = true;
        showView('loading');
        handleOAuthCallback(hash);

        // Clean up URL
        try {
            history.replaceState(null, '', window.location.pathname);
        } catch (e) {
            // Sandbox restriction - ignore
        }
    } else if (hash && hash.includes('error')) {
        const params = new URLSearchParams(hash.substring(1));
        const error = params.get('error');
        const errorDescription = params.get('error_description') || error;
        showLoginWithError(`Google login error: ${errorDescription}`);
    }
}
