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
                    {user && (
                        <button
                            onClick={onLogout}
                            className="nav-link"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '1rem',
                                color: 'rgba(255, 255, 255, 0.8)',
                                marginRight: '1.5rem'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span>{t('header.logout', 'Logout')}</span>
                        </button>
                    )}

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
            </div>
        </header>
    );
};

export default Header;
