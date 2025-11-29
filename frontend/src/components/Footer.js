import React from 'react';
import { useTranslation } from 'react-i18next';
import './Footer.css';

const Footer = () => {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="site-footer">
            <div className="footer-container">
                <div className="footer-content">
                    <p className="copyright">
                        © {currentYear} Linked.Coffee. {t('footer.rights')}
                    </p>
                    <a href="/GDPR.pdf" target="_blank" rel="noopener noreferrer" className="footer-link">
                        {t('footer.gdpr')}
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
