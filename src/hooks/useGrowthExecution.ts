/**
 * Growth Execution System - React Query Hooks
 * API-driven data fetching with loading, error, and empty states
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type {
    Goal,
    Task,
    Insight,
    MetricOverview,
    PerformanceChartData,
    GoalFilter,
    TaskFilter,
    TaskCreateInput,
    TaskUpdateInput,
    TaskStatusUpdate,
    MetricType
} from '../models/growth.types';

// =====================================================
// API BASE
// =====================================================

const GOALS_ENDPOINT = '/goals';
const TASKS_ENDPOINT = '/actions';
const INSIGHTS_ENDPOINT = '/insights';
const METRICS_ENDPOINT = '/metrics';

// =====================================================
// GOAL HOOKS
// =====================================================

/**
 * Fetch all goals with optional filtering
 */
export function useGoals(filter?: GoalFilter) {
    return useQuery({
        queryKey: ['goals', filter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filter?.metricType) params.append('metricType', filter.metricType);
            if (filter?.scopeType) params.append('scopeType', filter.scopeType);
            if (filter?.status) params.append('status', filter.status);
            if (filter?.brandId) params.append('brandId', filter.brandId);

            const { data } = await apiClient.get<Goal[]>(`${GOALS_ENDPOINT}?${params.toString()}`);
            return data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Fetch current active goal
 */
export function useCurrentGoal(metricType?: MetricType) {
    return useQuery({
        queryKey: ['current-goal', metricType],
        queryFn: async () => {
            const params = metricType ? `?metricType=${metricType}` : '';
            const { data } = await apiClient.get<Goal>(`${GOALS_ENDPOINT}/current${params}`);
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetch single goal by ID
 */
export function useGoal(goalId: string) {
    return useQuery({
        queryKey: ['goal', goalId],
        queryFn: async () => {
            const { data } = await apiClient.get<Goal>(`${GOALS_ENDPOINT}/${goalId}`);
            return data;
        },
        enabled: !!goalId,
    });
}

/**
 * Create a new goal
 */
export function useCreateGoal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (goal: Partial<Goal>) => {
            const { data } = await apiClient.post<Goal>(GOALS_ENDPOINT, goal);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            queryClient.invalidateQueries({ queryKey: ['current-goal'] });
        },
    });
}

/**
 * Update a goal
 */
export function useUpdateGoal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: { id: string } & Partial<Goal>) => {
            const { data } = await apiClient.put<Goal>(`${GOALS_ENDPOINT}/${id}`, updates);
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            queryClient.invalidateQueries({ queryKey: ['goal', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['current-goal'] });
        },
    });
}

// =====================================================
// TASK HOOKS
// =====================================================

/**
 * Fetch all tasks with filtering
 */
export function useTasks(filter?: TaskFilter) {
    return useQuery({
        queryKey: ['tasks', filter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filter?.status) params.append('status', filter.status);
            if (filter?.priority) params.append('priority', filter.priority);
            if (filter?.metricType) params.append('metricType', filter.metricType);
            if (filter?.scopeType) params.append('scopeType', filter.scopeType);
            if (filter?.goalId) params.append('goalId', filter.goalId);
            if (filter?.isAISuggested !== undefined) params.append('isAISuggested', String(filter.isAISuggested));

            const { data } = await apiClient.get<Task[]>(`${TASKS_ENDPOINT}?${params.toString()}`);
            return data || [];
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Fetch single task by ID
 */
export function useTask(taskId: string) {
    return useQuery({
        queryKey: ['task', taskId],
        queryFn: async () => {
            const { data } = await apiClient.get<Task>(`${TASKS_ENDPOINT}/${taskId}`);
            return data;
        },
        enabled: !!taskId,
    });
}

/**
 * Create a new task
 */
export function useCreateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (task: TaskCreateInput) => {
            const { data } = await apiClient.post<Task>(TASKS_ENDPOINT, task);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
}

/**
 * Update a task
 */
export function useUpdateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: { id: string } & TaskUpdateInput) => {
            const { data } = await apiClient.put<Task>(`${TASKS_ENDPOINT}/${id}`, updates);
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task', variables.id] });
        },
    });
}

/**
 * Update task status (lifecycle operations)
 */
export function useUpdateTaskStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, statusUpdate }: { id: string; statusUpdate: TaskStatusUpdate }) => {
            const { data } = await apiClient.patch<Task>(`${TASKS_ENDPOINT}/${id}/status`, statusUpdate);
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task', variables.id] });
        },
    });
}

