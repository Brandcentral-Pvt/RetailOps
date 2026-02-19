import React from 'react';

const Alerts = ({ alerts = [] }) => {
  const getAlertIcon = (type) => {
    const icons = {
      warning: 'bi-exclamation-triangle',
      success: 'bi-check-circle',
      danger: 'bi-x-circle',
      info: 'bi-info-circle'
    };
    return icons[type] || 'bi-bell';
  };

  const getAlertClass = (type) => {
    const classes = {
      warning: 'alert-warning',
      success: 'alert-success',
      danger: 'alert-danger',
      info: 'alert-info'
    };
    return classes[type] || 'alert-info';
  };

  if (!alerts || alerts.length === 0) {
    return (
      <div className="alerts-container">
        <div className="card-title mb-3">
          <i className="bi bi-bell me-2"></i>
          Alerts & Notifications
        </div>
        <div className="text-center py-6">
          <i className="bi bi-check-circle fs-1 text-muted mb-3 d-block"></i>
          <p className="text-muted mb-0">No active alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="card-title mb-0">
          <i className="bi bi-bell me-2"></i>
          Alerts & Notifications
        </h5>
        <span className="badge badge-primary">{alerts.length} new</span>
      </div>
      
      <div className="alerts-list">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={`alert ${getAlertClass(alert.type)}`}
          >
            <i className={`bi ${getAlertIcon(alert.type)} alert-icon`}></i>
            <div className="alert-content">
              <div className="alert-message">{alert.message}</div>
              <div className="alert-time">{alert.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
