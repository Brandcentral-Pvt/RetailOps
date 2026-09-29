import { useState, useCallback } from 'react';
import tasksApi from '../services/tasksApi';

export function useTasks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  // Templates
  const getTemplates = useCallback((params) => wrap(() => tasksApi.getTemplates(params)), [wrap]);
  const createTemplate = useCallback((data) => wrap(() => tasksApi.createTemplate(data)), [wrap]);
  const updateTemplate = useCallback((id, data) => wrap(() => tasksApi.updateTemplate(id, data)), [wrap]);
  const deleteTemplate = useCallback((id) => wrap(() => tasksApi.deleteTemplate(id)), [wrap]);

  // Instances
  const getInstances = useCallback((params) => wrap(() => tasksApi.getInstances(params)), [wrap]);
  const getInstanceById = useCallback((id) => wrap(() => tasksApi.getInstanceById(id)), [wrap]);
  const createInstance = useCallback((data) => wrap(() => tasksApi.createInstance(data)), [wrap]);
  const transitionStatus = useCallback((id, toStatus, details) => wrap(() => tasksApi.transitionStatus(id, toStatus, details)), [wrap]);
  const updateAchievement = useCallback((id, achievement) => wrap(() => tasksApi.updateAchievement(id, achievement)), [wrap]);

  // Sub Tasks & Activities
  const completeSubTask = useCallback((id) => wrap(() => tasksApi.completeSubTask(id)), [wrap]);
  const completeActivity = useCallback((id) => wrap(() => tasksApi.completeActivity(id)), [wrap]);

  // Evidence & Reviews
  const uploadEvidence = useCallback((data) => wrap(() => tasksApi.uploadEvidence(data)), [wrap]);
  const submitReview = useCallback((data) => wrap(() => tasksApi.submitReview(data)), [wrap]);

  // Dashboard
  const getDashboardKPIs = useCallback((params) => wrap(() => tasksApi.getDashboardKPIs(params)), [wrap]);
  const getSellerPerformance = useCallback((params) => wrap(() => tasksApi.getSellerPerformance(params)), [wrap]);

  return {
    loading, error,
    getTemplates, createTemplate, updateTemplate, deleteTemplate,
    getInstances, getInstanceById, createInstance, transitionStatus, updateAchievement,
    completeSubTask, completeActivity,
    uploadEvidence, submitReview,
    getDashboardKPIs, getSellerPerformance,
  };
}
