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
    // Use raw: true so XLSX doesn't auto-convert triple-quoted dates to serial numbers
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

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
      // Performance metrics
      acos: ['metrics.acos', 'ACoS', 'acos'],
      roas: ['metrics.roas', 'ROAS', 'roas'],
      ctr: ['metrics.ctr', 'CTR', 'ctr'],
      aov: ['metrics.aov', 'AOV', 'aov'],
      // Additional metrics from CSV
      cpc: ['metrics.cpc', 'CPC', 'cpc'],
      conversion_rate: ['metrics.conversion_rate', 'Conversion Rate', 'conversion_rate'],
      conversions: ['metrics.conversions', 'Conversions', 'conversions'],
      // Same SKU metrics
      same_sku_sales: ['metrics.same_sku_sales', 'Same SKU Sales', 'same_sku_sales'],
      same_sku_orders: ['metrics.same_sku_orders', 'Same SKU Orders', 'same_sku_orders'],
      // Budget metrics
      daily_budget: ['metrics.daily_budget', 'Daily Budget', 'daily_budget'],
      total_budget: ['metrics.total_budget', 'Total Budget', 'total_budget'],
      max_spend: ['metrics.max_spend', 'Max Spend', 'max_spend'],
      avg_spend: ['metrics.avg_spend', 'Avg Spend', 'avg_spend'],
      // Totals
      total_sales: ['metrics.total_sales', 'Total Sales', 'total_sales'],
      total_acos: ['metrics.total_acos', 'Total ACoS', 'total_acos'],
      total_units: ['metrics.total_units', 'Total Units', 'total_units'],
      // Organic metrics
      organic_sales: ['metrics.organic_sales', 'Organic Sales', 'organic_sales'],
      organic_orders: ['metrics.organic_orders', 'Organic Orders', 'organic_orders'],
      // Traffic & engagement
      page_views: ['metrics.page_views', 'Page Views', 'page_views'],
      ad_sales_perc: ['metrics.ad_sales_perc', 'Ad Sales %', 'ad_sales_perc'],
      tos_is: ['metrics.tos_is', 'TOS IS', 'tos_is'],
      sessions: ['metrics.sessions', 'Sessions', 'sessions'],
      buy_box_percentage: ['metrics.buy_box_percentage', 'Buy Box %', 'buy_box_percentage'],
      browser_sessions: ['metrics.browser_sessions', 'Browser Sessions', 'browser_sessions'],
      mobile_app_sessions: ['metrics.mobile_app_sessions', 'Mobile App Sessions', 'mobile_app_sessions']
    };

    const cleanValue = (val) => {
      if (val === null || val === undefined) return null;
      let cleaned = val.toString().trim();
      // Remove double/triple quotes (e.g., """2026-02-27""" or """None""")
      cleaned = cleaned.replace(/^"+|"+$/g, '');
      if (cleaned.toLowerCase() === 'none' || cleaned === '') return null;
      return cleaned;
    };

    // Parse date — handles M/D/YY (XLSX formatted), YYYY-MM-DD, and Excel serial numbers
    const parseDate = (val) => {
      if (!val) return null;
      let cleaned = val.toString().trim().replace(/^"+|"+$/g, '');
      if (cleaned.toLowerCase() === 'none' || cleaned === '') return null;

      // Excel serial number (e.g., 46080)
      if (!isNaN(cleaned) && Number(cleaned) > 10000) {
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + Number(cleaned) * 86400000);
        return d.toISOString().split('T')[0];
      }

      // M/D/YY format (e.g., "2/27/26" → "2026-02-27")
      const shortMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (shortMatch) {
        let year = parseInt(shortMatch[3]);
        year = year < 100 ? 2000 + year : year; // 26 → 2026
        const month = shortMatch[1].padStart(2, '0');
        const day = shortMatch[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      // M/D/YYYY format (e.g., "2/27/2026")
      const longMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (longMatch) {
        const month = longMatch[1].padStart(2, '0');
        const day = longMatch[2].padStart(2, '0');
        return `${longMatch[3]}-${month}-${day}`;
      }

      // Already YYYY-MM-DD
      return cleaned;
    };

    const findValue = (row, fields) => {
      const key = Object.keys(row).find(k => fields.includes(k));
      return key ? cleanValue(row[key]) : null;
    };

    const findDate = (row, fields) => {
      const key = Object.keys(row).find(k => fields.includes(k));
      return key ? parseDate(row[key]) : null;
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
        const rowDate = findDate(row, mappings.date);

        // Parse additional metrics
        const acosStr = findValue(row, mappings.acos);
        const roasStr = findValue(row, mappings.roas);
        const ctrStr = findValue(row, mappings.ctr);
        const aovStr = findValue(row, mappings.aov);
        const cpcStr = findValue(row, mappings.cpc);
        const conversionRateStr = findValue(row, mappings.conversion_rate);
        const conversionsStr = findValue(row, mappings.conversions);

        const acos = acosStr ? parseFloat(acosStr.replace(/,/g, "")) : 0;
        const roas = roasStr ? parseFloat(roasStr.replace(/,/g, "")) : 0;
        const ctr = ctrStr ? parseFloat(ctrStr.replace(/,/g, "")) : 0;
        const aov = aovStr ? parseFloat(aovStr.replace(/,/g, "")) : 0;
        const cpc = cpcStr ? parseFloat(cpcStr.replace(/,/g, "")) : 0;
        const conversion_rate = conversionRateStr ? parseFloat(conversionRateStr.replace(/,/g, "")) : 0;
        const conversions = conversionsStr ? parseInt(conversionsStr.replace(/,/g, "")) : 0;

        // Parse same SKU metrics
        const sameSkuSalesStr = findValue(row, mappings.same_sku_sales);
        const sameSkuOrdersStr = findValue(row, mappings.same_sku_orders);
        const same_sku_sales = sameSkuSalesStr ? parseFloat(sameSkuSalesStr.replace(/,/g, "")) : 0;
        const same_sku_orders = sameSkuOrdersStr ? parseInt(sameSkuOrdersStr.replace(/,/g, "")) : 0;

        // Parse budget metrics
        const dailyBudgetStr = findValue(row, mappings.daily_budget);
        const totalBudgetStr = findValue(row, mappings.total_budget);
        const maxSpendStr = findValue(row, mappings.max_spend);
        const avgSpendStr = findValue(row, mappings.avg_spend);
        const daily_budget = dailyBudgetStr ? parseFloat(dailyBudgetStr.replace(/,/g, "")) : 0;
        const total_budget = totalBudgetStr ? parseFloat(totalBudgetStr.replace(/,/g, "")) : 0;
        const max_spend = maxSpendStr ? parseFloat(maxSpendStr.replace(/,/g, "")) : 0;
        const avg_spend = avgSpendStr ? parseFloat(avgSpendStr.replace(/,/g, "")) : 0;

        // Parse totals
        const totalSalesStr = findValue(row, mappings.total_sales);
        const totalAcosStr = findValue(row, mappings.total_acos);
        const totalUnitsStr = findValue(row, mappings.total_units);
        const total_sales = totalSalesStr ? parseFloat(totalSalesStr.replace(/,/g, "")) : 0;
        const total_acos = totalAcosStr ? parseFloat(totalAcosStr.replace(/,/g, "")) : 0;
        const total_units = totalUnitsStr ? parseInt(totalUnitsStr.replace(/,/g, "")) : 0;

        // Parse organic metrics
        const organicSalesStr = findValue(row, mappings.organic_sales);
        const organicOrdersStr = findValue(row, mappings.organic_orders);
        const organic_sales = organicSalesStr ? parseFloat(organicSalesStr.replace(/,/g, "")) : 0;
        const organic_orders = organicOrdersStr ? parseInt(organicOrdersStr.replace(/,/g, "")) : 0;


        // Parse traffic & engagement
        const pageViewsStr = findValue(row, mappings.page_views);
        const adSalesPercStr = findValue(row, mappings.ad_sales_perc);
        const tosIsStr = findValue(row, mappings.tos_is);
        const sessionsStr = findValue(row, mappings.sessions);
        const buyBoxPercStr = findValue(row, mappings.buy_box_percentage);
        const browserSessionsStr = findValue(row, mappings.browser_sessions);
        const mobileAppSessionsStr = findValue(row, mappings.mobile_app_sessions);
        const page_views = pageViewsStr ? parseInt(pageViewsStr.replace(/,/g, "")) : 0;
        const ad_sales_perc = adSalesPercStr ? parseFloat(adSalesPercStr.replace(/,/g, "")) : 0;
        const tos_is = tosIsStr ? parseFloat(tosIsStr.replace(/,/g, "")) : 0;
        const sessions = sessionsStr ? parseInt(sessionsStr.replace(/,/g, "")) : 0;
        const buy_box_percentage = buyBoxPercStr ? parseFloat(buyBoxPercStr.replace(/,/g, "")) : 0;
        const browser_sessions = browserSessionsStr ? parseInt(browserSessionsStr.replace(/,/g, "")) : 0;
        const mobile_app_sessions = mobileAppSessionsStr ? parseInt(mobileAppSessionsStr.replace(/,/g, "")) : 0;

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
          cpc,
          conversion_rate,
          conversions,
          same_sku_sales,
          same_sku_orders,
          daily_budget,
          total_budget,
          max_spend,
          avg_spend,
          total_sales,
          total_acos,
          total_units,
          organic_sales,
          organic_orders,
          page_views,
          ad_sales_perc,
          tos_is,
          sessions,
          buy_box_percentage,
          browser_sessions,
          mobile_app_sessions,
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
