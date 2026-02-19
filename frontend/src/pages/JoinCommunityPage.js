import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || '';

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

  // Fetch invite information
  useEffect(() => {
    const fetchInviteInfo = async () => {
      try {
        const response = await fetch(`${API_URL}/api/invite/${code}/info`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid invite link');
          setIsLoading(false);
          return;
        }

        setInviteInfo(data.invite);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching invite info:', err);
        setError('Failed to load invite information');
        setIsLoading(false);
      }
    };

    if (code) {
      fetchInviteInfo();
    }
  }, [code]);

  const handleJoin = async () => {
    // Check if user is logged in
    if (!user) {
      // Redirect to login with return URL
      navigate('/login', { state: { from: { pathname: `/join/${code}` } } });
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
        setError(data.error || 'Failed to join community');
        setIsJoining(false);
        return;
      }

      setJoinSuccess(true);
      setMembershipStatus(data.membership.status);
      setIsJoining(false);
    } catch (err) {
      console.error('Error joining community:', err);
      setError('Failed to join community. Please try again.');
      setIsJoining(false);
    }
  };

  const handleGoToCommunity = () => {
    if (inviteInfo) {
      navigate(`/community/${inviteInfo.community.slug}`);
    }
  };

  const handleGoToDashboard = () => {
    navigate('/');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div className="loading-spinner">⏳</div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading invite information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !inviteInfo) {
    return (
      <div className="dashboard-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2 style={{ color: '#ff4444', marginBottom: '20px' }}>Invalid Invite Link</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              backgroundColor: '#8b7355',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 30px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#6d5a45')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#8b7355')}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (joinSuccess) {
    return (
      <div className="dashboard-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>
            {membershipStatus === 'Pending' ? '⏳' : '🎉'}
          </div>
          <h2 style={{ color: '#8b7355', marginBottom: '20px' }}>
            {membershipStatus === 'Pending' ? 'Request Submitted' : 'Welcome!'}
          </h2>
          <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '15px' }}>
            {inviteInfo.community.name}
          </h3>
          <p style={{ color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
            {membershipStatus === 'Pending'
              ? 'Your membership request has been submitted and is pending approval from a community admin. You\'ll receive a Telegram notification once approved.'
              : 'You\'re now a member of this community! You can start participating in weekly coffee matches.'}
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {membershipStatus === 'Active' && (
              <button
                onClick={handleGoToCommunity}
                style={{
                  backgroundColor: '#8b7355',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 30px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = '#6d5a45')}
                onMouseOut={(e) => (e.target.style.backgroundColor = '#8b7355')}
              >
                View Community
              </button>
            )}
            <button
              onClick={handleGoToDashboard}
              style={{
                backgroundColor: 'white',
                color: '#8b7355',
                border: '2px solid #8b7355',
                borderRadius: '8px',
                padding: '12px 30px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#f5f5f5';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'white';
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main invite display
  return (
    <div className="dashboard-container" style={{ padding: '40px 20px' }}>
      <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>☕</div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '10px', color: '#8b7355' }}>
            You're Invited!
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
            Invite: <strong>{inviteInfo.label}</strong>
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
            <>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Please log in to join this community
              </p>
              <button
                onClick={handleJoin}
                style={{
                  backgroundColor: '#8b7355',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 40px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
                  width: '100%',
                  maxWidth: '300px',
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = '#6d5a45')}
                onMouseOut={(e) => (e.target.style.backgroundColor = '#8b7355')}
              >
                Log in to Join
              </button>
            </>
          ) : (
            <>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Join this community to participate in weekly coffee matches with other members
              </p>
              <button
                onClick={handleJoin}
                disabled={isJoining}
                style={{
                  backgroundColor: isJoining ? '#ccc' : '#8b7355',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 40px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: isJoining ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.3s',
                  width: '100%',
                  maxWidth: '300px',
                }}
                onMouseOver={(e) => {
                  if (!isJoining) e.target.style.backgroundColor = '#6d5a45';
                }}
                onMouseOut={(e) => {
                  if (!isJoining) e.target.style.backgroundColor = '#8b7355';
                }}
              >
                {isJoining ? 'Joining...' : 'Join Community'}
              </button>
            </>
          )}
        </div>

        <div
          style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #eee',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: '#999' }}>
            Already a member?{' '}
            <button
              onClick={handleGoToDashboard}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b7355',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Go to Dashboard
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinCommunityPage;
