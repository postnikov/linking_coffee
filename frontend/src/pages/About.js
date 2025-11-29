import React from 'react';
import { useTranslation } from 'react-i18next';
import PageLayout from '../components/PageLayout';

const About = () => {
    const { t } = useTranslation();
    return (
        <PageLayout title={t('header.about')}>
            <p>{t('pages.about.text')}</p>
        </PageLayout>
    );
};

export default About;
