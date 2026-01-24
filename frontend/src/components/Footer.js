import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
                    <Link to="/privacy" className="footer-link">
                        {t('footer.gdpr')}
                    </Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