/**
 * Start a task (transition to IN_PROGRESS)
 */
export function useStartTask() {
    return useUpdateTaskStatus();
}

/**
 * Block a task
 */
export function useBlockTask() {
    return useUpdateTaskStatus();
}

/**
 * Submit task for review
 */
export function useSubmitTaskForReview() {
    return useUpdateTaskStatus();
}

/**
 * Complete a task
 */
export function useCompleteTask() {
    return useUpdateTaskStatus();
}

/**
 * Delete a task
 */
export function useDeleteTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`${TASKS_ENDPOINT}/${id}`);
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
}

// =====================================================
// INSIGHT HOOKS
// =====================================================

/**
 * Fetch all insights
 */
export function useInsights(metricType?: MetricType) {
    return useQuery({
        queryKey: ['insights', metricType],
        queryFn: async () => {
            const params = metricType ? `?metricType=${metricType}` : '';
            const { data } = await apiClient.get<Insight[]>(`${INSIGHTS_ENDPOINT}${params}`);
            return data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Create task from insight
 */
export function useCreateTaskFromInsight() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (insightId: string) => {
            const { data } = await apiClient.post<Task>(`${INSIGHTS_ENDPOINT}/${insightId}/convert-to-task`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['insights'] });
        },
    });
}

// =====================================================
// METRICS HOOKS
// =====================================================

/**
 * Fetch metrics overview for dashboard
 */
export function useMetricsOverview(brandId?: string, asin?: string, dateRange?: string) {
    return useQuery({
        queryKey: ['metrics-overview', brandId, asin, dateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (brandId) params.append('brandId', brandId);
            if (asin) params.append('asin', asin);
            if (dateRange) params.append('dateRange', dateRange);

            const { data } = await apiClient.get<MetricOverview[]>(`${METRICS_ENDPOINT}/overview?${params.toString()}`);
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetch performance timeline for chart
 */
export function usePerformanceTimeline(metricType: MetricType, goalId?: string, dateRange?: string) {
    return useQuery({
        queryKey: ['performance-timeline', metricType, goalId, dateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('metricType', metricType);
            if (goalId) params.append('goalId', goalId);
            if (dateRange) params.append('dateRange', dateRange);

            const { data } = await apiClient.get<PerformanceChartData>(`${METRICS_ENDPOINT}/timeline?${params.toString()}`);
            return data;
        },
        enabled: !!metricType,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetch all metrics timeline for chart with switching
 */
export function useChartData(metricType: MetricType, goalId?: string) {
    return usePerformanceTimeline(metricType, goalId, '30d');
}

// =====================================================
// COMPOSED HOOKS
// =====================================================

/**
 * Hook for the complete ActionsPage data
 */
export function useActionsPageData(metricType?: MetricType) {
    const currentGoal = useCurrentGoal(metricType);
    const tasks = useTasks();
    const insights = useInsights();
    const metrics = useMetricsOverview();

    const chartData = useChartData(
        metricType || 'GMS',
        currentGoal.data?.id
    );

    return {
        goal: currentGoal,
        tasks: tasks,
        insights: insights,
        metrics: metrics,
        chart: chartData,
        isLoading: currentGoal.isLoading || tasks.isLoading || insights.isLoading,
        isError: currentGoal.isError || tasks.isError || insights.isError,
    };
}

/**
 * Hook for task filtering
 */
export function useFilteredTasks(filter: TaskFilter) {
    return useTasks(filter);
}

/**
 * Hook for goal metrics
 */
export function useGoalMetrics(metricType: MetricType) {
    const goal = useCurrentGoal(metricType);
    const chart = useChartData(metricType, goal.data?.id);

    return { goal, chart };
}

/**
 * Hook for AI-generated tasks
 */
export function useAITasks() {
    return useTasks({ isAISuggested: true });
}

/**
 * Hook for task statistics
 */
export function useTaskStats() {
    const { data: tasks } = useTasks();

    const stats = {
        total: tasks?.length || 0,
        todo: tasks?.filter(t => t.status === 'TODO').length || 0,
        inProgress: tasks?.filter(t => t.status === 'IN_PROGRESS').length || 0,
        blocked: tasks?.filter(t => t.status === 'BLOCKED').length || 0,
        review: tasks?.filter(t => t.status === 'REVIEW').length || 0,
        completed: tasks?.filter(t => t.status === 'COMPLETED').length || 0,
    };

    return { stats, tasks };
}