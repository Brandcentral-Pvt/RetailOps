import React from 'react';
import { Sparkles } from 'lucide-react';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (AI listing analysis modal region).
const AiAnalysisModal = ({
  showAiAnalysisModal,
  setShowAiAnalysisModal,
  aiAnalysisLoading,
  aiAnalysisResult,
  syncing,
  handleAiCreateTasks,
}) => {
    return showAiAnalysisModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !aiAnalysisLoading && setShowAiAnalysisModal(false)}>
          <div style={{ background: '#fff', borderRadius: "var(--radius-xl)", width: '90%', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: 'linear-gradient(135deg, #6d28d9, #1976D2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>AI Listing Quality Analysis</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Amazon policy compliance & optimization recommendations</div>
                </div>
              </div>
              <button onClick={() => setShowAiAnalysisModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 120px)' }}>
              {aiAnalysisLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--border-light)', borderTopColor: 'var(--bc-violet-700)', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>AI is analyzing your listings against Amazon policies...</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>This may take 15-30 seconds per ASIN</div>
                </div>
              )}
              {!aiAnalysisLoading && aiAnalysisResult && aiAnalysisResult.map((result, idx) => (
                <div key={idx} style={{ marginBottom: 20, border: '1px solid var(--border-light)', borderRadius: "var(--radius-lg)", overflow: 'hidden' }}>
                  {result.error ? (
                    <div style={{ padding: 20, background: 'var(--bg-danger-subtle)', color: 'var(--text-danger)', fontSize: 12 }}>Error: {result.error}</div>
                  ) : (
                    <>
                      <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Score: {result.overallScore}/100</span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>{result.summary}</span>
                        </div>
                        <button onClick={() => handleAiCreateTasks(result.asinId)}
                          disabled={syncing}
                          style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: '4px 12px', borderRadius: 6, background: 'var(--text-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {syncing ? 'Creating...' : 'Create Tasks'}
                        </button>
                      </div>
                      {result.issues?.length > 0 && (
                        <div style={{ padding: 12 }}>
                          {result.issues.map((issue, i) => (
                            <div key={i} style={{ padding: '8px 12px', background: issue.severity === 'critical' ? 'var(--bg-danger-subtle)' : issue.severity === 'high' ? 'var(--bg-warning-subtle)' : 'var(--bg-secondary)', borderLeft: `3px solid ${issue.severity === 'critical' ? 'var(--text-danger)' : issue.severity === 'high' ? 'var(--text-warning)' : 'var(--text-brand)'}`, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: 10 }}>{issue.field} · {issue.severity}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: issue.priority === 'HIGH' ? 'var(--text-danger)' : 'var(--text-muted)' }}>{issue.priority}</span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{issue.issue}</div>
                              <div style={{ color: 'var(--text-success)', fontSize: 'var(--font-size-xs)' }}>→ {issue.recommendation}</div>
                              {issue.amazonPolicy && <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>Policy: {issue.amazonPolicy}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
};

export default AiAnalysisModal;
