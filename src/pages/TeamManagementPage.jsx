import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, UserPlus, Loader2, Mail, Shield, Settings, Activity,
    MoreHorizontal, Check, X, ShieldAlert, Award, ChevronRight,
    ExternalLink, Globe, Info, Search, Filter, Plus, Trash2, Edit2
} from 'lucide-react';
import {
    Modal, ModalHeader, ModalBody, ModalFooter,
    Button, Form, FormGroup, Label, Input, Alert,
    Badge, Nav, NavItem, NavLink, TabContent, TabPane
} from 'reactstrap';
import api, { userApi } from '../services/api';
import ListView from '../components/common/ListView';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Popover from '../components/common/Popover';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const TeamManagementPage = () => {
    const [teams, setTeams] = useState([]);
    const [activeTeam, setActiveTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('members');

    // Modals
    const [createTeamModal, setCreateTeamModal] = useState(false);
    const [addMemberModal, setAddMemberModal] = useState(false);
    const [editTeamModal, setEditTeamModal] = useState(false);

    // Form States
    const [teamForm, setTeamForm] = useState({ name: '', description: '' });
    const [memberForm, setMemberForm] = useState({ userId: '', role: 'member', resourceAccess: [] });

    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchSellers = useCallback(async () => {
        try {
            const res = await api.get('/sellers');
            const sellersData = res.data?.sellers || res.data || [];
            setSellers(Array.isArray(sellersData) ? sellersData : []);
        } catch (err) {
            console.error('Failed to fetch sellers:', err);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await userApi.getAll({ limit: 100 });
            const userData = res.data?.users || res.data || res || [];
            setAvailableUsers(Array.isArray(userData) ? userData : []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    }, []);

    const fetchTeams = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/teams');
            const teamData = res.data || [];
            setTeams(teamData);
            if (teamData.length > 0 && !activeTeam) {
                setActiveTeam(teamData[0]);
            }
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch teams');
            setLoading(false);
        }
    }, [activeTeam]);

    const fetchMembers = useCallback(async (teamId) => {
        try {
            const res = await api.get(`/teams/${teamId}/members`);
            setMembers(res.data || []);
        } catch (err) {
            setError('Failed to fetch members');
        }
    }, []);

    useEffect(() => {
        fetchTeams();
        fetchSellers();
        fetchUsers();
    }, [fetchTeams, fetchSellers, fetchUsers]);

    useEffect(() => {
        if (activeTeam) {
            fetchMembers(activeTeam._id);
        }
    }, [activeTeam, fetchMembers]);

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post('/teams', teamForm);
            setTeams([...teams, res.data]);
            setActiveTeam(res.data);
            setCreateTeamModal(false);
            setTeamForm({ name: '', description: '' });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create team');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.put(`/teams/${activeTeam._id}`, {
                name: teamForm.name,
                description: teamForm.description
            });
            setTeams(teams.map(t => t._id === res.data._id ? res.data : t));
            setActiveTeam(res.data);
            setEditTeamModal(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update team');
        } finally {
            setSaving(false);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/teams/${activeTeam._id}/members`, memberForm);
            fetchMembers(activeTeam._id);
            setAddMemberModal(false);
            setMemberForm({ userId: '', role: 'member', resourceAccess: [] });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add member');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateMember = async (userId, data) => {
        try {
            await api.put(`/teams/${activeTeam._id}/members/${userId}`, data);
            fetchMembers(activeTeam._id);
        } catch (err) {
            setError('Failed to update member');
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;
        try {
            await api.delete(`/teams/${activeTeam._id}/members/${userId}`);
            setMembers(members.filter(m => m.user?._id !== userId));
        } catch (err) {
            setError('Failed to remove member');
        }
    };

    const toggleTab = tab => {
        if (activeTab !== tab) setActiveTab(tab);
    };

    if (loading && teams.length === 0) { return <PageLoader message="Loading Teams..." />; }

    const breadcrumbItems = [
        { label: 'Home', route: '/', icon: Globe },
        { label: 'Team Hub', route: '/team-management', icon: Users },
        { label: activeTeam ? activeTeam.name : 'Select Team', icon: Award }
    ];

    return (
         <div className="team-hub-container bg-white" style={{ minHeight: '100vh' }}>
             {loading && (
               <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                 <LoadingIndicator type="line-simple" size="md" />
               </div>
             )}
             {/* Header & Breadcrumbs */}
             <div className="px-4 py-3 border-bottom sticky-top bg-white z-index-10">
                <Breadcrumbs items={breadcrumbItems} className="mb-2" />
                <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="rounded-4 d-flex align-items-center justify-content-center shadow-sm"
                            style={{
                                width: '48px', height: '48px',
                                background: 'linear-gradient(135deg, #7F56D9 0%, #6941C6 100%)',
                                color: 'white'
                            }}
                        >
                            <Users size={24} />
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0 text-dark">{activeTeam?.name}</h4>
                            <div className="d-flex align-items-center gap-2 smallest text-muted">
                                <Users size={12} />
                                <span>{members.length} Members</span>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        {activeTeam && (
                            <>
                                <Button
                                    color="white"
                                    className="btn-outline-secondary d-flex align-items-center gap-2 border shadow-sm fw-semibold"
                                    style={{ borderRadius: '10px' }}
                                    onClick={() => {
                                        setTeamForm({
                                            name: activeTeam.name,
                                            description: activeTeam.description || ''
                                        });
                                        setEditTeamModal(true);
                                    }}
                                >
                                    <Settings size={18} /> Team Settings
                                </Button>
                                <Button
                                    color="primary"
                                    className="d-flex align-items-center gap-2 shadow-sm fw-semibold"
                                    style={{ borderRadius: '10px', backgroundColor: '#7F56D9', border: 'none' }}
                                    onClick={() => setAddMemberModal(true)}
                                >
                                    <Plus size={18} /> Add Member
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="container-fluid py-4">
                {/* Team Switcher Horizontal */}
                <div className="d-flex gap-2 mb-4 overflow-auto pb-2 no-scrollbar">
                    {teams.map((team, index) => (
                        <div
                            key={team?._id || index}
                            onClick={() => setActiveTeam(team)}
                            className={`px-3 py-2 rounded-3 border cursor-pointer transition-all d-flex align-items-center gap-2 flex-shrink-0 ${activeTeam?._id === team?._id ? 'border-primary bg-primary-subtle text-primary border-2 shadow-sm' : 'border-light bg-light-subtle text-muted hover-bg-light'}`}
                        >
                            <div className={`rounded-circle smallest fw-bold d-flex align-items-center justify-content-center ${activeTeam?._id === team?._id ? 'bg-primary text-white' : 'bg-secondary-subtle text-muted'}`} style={{ width: '20px', height: '20px' }}>
                                {team?.name?.charAt(0) || '?'}
                            </div>
                            <span className="smallest fw-bold">{team?.name}</span>
                        </div>
                    ))}
                    <button
                        className="btn btn-outline-dashed btn-sm d-flex align-items-center gap-2 px-3 border-2"
                        style={{ borderRadius: '10px', borderStyle: 'dashed' }}
                        onClick={() => { setTeamForm({ name: '', description: '' }); setCreateTeamModal(true); }}
                    >
                        <Plus size={14} /> New Team
                    </button>
                </div>

                {error && <Alert color="danger" className="border-0 shadow-sm rounded-3 mb-4">{error}</Alert>}

                {!activeTeam && !loading && (
                    <div className="text-center py-5 bg-white rounded-4 shadow-sm border mx-auto" style={{ maxWidth: '600px', marginTop: '100px' }}>
                        <Users size={64} className="text-muted opacity-20 mb-4" />
                        <h4 className="fw-bold text-dark">Welcome to Team Hub</h4>
                        <p className="text-muted mb-4 px-5">Establish your first team to start managing performance, members, and resources in one premium workspace.</p>
                        <Button
                            color="primary"
                            className="px-4 py-2 shadow-sm fw-bold d-inline-flex align-items-center gap-2"
                            style={{ borderRadius: '10px', backgroundColor: '#7F56D9', border: 'none' }}
                            onClick={() => { setTeamForm({ name: '', description: '' }); setCreateTeamModal(true); }}
                        >
                            <Plus size={20} /> Create Your First Team
                        </Button>
                    </div>
                )}

                {activeTeam && (
                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                        <div className="card-header bg-white border-bottom p-0">
                            <Nav tabs className="border-0 px-4 pt-2 gap-4">
                                {['members', 'roles', 'activity', 'overview'].map(tab => (
                                    <NavItem key={tab}>
                                        <NavLink
                                            className={`px-0 py-3 border-0 smallest fw-bold transition-all cursor-pointer ${activeTab === tab ? 'text-primary border-bottom border-primary border-3' : 'text-muted opacity-70 hover-opacity-100'}`}
                                            active={activeTab === tab}
                                            onClick={() => toggleTab(tab)}
                                            style={{ textTransform: 'capitalize' }}
                                        >
                                            {tab === 'members' && <Users size={16} className="me-2" />}
                                            {tab === 'roles' && <Shield size={16} className="me-2" />}
                                            {tab === 'activity' && <Activity size={16} className="me-2" />}
                                            {tab === 'overview' && <Info size={16} className="me-2" />}
                                            {tab}
                                        </NavLink>
                                    </NavItem>
                                ))}
                            </Nav>
                        </div>
                        <div className="card-body p-0">
                            <TabContent activeTab={activeTab}>
                                <TabPane tabId="members">
                                    <ListView
                                        columns={[
                                            {
                                                label: 'Member',
                                                key: 'user',
                                                width: '35%',
                                                render: (user, row) => (
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="avatar shadow-sm rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                            style={{ width: '40px', height: '40px', backgroundColor: user?.role?.color || '#667085' }}>
                                                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark smallest">{user?.firstName} {user?.lastName}</div>
                                                            <div className="smallest text-muted">{user?.email}</div>
                                                        </div>
                                                    </div>
                                                )
                                            },
                                            {
                                                label: 'Team Role',
                                                key: 'role',
                                                width: '15%',
                                                render: (role) => (
                                                    <Badge color={role === 'lead' ? 'primary' : 'light'} className="rounded-pill px-3 py-1 fw-bold text-uppercase smallest" style={{ fontSize: '10px' }}>
                                                        {role === 'lead' ? <Award size={10} className="me-1" /> : null}
                                                        {role}
                                                    </Badge>
                                                )
                                            },
                                            {
                                                label: 'Access Scope',
                                                key: 'resourceAccess',
                                                width: '30%',
                                                render: (resources) => (
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {resources?.length > 0 ? resources.map((r, i) => (
                                                            <Badge key={r?._id || i} color="light" className="text-muted border px-2 py-1 smallest fw-medium">
                                                                {r?.name}
                                                            </Badge>
                                                        )) : <span className="text-muted smallest italic">Full Access</span>}
                                                    </div>
                                                )
                                            }
                                        ]}
                                        rows={members}
                                        rowKey="_id"
                                        options={{ selectable: true }}
                                        actions={(row) => (
                                            <div className="d-flex gap-2">
                                                <button className="btn btn-icon btn-light border btn-sm" title="Edit Access">
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-light border btn-sm text-danger"
                                                    onClick={() => handleRemoveMember(row.user?._id)}
                                                    title="Remove Member"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                        emptyMessage="No members in this team yet."
                                    />
                                </TabPane>

                                <TabPane tabId="roles">
                                    <div className="p-5 text-center text-muted">
                                        <ShieldAlert size={48} className="mb-3 opacity-20" />
                                        <h5>Role Management</h5>
                                        <p className="smallest">Define team-specific permissions and management hierarchies. This section is currently being integrated with global roles.</p>
                                    </div>
                                </TabPane>

                                <TabPane tabId="activity">
                                    <div className="p-5 text-center text-muted">
                                        <Activity size={48} className="mb-3 opacity-20" />
                                        <h5>Team Activity Audit</h5>
                                        <p className="smallest">Track all changes made to this team and its membership.</p>
                                    </div>
                                </TabPane>

                                <TabPane tabId="overview">
                                    <div className="p-4">
                                        <div className="row g-4">
                                            <div className="col-md-8">
                                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                                    <Info size={18} className="text-primary" /> About {activeTeam?.name}
                                                </h6>
                                                <p className="text-muted small lh-lg">
                                                    {activeTeam?.description || 'No description provided for this team. Add one in Team Settings to help members understand their objectives.'}
                                                </p>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="card bg-light border-0 rounded-4">
                                                    <div className="card-body">
                                                        <h6 className="fw-bold smallest text-uppercase tracking-wider mb-3">Quick Stats</h6>
                                                        <div className="d-flex flex-column gap-3">
                                                            <div className="d-flex justify-content-between border-bottom pb-2">
                                                                <span className="smallest text-muted">Members</span>
                                                                <span className="smallest fw-bold text-dark">{members.length}</span>
                                                            </div>
                                                            <div className="d-flex justify-content-between border-bottom pb-2">
                                                                <span className="smallest text-muted">Leads</span>
                                                                <span className="smallest fw-bold text-primary">{members.filter(m => m.role === 'lead').length}</span>
                                                            </div>
                                                            <div className="d-flex justify-content-between">
                                                                <span className="smallest text-muted">Resources</span>
                                                                <span className="smallest fw-bold text-dark">{activeTeam?.resourceAccess?.length || 0}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabPane>
                            </TabContent>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Team Modal */}
            <Modal isOpen={createTeamModal} toggle={() => setCreateTeamModal(false)} centered contentClassName="border-0 shadow-lg rounded-4">
                <ModalHeader toggle={() => setCreateTeamModal(false)} className="border-0 px-4 pt-4">
                    <span className="fw-bold h5">Establish New Team</span>
                </ModalHeader>
                <Form onSubmit={handleCreateTeam}>
                    <ModalBody className="p-4 pt-2">
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Team Identity</Label>
                            <Input
                                value={teamForm.name}
                                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                                placeholder="e.g. Amazon SEO Ops"
                                className="py-2 border-0 bg-light"
                                required
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Purpose / Description</Label>
                            <Input
                                type="textarea"
                                value={teamForm.description}
                                onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
                                placeholder="Briefly describe the team's mission..."
                                className="py-2 border-0 bg-light"
                                rows="3"
                            />
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter className="border-0 px-4 pb-4 pt-0">
                        <Button color="link" onClick={() => setCreateTeamModal(false)} className="text-decoration-none text-muted smallest fw-bold me-2">Cancel</Button>
                        <Button color="primary" type="submit" disabled={saving} className="fw-bold px-4 shadow" style={{ backgroundColor: '#7F56D9', border: 'none', borderRadius: '10px' }}>
                            {saving ? <Loader2 className="spin" size={16} /> : 'Establish Team'}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>

            {/* Edit Team Modal */}
            <Modal isOpen={editTeamModal} toggle={() => setEditTeamModal(false)} centered contentClassName="border-0 shadow-lg rounded-4">
                <ModalHeader toggle={() => setEditTeamModal(false)} className="border-0 px-4 pt-4">
                    <span className="fw-bold h5">Team Settings</span>
                </ModalHeader>
                <Form onSubmit={handleUpdateTeam}>
                    <ModalBody className="p-4 pt-2">
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Team Name</Label>
                            <Input
                                value={teamForm.name}
                                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                                className="py-2 border-0 bg-light"
                                required
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Purpose / Description</Label>
                            <Input
                                type="textarea"
                                value={teamForm.description}
                                onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
                                rows="3"
                                className="py-2 border-0 bg-light"
                            />
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter className="border-0 px-4 pb-4 pt-0">
                        <Button color="link" onClick={() => setEditTeamModal(false)} className="text-decoration-none text-muted smallest fw-bold me-2">Cancel</Button>
                        <Button color="primary" type="submit" disabled={saving} className="fw-bold px-4 shadow" style={{ backgroundColor: '#7F56D9', border: 'none', borderRadius: '10px' }}>
                            {saving ? <Loader2 className="spin" size={16} /> : 'Save Changes'}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>

            {/* Add Member Modal */}
            <Modal isOpen={addMemberModal} toggle={() => setAddMemberModal(false)} centered contentClassName="border-0 shadow-lg rounded-4">
                <ModalHeader toggle={() => setAddMemberModal(false)} className="border-0 px-4 pt-4">
                    <span className="fw-bold h5">Invite Team Member</span>
                </ModalHeader>
                <Form onSubmit={handleAddMember}>
                    <ModalBody className="p-4 pt-2">
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Select User</Label>
                            <div className="position-relative">
                                <Users className="position-absolute text-muted" size={16} style={{ left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <Input
                                    type="select"
                                    value={memberForm.userId}
                                    onChange={e => setMemberForm({ ...memberForm, userId: e.target.value })}
                                    className="py-2 ps-5 border-0 bg-light fs-7"
                                    required
                                >
                                    <option value="">Select a user...</option>
                                    {availableUsers.map(u => (
                                        <option key={u._id} value={u._id}>
                                            {u.firstName} {u.lastName} ({u.email})
                                        </option>
                                    ))}
                                </Input>
                            </div>
                        </FormGroup>
                        <div className="row g-3 mb-3">
                            <div className="col-md-6">
                                <Label className="smallest fw-bold text-muted text-uppercase mb-2">Authority Level</Label>
                                <Input
                                    type="select"
                                    value={memberForm.role}
                                    onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}
                                    className="py-2 border-0 bg-light fs-7"
                                >
                                    <option value="member">Team Member</option>
                                    <option value="lead">Team Lead</option>
                                </Input>
                            </div>
                        </div>
                        <FormGroup>
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Data Access (Sellers)</Label>
                            <div className="border-0 bg-light rounded-3 p-3 overflow-auto no-scrollbar" style={{ maxHeight: '150px' }}>
                                {Array.isArray(sellers) && sellers.map((seller, idx) => (
                                    <div key={seller?._id || idx} className="form-check mb-2">
                                        <Input
                                            type="checkbox"
                                            id={`seller-${seller?._id || idx}`}
                                            checked={memberForm.resourceAccess.includes(seller?._id)}
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setMemberForm(prev => ({
                                                    ...prev,
                                                    resourceAccess: checked
                                                        ? [...prev.resourceAccess, seller?._id]
                                                        : prev.resourceAccess.filter(id => id !== seller?._id)
                                                }));
                                            }}
                                            className="cursor-pointer"
                                        />
                                        <Label for={`seller-${seller?._id || idx}`} className="smallest cursor-pointer ms-2">{seller?.name}</Label>
                                    </div>
                                ))}
                                {sellers.length === 0 && <span className="smallest text-muted italic">No sellers available</span>}
                            </div>
                            <p className="smallest text-muted mt-2 mb-0">Empty selection grants access to all team resources.</p>
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter className="border-0 px-4 pb-4 pt-0">
                        <Button color="link" onClick={() => setAddMemberModal(false)} className="text-decoration-none text-muted smallest fw-bold me-2">Cancel</Button>
                        <Button color="primary" type="submit" disabled={saving} className="fw-bold px-4 shadow" style={{ backgroundColor: '#7F56D9', border: 'none', borderRadius: '10px' }}>
                            {saving ? <Loader2 className="spin" size={16} /> : 'Send Invite'}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>

            <style>{`
                .team-hub-container {
                    background-color: #fcfcfd;
                }
                .smallest { font-size: 13px; }
                .tracking-wider { letter-spacing: 0.05em; }
                .cursor-pointer { cursor: pointer; }
                .transition-all { transition: all 0.2s ease-in-out; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .hover-bg-light:hover { background-color: #f9fafb !important; }
                .hover-opacity-100:hover { opacity: 1 !important; }
                .z-index-10 { z-index: 10; }
                .btn-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 8px; }
            `}</style>
        </div>
    );
};

export default TeamManagementPage;
