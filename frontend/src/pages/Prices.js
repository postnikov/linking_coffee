import React from 'react';
import { useTranslation } from 'react-i18next';
import PageLayout from '../components/PageLayout';

const Prices = () => {
    const { t } = useTranslation();
    return (
        <PageLayout title={t('header.prices')}>
            <p>{t('pages.prices.text')}</p>
        </PageLayout>
    );
};

export default Prices;
