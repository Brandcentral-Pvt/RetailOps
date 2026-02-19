import React from 'react';
import UploadForm from '../components/UploadForm';
import ExportButton from '../components/ExportButton';

const UploadExport = () => {
  return (
    <>
      <header className="main-header">
        <h1 className="page-title">
          <i className="bi bi-arrow-left-right"></i>
          Upload & Export
        </h1>
      </header>
      <div className="page-content">
        <div className="row">
          <div className="col-lg-6 mb-4">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="bi bi-cloud-upload me-2"></i>
                  Upload Data
                </h3>
              </div>
              <div className="card-body">
                <UploadForm />
              </div>
            </div>
          </div>
          <div className="col-lg-6 mb-4">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="bi bi-download me-2"></i>
                  Export Data
                </h3>
              </div>
              <div className="card-body">
                <ExportButton />
              </div>
            </div>
          </div>
        </div>
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="bi bi-info-circle me-2"></i>
                  Instructions
                </h3>
              </div>
              <div className="card-body">
                <div className="alert alert-info">
                  <i className="bi bi-info-circle me-2"></i>
                  <div><strong>Upload Instructions:</strong> Accepts CSV files with Amazon sales data. Ensure columns include: Date, ASIN, SKU, Sales, Units, Revenue.</div>
                </div>
                <div className="alert alert-success">
                  <i className="bi bi-check-circle me-2"></i>
                  <div><strong>Export Options:</strong> Export your data in CSV or Excel format. Filter by date range before exporting for specific results.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UploadExport;
