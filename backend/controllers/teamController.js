const Team = require('../models/Team');
const User = require('../models/User');

// @desc    Get all teams for current user
// @route   GET /api/teams
// @access  Private
exports.getTeams = async (req, res) => {
    try {
        const teams = await Team.find({
            $or: [
                { owner: req.user._id },
                { 'members.user': req.user._id }
            ]
        }).populate('owner', 'firstName lastName email avatar')
            .populate('members.user', 'firstName lastName email avatar role')
            .populate('members.resourceAccess', 'name marketplace');

        res.status(200).json({
            success: true,
            count: teams.length,
            data: teams
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create new team
// @route   POST /api/teams
// @access  Private
exports.createTeam = async (req, res) => {
    try {
        req.body.owner = req.user._id;

        // Add owner as lead member
        req.body.members = [{
            user: req.user._id,
            role: 'lead'
        }];

        const team = await Team.create(req.body);

        // Update user's current team
        await User.findByIdAndUpdate(req.user._id, { currentTeam: team._id });

        res.status(201).json({
            success: true,
            data: team
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get team members
// @route   GET /api/teams/:id/members
// @access  Private
exports.getTeamMembers = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate({
                path: 'members.user',
                select: 'firstName lastName email avatar role isActive',
                populate: {
                    path: 'role',
                    select: 'displayName name color'
                }
            })
            .populate('members.resourceAccess', 'name marketplace');

        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        res.status(200).json({
            success: true,
            data: team.members
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update member in team
// @route   PUT /api/teams/:id/members/:userId
// @access  Private
exports.updateMember = async (req, res) => {
    try {
        const { role, resourceAccess } = req.body;
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        // Check if user is owner, lead, or admin
        const member = team.members.find(m => m.user.toString() === req.user._id.toString());
        const isLead = member && member.role === 'lead';

        if (team.owner.toString() !== req.user._id.toString() && !isLead && req.user.role.name !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Find member to update
        const memberIdx = team.members.findIndex(m => m.user.toString() === req.params.userId);
        if (memberIdx === -1) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        if (role) team.members[memberIdx].role = role;
        if (resourceAccess) team.members[memberIdx].resourceAccess = resourceAccess;

        await team.save();

        res.status(200).json({
            success: true,
            data: team.members[memberIdx]
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Add member to team
// @route   POST /api/teams/:id/members
// @access  Private
exports.addMember = async (req, res) => {
    try {
        const { email, userId, role, resourceAccess } = req.body;
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        // Check if user is owner, lead, or admin
        const member = team.members.find(m => m.user.toString() === req.user._id.toString());
        const isLead = member && member.role === 'lead';

        if (team.owner.toString() !== req.user._id.toString() && !isLead && req.user.role.name !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to add members' });
        }

        const userToAdd = userId ? await User.findById(userId) : await User.findOne({ email });

        if (!userToAdd) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if user is already a member
        const alreadyMember = team.members.find(m => m.user.toString() === userToAdd._id.toString());
        if (alreadyMember) {
            return res.status(400).json({ success: false, message: 'User is already a member' });
        }

        team.members.push({
            user: userToAdd._id,
            role: role || 'member',
            resourceAccess: resourceAccess || []
        });
        await team.save();

        res.status(200).json({
            success: true,
            message: 'Member added successfully',
            data: team
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Remove member from team
// @route   DELETE /api/teams/:id/members/:userId
// @access  Private
exports.removeMember = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        // Check if user is owner of team or admin
        if (team.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to remove members' });
        }

        // Cannot remove owner
        if (team.owner.toString() === req.params.userId) {
            return res.status(400).json({ success: false, message: 'Cannot remove team owner' });
        }

        team.members = team.members.filter(m => m.user.toString() !== req.params.userId);
        await team.save();

        res.status(200).json({
            success: true,
            message: 'Member removed successfully'
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update team
// @route   PUT /api/teams/:id
// @access  Private
exports.updateTeam = async (req, res) => {
    try {
        let team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        // Check if user is owner
        if (team.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        team = await Team.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: team
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete team
// @route   DELETE /api/teams/:id
// @access  Private
exports.deleteTeam = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);

        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        // Check if user is owner
        if (team.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await team.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Team deleted'
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
