const Objective = require('../models/Objective');
const Action = require('../models/Action');
const KeyResult = require('../models/KeyResult');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Growth Execution Controller
 * Implements mandatory API contracts for the high-fidelity dashboard.
 */

// GET /api/goals/current
exports.getCurrentGoal = async (req, res) => {
    try {
        // Find the most recent active monthly/weekly objective
        const objective = await Objective.findOne({
            status: { $in: ['IN_PROGRESS', 'AT_RISK', 'NOT_STARTED'] }
        }).sort({ createdAt: -1 });

        if (!objective) {
            return res.status(404).json({ message: 'No active goal found' });
        }

        // Calculate achieved GMS from Key Results if available
        const krs = await KeyResult.find({ objectiveId: objective._id });
        const gmsKR = krs.find(kr => kr.title.includes('GMS') || kr.measurementMetric === 'GMS');
        
        const achievedGMS = gmsKR ? gmsKR.currentValue : (objective.progress / 100) * (objective.goalSettings?.targetValue || 1000000);
        const targetGMS = objective.goalSettings?.targetValue || 1000000;

        // Determine status based on progress vs time elapsed
        const now = new Date();
        const totalDuration = objective.endDate - objective.startDate;
        const elapsed = now - objective.startDate;
        const expectedProgress = (elapsed / totalDuration) * 100;
        
        let status = 'ON_TRACK';
        if (objective.progress < expectedProgress - 10) status = 'BEHIND';
        if (objective.progress > expectedProgress + 5) status = 'AHEAD';

        res.json({
            id: objective._id,
            name: objective.title,
            targetGMS,
            achievedGMS,
            startDate: objective.startDate,
            endDate: objective.endDate,
            status,
            dailyRequiredRevenue: (targetGMS - achievedGMS) / Math.max(1, (objective.endDate - now) / (1000 * 60 * 60 * 24))
        });
    } catch (error) {
        console.error('Error fetching current goal:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /api/analytics/performance?goalId=
exports.getPerformanceAnalytics = async (req, res) => {
    try {
        const { goalId } = req.query;
        if (!goalId) return res.status(400).json({ message: 'goalId is required' });

        const objective = await Objective.findById(goalId);
        if (!objective) return res.status(404).json({ message: 'Goal not found' });

        // Generate mock-ish but realistic timeline based on objective duration
        // In a real scenario, this would aggregate daily sales from MarketData
        const timeline = [];
        const start = new Date(objective.startDate);
        const end = new Date(objective.endDate);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const targetGMS = objective.goalSettings?.targetValue || 1000000;
        
        for (let i = 0; i <= Math.min(30, totalDays); i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            if (date > new Date()) break;

            const targetRevenue = (targetGMS / totalDays) * i;
            // Simulated actual revenue with some variance
            const actualRevenue = targetRevenue * (0.85 + Math.random() * 0.25);
            
            timeline.push({
                date: date.toISOString().split('T')[0],
                actualRevenue: Math.round(actualRevenue),
                targetRevenue: Math.round(targetRevenue)
            });
        }

        const lastActual = timeline[timeline.length - 1]?.actualRevenue || 0;
        const lastTarget = timeline[timeline.length - 1]?.targetRevenue || 1;
        const gapPercentage = Math.round(((lastTarget - lastActual) / lastTarget) * 100);

        res.json({
            timeline,
            projectionRevenue: Math.round(lastActual * 1.2), // Simple projection
            gapPercentage,
            expectedFinal: Math.round(targetGMS * (lastActual / lastTarget))
        });
    } catch (error) {
        console.error('Error fetching performance analytics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /api/tasks?filter=
exports.getFilteredTasks = async (req, res) => {
    try {
        const { filter } = req.query;
        let query = {};

        // RBAC Scoping
        const user = await User.findById(req.user._id).populate('role');
        if (!user || !user.role) {
            return res.status(403).json({ message: 'User role context missing' });
        }

        const roleLevel = user.role.level || 0;
        // Strict scope for non-managers (Level <= 50: Analyst, Team Leader, Employee)
        if (roleLevel <= 50) { 
            query.$or = [
                { assignedTo: req.user._id },
                { createdBy: req.user._id }
            ];
        }

        if (filter === 'URGENT') query.priority = 'HIGH';
        if (filter === 'AI_SUGGESTED') query.isAISuggested = true;
        
        const actions = await Action.find(query)
            .populate('assignedTo', 'firstName lastName avatar email')
            .populate('asins', 'asinCode title')
            .limit(50)
            .sort({ createdAt: -1 });
        
        const formattedTasks = actions.map(action => ({
            id: action._id,
            title: action.title,
            description: action.description,
            type: action.type || 'TASK',
            scopeType: action.scopeType || action.type || 'GLOBAL',
            priority: action.priority,
            status: action.status,
            impactScore: action.impactWeight || 5, // Default fallback
            brandId: action.brandId,
            asinList: action.asins?.length > 0 ? action.asins.map(a => a.asinCode || a) : (action.resolvedAsins || []),
            isAISuggested: action.isAIGenerated || action.autoGenerated?.isAuto || false,
            assignee: action.assignedTo ? {
                id: action.assignedTo._id,
                name: `${action.assignedTo.firstName} ${action.assignedTo.lastName}`,
                avatar: action.assignedTo.avatar
            } : null,
            deadline: action.deadline
        }));

        res.json(formattedTasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /api/insights
exports.getIntelligenceInsights = async (req, res) => {
    try {
        const insights = [];

        // Dynamic Aggregation 1: Overdue Task Check
        const overdueCount = await Action.countDocuments({
            status: { $ne: 'COMPLETED' },
            deadline: { $lt: new Date() }
        });
        
        if (overdueCount > 0) {
            insights.push({
                id: 'overdue_alert',
                type: 'STOCK', // Represents risk/danger visually
                title: 'Overdue Execution Risk',
                reasoning: `${overdueCount} critical tasks have passed their deadline, threatening immediate growth velocity.`,
                actionLabel: 'Review Overdue',
                actionType: 'RESOLVE_TASKS',
                impactWeight: 15
            });
        }

        // Dynamic Aggregation 2: AI Bulk Generation Check
        const bulkTasksCount = await Action.countDocuments({
            'autoGenerated.isAuto': true,
            status: 'PENDING'
        });

        if (bulkTasksCount > 0) {
            insights.push({
                id: 'ai_bulk_alert',
                type: 'OPPORTUNITY', // Represents opportunity
                title: 'High-Impact Optimizations',
                reasoning: `AI has generated ${bulkTasksCount} untapped optimization actions from recent ASIN analysis.`,
                actionLabel: 'Execute Optimizations',
                actionType: 'ACCELERATE_GROWTH',
                impactWeight: 25
            });
        }

        // Dynamic Aggregation 3: In Review Tasks
        const reviewCount = await Action.countDocuments({
            status: 'REVIEW'
        });

        if (reviewCount > 0) {
            insights.push({
                id: 'review_bottleneck',
                type: 'ADS',
                title: 'Review Bottleneck Detected',
                reasoning: `${reviewCount} tasks are awaiting managerial approval. Unblocking them restores team velocity.`,
                actionLabel: 'Approve Work',
                actionType: 'CLEAR_BACKLOG',
                impactWeight: 10
            });
        }

        // Fallback if no specific triggers exist
        if (insights.length === 0) {
            insights.push({
                id: 'healthy_system',
                type: 'OPPORTUNITY',
                title: 'Operationally Sound',
                reasoning: 'Execution engine running flawlessly. Identify new strategic markets or ASINs for expansion.',
                actionLabel: 'Expand Strategy',
                actionType: 'CREATE_GOAL',
                impactWeight: 5
            });
        }

        res.json(insights);
    } catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
