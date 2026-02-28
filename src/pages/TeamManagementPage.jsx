import React, { useState, useEffect } from 'react';
import {
    Users, UserPlus, Loader2, Mail
} from 'lucide-react';
import {
    Modal, ModalHeader, ModalBody, ModalFooter,
    Button, Form, FormGroup, Label, Input, Alert,
    Badge
} from 'reactstrap';
import api from '../services/api';

const CategoryPill = ({ label, color }) => (
    <Badge
        style={{
            backgroundColor: `${color}15`,
            color: color,
            border: `1px solid ${color}30`,
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: '600'
        }}
    >
        {label}
    </Badge>
);

const TeamManagementPage = () => {
    const [teams, setTeams] = useState([]);
    const [activeTeam, setActiveTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [memberModalOpen, setMemberModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', website: '', description: '' });
    const [memberData, setMemberData] = useState({ email: '' });
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTeams();
    }, []);

    useEffect(() => {
        if (activeTeam) {
            fetchMembers(activeTeam._id);
        }
    }, [activeTeam]);

    const fetchTeams = async () => {
        try {
            setLoading(true);
            const res = await api.get('/teams');
            const teamData = res.data.data || [];
            setTeams(teamData);
            if (teamData.length > 0 && !activeTeam) {
                setActiveTeam(teamData[0]);
            }
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch teams');
            setLoading(false);
        }
    };

    const fetchMembers = async (teamId) => {
        try {
            const res = await api.get(`/teams/${teamId}/members`);
            setMembers(res.data.data || []);
        } catch (err) {
            setError('Failed to fetch members');
        }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post('/teams', formData);
            setTeams([...teams, res.data.data]);
            setActiveTeam(res.data.data);
            setModalOpen(false);
            setFormData({ name: '', website: '', description: '' });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create team');
        } finally {
            setSaving(false);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/teams/${activeTeam._id}/members`, memberData);
            fetchMembers(activeTeam._id);
            setMemberModalOpen(false);
            setMemberData({ email: '' });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add member');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;
        try {
            await api.delete(`/teams/${activeTeam._id}/members/${userId}`);
            setMembers(members.filter(m => m.user._id !== userId));
        } catch (err) {
            setError('Failed to remove member');
        }
    };

    return (
        <div className="container-fluid py-4 bg-white" style={{ minHeight: '100vh' }}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-5">
                <div>
                    <h3 className="fw-bold mb-1" style={{ color: '#0f172a' }}>Team management</h3>
                    <p className="text-muted small mb-0">Manage your teams and user permissions.</p>
                </div>
                <div className="d-flex gap-3">
                    <button
                        className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3 fw-semibold border-0 hover-bg-light"
                        style={{ borderRadius: '10px' }}
                        onClick={() => { setFormData({ name: '', website: '', description: '' }); setModalOpen(true); }}
                    >
                        Create new team
                    </button>
                    <button
                        className="btn btn-primary d-flex align-items-center gap-2 px-3 fw-semibold shadow-sm"
                        style={{ borderRadius: '10px', backgroundColor: '#7F56D9', border: 'none' }}
                        onClick={() => setMemberModalOpen(true)}
                        disabled={!activeTeam}
                    >
                        <UserPlus size={18} /> Add team member
                    </button>
                </div>
            </div>

            {error && (
                <Alert color="danger" className="border-0 shadow-sm mb-4" toggle={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Teams Section */}
            <div className="mb-5">
                <div className="mb-3">
                    <h5 className="fw-bold mb-1" style={{ color: '#0f172a' }}>Teams</h5>
                    <p className="text-muted smallest">You're on the following teams. You can create a new team here.</p>
                </div>

                <div className="card border-0">
                    <div className="card-body p-0">
                        <div className="mb-2">
                            <span className="text-muted smallest fw-bold text-uppercase tracking-wider">On teams</span>
                            <p className="text-muted smallest">You're currently on these teams.</p>
                        </div>

                        <div className="list-group list-group-flush border-top">
                            {loading ? (
                                <div className="py-4 text-center">
                                    <Loader2 className="spin text-primary" size={24} />
                                    <p className="smallest text-muted mt-2">Loading teams...</p>
                                </div>
                            ) : (
                                (teams || []).length > 0 ? (
                                    (teams || []).filter(t => t).map(team => (
                                        <div
                                            key={team?._id}
                                            className={`list-group-item border-0 py-3 px-0 d-flex justify-content-between align-items-center cursor-pointer transition-all ${activeTeam?._id === team?._id ? 'bg-light-opacity' : ''}`}
                                            onClick={() => setActiveTeam(team)}
                                        >
                                            <div className="d-flex align-items-center gap-3">
                                                <div
                                                    className={`rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm`}
                                                    style={{ width: '40px', height: '40px', backgroundColor: '#344054' }}
                                                >
                                                    {team.name ? team.name.charAt(0) : 'T'}
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark mb-0">{team.name}</div>
                                                    <div className="smallest text-muted">{team.website || 'No website'}</div>
                                                </div>
                                            </div>
                                            <button className="btn btn-link text-decoration-none text-muted smallest fw-bold hover-bg-light px-3 py-2 rounded">
                                                Leave
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-4 text-center text-muted smallest">No teams found. Create one to get started.</div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Your Team Section */}
            {activeTeam && (
                <div className="mt-5">
                    <div className="mb-4">
                        <h5 className="fw-bold mb-1" style={{ color: '#0f172a' }}>Your team</h5>
                        <p className="text-muted smallest">Manage your existing team and change roles/permissions.</p>
                    </div>

                    <div className="card border shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4 py-3 text-muted smallest fw-bold text-uppercase tracking-wider">Name</th>
                                        <th className="py-3 text-muted smallest fw-bold text-uppercase tracking-wider">Email</th>
                                        <th className="pe-4 py-3 text-muted smallest fw-bold text-uppercase tracking-wider text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(members || []).filter(m => m && m.user).length > 0 ? (
                                        (members || []).filter(m => m && m.user).map(member => (
                                            <tr key={member?._id}>
                                                <td className="ps-4 py-3">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div
                                                            className="rounded-circle overflow-hidden bg-light d-flex align-items-center justify-content-center"
                                                            style={{ width: '40px', height: '40px' }}
                                                        >
                                                            {member.user && member.user.avatar ? (
                                                                <img src={member.user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <span className="fw-bold text-muted smallest">
                                                                    {member.user && member.user.firstName ? member.user.firstName.charAt(0) : ''}
                                                                    {member.user && member.user.lastName ? member.user.lastName.charAt(0) : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark smallest mb-0">
                                                                {member.user ? `${member.user.firstName} ${member.user.lastName}` : 'Unknown User'}
                                                            </div>
                                                            {member.user && member.user.role && (
                                                                <CategoryPill label={member.user.role.displayName} color={member.user.role.color || '#667085'} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <span className="text-muted smallest">{member.user ? member.user.email : ''}</span>
                                                </td>
                                                <td className="pe-4 py-3 text-end">
                                                    <div className="d-flex justify-content-end gap-3">
                                                        <button
                                                            className="btn btn-link text-decoration-none text-danger smallest fw-bold p-0"
                                                            onClick={() => handleRemoveMember(member?.user?._id)}
                                                        >
                                                            Delete
                                                        </button>
                                                        <button className="btn btn-link text-decoration-none text-primary smallest fw-bold p-0">
                                                            Edit
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="3" className="text-center py-4 text-muted smallest">
                                                No members found in this team.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Team Modal */}
            <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} centered contentClassName="border-0 shadow-lg rounded-4">
                <ModalHeader toggle={() => setModalOpen(false)} className="border-0 px-4 pt-4">
                    <span className="fw-bold h5">Create New Team</span>
                </ModalHeader>
                <Form onSubmit={handleCreateTeam}>
                    <ModalBody className="p-4 pt-2">
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Team Name</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Catalog"
                                className="py-2 px-3 border-light-gray"
                                required
                            />
                        </FormGroup>
                        <FormGroup className="mb-3">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Website</Label>
                            <Input
                                value={formData.website}
                                onChange={e => setFormData({ ...formData, website: e.target.value })}
                                placeholder="e.g. catalogapp.io"
                                className="py-2 px-3 border-light-gray"
                            />
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter className="border-0 px-4 pb-4 pt-0">
                        <Button color="link" onClick={() => setModalOpen(false)} className="text-decoration-none text-muted smallest fw-bold me-2">Cancel</Button>
                        <Button color="primary" type="submit" disabled={saving} className="fw-bold px-4" style={{ backgroundColor: '#7F56D9', border: 'none' }}>
                            {saving ? <Loader2 className="spin" size={16} /> : 'Create team'}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>

            {/* Add Member Modal */}
            <Modal isOpen={memberModalOpen} toggle={() => setMemberModalOpen(false)} centered contentClassName="border-0 shadow-lg rounded-4">
                <ModalHeader toggle={() => setMemberModalOpen(false)} className="border-0 px-4 pt-4">
                    <span className="fw-bold h5">Add Team Member</span>
                </ModalHeader>
                <Form onSubmit={handleAddMember}>
                    <ModalBody className="p-4 pt-2">
                        <FormGroup className="mb-0">
                            <Label className="smallest fw-bold text-muted text-uppercase mb-2">Email Address</Label>
                            <div className="position-relative">
                                <Mail className="position-absolute text-muted" size={18} style={{ left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <Input
                                    type="email"
                                    value={memberData.email}
                                    onChange={e => setMemberData({ ...memberData, email: e.target.value })}
                                    placeholder="olivia@untitledui.com"
                                    className="py-2 ps-5 border-light-gray"
                                    required
                                />
                            </div>
                        </FormGroup>
                    </ModalBody>
                    <ModalFooter className="border-0 px-4 pb-4 pt-0">
                        <Button color="link" onClick={() => setMemberModalOpen(false)} className="text-decoration-none text-muted smallest fw-bold me-2">Cancel</Button>
                        <Button color="primary" type="submit" disabled={saving} className="fw-bold px-4" style={{ backgroundColor: '#7F56D9', border: 'none' }}>
                            {saving ? <Loader2 className="spin" size={16} /> : 'Invite member'}
                        </Button>
                    </ModalFooter>
                </Form>
            </Modal>

            <style>{`
                .smallest { font-size: 13px; }
                .tracking-wider { letter-spacing: 0.05em; }
                .cursor-pointer { cursor: pointer; }
                .transition-all { transition: all 0.2s ease; }
                .bg-light-opacity { background-color: rgba(0,0,0,0.02); }
                .border-light-gray { border: 1px solid #D0D5DD; border-radius: 8px; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .btn-link:hover { opacity: 0.8; }
                .hover-bg-light:hover { background-color: #F9FAFB !important; }
            `}</style>
        </div>
    );
};

export default TeamManagementPage;
