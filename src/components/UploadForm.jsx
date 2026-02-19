import axios from 'axios';
import { useState } from 'react';
import '../App.css';

const UploadForm = () => {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errors, setErrors] = useState([]);

  const validateFile = (selectedFile) => {
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(selectedFile.type)) {
      return 'Only Excel files (.xlsx, .xls) are accepted';
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  const validateMonth = (selectedMonth) => {
    if (!selectedMonth) {
      return 'Please select a month';
    }

    const selectedDate = new Date(selectedMonth + '-01');
    const currentDate = new Date();
    if (selectedDate > currentDate) {
      return 'Future dates are not allowed';
    }

    return null;
  };

  const handleUpload = async () => {
    setErrors([]);
    setUploadStatus(null);

    // Validate inputs
    const fileError = file ? validateFile(file) : 'Please select a file';
    const monthError = validateMonth(month);

    const validationErrors = [];
    if (fileError) validationErrors.push(fileError);
    if (monthError) validationErrors.push(monthError);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', month);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/upload-monthly`, formData);
      setUploadStatus({
        type: 'success',
        message: `✅ Uploaded Successfully: ${res.data.inserted} records added.`,
        details: res.data
      });
      setFile(null);
      setMonth('');
    } catch (err) {
      console.error("❌ Upload error:", err);
      setUploadStatus({
        type: 'error',
        message: err.response?.data?.error || "❌ Upload failed. Please try again.",
        details: err.response?.data
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      const fileError = validateFile(selectedFile);
      if (fileError) {
        setErrors([fileError]);
      } else if (errors.length > 0) {
        setErrors([]);
      }
    }
  };

  const handleMonthChange = (e) => {
    setMonth(e.target.value);
    if (e.target.value) {
      const monthError = validateMonth(e.target.value);
      if (monthError) {
        setErrors([monthError]);
      } else if (errors.length > 0) {
        setErrors([]);
      }
    }
  };

  return (
    <div className="upload-form">
      <h6 className="card-title mb-4">
        <i className="bi bi-cloud-upload me-2" style={{ color: 'var(--color-primary-600)' }}></i>
        Upload Monthly Data
      </h6>

      {/* File Upload */}
      <div className="form-group">
        <label className="form-label">📄 Select Excel File</label>
        <div className="upload-area" onClick={() => document.getElementById('fileInput').click()}>
          <div className="upload-icon">
            <i className="bi bi-file-earmark-spreadsheet" style={{ fontSize: '48px', color: 'var(--color-success-500)' }}></i>
          </div>
          <p className="upload-text">
            {file ? file.name : 'Click to upload or drag and drop'}
          </p>
          <p className="upload-hint">Excel files only (.xlsx, .xls)</p>
          <input
            id="fileInput"
            type="file"
            className="d-none"
            onChange={handleFileChange}
            accept=".xlsx,.xls"
          />
        </div>
        {file && (
          <div className="mt-2 d-flex align-items-center gap-2">
            <i className="bi bi-check-circle text-success"></i>
            <span className="text-sm text-muted">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
        )}
      </div>

      {/* Month Selection */}
      <div className="form-group">
        <label className="form-label">📅 Select Month</label>
        <input
          type="month"
          className={`form-control ${errors.length > 0 ? 'is-invalid' : ''}`}
          onChange={handleMonthChange}
          placeholder="Select Month"
          value={month}
        />
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="alert alert-danger">
          <ul className="mb-0">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Status */}
      {uploadStatus && (
        <div className={`alert alert-${uploadStatus.type === 'success' ? 'success' : 'danger'}`}>
          {uploadStatus.message}
        </div>
      )}

      {/* Upload Button */}
      <div className="d-flex gap-2 mt-4">
        <button
          className={`btn btn-primary ${isLoading ? 'disabled' : ''}`}
          onClick={handleUpload}
          disabled={isLoading || !file || !month}
          style={{ flex: 1 }}
        >
          {isLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Uploading...
            </>
          ) : (
            <>
              <i className="bi bi-cloud-arrow-up me-2"></i>
              Upload Data
            </>
          )}
        </button>

        {/* Clear Button */}
        {(file || month) && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setFile(null);
              setMonth('');
              setErrors([]);
              setUploadStatus(null);
            }}
            disabled={isLoading}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-light rounded-lg" style={{ background: 'var(--color-gray-100)' }}>
        <p className="text-sm text-muted mb-2">
          <strong>📋 Instructions:</strong>
        </p>
        <ul className="text-sm text-muted mb-0" style={{ paddingLeft: 'var(--space-4)' }}>
          <li>File format: Excel (.xlsx, .xls)</li>
          <li>Size limit: 10 MB</li>
          <li>Required columns: ASIN, Ordered Revenue, Ordered Units</li>
          <li>Ensure all ASINs exist in master product data</li>
        </ul>
      </div>
    </div>
  );
};

export default UploadForm;
