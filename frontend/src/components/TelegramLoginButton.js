import React, { useEffect, useRef } from 'react';

const TelegramLoginButton = ({ botName, onAuth, buttonSize = 'large', cornerRadius = 20, requestAccess = 'write' }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Check if script already exists to prevent duplicates
        if (containerRef.current.querySelector('script')) return;

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', botName);
        script.setAttribute('data-size', buttonSize);
        script.setAttribute('data-radius', cornerRadius);
        script.setAttribute('data-request-access', requestAccess);
        script.setAttribute('data-userpic', 'false');
        script.async = true;

        // Define the callback function globally
        window.onTelegramAuth = (user) => {
            onAuth(user);
        };

        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        containerRef.current.appendChild(script);

        return () => {
            // Cleanup if needed, though usually not necessary for this widget
            // window.onTelegramAuth = undefined; 
        };
    }, [botName, buttonSize, cornerRadius, requestAccess, onAuth]);

    return <div ref={containerRef} className="telegram-login-container" />;
};

export default TelegramLoginButton;
