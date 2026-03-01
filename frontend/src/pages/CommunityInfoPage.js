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

  useEffect(() => {
    if (!user) {
      navigate('/');
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
          if (infoData.membershipStatus === 'Pending') {
            setIsPendingMember(true);
            setIsLoading(false);
            return;
          }
          setError(infoData.error || t('community.failed_load'));
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

        // Fetch pending members if admin
        const role = infoData.community.myRole;
        if (role === 'Owner' || role === 'Admin') {
          const pendingResponse = await fetch(`${API_URL}/api/community/${slug}/pending-members`, {
            headers: { 'x-user': user.Tg_Username }
          });
          const pendingData = await pendingResponse.json();

          if (pendingResponse.ok) {
            setPendingMembers(pendingData.pendingMembers || []);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching community data:', err);
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

      // Redirect to communities page
      navigate('/my/communities');
    } catch (err) {
      console.error('Error leaving community:', err);
      alert(t('community.failed_leave'));
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner">⏳</div>
          <p style={{ marginTop: '20px', color: '#666' }}>{t('community.loading')}</p>
        </div>
      </PageLayout>
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
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', width: '100%', boxSizing: 'border-box' }}>
        <div className="content-card" style={{ padding: '2rem' }}>
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
                          onClick={() => handleRemoveMember(member.membershipId, member.username)}
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
                ))}
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
