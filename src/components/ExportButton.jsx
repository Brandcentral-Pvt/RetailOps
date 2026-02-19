import axios from 'axios';
import { useState } from 'react';

const ExportButton = ({ data, fileName = 'export', format = 'excel', className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    if (!data || data.length === 0) {
      alert('No data available to export');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const formatParam = format === 'excel' ? 'xlsx' : 'csv';
      const response = await axios.post(
        `http://localhost:3001/api/export/${formatParam}`,
        { data },
        {
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName}.${formatParam}`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('❌ Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`btn btn-primary ${className}`}
      onClick={handleExport}
      disabled={isLoading || !data}
    >
      {isLoading ? (
        <>
          <span className="spinner-border spinner-border-sm me-2"></span>
          Exporting...
        </>
      ) : (
        <>
          <i className="bi bi-download me-2"></i>
          Export {format === 'excel' ? 'Excel' : 'CSV'}
        </>
      )}
    </button>
  );
};

export default ExportButton;
