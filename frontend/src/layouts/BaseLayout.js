import React from 'react';
import './BaseLayout.css';

export const BaseLayout = ({
    children,
    containerSize = 'content', // 'full' | 'wide' | 'content' | 'reading' | 'narrow'
    className = ''
}) => {
    const containerClass = `container-${containerSize}`;

    return (
        <main className={`layout-wrapper ${className}`}>
            <div className={containerClass}>
                {children}
            </div>
        </main>
    );
};

// Convenience exports
export const FullLayout = ({ children, className }) => (
    <BaseLayout containerSize="full" className={className}>{children}</BaseLayout>
);

export const WideLayout = ({ children, className }) => (
    <BaseLayout containerSize="wide" className={className}>{children}</BaseLayout>
);

export const ContentLayout = ({ children, className }) => (
    <BaseLayout containerSize="content" className={className}>{children}</BaseLayout>
);

export const ReadingLayout = ({ children, className }) => (
    <BaseLayout containerSize="reading" className={className}>{children}</BaseLayout>
);

export const NarrowLayout = ({ children, className }) => (
    <BaseLayout containerSize="narrow" className={className}>{children}</BaseLayout>
);
