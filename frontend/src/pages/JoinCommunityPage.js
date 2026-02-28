import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || '';
const BOT_NAME = process.env.REACT_APP_TELEGRAM_BOT_NAME || 'Linked_Coffee_Bot';

const JoinCommunityPage = ({ user }) => {
  const { t } = useTranslation();
  const { code } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  // Persist return URL so LoginPage can redirect back after Telegram bot login
  useEffect(() => {
    if (!user && code) {
      localStorage.setItem('pendingReturnTo', `/join/${code}`);
    }
  }, [user, code]);

  // Fetch invite information
  useEffect(() => {
    const fetchInviteInfo = async () => {
      try {
        const response = await fetch(`${API_URL}/api/invite/${code}/info`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || t('community.invalid_invite'));
          setIsLoading(false);
          return;
        }

        setInviteInfo(data.invite);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching invite info:', err);
        setError(t('community.failed_load_invite'));
        setIsLoading(false);
      }
    };

    if (code) {
      fetchInviteInfo();
    }
  }, [code, t]);

  const handleJoin = async () => {
    // Check if user is logged in
    if (!user) {
      // Redirect to login with return URL
      navigate('/');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/community/join/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: user.Tg_Username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Your membership is pending approval') {
          setJoinSuccess(true);
          setMembershipStatus('Pending');
          setIsJoining(false);
          return;
        }
        if (data.error === 'You are already a member of this community') {
          setAlreadyMember(true);
          setJoinSuccess(true);
          setMembershipStatus('Active');
          setIsJoining(false);
          return;
        }
        setError(data.error || t('community.failed_join'));
        setIsJoining(false);
        return;
      }

      setJoinSuccess(true);
      setMembershipStatus(data.membership.status);
      setIsJoining(false);
    } catch (err) {
      console.error('Error joining community:', err);
      setError(t('community.failed_join_retry'));
      setIsJoining(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate('/');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 140px)' }}>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div className="loading-spinner">⏳</div>
          <p style={{ marginTop: '20px', color: '#666' }}>{t('community.loading_invite')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !inviteInfo) {
    return (
      <div className="dashboard-container" style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 140px)' }}>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2 style={{ color: '#ff4444', marginBottom: '20px' }}>{t('community.invalid_invite_title')}</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 30px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'opacity 0.3s',
            }}
            onMouseOver={(e) => (e.target.style.opacity = '0.85')}
            onMouseOut={(e) => (e.target.style.opacity = '1')}
          >
            {t('community.go_to_dashboard')}
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (joinSuccess) {
    return (
      <div className="dashboard-container" style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 140px)' }}>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>
            {membershipStatus === 'Pending' ? '⏳' : alreadyMember ? '☕' : '🎉'}
          </div>
          <h2 style={{ color: '#6366f1', marginBottom: '20px' }}>
            {membershipStatus === 'Pending'
              ? t('community.join_request_submitted')
              : alreadyMember
                ? t('community.already_member_title')
                : t('community.join_welcome')}
          </h2>
          <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '15px' }}>
            {inviteInfo.community.name}
          </h3>
          <p style={{ color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
            {membershipStatus === 'Pending'
              ? t('community.join_pending_msg')
              : alreadyMember
                ? t('community.already_member_msg', { name: inviteInfo.community.name })
                : t('community.join_success_msg', { name: inviteInfo.community.name })}
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleGoToDashboard}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 30px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'opacity 0.3s',
              }}
              onMouseOver={(e) => (e.target.style.opacity = '0.85')}
              onMouseOut={(e) => (e.target.style.opacity = '1')}
            >
              {t('community.go_to_profile_btn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main invite display
  return (
    <div className="dashboard-container" style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 140px)' }}>
      <div className="glass-card" style={{ maxWidth: '600px', width: '100%', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>☕</div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '10px', color: '#6366f1' }}>
            {t('community.youre_invited')}
          </h2>
          <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '15px' }}>
            {inviteInfo.community.name}
          </h3>
          {inviteInfo.community.description && (
            <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '20px' }}>
              {inviteInfo.community.description}
            </p>
          )}
          <div
            style={{
              display: 'inline-block',
              backgroundColor: '#f5f5f5',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#666',
            }}
          >
            {t('community.invite_label')} <strong>{inviteInfo.label}</strong>
          </div>
        </div>

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

        <div style={{ textAlign: 'center' }}>
          {!user ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ color: '#666', marginBottom: '12px' }}>
                {t('community.login_to_join')}
              </p>
              <a
                href={`https://t.me/${BOT_NAME}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginBottom: '12px',
                  color: '#6366f1',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}
              >
                @{BOT_NAME}
              </a>
              <a
                href={`https://t.me/${BOT_NAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="submit-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  width: '100%',
                  gap: '8px',
                  fontSize: '1rem'
                }}
              >
                <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                <span>{t('form.go_to_bot', 'Continue with Telegram')}</span>
              </a>
              <p style={{
                marginTop: '12px',
                fontSize: '0.85rem',
                color: 'var(--gray-600)',
                lineHeight: '1.4'
              }}>
                {t('form.bot_instructions', 'Open the bot, press Start — you\'ll get a magic link to log in instantly.')}
              </p>
            </div>
          ) : (
            <>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                {t('community.join_desc')}
              </p>
              <button
                onClick={handleJoin}
                disabled={isJoining}
                style={{
                  background: isJoining ? '#ccc' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 40px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: isJoining ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.3s',
                  width: '100%',
                  maxWidth: '300px',
                }}
                onMouseOver={(e) => {
                  if (!isJoining) e.target.style.opacity = '0.85';
                }}
                onMouseOut={(e) => {
                  if (!isJoining) e.target.style.opacity = '1';
                }}
              >
                {isJoining ? t('community.joining') : t('community.join_btn')}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default JoinCommunityPage;
