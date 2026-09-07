/**
 * TaskFlow Controller
 * REST API endpoints for the new TaskFlow system
 */
const { validationResult } = require('express-validator');
const taskflowService = require('../services/taskflow/service');
const logger = require('../../utils/logger');

function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  return null;
}

// ============================================================
// SLA POLICIES
// ============================================================

exports.getSlaPolicies = async (req, res) => {
  try {
    const { page, limit, isActive, isDefault } = req.query;
    const result = await taskflowService.getSlaPolicies({ page, limit, isActive: isActive !== undefined ? isActive === 'true' : undefined, isDefault: isDefault !== undefined ? isDefault === 'true' : undefined });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('getSlaPolicies error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getSlaPolicyById = async (req, res) => {
  try {
    const policy = await taskflowService.getSlaPolicyById(req.params.id);
    if (!policy) return res.status(404).json({ success: false, error: 'SLA policy not found' });
    res.json({ success: true, data: policy });
  } catch (error) {
    logger.error('getSlaPolicyById error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createSlaPolicy = async (req, res) => {
  try {
    const error = handleValidationErrors(req, res);
    if (error) return;
    
    const result = await taskflowService.createSlaPolicy({ ...req.body, createdBy: req.user?.Id || req.user?._id });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('createSlaPolicy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateSlaPolicy = async (req, res) => {
  try {
    const result = await taskflowService.updateSlaPolicy(req.params.id, req.body);
    if (!result) return res.status(404).json({ success: false, error: 'SLA policy not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('updateSlaPolicy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteSlaPolicy = async (req, res) => {
  try {
    await taskflowService.deleteSlaPolicy(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteSlaPolicy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// TASK TEMPLATES
// ============================================================

exports.getTemplates = async (req, res) => {
  try {
    const { page, limit, category, department, search, isActive } = req.query;
    const result = await taskflowService.getTemplates({ page, limit, category, department, search, isActive: isActive !== undefined ? isActive === 'true' : undefined });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('getTemplates error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const template = await taskflowService.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('getTemplateById error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const error = handleValidationErrors(req, res);
    if (error) return;
    
    const result = await taskflowService.createTemplate({ ...req.body, createdBy: req.user?.Id || req.user?._id });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('createTemplate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const result = await taskflowService.updateTemplate(req.params.id, req.body);
    if (!result) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('updateTemplate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    await taskflowService.deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteTemplate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// TASK INSTANCES
// ============================================================

exports.getTasks = async (req, res) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      sellerId: req.query.sellerId,
      assigneeId: req.query.assigneeId,
      reviewerId: req.query.reviewerId,
      priority: req.query.priority,
      department: req.query.department,
      templateId: req.query.templateId,
      slaStatus: req.query.slaStatus,
      dueBefore: req.query.dueBefore,
      dueAfter: req.query.dueAfter,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      page: req.query.page,
      limit: req.query.limit,
      userId: req.user?.Id || req.user?._id,
      isGlobalUser: req.user?.role?.name === 'admin' || req.user?.role === 'admin' || req.user?.role?.name === 'super_admin'
    };
    
    const result = await taskflowService.getTasks(filters);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('getTasks error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await taskflowService.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('getTaskById error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    const error = handleValidationErrors(req, res);
    if (error) return;
    
    const result = await taskflowService.createTask({ ...req.body, createdBy: req.user?.Id || req.user?._id });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('createTask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const result = await taskflowService.updateTask(req.params.id, req.body);
    if (!result) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('updateTask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    await taskflowService.deleteTask(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteTask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// STATUS TRANSITIONS
// ============================================================

exports.transitionStatus = async (req, res) => {
  try {
    const { toStatus, details } = req.body;
    if (!toStatus) return res.status(400).json({ success: false, error: 'toStatus is required' });
    
    const result = await taskflowService.transitionStatus(req.params.id, toStatus, req.user?.Id || req.user?._id, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim(), details);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('transitionStatus error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.bulkTransition = async (req, res) => {
  try {
    const { taskIds, toStatus, details } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) return res.status(400).json({ success: false, error: 'taskIds array is required' });
    if (!toStatus) return res.status(400).json({ success: false, error: 'toStatus is required' });
    
    const result = await taskflowService.bulkTransition(taskIds, toStatus, req.user?.Id || req.user?._id, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim(), details);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('bulkTransition error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// SUBTASKS
// ============================================================

exports.getSubTasks = async (req, res) => {
  try {
    const subtasks = await taskflowService.getSubTasks(req.params.id);
    res.json({ success: true, data: subtasks });
  } catch (error) {
    logger.error('getSubTasks error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createSubTask = async (req, res) => {
  try {
    const error = handleValidationErrors(req, res);
    if (error) return;
    
    const result = await taskflowService.createSubTask({ ...req.body, taskId: req.params.id });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('createSubTask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateSubTask = async (req, res) => {
  try {
    const result = await taskflowService.updateSubTask(req.params.id, req.body);
    if (!result) return res.status(404).json({ success: false, error: 'Subtask not found' });
    res.json({ success: true });
  } catch (error) {
    logger.error('updateSubTask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.completeSubTask = async (req, res) => {
  try {
    await taskflowService.completeSubTask(req.params.id, req.user?.Id || req.user?._id, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim());
    res.json({ success: true });
  } catch (error) {
    logger.error('completeSubTask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// ACTIVITIES
// ============================================================

exports.getActivities = async (req, res) => {
  try {
    const activities = await taskflowService.getActivities(req.params.subTaskId);
    res.json({ success: true, data: activities });
  } catch (error) {
    logger.error('getActivities error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createActivity = async (req, res) => {
  try {
    const error = handleValidationErrors(req, res);
    if (error) return;
    
    const result = await taskflowService.createActivity({ ...req.body, subTaskId: req.params.subTaskId });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('createActivity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.completeActivity = async (req, res) => {
  try {
    await taskflowService.completeActivity(req.params.id, req.user?.Id || req.user?._id, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim());
    res.json({ success: true });
  } catch (error) {
    logger.error('completeActivity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// ATTACHMENTS (EVIDENCE)
// ============================================================

exports.uploadAttachment = async (req, res) => {
  try {
    // Handle file upload - assuming multer or similar middleware
    const files = req.files || [req.file];
    if (!files || files.length === 0) return res.status(400).json({ success: false, error: 'No files uploaded' });
    
    const results = [];
    for (const file of files) {
      const result = await taskflowService.uploadAttachment({
        taskId: req.body.taskId,
        subTaskId: req.body.subTaskId,
        activityId: req.body.activityId,
        fileName: file.originalname,
        fileUrl: file.path || file.url, // depends on storage
        fileType: file.mimetype?.startsWith('image/') ? 'IMAGE' : 'FILE',
        fileSize: file.size,
        mimeType: file.mimetype,
        remarks: req.body.remarks,
        uploadedBy: req.user?.Id || req.user?._id,
        uploadedByName: `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim()
      });
      results.push(result);
    }
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('uploadAttachment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAttachments = async (req, res) => {
  try {
    const attachments = await taskflowService.getAttachments(req.params.taskId);
    res.json({ success: true, data: attachments });
  } catch (error) {
    logger.error('getAttachments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    await taskflowService.deleteAttachment(req.params.id, req.user?.Id || req.user?._id);
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteAttachment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// COMMENTS
// ============================================================

exports.getComments = async (req, res) => {
  try {
    const comments = await taskflowService.getComments(req.params.taskId);
    res.json({ success: true, data: comments });
  } catch (error) {
    logger.error('getComments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const error = handleValidationErrors(req, res);
    if (error) return;
    
    const result = await taskflowService.addComment({
      taskId: req.params.taskId,
      subTaskId: req.body.subTaskId,
      authorId: req.user?.Id || req.user?._id,
      content: req.body.content,
      isInternal: req.body.isInternal,
      parentCommentId: req.body.parentCommentId
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('addComment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    await taskflowService.deleteComment(req.params.id, req.user?.Id || req.user?._id);
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteComment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// AUDIT LOGS
// ============================================================

exports.getAuditLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await taskflowService.getAuditLogs(req.params.taskId, limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('getAuditLogs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// WATCHERS
// ============================================================

exports.addWatcher = async (req, res) => {
  try {
    const result = await taskflowService.addWatcher(req.params.taskId, req.body.userId || req.user?.Id || req.user?._id);
    if (result.exists) return res.status(409).json({ success: false, error: 'User is already watching this task' });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('addWatcher error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.removeWatcher = async (req, res) => {
  try {
    await taskflowService.removeWatcher(req.params.taskId, req.params.userId);
    res.json({ success: true });
  } catch (error) {
    logger.error('removeWatcher error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getWatchers = async (req, res) => {
  try {
    const watchers = await taskflowService.getWatchers(req.params.taskId);
    res.json({ success: true, data: watchers });
  } catch (error) {
    logger.error('getWatchers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// DASHBOARD KPIs
// ============================================================

exports.getDashboardKPIs = async (req, res) => {
  try {
    const kpis = await taskflowService.getDashboardKPIs({
      userId: req.user?.Id || req.user?._id,
      isGlobalUser: req.user?.role?.name === 'admin' || req.user?.role === 'admin',
      sellerId: req.query.sellerId,
      assigneeId: req.query.assigneeId,
      reviewerId: req.query.reviewerId
    });
    res.json({ success: true, data: kpis });
  } catch (error) {
    logger.error('getDashboardKPIs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// RECURRENCE
// ============================================================

exports.triggerRecurrence = async (req, res) => {
  try {
    const result = await taskflowService.generateRecurringTasks(new Date(req.body.now));
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('triggerRecurrence error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================================
// HELPER
// ============================================================

function handleValidationErrors(req, res) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return errors.array();
  }
  return null;
}