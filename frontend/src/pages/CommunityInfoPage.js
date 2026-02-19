import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageLayout from '../components/PageLayout';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const CommunityInfoPage = ({ user }) => {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteLinks, setInviteLinks] = useState([]);
  const [error, setError] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchCommunityData = async () => {
      try {
        // Fetch community info
        const infoResponse = await fetch(`${API_URL}/api/community/${slug}`, {
          headers: { 'x-user': user.Tg_Username }
        });
        const infoData = await infoResponse.json();

        if (!infoResponse.ok) {
          setError(infoData.error || 'Failed to load community');
          setIsLoading(false);
          return;
        }

        setCommunity(infoData.community);

        // Fetch members if allowed
        const membersResponse = await fetch(`${API_URL}/api/community/${slug}/members`, {
          headers: { 'x-user': user.Tg_Username }
        });
        const membersData = await membersResponse.json();

        if (membersResponse.ok) {
          setMembers(membersData.members || []);
        }

        // Fetch invite links if allowed
        const linksResponse = await fetch(`${API_URL}/api/community/${slug}/invite-links`, {
          headers: { 'x-user': user.Tg_Username }
        });
        const linksData = await linksResponse.json();

        if (linksResponse.ok) {
          setInviteLinks(linksData.inviteLinks || []);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching community data:', err);
        setError('Failed to load community data');
        setIsLoading(false);
      }
    };

    fetchCommunityData();
  }, [user, slug, navigate]);

  const handleLeaveCommunity = async () => {
    setIsLeaving(true);

    try {
      const response = await fetch(`${API_URL}/api/community/${slug}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user': user.Tg_Username
        }
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to leave community');
        setIsLeaving(false);
        return;
      }

      // Redirect to communities page
      navigate('/my/communities');
    } catch (err) {
      console.error('Error leaving community:', err);
      alert('Failed to leave community');
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner">⏳</div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading community...</p>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2 style={{ color: '#ff4444', marginBottom: '20px' }}>Error</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>{error}</p>
          <button
            onClick={() => navigate('/my/communities')}
            style={{
              backgroundColor: '#8b7355',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 30px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Go to My Communities
          </button>
        </div>
      </PageLayout>
    );
  }

  const isAdmin = community.myRole === 'Owner' || community.myRole === 'Admin';

  return (
    <PageLayout>
      <div className="dashboard-container" style={{ padding: '20px' }}>
        <div className="glass-card" style={{ maxWidth: '900px', margin: '0 auto', padding: '30px' }}>
          {/* Header */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
              <div>
                <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#8b7355', marginBottom: '10px' }}>
                  {community.name}
                </h1>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  <span style={{ marginRight: '15px' }}>👥 {community.memberCount} members</span>
                  <span>Role: <strong>{community.myRole}</strong></span>
                </div>
              </div>
              {isAdmin && (
                <Link
                  to={`/community/${slug}/admin`}
                  style={{
                    backgroundColor: '#8b7355',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: '600'
                  }}
                >
                  ⚙️ Admin
                </Link>
              )}
            </div>

            {community.description && (
              <p style={{ color: '#666', lineHeight: '1.6' }}>{community.description}</p>
            )}
          </div>

          {/* Settings Info */}
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>
              Community Settings
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Approval Mode</div>
                <div style={{ fontWeight: '600' }}>{community.settings?.approval_mode || 'auto'}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Min. Members for Matching</div>
                <div style={{ fontWeight: '600' }}>{community.minActiveForMatching || 6}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Member List Visible To</div>
                <div style={{ fontWeight: '600' }}>{community.settings?.member_list_visible_to || 'all_members'}</div>
              </div>
            </div>
          </div>

          {/* Members List */}
          {members.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px' }}>
                Members ({members.length})
              </h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {members.map(member => (
                  <div
                    key={member.username}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '15px',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      backgroundColor: 'white'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '5px' }}>
                        {member.name || '@' + member.username}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        @{member.username}
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: member.role === 'Owner' ? '#8b7355' : '#f0f0f0',
                      color: member.role === 'Owner' ? 'white' : '#666'
                    }}>
                      {member.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite Links */}
          {inviteLinks.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px' }}>
                Invite Links ({inviteLinks.length})
              </h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {inviteLinks.map(link => (
                  <div
                    key={link.id}
                    style={{
                      padding: '15px',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      backgroundColor: 'white'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '600' }}>{link.label}</div>
                      <div style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        backgroundColor: link.status === 'Active' ? '#d4edda' : '#f8d7da',
                        color: link.status === 'Active' ? '#155724' : '#721c24'
                      }}>
                        {link.status}
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      <div>Code: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>{link.code}</code></div>
                      <div>Used: {link.usedCount} {link.maxUses !== -1 && `/ ${link.maxUses}`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
            {community.myRole !== 'Owner' && (
              <>
                {!showLeaveConfirm ? (
                  <button
                    onClick={() => setShowLeaveConfirm(true)}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#dc2626',
                      border: '2px solid #dc2626',
                      borderRadius: '6px',
                      padding: '10px 20px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Leave Community
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                      onClick={handleLeaveCommunity}
                      disabled={isLeaving}
                      style={{
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '10px 20px',
                        cursor: isLeaving ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      {isLeaving ? 'Leaving...' : 'Confirm Leave'}
                    </button>
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      disabled={isLeaving}
                      style={{
                        backgroundColor: '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '10px 20px',
                        cursor: isLeaving ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default CommunityInfoPage;
