import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [copiedCode, setCopiedCode] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ label: '', maxUses: -1 });
  const [togglingLinkId, setTogglingLinkId] = useState(null);
  const [isPendingMember, setIsPendingMember] = useState(false);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberProfile, setMemberProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchCommunityData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/community/${slug}/full`, {
          headers: { 'x-user': user.Tg_Username }
        });
        const data = await response.json();

        if (!response.ok) {
          if (data.membershipStatus === 'Pending') {
            setIsPendingMember(true);
            setIsLoading(false);
            return;
          }
          setError(data.error || t('community.failed_load'));
          setIsLoading(false);
          return;
        }

        setCommunity(data.community);
        setMembers(data.members || []);
        setInviteLinks(data.inviteLinks || []);
        setPendingMembers(data.pendingMembers || []);
        setIsLoading(false);
      } catch (err) {
        setError(t('community.failed_load_data'));
        setIsLoading(false);
      }
    };

    fetchCommunityData();
  }, [user, slug, navigate, t]);

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
        alert(data.error || t('community.failed_leave'));
        setIsLeaving(false);
        return;
      }

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('Error leaving community:', err);
      alert(t('community.failed_leave'));
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    const shimmer = {
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '8px'
    };
    return (
      <main className="main-content dashboard-main">
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', width: '100%', boxSizing: 'border-box' }}>
          <div className="content-card" style={{ padding: '2rem' }}>
            <div style={{ ...shimmer, width: '280px', height: '36px', marginBottom: '12px' }} />
            <div style={{ ...shimmer, width: '220px', height: '16px', marginBottom: '24px' }} />
            <div style={{ ...shimmer, width: '100%', height: '14px', marginBottom: '8px' }} />
            <div style={{ ...shimmer, width: '60%', height: '14px', marginBottom: '30px' }} />
            <div style={{ ...shimmer, width: '100%', height: '120px', marginBottom: '30px' }} />
            <div style={{ ...shimmer, width: '160px', height: '24px', marginBottom: '16px' }} />
            <div style={{ ...shimmer, width: '100%', height: '60px' }} />
          </div>
        </div>
      </main>
    );
  }

  if (isPendingMember) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
          <h2 style={{ color: '#6366f1', marginBottom: '20px' }}>
            {t('community.join_request_submitted')}
          </h2>
          <p style={{ color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
            {t('community.join_pending_msg')}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 30px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'opacity 0.3s'
            }}
            onMouseOver={(e) => (e.target.style.opacity = '0.85')}
            onMouseOut={(e) => (e.target.style.opacity = '1')}
          >
            {t('community.go_to_profile_btn')}
          </button>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h2 style={{ color: '#ff4444', marginBottom: '20px' }}>{t('community.error')}</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>{error}</p>
          <button
            onClick={() => navigate('/my/communities')}
            style={{
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 30px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            {t('community.go_to_communities')}
          </button>
        </div>
      </PageLayout>
    );
  }

  const isAdmin = community.myRole === 'Owner' || community.myRole === 'Admin';

  const startEditing = () => {
    setEditForm({
      description: community.description || '',
      minActiveForMatching: community.minActiveForMatching || 6,
      approval_mode: community.settings?.approval_mode || 'auto',
      member_list_visible_to: community.settings?.member_list_visible_to || 'all_members',
      invite_links_visible_to: community.settings?.invite_links_visible_to || 'all_members',
      odd_user_handling: community.settings?.odd_user_handling || 'skip'
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/community/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user': user.Tg_Username
        },
        body: JSON.stringify({
          description: editForm.description,
          minActiveForMatching: Number(editForm.minActiveForMatching),
          settings: {
            approval_mode: editForm.approval_mode,
            member_list_visible_to: editForm.member_list_visible_to,
            invite_links_visible_to: editForm.invite_links_visible_to,
            odd_user_handling: editForm.odd_user_handling
          }
        })
      });

      if (response.ok) {
        setCommunity({
          ...community,
          description: editForm.description,
          minActiveForMatching: Number(editForm.minActiveForMatching),
          settings: {
            ...community.settings,
            approval_mode: editForm.approval_mode,
            member_list_visible_to: editForm.member_list_visible_to,
            invite_links_visible_to: editForm.invite_links_visible_to,
            odd_user_handling: editForm.odd_user_handling
          }
        });
        setIsEditing(false);
      } else {
        const data = await response.json();
        alert(data.error || t('community.failed_save'));
      }
    } catch (err) {
      alert(t('community.failed_save'));
    }
    setIsSaving(false);
  };

  const handleCreateInviteLink = async () => {
    if (!createForm.label.trim()) return;
    setIsCreating(true);

    try {
      const response = await fetch(`${API_URL}/api/community/${slug}/invite-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user': user.Tg_Username
        },
        body: JSON.stringify({
          label: createForm.label.trim(),
          maxUses: createForm.maxUses
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || t('community.failed_create_invite'));
        setIsCreating(false);
        return;
      }

      setInviteLinks([{
        ...data.inviteLink,
        createdAt: new Date().toISOString()
      }, ...inviteLinks]);
      setCreateForm({ label: '', maxUses: -1 });
      setShowCreateForm(false);
      setIsCreating(false);
    } catch (err) {
      console.error('Error creating invite link:', err);
      alert(t('community.failed_create_invite'));
      setIsCreating(false);
    }
  };

  const handleToggleLinkStatus = async (link) => {
    if (togglingLinkId) return;
    const newStatus = link.status === 'Active' ? 'Disabled' : 'Active';
    setTogglingLinkId(link.id);

    try {
      const response = await fetch(`${API_URL}/api/community/${slug}/invite-links/${link.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user': user.Tg_Username
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || t('community.failed_save'));
        setTogglingLinkId(null);
        return;
      }

      setInviteLinks(inviteLinks.map(l =>
        l.id === link.id ? { ...l, status: newStatus } : l
      ));
      setTogglingLinkId(null);
    } catch (err) {
      console.error('Error toggling invite link:', err);
      alert(t('community.failed_save'));
      setTogglingLinkId(null);
    }
  };

  const handleDeleteLink = (linkId) => {
    setConfirmModal({
      message: t('community.confirm_delete_link'),
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const response = await fetch(`${API_URL}/api/community/${slug}/invite-links/${linkId}`, {
            method: 'DELETE',
            headers: { 'x-user': user.Tg_Username }
          });

          if (!response.ok) {
            const data = await response.json();
            alert(data.error || t('community.failed_delete_link'));
            return;
          }

          setInviteLinks(inviteLinks.filter(l => l.id !== linkId));
        } catch (err) {
          alert(t('community.failed_delete_link'));
        }
      }
    });
  };

  const handleApproveMember = async (membershipId) => {
    if (approvingId || rejectingId) return;
    setApprovingId(membershipId);

    try {
      const response = await fetch(`${API_URL}/api/community/${slug}/members/${membershipId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user': user.Tg_Username
        }
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || t('community.failed_approve'));
        setApprovingId(null);
        return;
      }

      // Move from pending to active members
      const approved = pendingMembers.find(m => m.membershipId === membershipId);
      setPendingMembers(pendingMembers.filter(m => m.membershipId !== membershipId));
      if (approved) {
        setMembers([...members, {
          username: approved.username,
          name: approved.name,
          role: 'Member',
          joinedAt: new Date().toISOString()
        }]);
      }
      setCommunity({ ...community, memberCount: (community.memberCount || 0) + 1 });
      setApprovingId(null);
    } catch (err) {
      console.error('Error approving member:', err);
      alert(t('community.failed_approve'));
      setApprovingId(null);
    }
  };

  const handleRejectMember = async (membershipId) => {
    if (approvingId || rejectingId) return;
    setRejectingId(membershipId);

    try {
      const response = await fetch(`${API_URL}/api/community/${slug}/members/${membershipId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user': user.Tg_Username
        }
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || t('community.failed_reject'));
        setRejectingId(null);
        return;
      }

      setPendingMembers(pendingMembers.filter(m => m.membershipId !== membershipId));
      setRejectingId(null);
    } catch (err) {
      console.error('Error rejecting member:', err);
      alert(t('community.failed_reject'));
      setRejectingId(null);
    }
  };

  const handleRemoveMember = (membershipId, memberUsername) => {
    if (removingId) return;
    setConfirmModal({
      message: t('community.confirm_remove_member', { username: memberUsername }),
      onConfirm: async () => {
        setConfirmModal(null);
        setRemovingId(membershipId);

        try {
          const response = await fetch(`${API_URL}/api/community/${slug}/members/${membershipId}/remove`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user': user.Tg_Username
            }
          });

          if (!response.ok) {
            const data = await response.json();
            alert(data.error || t('community.failed_remove_member'));
            setRemovingId(null);
            return;
          }

          setMembers(members.filter(m => m.membershipId !== membershipId));
          setCommunity({ ...community, memberCount: Math.max((community.memberCount || 1) - 1, 0) });
          setRemovingId(null);
        } catch (err) {
          alert(t('community.failed_remove_member'));
          setRemovingId(null);
        }
      }
    });
  };

  const handleSelectMember = async (username) => {
    if (username === selectedMember) {
      setSelectedMember(null);
      setMemberProfile(null);
      return;
    }

    setSelectedMember(username);
    setMemberProfile(null);
    setIsLoadingProfile(true);

    try {
      const response = await fetch(
        `${API_URL}/api/profile?username=${username}&requester=${user.Tg_Username}&communitySlug=${encodeURIComponent(slug)}`
      );
      const data = await response.json();

      if (data.success) {
        setMemberProfile(data.profile);
      } else {
        setMemberProfile(null);
        setSelectedMember(null);
      }
    } catch (err) {
      setMemberProfile(null);
      setSelectedMember(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http') || avatarPath.startsWith('data:')) return avatarPath;
    return `${API_URL}${avatarPath}`;
  };

  const settingValueLabels = {
    auto: t('community.approval_auto'),
    manual: t('community.approval_manual'),
    all_members: t('community.visible_all'),
    admins_only: t('community.visible_admins'),
    skip: t('community.odd_skip'),
    notify_admin: t('community.odd_notify')
  };

  return (
    <main className="main-content dashboard-main">
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 2rem',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        gap: '2rem',
        alignItems: 'flex-start'
      }}>
        <div className="content-card" style={{ padding: '2rem', flex: selectedMember ? '0 0 65%' : '1', minWidth: 0, transition: 'flex 0.3s' }}>
          {/* Header */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
              <div>
                <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#6366f1', marginBottom: '10px' }}>
                  {community.name}
                </h1>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  <span style={{ marginRight: '15px' }}>{t('community.members_count', { count: community.memberCount })}</span>
                  <span>{t('community.role_label')} <strong>{community.myRole}</strong></span>
                </div>
              </div>
            </div>

            {community.description && (
              <p style={{ color: '#666', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{community.description}</p>
            )}
          </div>

          {/* Settings Info (Admin Only) */}
          {isAdmin && <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#eef0fb', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                {t('community.settings_title')}
              </h3>
              {!isEditing ? (
                <button
                  onClick={startEditing}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={t('community.edit_settings')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                      background: 'none',
                      border: '1.5px solid #16a34a',
                      borderRadius: '6px',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: isSaving ? 0.5 : 1
                    }}
                    title={t('community.save')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    style={{
                      background: 'none',
                      border: '1.5px solid #dc2626',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={t('community.cancel')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div style={{ display: 'grid', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>{t('community.description')}</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', minHeight: '80px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>{t('community.approval_mode')}</label>
                    <select
                      value={editForm.approval_mode}
                      onChange={(e) => setEditForm({ ...editForm, approval_mode: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }}
                    >
                      <option value="auto">{t('community.approval_auto')}</option>
                      <option value="manual">{t('community.approval_manual')}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>{t('community.min_members')}</label>
                    <input
                      type="number"
                      min="2"
                      value={editForm.minActiveForMatching}
                      onChange={(e) => setEditForm({ ...editForm, minActiveForMatching: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>{t('community.member_list_visible')}</label>
                    <select
                      value={editForm.member_list_visible_to}
                      onChange={(e) => setEditForm({ ...editForm, member_list_visible_to: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }}
                    >
                      <option value="all_members">{t('community.visible_all')}</option>
                      <option value="admins_only">{t('community.visible_admins')}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>{t('community.invite_links_visible')}</label>
                    <select
                      value={editForm.invite_links_visible_to}
                      onChange={(e) => setEditForm({ ...editForm, invite_links_visible_to: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }}
                    >
                      <option value="all_members">{t('community.visible_all')}</option>
                      <option value="admins_only">{t('community.visible_admins')}</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>{t('community.approval_mode')}</div>
                  <div style={{ fontWeight: '600' }}>{settingValueLabels[community.settings?.approval_mode] || settingValueLabels.auto}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>{t('community.min_members')}</div>
                  <div style={{ fontWeight: '600' }}>{community.minActiveForMatching || 6}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>{t('community.member_list_visible')}</div>
                  <div style={{ fontWeight: '600' }}>{settingValueLabels[community.settings?.member_list_visible_to] || settingValueLabels.all_members}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>{t('community.invite_links_visible')}</div>
                  <div style={{ fontWeight: '600' }}>{settingValueLabels[community.settings?.invite_links_visible_to] || settingValueLabels.all_members}</div>
                </div>
              </div>
            )}
          </div>}

          {/* Members List */}
          {members.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px' }}>
                {t('community.members_title', { count: members.length })}
              </h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {members.map(member => {
                  const isClickable = member.username !== user.Tg_Username;
                  const isSelected = selectedMember === member.username;

                  return (
                  <div
                    key={member.username}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '15px',
                      border: isSelected ? '2px solid #6366f1' : '1px solid #eee',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#f5f3ff' : 'white',
                      cursor: isClickable ? 'pointer' : 'default',
                      transition: 'border-color 0.2s, background-color 0.2s'
                    }}
                    onClick={() => isClickable && handleSelectMember(member.username)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '16px',
                        marginBottom: '5px',
                        color: isClickable ? '#6366f1' : 'inherit'
                      }}>
                        {member.name || '@' + member.username}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        @{member.username}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: member.role === 'Owner' ? '#6366f1' : '#f0f0f0',
                        color: member.role === 'Owner' ? 'white' : '#666'
                      }}>
                        {member.role}
                      </div>
                      {isAdmin && member.role !== 'Owner' && member.username !== user.Tg_Username && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.membershipId, member.username); }}
                          disabled={removingId === member.membershipId}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: removingId === member.membershipId ? 'not-allowed' : 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: removingId === member.membershipId ? 0.4 : 0.6,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => { if (removingId !== member.membershipId) e.currentTarget.style.opacity = '1'; }}
                          onMouseOut={(e) => { if (removingId !== member.membershipId) e.currentTarget.style.opacity = '0.6'; }}
                          title={t('community.remove_member')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Members (Admin Only) */}
          {isAdmin && pendingMembers.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px', color: '#f59e0b' }}>
                {t('community.pending_members_title', { count: pendingMembers.length })}
              </h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {pendingMembers.map(member => {
                  const isApproving = approvingId === member.membershipId;
                  const isRejecting = rejectingId === member.membershipId;
                  const isBusy = approvingId || rejectingId;

                  return (
                    <div
                      key={member.membershipId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '15px',
                        border: '2px solid #fbbf24',
                        borderRadius: '8px',
                        backgroundColor: '#fffbeb'
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApproveMember(member.membershipId)}
                          disabled={isBusy}
                          style={{
                            backgroundColor: isApproving ? '#86efac' : '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: isBusy ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isApproving ? t('community.approving') : t('community.approve')}
                        </button>
                        <button
                          onClick={() => handleRejectMember(member.membershipId)}
                          disabled={isBusy}
                          style={{
                            backgroundColor: 'transparent',
                            color: isRejecting ? '#999' : '#dc2626',
                            border: `1px solid ${isRejecting ? '#999' : '#dc2626'}`,
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: isBusy ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isRejecting ? t('community.rejecting') : t('community.reject')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invite Links */}
          {(inviteLinks.length > 0 || isAdmin) && (
            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600' }}>
                  {t('community.invite_links_title', { count: inviteLinks.length })}
                </h3>
                {isAdmin && !showCreateForm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.6,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                    title={t('community.create_invite_link')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Create Invite Form */}
              {showCreateForm && (
                <div style={{
                  padding: '20px',
                  border: '2px solid #6366f1',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99,102,241,0.04)',
                  marginBottom: '15px'
                }}>
                  <div style={{ display: 'grid', gap: '12px', marginBottom: '15px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>
                        {t('community.invite_label_field')} *
                      </label>
                      <input
                        type="text"
                        value={createForm.label}
                        onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
                        placeholder={t('community.invite_label_placeholder')}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#666', display: 'block', marginBottom: '5px' }}>
                        {t('community.invite_max_uses')}
                      </label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={createForm.maxUses === -1 ? '' : createForm.maxUses}
                          onChange={(e) => setCreateForm({
                            ...createForm,
                            maxUses: e.target.value === '' ? -1 : Number(e.target.value)
                          })}
                          placeholder={t('community.invite_unlimited')}
                          style={{
                            width: '140px',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid #ddd',
                            fontSize: '14px'
                          }}
                        />
                        <span style={{ fontSize: '13px', color: '#999' }}>
                          {createForm.maxUses === -1 ? t('community.invite_unlimited') : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleCreateInviteLink}
                      disabled={isCreating || !createForm.label.trim()}
                      style={{
                        backgroundColor: isCreating || !createForm.label.trim() ? '#ccc' : '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: isCreating || !createForm.label.trim() ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isCreating ? t('community.creating_invite') : t('community.create_invite_link')}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setCreateForm({ label: '', maxUses: -1 });
                      }}
                      disabled={isCreating}
                      style={{
                        backgroundColor: '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {t('community.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {inviteLinks.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '30px 20px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  color: '#999',
                  fontSize: '14px'
                }}>
                  {t('community.no_invite_links')}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {inviteLinks.map(link => {
                    const baseUrl = window.location.origin;
                    const fullLink = `${baseUrl}/join/${link.code}`;
                    const isCopied = copiedCode === link.code;
                    const isToggling = togglingLinkId === link.id;

                    return (
                      <div
                        key={link.id}
                        style={{
                          padding: '15px',
                          border: '1px solid #eee',
                          borderRadius: '8px',
                          backgroundColor: 'white',
                          opacity: link.status === 'Disabled' ? 0.7 : 1
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ fontWeight: '600' }}>{link.label}</div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              backgroundColor: link.status === 'Active' ? '#d4edda' : '#f8d7da',
                              color: link.status === 'Active' ? '#155724' : '#721c24'
                            }}>
                              {link.status === 'Active' ? t('community.status_active') : t('community.status_disabled')}
                            </div>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleToggleLinkStatus(link)}
                                  disabled={isToggling}
                                  title={link.status === 'Active' ? t('community.disable_link') : t('community.enable_link')}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: isToggling ? 'not-allowed' : 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: isToggling ? 0.4 : 0.6,
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseOver={(e) => { if (!isToggling) e.currentTarget.style.opacity = '1'; }}
                                  onMouseOut={(e) => { if (!isToggling) e.currentTarget.style.opacity = '0.6'; }}
                                >
                                  {link.status === 'Active' ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="6" y="4" width="4" height="16" rx="1" />
                                      <rect x="14" y="4" width="4" height="16" rx="1" />
                                    </svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polygon points="6,4 20,12 6,20" />
                                    </svg>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDeleteLink(link.id)}
                                  title={t('community.delete_link')}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: 0.6,
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }}>
                          <code style={{ flex: 1, fontSize: '13px', wordBreak: 'break-all', color: '#333' }}>
                            {fullLink}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(fullLink);
                              setCopiedCode(link.code);
                              setTimeout(() => setCopiedCode(null), 2000);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              flexShrink: 0,
                              transition: 'opacity 0.2s',
                              opacity: 0.6
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                            onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                            title={isCopied ? t('community.copied') : t('community.copy_link')}
                          >
                            {isCopied ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <div style={{ fontSize: '13px', color: '#888' }}>
                          {link.maxUses !== -1
                            ? t('community.used_of', { count: link.usedCount, max: link.maxUses })
                            : t('community.used', { count: link.usedCount })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                    {t('community.leave')}
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
                      {isLeaving ? t('community.leaving') : t('community.confirm_leave')}
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
                      {t('community.cancel')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Member Profile Panel */}
        {selectedMember && (
          <>
          {/* Mobile overlay backdrop */}
          <div
            className="member-profile-backdrop"
            onClick={() => { setSelectedMember(null); setMemberProfile(null); }}
          />
          <div className="member-profile-panel">
            <div className="content-card" style={{ padding: '1.5rem' }}>
              {/* Close button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <button
                  onClick={() => { setSelectedMember(null); setMemberProfile(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.5
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {isLoadingProfile ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                  <div className="loading-spinner" />
                </div>
              ) : memberProfile ? (
                <div>
                  {/* Avatar + Name */}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      margin: '0 auto 12px',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {memberProfile.avatar ? (
                        <img
                          src={getAvatarUrl(memberProfile.avatar)}
                          alt={memberProfile.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '28px', color: '#999' }}>
                          {memberProfile.name ? memberProfile.name.charAt(0).toUpperCase() : '?'}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>
                      {memberProfile.name} {memberProfile.family}
                    </h3>
                    <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {memberProfile.profession && <span>{memberProfile.profession}</span>}
                      {memberProfile.grade && (
                        <>
                          {memberProfile.profession && <span style={{ opacity: 0.5 }}>&bull;</span>}
                          <span>{memberProfile.grade}</span>
                        </>
                      )}
                    </div>
                    {memberProfile.linkedin && (
                      <a
                        href={memberProfile.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0077b5', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        LinkedIn
                      </a>
                    )}
                  </div>

                  {/* Location */}
                  {(memberProfile.country || memberProfile.city || memberProfile.timezone) && (
                    <div style={{
                      fontSize: '13px',
                      color: '#666',
                      textAlign: 'center',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      {memberProfile.country && (
                        <>
                          <span>{memberProfile.country.flag}</span>
                          <span>{memberProfile.country.name}</span>
                        </>
                      )}
                      {memberProfile.city && <span>&bull; {memberProfile.city.name}</span>}
                      {memberProfile.timezone && <span>&bull; {memberProfile.timezone}</span>}
                    </div>
                  )}

                  {/* Telegram button */}
                  {memberProfile.tg_username && (
                    <a
                      href={`https://t.me/${memberProfile.tg_username.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#6366f1',
                        color: 'white',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '1.5rem'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.638z"/></svg>
                      {t('community.message_telegram', 'Message on Telegram')}
                    </a>
                  )}

                  {/* Descriptions */}
                  {memberProfile.professionalDesc && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {t('dashboard.profile.professional_desc')}
                      </h4>
                      <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.5', margin: 0 }}>
                        {memberProfile.professionalDesc}
                      </p>
                    </div>
                  )}

                  {memberProfile.personalDesc && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {t('dashboard.profile.personal_desc')}
                      </h4>
                      <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.5', margin: 0 }}>
                        {memberProfile.personalDesc}
                      </p>
                    </div>
                  )}

                  {/* Professional Interests */}
                  {memberProfile.professionalInterests?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {t('dashboard.profile.professional_interests')}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {memberProfile.professionalInterests.map(item => (
                          <span key={item} style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            backgroundColor: '#eef0fb',
                            color: '#4b5563'
                          }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Personal Interests */}
                  {memberProfile.personalInterests?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {t('dashboard.profile.personal_interests')}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {memberProfile.personalInterests.map(item => (
                          <span key={item} style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coffee Goals */}
                  {memberProfile.coffeeGoals?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {t('dashboard.profile.coffee_goals')}
                      </h4>
                      <p style={{ fontSize: '14px', color: '#333', margin: 0 }}>
                        {Array.isArray(memberProfile.coffeeGoals) ? memberProfile.coffeeGoals.join(', ') : memberProfile.coffeeGoals}
                      </p>
                    </div>
                  )}

                  {/* Languages */}
                  {memberProfile.languages?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {t('dashboard.profile.languages')}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {memberProfile.languages.map(lang => (
                          <span key={lang} style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            backgroundColor: '#f0f0f0',
                            color: '#333'
                          }}>
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meeting Days */}
                  {memberProfile.bestMeetingDays?.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {t('dashboard.profile.best_days')}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {memberProfile.bestMeetingDays.map(day => (
                          <span key={day} style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            backgroundColor: '#dbeafe',
                            color: '#1e40af'
                          }}>
                            {t(`dashboard.days.${day.toLowerCase()}`, day)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  {t('community.profile_not_available', 'Profile not available')}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
      {confirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setConfirmModal(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: '16px', lineHeight: '1.5', color: '#333', marginBottom: '24px', marginTop: 0 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {t('community.cancel')}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {t('community.confirm_action')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    );
};

export default CommunityInfoPage;
