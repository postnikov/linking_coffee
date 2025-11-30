import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Header.css';

const Header = ({ user, onLogout }) => {
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

                </nav>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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

                    {user && (
                        <button
                            onClick={onLogout}
                            className="nav-link"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0',
                                marginLeft: '1rem',
                                color: 'var(--text-primary)'
                            }}
                        >
                            Logout
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
