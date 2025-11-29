import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Header.css';

const Header = () => {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <header className="site-header">
            <div className="header-container">
                <Link to="/" className="header-logo">
                    Linked.Coffee
                </Link>

                <nav className="header-nav">
                    <Link to="/about" className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}>
                        {t('header.about')}
                    </Link>
                    <Link to="/rules" className={`nav-link ${location.pathname === '/rules' ? 'active' : ''}`}>
                        {t('header.rules')}
                    </Link>
                    <Link to="/prices" className={`nav-link ${location.pathname === '/prices' ? 'active' : ''}`}>
                        {t('header.prices')}
                    </Link>
                    <Link to="/register" className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`}>
                        {t('header.register')}
                    </Link>
                </nav>

                <div className="language-switcher-header">
                    <button
                        className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
                        onClick={() => changeLanguage('en')}
                    >
                        EN
                    </button>
                    <span className="lang-divider">|</span>
                    <button
                        className={`lang-btn ${i18n.language === 'ru' ? 'active' : ''}`}
                        onClick={() => changeLanguage('ru')}
                    >
                        RU
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
