// ui.js - UI Management Module

let currentUser = null;

export function showView(viewName) {
    const views = {
        'loading': document.getElementById('loading-view'),
        'login': document.getElementById('login-view'),
        'app': document.getElementById('app-view')
    };

    Object.values(views).forEach(view => {
        if (view) view.classList.add('hidden');
    });

    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }

    document.body.classList.add('initialized');
}

export function showError(message) {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

export function hideError() {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function getCurrentUser() {
    return currentUser;
}

export function updateUserDisplay() {
    if (!currentUser) return;

    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userAvatarEl = document.getElementById('user-avatar');

    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userEmailEl) userEmailEl.textContent = currentUser.email;
    if (userAvatarEl) userAvatarEl.src = currentUser.picture || '';

    // Update welcome message with first name
    updateWelcomeMessage();
}

export function updateWelcomeMessage() {
    if (!currentUser) return;

    const welcomeTitleEl = document.getElementById('welcome-title');
    if (welcomeTitleEl) {
        const firstName = currentUser.firstName || currentUser.name.split(' ')[0];
        welcomeTitleEl.textContent = `Hoi ${firstName}! Wat kan ik voor je doen?`;
    }
}
