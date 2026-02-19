const XLSX = require('xlsx');

exports.exportToExcel = async (req, res) => {
  try {
    const { data, fileName = 'export' } = req.body;

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('❌ Excel export error:', error);
    res.status(500).json({ error: 'Excel export failed' });
  }
};

exports.exportToCSV = async (req, res) => {
  try {
    const { data, fileName = 'export' } = req.body;

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Generate CSV file
    const csvBuffer = XLSX.write(wb, { bookType: 'csv', type: 'buffer' });

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    
    res.send(csvBuffer);
  } catch (error) {
    console.error('❌ CSV export error:', error);
    res.status(500).json({ error: 'CSV export failed' });
  }
};

// Helper function to format data for export
const formatExportData = (data) => {
  return data.map(item => {
    const formattedItem = { ...item };
    
    // Format numbers
    if (formattedItem.ordered_revenue) {
      formattedItem.ordered_revenue = formatCurrency(formattedItem.ordered_revenue);
    }
    if (formattedItem.total_revenue) {
      formattedItem.total_revenue = formatCurrency(formattedItem.total_revenue);
    }
    if (formattedItem.price) {
      formattedItem.price = formatCurrency(formattedItem.price);
    }

    // Format dates
    if (formattedItem.month) {
      formattedItem.month = new Date(formattedItem.month).toLocaleDateString();
    }
    if (formattedItem.createdAt) {
      formattedItem.createdAt = new Date(formattedItem.createdAt).toLocaleString();
    }
    if (formattedItem.updatedAt) {
      formattedItem.updatedAt = new Date(formattedItem.updatedAt).toLocaleString();
    }

    return formattedItem;
  });
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'INR'
  }).format(value);
};
