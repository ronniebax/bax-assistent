// config.js - Configuration Module
export const CONFIG = {
    GOOGLE_CLIENT_ID: '677057678247-n71ao8v6gqr75l9sduf2tcm2vbkphh5a.apps.googleusercontent.com',
    REDIRECT_URI: window.location.origin + window.location.pathname,
    ALLOWED_DOMAIN: 'bax-shop.nl',
    
    // API Endpoints
    LOGIN_URL: 'https://n8n.bax-ict.nl/webhook/bax-assistent/auth/login',
    VERIFY_SESSION_URL: 'https://n8n.bax-ict.nl/webhook/bax-assistent/auth/verify',
    
    // n8n Chat Trigger webhook URL
    CHAT_WEBHOOK_URL: 'https://n8n.bax-ict.nl/webhook/bfb70a44-e665-4b1b-979f-403cf46a4819/chat'
};
