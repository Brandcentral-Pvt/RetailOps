const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const Monthly = require("../models/MonthlyPerformance");
const Master = require("../models/Master");

exports.uploadMonthlyData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const month = req.body.month; // Format: YYYY-MM
    const inserts = [];
    const errors = [];
    const skippedRecords = [];

    // Validate file structure
    const requiredColumns = ['ASIN', 'Ordered Revenue', 'Ordered Units'];
    const headers = Object.keys(jsonData[0] || {});
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      
      try {
        const asin = row["ASIN"];
        const revenue = parseFloat((row["Ordered Revenue"] || '0').toString().replace(/,/g, ""));
        const units = parseInt(row["Ordered Units"] || 0);

        // Validate ASIN exists
        const exists = await Master.findOne({ asin });
        if (!exists) {
          skippedRecords.push({
            index: index + 1,
            asin,
            reason: 'ASIN not found in master product data'
          });
          continue;
        }

        // Validate data types
        if (isNaN(revenue) || isNaN(units)) {
          skippedRecords.push({
            index: index + 1,
            asin,
            reason: 'Invalid numeric values'
          });
          continue;
        }

        // Check for existing record
        const existing = await Monthly.findOne({
          asin,
          month: new Date(`${month}-01`)
        });

        if (!existing) {
          inserts.push({
            asin,
            ordered_units: units,
            ordered_revenue: revenue,
            month: new Date(`${month}-01`)
          });
        } else {
          skippedRecords.push({
            index: index + 1,
            asin,
            reason: 'Record already exists'
          });
        }

      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error.message);
        errors.push({
          index: index + 1,
          asin: row["ASIN"],
          error: error.message
        });
      }
    }

    if (inserts.length > 0) {
      await Monthly.insertMany(inserts);
    }

    fs.unlinkSync(filePath);
    
    res.json({
      message: "Upload processed successfully",
      inserted: inserts.length,
      skipped: skippedRecords.length,
      errors: errors.length,
      details: {
        skippedRecords,
        errors
      }
    });

  } catch (err) {
    console.error("❌ Upload Error:", err);
    
    // Cleanup file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error("❌ File cleanup error:", cleanupErr);
      }
    }
    
    res.status(400).json({
      error: err.message || "Upload failed",
      code: err.code || "UPLOAD_ERROR"
    });
  }
};

// Get upload statistics
exports.getUploadStats = async (req, res) => {
  try {
    const stats = await Monthly.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$month" },
            month: { $month: "$month" }
          },
          records: { $sum: 1 },
          totalRevenue: { $sum: "$ordered_revenue" },
          totalUnits: { $sum: "$ordered_units" }
        }
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 }
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    console.error("❌ Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};
