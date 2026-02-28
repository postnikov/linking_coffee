import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageLayout from '../components/PageLayout';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const MyCommunitiesPage = ({ user }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [communities, setCommunities] = useState([]);
  const [matchingContext, setMatchingContext] = useState('global');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch user's communities
  useEffect(() => {
    const fetchCommunities = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/my/communities?username=${user.Tg_Username}`
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || t('community.failed_load_communities'));
          setIsLoading(false);
          return;
        }

        setCommunities(data.communities);
        setMatchingContext(data.matchingContext);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching communities:', err);
        setError(t('community.failed_load_communities'));
        setIsLoading(false);
      }
    };

    fetchCommunities();
  }, [user, navigate, t]);

  const handleContextChange = async (newContext) => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/my/matching-context`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: user.Tg_Username,
          matchingContext: newContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('community.failed_update_context'));
        setIsSaving(false);
        return;
      }

      setMatchingContext(newContext);
      setSaveSuccess(true);
      setIsSaving(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating matching context:', err);
      setError(t('community.failed_update_context'));
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner">⏳</div>
          <p style={{ marginTop: '20px', color: '#666' }}>{t('community.loading_communities')}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <div style={{ paddingTop: '100px', paddingBottom: '40px', minHeight: '100vh', background: 'white' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '10px', color: '#6366f1' }}>
            {t('community.my_title')}
          </h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>
            {t('community.my_subtitle')}
          </p>

          {error && (
            <div
              style={{
                backgroundColor: '#fff3f3',
                border: '1px solid #ffcccc',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px',
                color: '#cc0000',
              }}
            >
              {error}
            </div>
          )}

          {saveSuccess && (
            <div
              style={{
                backgroundColor: '#f0fff4',
                border: '1px solid #9ae6b4',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px',
                color: '#22543d',
              }}
            >
              {t('community.context_updated')}
            </div>
          )}

          {/* Matching Context Selector */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#333' }}>
              {t('community.select_pool')}
            </h3>

            {/* Global Pool Option */}
            <div
              onClick={() => !isSaving && handleContextChange('global')}
              style={{
                border: matchingContext === 'global' ? '3px solid #6366f1' : '2px solid #ddd',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '15px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                backgroundColor: matchingContext === 'global' ? 'rgba(99,102,241,0.04)' : 'white',
                transition: 'all 0.3s',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: matchingContext === 'global' ? '7px solid #6366f1' : '2px solid #ccc',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginBottom: '5px' }}>
                    {t('community.global_pool')}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {t('community.global_desc')}
                  </div>
                </div>
                {matchingContext === 'global' && (
                  <div
                    style={{
                      backgroundColor: '#6366f1',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    {t('community.active_badge')}
                  </div>
                )}
              </div>
            </div>

            {/* Community Options */}
            {communities.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '12px',
                  border: '2px dashed #ddd',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>🔍</div>
                <p style={{ color: '#666', marginBottom: '20px' }}>
                  {t('community.no_communities')}
                </p>
                <p style={{ fontSize: '14px', color: '#999' }}>
                  {t('community.no_communities_desc')}
                </p>
              </div>
            ) : (
              communities.map((community) => (
                <div
                  key={community.slug}
                  onClick={() =>
                    !isSaving &&
                    community.status === 'Active' &&
                    handleContextChange(`community:${community.slug}`)
                  }
                  style={{
                    border:
                      matchingContext === `community:${community.slug}`
                        ? '3px solid #6366f1'
                        : '2px solid #ddd',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    cursor:
                      isSaving || community.status !== 'Active' ? 'not-allowed' : 'pointer',
                    backgroundColor:
                      matchingContext === `community:${community.slug}` ? 'rgba(99,102,241,0.04)' : 'white',
                    transition: 'all 0.3s',
                    opacity: community.status !== 'Active' ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border:
                          matchingContext === `community:${community.slug}`
                            ? '7px solid #6366f1'
                            : '2px solid #ccc',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#333',
                          marginBottom: '5px',
                        }}
                      >
                        {community.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {community.status === 'Pending'
                          ? t('community.pending_approval')
                          : `${t('community.role_label')} ${community.role}`}
                      </div>
                    </div>
                    {matchingContext === `community:${community.slug}` && (
                      <div
                        style={{
                          backgroundColor: '#6366f1',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        {t('community.active_badge')}
                      </div>
                    )}
                    {community.status === 'Pending' && (
                      <div
                        style={{
                          backgroundColor: '#ffa500',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        {t('community.pending_badge')}
                      </div>
                    )}
                  </div>
                  {matchingContext !== `community:${community.slug}` &&
                    community.status === 'Active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/community/${community.slug}`);
                        }}
                        style={{
                          marginTop: '15px',
                          backgroundColor: 'transparent',
                          color: '#6366f1',
                          border: '2px solid #6366f1',
                          borderRadius: '6px',
                          padding: '8px 16px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = 'rgba(99,102,241,0.05)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        {t('community.view_community')} →
                      </button>
                    )}
                </div>
              ))
            )}
          </div>

          {/* Info Box */}
          <div
            style={{
              backgroundColor: '#f0f8ff',
              border: '1px solid #b3d9ff',
              borderRadius: '8px',
              padding: '15px',
              marginTop: '30px',
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1a5490' }}>
              {t('community.how_title')}
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#1a5490', fontSize: '14px' }}>
              <li style={{ marginBottom: '5px' }}>
                {t('community.how_1')}
              </li>
              <li style={{ marginBottom: '5px' }}>
                {t('community.how_2')}
              </li>
              <li>{t('community.how_3')}</li>
            </ul>
          </div>
      </div>
    </div>
  );
};

export default MyCommunitiesPage;
