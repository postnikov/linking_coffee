import React from 'react';
import { useTranslation } from 'react-i18next';

const PageLayout = ({ title, children }) => {
    return (
        <div className="page-container">
            <div className="glass-card page-card">
                <h1 className="page-title">{title}</h1>
                <div className="page-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default PageLayout;
