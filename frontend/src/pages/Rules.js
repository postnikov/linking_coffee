import React from 'react';
import { useTranslation } from 'react-i18next';
import PageLayout from '../components/PageLayout';

const Rules = () => {
    const { t } = useTranslation();
    return (
        <PageLayout title={t('header.rules')}>
            <p>{t('pages.rules.text')}</p>
        </PageLayout>
    );
};

export default Rules;
