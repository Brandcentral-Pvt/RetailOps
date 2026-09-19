const { sql, getPool, generateId } = require('../database/db');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const SocketService = require('../services/socketService');
const { resolveSellerScope, bindSellerFilter } = require('../utils/sellerScope');

// Configurable so tests (and deployments with a mounted volume) can redirect
// generated workbooks; defaults to the historical location.
const EXPORTS_DIR = process.env.ADS_EXPORTS_DIR || path.join(__dirname, '../uploads/exports');
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

const updateDownloadStatus = async (pool, id, status, progress, filePath = null) => {
    let q = `UPDATE Downloads SET Status = @status, Progress = @progress`;
    if (filePath) { q += `, FilePath = @filePath`; }
    q += ` WHERE Id = @id`;

    const req = pool.request()
        .input('id', sql.VarChar, id)
        .input('status', sql.VarChar, status)
        .input('progress', sql.Int, progress);
    
    if (filePath) req.input('filePath', sql.VarChar, filePath);
    
    await req.query(q);
    SocketService.emitExportUpdate(id, { status, progress, filePath });
};

/**
 * Start an ads export.
 *
 * Fixes carried over from docs/ads-module-deep-dive.md:
 *  - F2a: the route now enforces the `adsreport_export` permission (it used to
 *         be `auth` only, so any signed-in user could export every seller).
 *  - F2b: `Downloads.UserId` was written from `req.user.id`, which does not
 *         exist on this middleware's user object (it sets `Id`/`_id`) — the row
 *         was written with a null owner.
 *  - F2c: seller scope is resolved here, before the job is queued, and the
 *         resolveed scope drives the SQL filter instead of a raw body value.
 *  - F11: the query now filters `ReportType`, so 'daily' and 'monthly' rows are
 *         never summed together (monthly rows are aggregates of the same days).
 */
