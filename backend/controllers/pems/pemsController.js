const pemsService = require('../../services/pems/pemsService');
const { WORKFLOW_STATUSES, FREQUENCIES, CATEGORIES, PRIORITIES } = require('../../services/pems/workflowEngine');
const { canCreateTaskForSeller } = require('../../services/pems/pemsPolicy');
const { isGlobalUserRole } = require('../../utils/roleUtils');

function getUserId(req) { return req.user?.Id || req.user?._id; }
function getUserName(req) { return (`${req.user?.FirstName || ''} ${req.user?.LastName || ''}`).trim() || req.user?.Email; }

// ═══════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════

exports.createTemplate = async (req, res) => {
  try {
    const result = await pemsService.createTemplate({ ...req.body, createdBy: getUserId(req) });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('createTemplate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const result = await pemsService.getTemplates(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('getTemplates error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTemplateSummary = async (req, res) => {
  try {
    const summary = await pemsService.getTemplateSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const template = await pemsService.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err) {
    console.error('getTemplateById error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    await pemsService.updateTemplate(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('updateTemplate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    await pemsService.deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTemplate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Validate a (possibly unsaved) template configuration for publication.
 * Read-only: callers can check without persisting.
 */
exports.validateTemplate = async (req, res) => {
  try {
    const { template, assignmentRules } = req.body || {};
    const validation = pemsService.validateTemplateForPublish(template || {}, assignmentRules || {});
    res.json({ success: true, data: validation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Atomically save a template and its assignment rules. Either both persist or
 * neither does. Rejects (400) when the caller attempts to publish an invalid
 * configuration, and surfaces the field-level errors for the UI.
 */
exports.saveTemplateConfiguration = async (req, res) => {
  try {
    const { template, assignmentRules } = req.body || {};
    const id = req.params.id || req.body?.id || null;
    const result = await pemsService.saveTemplateConfig(
      { id, template: template || {}, assignmentRules: assignmentRules || {}, createdBy: getUserId(req) },
      req.user
    );
    res.json({ success: true, data: { id: result.id, taskCode: result.taskCode, created: result.created, validation: result.validation } });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message, validation: err.validation || null });
  }
};

// ═══════════════════════════════════════════════════════
// TASK INSTANCES
// ═══════════════════════════════════════════════════════

exports.createInstance = async (req, res) => {
  try {
    // A restricted user must not be able to open work against a seller they do
    // not own — that would put a task outside their scope in someone else's list.
    const sellerId = req.body?.sellerId || req.body?.SellerId || null;
    if (!canCreateTaskForSeller(req.user, sellerId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to the selected seller',
      });
    }

    // The assignee and reviewer must actually cover this seller, otherwise the
    // work is created for someone who can never see it. The UI already hides
    // other brands' people from the dropdowns; this closes the API so a
    // hand-built request cannot do the same thing.
    if (sellerId) {
      const targets = [
        ['assignee', req.body?.assignedTo || req.body?.AssignedTo],
        ['reviewer', req.body?.reviewerId || req.body?.ReviewerId],
      ];
      for (const [role, userId] of targets) {
        if (!userId) continue;
        const covers = await pemsService.userCoversSeller(userId, sellerId);
        if (!covers) {
          return res.status(403).json({
            success: false,
            error: `The selected ${role} does not work on this seller`,
          });
        }
      }
    }

    const result = await pemsService.createInstance(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('createInstance error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getInstances = async (req, res) => {
  try {
    // Requester passed through so the service can enforce seller-level scope.
    const result = await pemsService.getInstances(req.query, req.user);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('getInstances error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const data = await pemsService.addComment(req.params.id, req.body?.text, getUserId(req), getUserName(req) || req.user?.email);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.verifyFix = async (req, res) => {
  try {
    const data = await pemsService.verifyFix(req.params.id, getUserId(req), getUserName(req) || req.user?.email);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getInstanceById = async (req, res) => {
  try {
    // req.user is required: the service enforces seller scope and fails closed,
    // so omitting it would 404 every lookup. A task outside the caller's
    // sellers returns 404 rather than 403, so the id cannot be probed for
    // existence.
    const instance = await pemsService.getInstanceById(req.params.id, req.user);
    if (!instance) return res.status(404).json({ success: false, error: 'Instance not found' });
    res.json({ success: true, data: instance });
  } catch (err) {
    console.error('getInstanceById error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.transitionStatus = async (req, res) => {
  try {
    const { toStatus, details } = req.body;
    const result = await pemsService.transitionStatus(
      req.params.id, toStatus,
      getUserId(req), getUserName(req) || req.user?.email, req.user?.role,
      details
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('transitionStatus error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.bulkTransition = async (req, res) => {
  try {
    const { ids, toStatus, details } = req.body;
    const result = await pemsService.bulkTransition(
      ids, toStatus,
      getUserId(req), getUserName(req) || req.user?.email, req.user?.role,
      details,
      // Full requester: seller scope is enforced per task inside the service.
      req.user
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('bulkTransition error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateAchievement = async (req, res) => {
  try {
    const { achievement } = req.body;
    const result = await pemsService.updateAchievement(req.params.id, achievement);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('updateAchievement error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// ════════════════════════════════════════════════════════
// SUB TASKS & ACTIVITIES
// ═══════════════════════════════════════════════════════

exports.completeSubTask = async (req, res) => {
  try {
    await pemsService.completeSubTask(req.params.subTaskId, getUserId(req), getUserName(req) || req.user?.email);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.completeActivity = async (req, res) => {
  try {
    await pemsService.completeActivity(req.params.activityId, getUserId(req), getUserName(req) || req.user?.email);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ════════════════════════════════════════════════════════
// EVIDENCE
// ═══════════════════════════════════════════════════════

exports.uploadEvidence = async (req, res) => {
  try {
    const result = await pemsService.uploadEvidence({
      ...req.body,
      uploadedBy: getUserId(req),
      uploadedByName: getUserName(req) || req.user?.email,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ════════════════════════════════════════════════════════
// AFFECTED ASINS
// ════════════════════════════════════════════════════════

exports.getInstanceAsins = async (req, res) => {
  try {
    const data = await pemsService.getInstanceAsins(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getInstanceAsins error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateAsinRemarks = async (req, res) => {
  try {
    const { asinCode, sellerId, signalCode, remarks, resolution, waiveReason } = req.body || {};
    if (!asinCode || !sellerId || !signalCode) {
      return res.status(400).json({ success: false, error: 'asinCode, sellerId, signalCode required' });
    }
    const data = await pemsService.updateAsinRemarks(
      req.params.id, asinCode, sellerId, signalCode,
      remarks, resolution, waiveReason,
      getUserId(req), getUserName(req) || req.user?.email
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error('updateAsinRemarks error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.resolveAsin = async (req, res) => {
  try {
    const { action, waiveReason } = req.body || {};
    if (!action || !['resolve', 'waive'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be "resolve" or "waive"' });
    }
    if (action === 'waive' && !waiveReason) {
      return res.status(400).json({ success: false, error: 'waiveReason required when waiving' });
    }
    const data = await pemsService.resolveAsin(
      req.params.id, req.params.asinId,
      action, waiveReason,
      getUserId(req), getUserName(req) || req.user?.email
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error('resolveAsin error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// ════════════════════════════════════════════════════════
// REVIEWS
// ════════════════════════════════════════════════════════

const reviewActor = (req) => ({
  id: getUserId(req),
  name: getUserName(req) || req.user?.email,
  role: req.user?.role,
});

// Review + workflow transition (claim → record → decide) in ONE transaction.
exports.submitReview = async (req, res) => {
  try {
    const result = await pemsService.submitReviewAndTransition(req.body, reviewActor(req));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('submitReview error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.bulkReview = async (req, res) => {
  try {
    const { ids, decision, feedback, qualityScore } = req.body || {};
    const result = await pemsService.bulkReview(ids, { decision, feedback, qualityScore }, reviewActor(req), req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('bulkReview error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getMyDay = async (req, res) => {
  try {
    const data = await pemsService.getMyDay(req.user, req.query.userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getMyDay error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getReviewStats = async (req, res) => {
  try {
    const data = await pemsService.getReviewStats(req.user);
    res.json({ success: true, data });
  } catch (err) {
    console.error('getReviewStats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

exports.getDashboardKPIs = async (req, res) => {
  try {
    const kpis = await pemsService.getDashboardKPIs(req.query, req.user);
    res.json({ success: true, data: kpis });
  } catch (err) {
    console.error('getDashboardKPIs error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSellerPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getSellerPerformance(req.query, req.user);
    res.json({ success: true, data: perf });
  } catch (err) {
    console.error('getSellerPerformance error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.refreshSLA = async (req, res) => {
  try {
    const result = await pemsService.refreshSLAStatuses();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// V2: NOTIFICATIONS
// ══════════════════════════════════════════════════════

exports.getNotifications = async (req, res) => {
  try {
    // Notifications carry task titles and seller names, so a ?userId override
    // let any user read anyone else's feed via IDOR. Only global roles may look
    // at another user's notifications; everyone else is pinned to their own.
    const callerId = getUserId(req);
    const role = String(req.user?.role?.name || req.user?.role || '').toLowerCase();
    const userId = callerId && (!req.query.userId || String(req.query.userId) === String(callerId))
      ? callerId
      : (isGlobalUserRole(role) ? req.query.userId : callerId);
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await pemsService.getNotifications(userId, unreadOnly);
    const unreadCount = await pemsService.getUnreadCount(userId);
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await pemsService.markNotificationRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = getUserId(req);
    await pemsService.markAllRead(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// V2: ANALYTICS & DEPARTMENTS
// ══════════════════════════════════════════════════════

exports.getDepartmentPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getDepartmentPerformance(req.query, req.user);
    res.json({ success: true, data: perf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBrandManagerPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getBrandManagerPerformance(req.query, req.user);
    res.json({ success: true, data: perf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getReviewerPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getReviewerPerformance(req.query, req.user);
    res.json({ success: true, data: perf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getRiskPanel = async (req, res) => {
  try {
    const risk = await pemsService.getRiskPanel(req.user);
    res.json({ success: true, data: risk });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTopPerformers = async (req, res) => {
  try {
    const performers = await pemsService.getTopPerformers(req.user);
    res.json({ success: true, data: performers });
  } catch (err) {
    console.error('getTopPerformers error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.checkEscalations = async (req, res) => {
  try {
    const result = await pemsService.checkEscalations();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// V2: DYNAMIC DATA SOURCES
// ══════════════════════════════════════════════════════

exports.getAutomationStats = async (req, res) => {
  try {
    // Seller-scoped: this drives a dashboard tile, so an unscoped count would
    // expose other sellers' automation volume.
    const stats = await pemsService.getAutomationStats(req.query, req.user);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('getAutomationStats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSellers = async (req, res) => {
  try {
    const sellers = await pemsService.getSellersForPEMS(req.query.marketplace, req.user);
    res.json({ success: true, data: sellers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBrandManagers = async (req, res) => {
  try {
    // sellerId narrows the list to that brand's own people. The service clamps
    // it to the caller's own sellers, so passing someone else's id returns [].
    const managers = await pemsService.getBrandManagersForPEMS(req.user, req.query.sellerId);
    res.json({ success: true, data: managers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getReviewers = async (req, res) => {
  try {
    const reviewers = await pemsService.getReviewersForPEMS(req.user, req.query.sellerId);
    res.json({ success: true, data: reviewers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getFilterOptions = async (req, res) => {
  res.json({
    success: true,
    data: {
      frequencies: Object.values(require('../../services/pems/workflowEngine').FREQUENCIES),
      categories: Object.values(require('../../services/pems/workflowEngine').CATEGORIES),
      priorities: Object.values(require('../../services/pems/workflowEngine').PRIORITIES),
      statuses: Object.values(require('../../services/pems/workflowEngine').WORKFLOW_STATUSES),
      departments: Object.values(require('../../services/pems/workflowEngine').DEPARTMENTS),
      targetTypes: Object.values(require('../../services/pems/workflowEngine').TARGET_TYPES),
      complexityLevels: Object.values(require('../../services/pems/workflowEngine').COMPLEXITY_LEVELS),
      approvalLevels: Object.values(require('../../services/pems/workflowEngine').APPROVAL_LEVELS),
      autoAssignStrategies: Object.values(require('../../services/pems/workflowEngine').AUTO_ASSIGN_STRATEGIES),
    }
  });
};

// ════════════════════════════════════════════════════════
// V3: TEMPLATE DETAIL ANALYTICS
// ═══════════════════════════════════════════════════════

exports.getTemplateDetail = async (req, res) => {
  try {
    const template = await pemsService.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    const analytics = await pemsService.getTemplateAnalytics(req.params.id);
    const rules = await pemsService.getAssignmentRules(req.params.id);
    res.json({ success: true, data: { ...template, analytics, assignmentRules: rules } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.upsertAssignmentRules = async (req, res) => {
  try {
    await pemsService.upsertAssignmentRules(req.params.templateId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.recalculateProgress = async (req, res) => {
  try {
    const result = await pemsService.recalculateAllWeightedProgress();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// NOTE: an unscoped duplicate of getAutomationStats used to live here. Because
// it was defined *after* the seller-scoped version above, it silently replaced it
// on `exports`, and its `require('../../config/db')` pointed at a path that does
// not exist (the real module is database/db) — which is what surfaced to the UI
// as a 500 on /api/pems/automation-stats.

// ── Daily routine (Daily Operations Master import + generation) ──
exports.importDailyOps = async (req, res) => {
  try {
    const routineService = require('../../services/pems/routineService');
    const { rows, overrides, dryRun, generateNow } = req.body || {};
    const data = await routineService.importDailyOps({
      rows, overrides: overrides || {}, dryRun: dryRun !== false, generateNow: generateNow !== false, userId: getUserId(req),
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('importDailyOps error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.generateRoutineToday = async (req, res) => {
  try {
    const routineService = require('../../services/pems/routineService');
    const data = await routineService.generateToday({ templateId: req.body?.templateId });
    res.json({ success: true, data });
  } catch (err) {
    console.error('generateRoutineToday error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.setBrandCheck = async (req, res) => {
  try {
    const { completed, note } = req.body || {};
    if (typeof completed !== 'boolean') return res.status(400).json({ success: false, message: '"completed" (true/false) is required' });
    const data = await pemsService.setBrandCheck(req.params.id, req.params.brandId, completed, getUserId(req), note);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};