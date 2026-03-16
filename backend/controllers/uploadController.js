const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const Monthly = require("../models/MonthlyPerformance");
const Master = require("../models/Master");
const AdsPerformance = require("../models/AdsPerformance");

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

exports.uploadAdsData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const reportType = req.body.reportType || 'daily'; // 'daily' or 'monthly'
    const reportDate = req.body.date; // For daily: YYYY-MM-DD, For monthly: YYYY-MM

    if (!reportDate) {
      throw new Error("Report date is required");
    }

    const inserts = [];
    const errors = [];
    const skippedRecords = [];

    // Common column mappings (standard Amazon Ads reports + custom formats)
    const mappings = {
      asin: ['asin', 'Advertised ASIN', 'ASIN', 'metrics.asin'],
      sku: ['sku', 'Advertised SKU', 'SKU', 'metrics.sku'],
      spend: ['metrics.spend', 'Spend', 'ad_spend', 'Total Spend'],
      sales: ['metrics.sales', '7 Day Total Sales', 'Total Sales', 'ad_sales', 'Sales'],
      impressions: ['metrics.impressions', 'Impressions', 'impressions'],
      clicks: ['metrics.clicks', 'Clicks', 'clicks'],
      orders: ['metrics.orders', '7 Day Total Orders', 'Total Orders', 'orders'],
      date: ['date', 'Date', 'Day', 'metrics.date'],
      // Additional metrics
      acos: ['metrics.acos', 'ACoS', 'acos'],
      roas: ['metrics.roas', 'ROAS', 'roas'],
      ctr: ['metrics.ctr', 'CTR', 'ctr'],
      aov: ['metrics.aov', 'AOV', 'aov']
    };

    const cleanValue = (val) => {
      if (val === null || val === undefined) return null;
      let cleaned = val.toString().trim();
      // Remove double quotes if present (e.g., """2026-02-27""" or """None""")
      cleaned = cleaned.replace(/^"+|"+$/g, '');
      if (cleaned.toLowerCase() === 'none' || cleaned === '') return null;
      return cleaned;
    };

    const findValue = (row, fields) => {
      const key = Object.keys(row).find(k => fields.includes(k));
      return key ? cleanValue(row[key]) : null;
    };

    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      try {
        const asin = findValue(row, mappings.asin);
        if (!asin) {
          skippedRecords.push({ index: index + 1, reason: 'ASIN column not found or empty' });
          continue;
        }

        const spendStr = findValue(row, mappings.spend);
        const salesStr = findValue(row, mappings.sales);
        const spend = parseFloat((spendStr || '0').replace(/,/g, ""));
        const sales = parseFloat((salesStr || '0').replace(/,/g, ""));
        const impressions = parseInt(findValue(row, mappings.impressions) || 0);
        const clicks = parseInt(findValue(row, mappings.clicks) || 0);
        const orders = parseInt(findValue(row, mappings.orders) || 0);
        const sku = findValue(row, mappings.sku);
        const rowDate = findValue(row, mappings.date);

        // Parse additional metrics
        const acosStr = findValue(row, mappings.acos);
        const roasStr = findValue(row, mappings.roas);
        const ctrStr = findValue(row, mappings.ctr);
        const aovStr = findValue(row, mappings.aov);

        const acos = acosStr ? parseFloat(acosStr.replace(/,/g, "")) : 0;
        const roas = roasStr ? parseFloat(roasStr.replace(/,/g, "")) : 0;
        const ctr = ctrStr ? parseFloat(ctrStr.replace(/,/g, "")) : 0;
        const aov = aovStr ? parseFloat(aovStr.replace(/,/g, "")) : 0;

        const filter = { asin, reportType };
        const updateData = {
          advertised_sku: sku,
          ad_spend: spend,
          ad_sales: sales,
          impressions,
          clicks,
          orders,
          acos,
          roas,
          ctr,
          aov,
          uploaded_at: new Date()
        };

        if (reportType === 'daily') {
          const finalDate = rowDate || reportDate;
          if (!finalDate) throw new Error("Date is missing for daily report");
          filter.date = new Date(finalDate);
          updateData.date = new Date(finalDate);
        } else {
          // For monthly, use the provided reportDate if rowDate isn't a full date
          const finalMonth = rowDate || reportDate;
          const monthDate = finalMonth.includes('-') && finalMonth.split('-').length === 2
            ? `${finalMonth}-01`
            : finalMonth;
          filter.month = new Date(monthDate);
          updateData.month = new Date(monthDate);
        }

        // Upsert logic
        await AdsPerformance.findOneAndUpdate(filter, updateData, { upsert: true, new: true });
        inserts.push(asin);

      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error.message);
        errors.push({ index: index + 1, asin: row[Object.keys(row)[0]], error: error.message });
      }
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      message: `Ads ${reportType} report processed successfully`,
      processed: inserts.length,
      skipped: skippedRecords.length,
      errors: errors.length,
      details: { skippedRecords, errors }
    });

  } catch (err) {
    console.error("❌ Ads Upload Error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: err.message || "Upload failed" });
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
