const express = require('express');
const router = express.Router();
const {
    getTeams,
    createTeam,
    getTeamMembers,
    addMember,
    removeMember,
    updateMember,
    updateTeam,
    deleteTeam
} = require('../controllers/teamController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.route('/')
    .get(getTeams)
    .post(createTeam);

router.route('/:id')
    .put(updateTeam)
    .delete(deleteTeam);

router.route('/:id/members')
    .get(getTeamMembers)
    .post(addMember);

router.route('/:id/members/:userId')
    .put(updateMember)
    .delete(removeMember);

module.exports = router;