exports.startAdsExport = async (req, res) => {
    try {
        const { startDate, endDate, search, groupBy = 'asin', format = 'xlsx', reportType = 'daily' } = req.body;
        const userId = req.user?.Id || req.user?._id || req.userId || 'system';
        const downloadId = generateId();

        const pool = await getPool();

        // Authorise the requested seller(s) before anything is queued.
        const scope = resolveSellerScope(req.user, req.body.sellerId);
        if (scope.denied) {
            return res.status(403).json({
                success: false,
                code: 'forbidden_seller',
                message: 'You do not have access to the requested seller(s).',
                requestedSellers: scope.requested,
                assignedSellers: scope.allowed,
            });
        }

        const params = {
            requestedSeller: scope.requested,
            allowedSellerIds: scope.sellerIds,
            isGlobal: scope.isGlobal,
            unrestricted: scope.unrestricted,
            startDate: startDate || null,
            endDate: endDate || null,
            search: search || null,
            groupBy,
            reportType: reportType === 'monthly' ? 'monthly' : 'daily',
            format,
        };

        const insertQuery = `
            INSERT INTO Downloads (Id, UserId, FileName, FilePath, Format, Status, Params, CreatedAt)
            VALUES (@id, @userId, @fileName, '', @format, 'pending', @params, dbo.GetEnvDate())
        `;
        const fileName = `ads_export_${Date.now()}.${format}`;

        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('userId', sql.VarChar, userId)
            .input('format', sql.VarChar, format)
            .input('params', sql.NVarChar, JSON.stringify({ ...params, fileName }))
            .input('fileName', sql.VarChar, fileName)
            .query(insertQuery);

        res.json({ success: true, downloadId, message: 'Ads export started in background' });

        // Background job — scope travels with the job, it is not re-derived.
        processAdsExportJob(downloadId, params, fileName).catch(err => {
            console.error('Error processing ads export:', err);
            updateDownloadStatus(pool, downloadId, 'failed', 0).catch(console.error);
        });

    } catch (error) {
        console.error('startAdsExport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

async function processAdsExportJob(downloadId, params, fileName) {
    const pool = await getPool();
    await updateDownloadStatus(pool, downloadId, 'processing', 10);

    const { startDate, endDate, search, groupBy, reportType } = params;

    const request = pool.request()
        .input('reportType', sql.VarChar, reportType || 'daily')
        .input('startDate', sql.VarChar, startDate || null)
        .input('endDate', sql.VarChar, endDate || null);

    // Dates are bound as strings and CAST in SQL: the pool does not run in UTC,
    // so JS Date objects shift the window by a day in IST.
    let whereClause = 'WHERE p.ReportType = @reportType';
    if (startDate) {
        whereClause += ' AND p.Date >= CAST(@startDate AS date)';
    } else {
        whereClause += ' AND p.Date >= DATEADD(day, -30, dbo.GetEnvDate())';
    }
    if (endDate) {
        whereClause += ' AND p.Date <= CAST(@endDate AS date)';
    }

    if (search) {
        whereClause += ' AND (p.Asin LIKE @search OR a.Sku LIKE @search OR a.Title LIKE @search)';
        request.input('search', sql.VarChar, `%${search}%`);
    }

    // Rebuild the scope from the stored job params (never from live request state)
    // and bind it as a parameterised IN list; failure-closed when empty.
    const scopeForFilter = {
        isGlobal: !!params.isGlobal,
        unrestricted: !!params.unrestricted,
        sellerIds: Array.isArray(params.allowedSellerIds) ? params.allowedSellerIds : [],
    };
    whereClause += bindSellerFilter(request, scopeForFilter, { alias: 'a', prefix: 'expScope' });

    await updateDownloadStatus(pool, downloadId, 'processing', 20);

    const isParentGroup = groupBy === 'parent';
    const query = `
        SELECT 
            ${isParentGroup ? "COALESCE(NULLIF(a.ParentAsin, ''), p.Asin)" : 'p.Asin'} as [ASIN],
            COALESCE(MAX(a.Sku), MAX(p.AdvertisedSku), 'N/A') as [SKU],
            COALESCE(MAX(a.Title), 'Unknown Title') as [Title],
            MAX(a.Brand) as [Brand],
            MAX(a.Category) as [Category],
            MAX(a.SellerId) as [Seller Id],
            MAX(s.Name) as [Seller],
            SUM(ISNULL(p.AdSpend, 0)) as Spend,
            SUM(ISNULL(p.AdSales, 0)) as Sales,
            SUM(ISNULL(p.OrganicSales, 0)) as [Organic Sales],
            SUM(ISNULL(p.OrganicOrders, 0)) as [Organic Orders],
            SUM(ISNULL(p.Orders, 0)) as Orders,
            SUM(ISNULL(p.Impressions, 0)) as Impressions,
            SUM(ISNULL(p.Clicks, 0)) as Clicks,
            SUM(ISNULL(p.PageViews, 0)) as [Page Views],
            SUM(ISNULL(p.TotalUnits, 0)) as Units,
            SUM(ISNULL(p.SameSkuSales, 0)) as [Same SKU Sales]
        FROM AdsPerformance p
        LEFT JOIN Asins a ON p.Asin = a.AsinCode
        LEFT JOIN Sellers s ON s.Id = a.SellerId
        ${whereClause}
        GROUP BY ${isParentGroup ? "COALESCE(NULLIF(a.ParentAsin, ''), p.Asin)" : 'p.Asin'}
    `;

    const result = await request.query(query);
    const rawData = result.recordset;

    await updateDownloadStatus(pool, downloadId, 'processing', 40);

    const exportData = rawData.map(row => {
        const Spend = Number(row.Spend || 0);
        const Sales = Number(row.Sales || 0);
        const Organic = Number(row['Organic Sales'] || 0);
        const TotalSales = Sales + Organic;
        const Orders = Number(row.Orders || 0);
        const Impressions = Number(row.Impressions || 0);
        const Clicks = Number(row.Clicks || 0);

        return {
            ASIN: row.ASIN,
            SKU: row.SKU,
            Title: row.Title,
            Brand: row.Brand || '—',
            Category: row.Category || '—',
            Seller: row.Seller || row['Seller Id'] || '—',
            Spend: '₹' + Spend.toFixed(2),
            Sales: '₹' + Sales.toFixed(2),
            'Organic Sales': '₹' + Organic.toFixed(2),
            'Total Sales': '₹' + TotalSales.toFixed(2),
            Orders,
            Impressions,
            Clicks,
            'Page Views': Number(row['Page Views'] || 0),
            Units: Number(row.Units || 0),
            ACOS: Sales > 0 ? ((Spend / Sales) * 100).toFixed(2) + '%' : '—',
            TACOS: TotalSales > 0 ? ((Spend / TotalSales) * 100).toFixed(2) + '%' : '—',
            ROAS: Spend > 0 ? (Sales / Spend).toFixed(2) : '—',
            CTR: Impressions > 0 ? ((Clicks / Impressions) * 100).toFixed(2) + '%' : '—',
            CVR: Clicks > 0 ? ((Orders / Clicks) * 100).toFixed(2) + '%' : '—',
        };
    });

    await updateDownloadStatus(pool, downloadId, 'processing', 70);

    const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);
    
    // ExcelJS for .xlsx files
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ads Data');
    
    if (exportData.length > 0) {
        const keys = Object.keys(exportData[0]);
        worksheet.columns = keys.map(key => ({
            header: key,
            key: key,
            width: key === 'Title' ? 40 : 18
        }));
        
        exportData.forEach(row => worksheet.addRow(row));
        
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 24;
    }
    
    await workbook.xlsx.writeFile(filePath);

    await updateDownloadStatus(pool, downloadId, 'completed', 100, `/exports/${downloadId}_${fileName}`);
}
