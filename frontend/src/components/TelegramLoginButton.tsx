import React, { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { setTelegramUser, TelegramUser } from '../store/telegramSlice';

declare global {
    interface Window {
        onTelegramAuth: (user: TelegramUser) => void;
    }
}

const TelegramLoginButton: React.FC = () => {
    const dispatch = useDispatch();
    const telegramContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (telegramContainerRef.current) {
            // Set up auth callback
            window.onTelegramAuth = (user) => {
                console.log('Telegram user:', user);
                dispatch(setTelegramUser(user));
            };

            // Create and add script
            console.log("Adding Telegram script");
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-widget.js?22';
            script.setAttribute('data-telegram-login', 'smartWallletBot');
            script.setAttribute('data-size', 'large');
            script.setAttribute('data-onauth', 'onTelegramAuth(user)');
            script.setAttribute('data-request-access', 'write');
            script.async = true;

            telegramContainerRef.current.appendChild(script);
        }
    }, [dispatch]);

    return (
        <div 
            ref={telegramContainerRef}
            className="flex justify-center bg-gray-800 p-4 rounded-lg"
        />
    );
};

export default TelegramLoginButton;
