import { Spinner, LoadingIndicator } from "@/components/Spinner";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useTransition,
} from "react";
import {
  Table,
  Button,
  DatePicker,
  Upload,
  Modal,
  Typography,
  Space,
  Input,
  Tag,
  Tooltip,
  message,
  Progress,
  Select,
  Segmented,
  Radio,
} from "antd";
import {
  UploadOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import Chart from "react-apexcharts";
import { sellerApi, gmsApi, exportApi } from "../services/api";
import { userApi } from "../services/api";
import { useDateRange } from "../contexts/DateRangeContext";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";

import { LoadError } from "@/components/LoadError";
import { GmsTrackerSkeleton } from "@/components/ui/PageSkeletons";
import { Panel, MiniState, timeAgo, useNow } from "./opsCenter/primitives";
import "./opsCenter/ops.css";
import "./ads/ads.css";
import "./gms.css";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

const { Text } = Typography;

// Helper to pre-resolve seller names (resolvedDbBrand) for GMS records
const resolveDbBrands = (data, asins, sellers) => {
  if (!data || !Array.isArray(data)) return [];
  const asinMap = new Map();
  asins.forEach((a) => {
    asinMap.set((a.asinCode || "").toUpperCase(), a);
  });
  const sellerMap = new Map();
  sellers.forEach((s) => {
    sellerMap.set(s._id || s.id, s.name || "");
  });

  return data.map((d) => {
    if (d.resolvedDbBrand) return d;
    const matchedDbAsin = asinMap.get((d.asin || "").toUpperCase());
    let dbBrandName = "";
    if (matchedDbAsin) {
      if (matchedDbAsin.brand) {
        dbBrandName = matchedDbAsin.brand;
      } else if (matchedDbAsin.sellerName) {
        dbBrandName = matchedDbAsin.sellerName;
      } else if (matchedDbAsin.sellerId) {
        const matchedSellerName = sellerMap.get(matchedDbAsin.sellerId);
        if (matchedSellerName) {
          dbBrandName = matchedSellerName;
        }
      }
    }
    const resolvedSellerId =
      d.sellerId != null ? d.sellerId : (matchedDbAsin?.sellerId ?? null);
    return {
      ...d,
      resolvedDbBrand: d.dbBrand || dbBrandName || "-",
      resolvedSellerId,
    };
  });
};

// Pre-compute MoM, WoW, DoD trends for all rows from grouped data — no gmsData scanning
const precomputeTrends = (rows) => {
  rows.forEach((row) => {
    row._momTrends = {};
    row._wowTrends = {};
    row._dodTrends = {};

    // MoM: current month vs previous month from row.monthlyRev
    const months = Object.keys(row.monthlyRev).sort((a, b) =>
      a.localeCompare(b),
    );
    for (let i = 1; i < months.length; i++) {
      const curr = row.monthlyRev[months[i]] || 0;
      const prev = row.monthlyRev[months[i - 1]] || 0;
      row._momTrends[months[i]] =
        prev > 0 ? ((curr - prev) / prev) * 100 : null;
    }

    // WoW: current week vs previous week from row.weeklyRev
    const weeks = Object.keys(row.weeklyRev).sort((a, b) => a.localeCompare(b));
    for (let i = 1; i < weeks.length; i++) {
      const curr = row.weeklyRev[weeks[i]] || 0;
      const prev = row.weeklyRev[weeks[i - 1]] || 0;
      row._wowTrends[weeks[i]] = prev > 0 ? ((curr - prev) / prev) * 100 : null;
    }

    // DoD: each day vs previous day from row.dailyRev
    const days = Object.keys(row.dailyRev).sort((a, b) => a.localeCompare(b));
    for (let i = 1; i < days.length; i++) {
      const curr = row.dailyRev[days[i]] || 0;
      const prev = row.dailyRev[days[i - 1]] || 0;
      row._dodTrends[days[i]] = prev > 0 ? ((curr - prev) / prev) * 100 : null;
    }
  });
  return rows;
};

// Get pre-computed trend for a record by period and key
const getTrend = (record, period, key) => {
  if (!record || !key || typeof key !== "string") return null;
  const trendMap =
    period === "month"
      ? record._momTrends
      : period === "week"
        ? record._wowTrends
        : record._dodTrends;
  return trendMap?.[key] ?? null;
};

// Compact INR for tight KPI tiles: ₹4.2Cr / ₹38.5L / ₹9,400 / ₹0
const formatCompactINR = (value) => {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e6) return `${sign}₹${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
};

const formatCompactCount = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e4) return `${sign}${(abs / 1e3).toFixed(1)}k`;
  return `${sign}${Math.round(abs).toLocaleString("en-IN")}`;
};

// Short, human label for the comparison window (e.g. "vs prior 15d")
const describeWindow = (from, to) => {
  if (!from || !to) return null;
  const days = Math.round((dayjs(to).diff(dayjs(from), "day") || 0) + 1);
  return { text: `vs prior ${days}d`, title: `Compared against the ${days} days immediately before` };
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function GmsTrackerPage() {
  const { isAdmin, isGlobalUser, hasPermission } = useAuth();
  const { setPageMeta } = useHeader();
  const [gmsData, setGmsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadDate, setUploadDate] = useState(dayjs());
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedManagers, setSelectedManagers] = useState([]);
  const { startDate, endDate } = useDateRange();
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [fileList, setFileList] = useState([]);
  const [viewLevel, setViewLevel] = useState("asin"); // 'asin' or 'seller'
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportLevel, setExportLevel] = useState("asin");
  const [exportDateType, setExportDateType] = useState("current");
  const [exportCustomDates, setExportCustomDates] = useState(null);
  const [exportBrandType, setExportBrandType] = useState("current");
  const [exportCustomBrands, setExportCustomBrands] = useState([]);
  const [exportDataType, setExportDataType] = useState("daily");
  const [exportFileType, setExportFileType] = useState("xlsx");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(50);

  // Database Sellers / Brands / Managers
  const [dbSellers, setDbSellers] = useState([]);
  const [dbManagers, setDbManagers] = useState([]);
  const dbAsinsRef = useRef([]);
  const dbSellersRef = useRef([]); // Cached for date-change refetch (avoids re-fetching static data)
  const staticLoadedRef = useRef(false);

  // Deferred filter transition for smooth UX during heavy filter recomputation
  const [isFilterPending, startFilterTransition] = useTransition();

  // Upload Progress States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");

  const loadMountedRef = useRef(true);
// Fetch Brands/Sellers, ASINs & GMS data — only static data once, GMS data on every date change
  const loadAllData = useCallback(async () => {
    if (!loadMountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      let sellers = dbSellersRef.current;
      let asins = dbAsinsRef.current;

      // Only fetch sellers/asins/managers on the first load
      if (!staticLoadedRef.current) {
        const [sellersRes, asinsRes, managersRes] = await Promise.all([
          sellerApi.getAll({ limit: 1000 }).catch(() => null),
          gmsApi.getAsins().catch(() => null),
          userApi.getManagers().catch(() => null),
        ]);

        if (sellersRes?.success && sellersRes.data?.sellers) {
          sellers = sellersRes.data.sellers;
          dbSellersRef.current = sellers;
          setDbSellers(sellers);
        }
        if (asinsRes?.success && asinsRes.data) {
          asins = asinsRes.data || [];
          dbAsinsRef.current = asins;
        }
        if (managersRes?.success && managersRes.data) {
          setDbManagers(managersRes.data);
        }
        staticLoadedRef.current = true;
      }

      // Always re-fetch GMS data when date range changes
      const effectiveStart =
        startDate || dayjs().startOf("month").format("YYYY-MM-DD");
      const effectiveEnd =
        endDate || dayjs().endOf("month").format("YYYY-MM-DD");
      const gmsRes = await gmsApi
        .getAll({
          startDate: effectiveStart,
          endDate: effectiveEnd,
        })
        .catch(() => null);

      if (gmsRes?.success && gmsRes.data) {
        const resolved = resolveDbBrands(gmsRes.data, asins, sellers);
        setGmsData(resolved);
      }
      setLastLoadedAt(Date.now());
    } catch (err) {
      console.error("Failed to load GMS data:", err);
      setError("Failed to load GMS data. Please try again.");
    } finally {
      if (loadMountedRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadMountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadAllData is async; initial data fetch is standard pattern
    loadAllData().finally(() => {
      loadMountedRef.current = false;
    });
    return () => {
      loadMountedRef.current = false;
    };
  }, [loadAllData]);

  useEffect(() => {
    setPageMeta({
      title: 'GMS Tracker',
      subtitle: 'Spreadsheet matrix of Ordered Revenue across ASINs and Sellers',
      breadcrumbs: [{ label: 'Workspace' }, { label: 'GMS Tracker' }],
    });
  }, [setPageMeta]);

  const clearAllData = useCallback(() => {
    Modal.confirm({
      title: "Are you sure you want to clear all GMS Tracker data?",
      content:
        "This will delete all uploaded GMS records permanently from the database.",
      okText: "Clear Data",
      okType: "danger",
      cancelText: "Cancel",
      async onOk() {
        try {
          const res = await gmsApi.clearAll();
          if (res.success) {
            setGmsData([]);
            message.success("GMS Tracker cleared successfully.");
          }
        } catch (err) {
          message.error("Failed to clear GMS data: " + err.message);
        }
      },
    });
  }, []);

  // Handle GMS spreadsheet matrix export via background job served in Downloads drawer
  const handleExport = async () => {
    try {
      // selectedBrands holds seller IDs — resolve to names for export backend (which filters by name)
      const resolvedSelectedBrands = selectedBrands
        .map((id) => dbSellers.find((s) => (s._id || s.id) === id)?.name)
        .filter(Boolean);
      const exportParams = {
        exportLevel,
        exportDateType,
        exportCustomDates:
          exportDateType === "custom" &&
          exportCustomDates &&
          exportCustomDates[0] &&
          exportCustomDates[1]
            ? [
                exportCustomDates[0].toISOString(),
                exportCustomDates[1].toISOString(),
              ]
            : null,
        exportBrandType,
        exportCustomBrands,
        exportDataType,
        exportFileType,
        startDate:
          exportDateType === "current" && startDate
            ? dayjs(startDate).format("YYYY-MM-DD")
            : null,
        endDate:
          exportDateType === "current" && endDate
            ? dayjs(endDate).format("YYYY-MM-DD")
            : null,
        selectedBrands: resolvedSelectedBrands,
      };

      message.loading({
        content: "Initiating GMS matrix export...",
        key: "gms-export",
        duration: 2,
      });

      const res = await exportApi.startGmsExport(exportParams);
      if (res.success) {
        message.success({
          content:
            "GMS export started! Open the Downloads drawer to track progress.",
          key: "gms-export",
          duration: 3,
        });
        setIsExportOpen(false);
        // Trigger Header drawer slide open
        window.dispatchEvent(new CustomEvent("export-started"));
      } else {
        throw new Error(res.message || "Export failed to start");
      }
    } catch (err) {
      message.error({
        content: "GMS export failed: " + err.message,
        key: "gms-export",
        duration: 4,
      });
    }
  };

  // Extract unique brands from database sellers only
  const uniqueBrands = useMemo(() => {
    return dbSellers
      .map((s) => s.name)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));
  }, [dbSellers]);

  // Handle CSV file parsing with visual loading stages
  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Uploading report to database...");

    try {
      const formattedDate = uploadDate.format("YYYY-MM-DD");
      const res = await gmsApi.upload(file, formattedDate, (percent) => {
        setUploadProgress(Math.min(95, percent));
        if (percent >= 100) {
          setUploadStatus("Processing and ingestion running on server...");
        }
      });

      if (res.success) {
        setUploadProgress(100);
        setUploadStatus("Processing completed successfully!");
        message.success(
          `Successfully uploaded GMS report: ${res.processed} rows processed, ${res.skipped} skipped.`,
        );

        const effectiveStart =
          startDate || dayjs().startOf("month").format("YYYY-MM-DD");
        const effectiveEnd =
          endDate || dayjs().endOf("month").format("YYYY-MM-DD");
        const freshGms = await gmsApi.getAll({
          startDate: effectiveStart,
          endDate: effectiveEnd,
        });
        if (freshGms.success && freshGms.data) {
          const resolved = resolveDbBrands(
            freshGms.data,
            dbAsinsRef.current,
            dbSellersRef.current,
          );
          setGmsData(resolved);
        }

        setTimeout(() => {
          setIsUploadOpen(false);
          setIsUploading(false);
          setFileList([]);
          setUploadProgress(0);
          setUploadStatus("");
        }, 800);
      } else {
        throw new Error(res.error || "Ingestion failed");
      }
    } catch (err) {
      console.error(err);
      message.error("File upload failed: " + err.message);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
    }
    return false; // prevent default upload
  };

  // Filter Data — pre-compute date boundaries to avoid per-item dayjs creation
  const filteredData = useMemo(() => {
    const startMs = startDate ? dayjs(startDate).startOf("day").valueOf() : 0;
    const endMs = endDate ? dayjs(endDate).endOf("day").valueOf() : Infinity;
    const hasDateFilter = !!startDate && !!endDate;
    const sellerIdSet =
      selectedBrands.length > 0 ? new Set(selectedBrands) : null;
    const searchLower = searchQuery ? searchQuery.toLowerCase() : "";

    // Resolve manager -> seller IDs filter
    let managerSellerIds = null;
    if (selectedManagers.length > 0) {
      managerSellerIds = new Set();
      dbManagers.forEach((m) => {
        if (selectedManagers.includes(m._id || m.id)) {
          (m.assignedSellers || []).forEach((s) =>
            managerSellerIds.add(s._id || s.id || s.SellerId),
          );
        }
      });
    }

    return gmsData.filter((item) => {
      if (hasDateFilter) {
        const itemMs = new Date(item.date).getTime();
        if (itemMs < startMs || itemMs > endMs) return false;
      }
      if (sellerIdSet) {
        const effectiveSellerId = item.sellerId ?? item.resolvedSellerId;
        if (!effectiveSellerId || !sellerIdSet.has(effectiveSellerId))
          return false;
      }
      if (managerSellerIds) {
        const effectiveSellerId = item.sellerId ?? item.resolvedSellerId;
        if (!effectiveSellerId || !managerSellerIds.has(effectiveSellerId))
          return false;
      }
      if (searchLower) {
        if (
          !(item.asin && item.asin.toLowerCase().includes(searchLower)) &&
          !(
            item.productTitle &&
            item.productTitle.toLowerCase().includes(searchLower)
          ) &&
          !(item.brand && item.brand.toLowerCase().includes(searchLower)) &&
          !(item.dbBrand && item.dbBrand.toLowerCase().includes(searchLower)) &&
          !(
            item.resolvedDbBrand &&
            item.resolvedDbBrand.toLowerCase().includes(searchLower)
          ) &&
          !(
            item.storeCode && item.storeCode.toLowerCase().includes(searchLower)
          )
        )
          return false;
      }
      return true;
    });
  }, [
    gmsData,
    startDate,
    endDate,
    selectedBrands,
    selectedManagers,
    searchQuery,
    dbManagers,
  ]);

  // Reset table pagination when filters change
  useEffect(() => {
    const timer = setTimeout(() => setTablePage(1), 0);
    return () => clearTimeout(timer);
  }, [selectedBrands, selectedManagers, searchQuery, viewLevel]);

  // Aggregate Metrics for KPIs
  const kpiMetrics = useMemo(() => {
    let orderedRevenue = 0;
    let orderedUnits = 0;
    let shippedRevenue = 0;
    let shippedCOGS = 0;
    let shippedUnits = 0;
    let customerReturns = 0;

    filteredData.forEach((d) => {
      orderedRevenue += d.orderedRevenue;
      orderedUnits += d.orderedUnits;
      shippedRevenue += d.shippedRevenue;
      shippedCOGS += d.shippedCOGS;
      shippedUnits += d.shippedUnits;
      customerReturns += d.customerReturns;
    });

    const profit = shippedRevenue - shippedCOGS;
    const marginPct = shippedRevenue > 0 ? (profit / shippedRevenue) * 100 : 0;
    const returnRatio =
      orderedUnits > 0 ? (customerReturns / orderedUnits) * 100 : 0;

    return {
      orderedRevenue,
      orderedUnits,
      shippedRevenue,
      shippedCOGS,
      shippedUnits,
      customerReturns,
      profit,
      marginPct,
      returnRatio,
    };
  }, [filteredData]);

  // Compute period-over-period change: the most recent half of the date
  // range vs the equally-sized window immediately preceding it.
  // Returns null for a metric when there is no prior period to compare against,
  // so the UI can render "no prior period" instead of a misleading 0%.
  const percentageChanges = useMemo(() => {
    const sortedDates = [...new Set(filteredData.map((d) => d.date))].sort(
      (a, b) => String(a).localeCompare(String(b)),
    );

    if (sortedDates.length < 2) {
      return { changes: null, window: null };
    }

    const periodLen = Math.ceil(sortedDates.length / 2);
    const currentDates = new Set(sortedDates.slice(-periodLen));
    const priorDates = new Set(
      sortedDates.slice(-periodLen * 2, -periodLen),
    );

    if (priorDates.size === 0) {
      return { changes: null, window: null };
    }

    const window = describeWindow(
      [...priorDates].sort()[0],
      [...currentDates].sort().slice(-1)[0],
    );

    // Sum a numeric field across both windows
    const sumIn = (dates, field) =>
      filteredData.reduce(
        (acc, d) => (dates.has(d.date) ? acc + (d[field] || 0) : acc),
        0,
      );

    // Percent change; null when the baseline is zero (don't fake a 0%)
    const pctChange = (current, prior) =>
      prior === 0 ? null : ((current - prior) / Math.abs(prior)) * 100;

    const profitIn = (dates) =>
      sumIn(dates, "shippedRevenue") - sumIn(dates, "shippedCOGS");

    const ratioIn = (dates) => {
      const units = sumIn(dates, "orderedUnits");
      return units > 0 ? (sumIn(dates, "customerReturns") / units) * 100 : 0;
    };

    const currentProfit = profitIn(currentDates);
    const priorProfit = profitIn(priorDates);
    const currentRatio = ratioIn(currentDates);
    const priorRatio = ratioIn(priorDates);

    return {
      window,
      changes: {
        orderedRevenue: pctChange(
          sumIn(currentDates, "orderedRevenue"),
          sumIn(priorDates, "orderedRevenue"),
        ),
        orderedUnits: pctChange(
          sumIn(currentDates, "orderedUnits"),
          sumIn(priorDates, "orderedUnits"),
        ),
        shippedRevenue: pctChange(
          sumIn(currentDates, "shippedRevenue"),
          sumIn(priorDates, "shippedRevenue"),
        ),
        shippedCOGS: pctChange(
          sumIn(currentDates, "shippedCOGS"),
          sumIn(priorDates, "shippedCOGS"),
        ),
        shippedUnits: pctChange(
          sumIn(currentDates, "shippedUnits"),
          sumIn(priorDates, "shippedUnits"),
        ),
        customerReturns: pctChange(
          sumIn(currentDates, "customerReturns"),
          sumIn(priorDates, "customerReturns"),
        ),
        profit: pctChange(currentProfit, priorProfit),
        returnRatio: pctChange(currentRatio, priorRatio),
      },
    };
  }, [filteredData]);

  // MEMO 1 — Build aggregated rows, fixed columns, and month/week/day groupings from filteredData
  const { tableDataSource, fixedCols, monthGroups } = useMemo(() => {
    if (filteredData.length === 0) {
      return { tableDataSource: [], fixedCols: [], monthGroups: {} };
    }

    let rows;
    let fixedCols;

    if (viewLevel === "seller") {
      const sellersMap = {};
      filteredData.forEach((d) => {
        const isUnmatched = !d.resolvedDbBrand || d.resolvedDbBrand === "-";
        const sellerName = !isUnmatched ? d.resolvedDbBrand : d.brand || "-";
        if (!sellersMap[sellerName]) {
          sellersMap[sellerName] = {
            key: sellerName,
            dbBrand: sellerName,
            isUnmatched: isUnmatched,
            asins: new Set(),
            brands: new Set(),
            storeCodes: new Set(),
            orderedUnits: 0,
            dailyRev: {},
            weeklyRev: {},
            monthlyRev: {},
          };
        }
        const s = sellersMap[sellerName];
        if (d.asin) s.asins.add(d.asin);
        if (d.brand) s.brands.add(d.brand);
        if (d.storeCode) s.storeCodes.add(d.storeCode);
        s.orderedUnits += d.orderedUnits || 0;

        const dObj = dayjs(d.date);
        const dateStr = d.date;
        const monthKey = dObj.format("YYYY-MM");
        const weekNum = dObj.isoWeek();
        const weekKey = `${dObj.format("YYYY")}-W${String(weekNum).padStart(2, "0")}`;

        // Day Revenue
        if (!s.dailyRev[dateStr]) s.dailyRev[dateStr] = 0;
        s.dailyRev[dateStr] += d.orderedRevenue;

        // Week Revenue
        if (!s.weeklyRev[weekKey]) s.weeklyRev[weekKey] = 0;
        s.weeklyRev[weekKey] += d.orderedRevenue;

        // Month Revenue
        if (!s.monthlyRev[monthKey]) s.monthlyRev[monthKey] = 0;
        s.monthlyRev[monthKey] += d.orderedRevenue;
      });

      rows = Object.values(sellersMap).map((s) => ({
        ...s,
        asinsList: Array.from(s.asins),
        brandsList: Array.from(s.brands),
        storeCodesList: Array.from(s.storeCodes),
      }));

      fixedCols = [
        {
          title: "Seller (DB)",
          dataIndex: "dbBrand",
          key: "dbBrand",
          width: 140,
          sorter: (a, b) => (a.dbBrand || "").localeCompare(b.dbBrand || ""),
          render: (text, record) => {
            if (record.isUnmatched) {
              return (
                <Space>
                  <Text type="secondary">{text}</Text>
                  <Tag
                    color="orange"
                    style={{
                      border: "none",
                      fontSize: 9,
                      margin: 0,
                      padding: "0 4px",
                      lineHeight: "14px",
                    }}
                  >
                    Unmatched
                  </Tag>
                </Space>
              );
            }
            return <Text strong>{text}</Text>;
          },
        },
        {
          title: "ASIN",
          dataIndex: "asin",
          key: "asin",
          width: 120,
          render: () => "-",
        },
        {
          title: "Brand (Sheet)",
          dataIndex: "brand",
          key: "brand",
          width: 120,
          render: (_text, record) =>
            record.brandsList && record.brandsList.length > 0
              ? record.brandsList.join(", ")
              : "-",
          sorter: (a, b) => (a.brand || "").localeCompare(b.brand || ""),
        },
        {
          title: "Store Code",
          dataIndex: "storeCode",
          key: "storeCode",
          width: 90,
          render: (_text, record) =>
            record.storeCodesList && record.storeCodesList.length > 0
              ? record.storeCodesList.join(", ")
              : "-",
          sorter: (a, b) =>
            (a.storeCode || "").localeCompare(b.storeCode || ""),
        },
        {
          title: "Orders",
          dataIndex: "orderedUnits",
          key: "orderedUnits",
          width: 80,
          align: "center",
          render: (v) => (
            <Text
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                color: "#1349c6",
              }}
            >
              {(v || 0).toLocaleString()}
            </Text>
          ),
          sorter: (a, b) => (a.orderedUnits || 0) - (b.orderedUnits || 0),
        },
      ];
    } else {
      // Group by ASIN to generate rows
      const asinsMap = {};
      filteredData.forEach((d) => {
        if (!asinsMap[d.asin]) {
          asinsMap[d.asin] = {
            key: d.asin,
            asin: d.asin,
            productTitle: d.productTitle || "-",
            dbBrand: d.resolvedDbBrand || "-",
            brand: d.brand || "Generic",
            storeCode: d.storeCode || "IN",
            orderedUnits: 0,
            dailyRev: {},
            weeklyRev: {},
            monthlyRev: {},
          };
        }
        asinsMap[d.asin].orderedUnits += d.orderedUnits || 0;

        const dObj = dayjs(d.date);
        const dateStr = d.date;
        const monthKey = dObj.format("YYYY-MM");
        const weekNum = dObj.isoWeek();
        const weekKey = `${dObj.format("YYYY")}-W${String(weekNum).padStart(2, "0")}`;

        // Day Revenue
        if (!asinsMap[d.asin].dailyRev[dateStr])
          asinsMap[d.asin].dailyRev[dateStr] = 0;
        asinsMap[d.asin].dailyRev[dateStr] += d.orderedRevenue;

        // Week Revenue
        if (!asinsMap[d.asin].weeklyRev[weekKey])
          asinsMap[d.asin].weeklyRev[weekKey] = 0;
        asinsMap[d.asin].weeklyRev[weekKey] += d.orderedRevenue;

        // Month Revenue
        if (!asinsMap[d.asin].monthlyRev[monthKey])
          asinsMap[d.asin].monthlyRev[monthKey] = 0;
        asinsMap[d.asin].monthlyRev[monthKey] += d.orderedRevenue;
      });

      rows = Object.values(asinsMap);

      fixedCols = [
        {
          title: "Seller (DB)",
          dataIndex: "dbBrand",
          key: "dbBrand",
          width: 140,
          sorter: (a, b) => (a.dbBrand || "").localeCompare(b.dbBrand || ""),
        },
        {
          title: "ASIN",
          dataIndex: "asin",
          key: "asin",
          width: 120,
          render: (text) => (
            <Text strong style={{ fontFamily: "monospace" }}>
              {text}
            </Text>
          ),
          sorter: (a, b) => (a.asin || "").localeCompare(b.asin || ""),
        },
        {
          title: "Brand (Sheet)",
          dataIndex: "brand",
          key: "brand",
          width: 120,
          sorter: (a, b) => (a.brand || "").localeCompare(b.brand || ""),
        },
        {
          title: "Store Code",
          dataIndex: "storeCode",
          key: "storeCode",
          width: 90,
          sorter: (a, b) =>
            (a.storeCode || "").localeCompare(b.storeCode || ""),
        },
        {
          title: "Orders",
          dataIndex: "orderedUnits",
          key: "orderedUnits",
          width: 80,
          align: "center",
          render: (v) => (
            <Text
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                color: "#1349c6",
              }}
            >
              {(v || 0).toLocaleString()}
            </Text>
          ),
          sorter: (a, b) => (a.orderedUnits || 0) - (b.orderedUnits || 0),
        },
      ];
    }

    // Pre-compute all trends after rows are built — eliminates per-cell gmsData scans
    precomputeTrends(rows);

    // Gather and sort all unique dates from filteredData and build month/week/day groupings
    const dates = [...new Set(filteredData.map((d) => d.date))].sort((a, b) =>
      String(a).localeCompare(String(b)),
    );
    const monthGroups = {};

    dates.forEach((dateStr) => {
      const d = dayjs(dateStr);
      const monthKey = d.format("YYYY-MM");
      const monthLabel = d.format("MMMM YYYY");
      const weekNum = d.isoWeek();
      const weekKey = `${d.format("YYYY")}-W${String(weekNum).padStart(2, "0")}`;

      const startOfWeek = d.startOf("isoWeek").format("DD MMM");
      const endOfWeek = d.endOf("isoWeek").format("DD MMM");
      const weekLabel = `Week ${weekNum} (${startOfWeek} - ${endOfWeek})`;

      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = {
          label: monthLabel,
          key: monthKey,
          weeks: {},
        };
      }

      if (!monthGroups[monthKey].weeks[weekKey]) {
        monthGroups[monthKey].weeks[weekKey] = {
          label: weekLabel,
          key: weekKey,
          days: [],
        };
      }

      monthGroups[monthKey].weeks[weekKey].days.push(dateStr);
    });

    return { tableDataSource: rows, fixedCols, monthGroups };
  }, [filteredData, viewLevel]);

  // MEMO 2 — Build column definitions from fixedCols and monthGroups; re-runs only when expand state changes
  const tableColumns = useMemo(() => {
    if (fixedCols.length === 0 && Object.keys(monthGroups).length === 0) {
      return [];
    }

    // Build nested dynamic Excel columns with collapsible month and week levels
    const dynamicCols = Object.values(monthGroups).map((month) => {
      const isMonthExpanded = expandedMonths[month.key] !== false; // default to expanded

      const toggleMonth = (e) => {
        e.stopPropagation();
        setExpandedMonths((prev) => ({
          ...prev,
          [month.key]: !isMonthExpanded,
        }));
      };

      const monthTitle = (
        <span
          className="gms-col-month"
          onClick={toggleMonth}
          style={{ cursor: "pointer" }}
        >
          <span className="gms-col-toggle" style={{ cursor: "pointer" }}>
            {isMonthExpanded ? "▼" : "▶"}
          </span>
          {month.label}
        </span>
      );

      if (!isMonthExpanded) {
        // Collapsed Month: show only Month Total and MoM Trend directly under the Month header
        return {
          title: monthTitle,
          children: [
            {
              title: "Month Total",
              key: `month-total-${month.key}`,
              align: "right",
              width: 130,
              render: (_, record) => {
                const rev = record.monthlyRev[month.key] || 0;
                return rev ? (
                  <span style={{ fontWeight: 800, color: "#0f172a" }}>
                    ₹{rev.toLocaleString("en-IN")}
                  </span>
                ) : (
                  "-"
                );
              },
              sorter: (a, b) =>
                (a.monthlyRev[month.key] || 0) - (b.monthlyRev[month.key] || 0),
            },
            {
              title: "MoM Trend",
              key: `mom-trend-${month.key}`,
              align: "center",
              width: 110,
              render: (_, record) => {
                const trend = getTrend(record, "month", month.key);
                if (trend === null)
                  return <span style={{ color: "#8896ab" }}>-</span>;
                const isUp = trend >= 0;
                return (
                  <Tag
                    color={isUp ? "success" : "error"}
                    style={{ border: "none", fontWeight: 600 }}
                  >
                    {isUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
                  </Tag>
                );
              },
              sorter: (a, b) =>
                (getTrend(a, "month", month.key) || 0) -
                (getTrend(b, "month", month.key) || 0),
            },
          ],
        };
      }

      // Expanded Month: build week sub-columns
      const weekCols = Object.values(month.weeks).map((week) => {
        const isWeekExpanded = expandedWeeks[week.key] === true; // default to collapsed

        const toggleWeek = (e) => {
          e.stopPropagation();
          setExpandedWeeks((prev) => ({
            ...prev,
            [week.key]: !isWeekExpanded,
          }));
        };

        const weekTitle = (
          <span
            className="gms-col-week"
            onClick={toggleWeek}
            style={{ cursor: "pointer" }}
          >
            <span className="gms-col-week-toggle" style={{ cursor: "pointer" }}>
              {isWeekExpanded ? "▼" : "▶"}
            </span>
            {week.label}
          </span>
        );

        if (!isWeekExpanded) {
          // Collapsed Week: show only Week Total and WoW Trend
          return {
            title: weekTitle,
            children: [
              {
                title: "Week Total",
                key: `week-total-${week.key}`,
                align: "right",
                width: 120,
                render: (_, record) => {
                  const rev = record.weeklyRev[week.key] || 0;
                  return rev ? (
                    <span style={{ fontWeight: 600, color: "#1349c6" }}>
                      ₹{rev.toLocaleString("en-IN")}
                    </span>
                  ) : (
                    "-"
                  );
                },
                sorter: (a, b) =>
                  (a.weeklyRev[week.key] || 0) - (b.weeklyRev[week.key] || 0),
              },
              {
                title: "WoW Trend",
                key: `wow-trend-${week.key}`,
                align: "center",
                width: 110,
                render: (_, record) => {
                  const trend = getTrend(record, "week", week.key);
                  if (trend === null)
                    return <span style={{ color: "#8896ab" }}>-</span>;
                  const isUp = trend >= 0;
                  return (
                    <Tag
                      color={isUp ? "success" : "error"}
                      style={{ border: "none", fontWeight: 600 }}
                    >
                      {isUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
                    </Tag>
                  );
                },
                sorter: (a, b) =>
                  (getTrend(a, "week", week.key) || 0) -
                  (getTrend(b, "week", week.key) || 0),
              },
            ],
          };
        }

        // Expanded Week: show day columns with interleaved DoD trend columns
        // Layout: Day1 | Day2 | Trend(1→2) | Day3 | Trend(2→3) | ...
        const sortedDays = [...week.days].sort((a, b) =>
          String(a).localeCompare(String(b)),
        );
        const dayCols = [];

        sortedDays.forEach((dayStr, idx) => {
          // Add the day column
          dayCols.push({
            title: dayjs(dayStr).format("DD MMM"),
            key: `day-${dayStr}`,
            align: "right",
            width: 100,
            render: (_, record) => {
              const rev = record.dailyRev[dayStr] || 0;
              return rev ? `₹${rev.toLocaleString("en-IN")}` : "-";
            },
            sorter: (a, b) =>
              (a.dailyRev[dayStr] || 0) - (b.dailyRev[dayStr] || 0),
          });

          // After the 2nd day onward, add a DoD trend column between prev day and current day
          if (idx > 0) {
            const prevDayStr = sortedDays[idx - 1];
            const currDayStr = dayStr;
            const trendLabel = `${dayjs(prevDayStr).format("DD")}→${dayjs(currDayStr).format("DD")}`;

            dayCols.push({
              title: (
                <Tooltip
                  title={`Trend: ${dayjs(prevDayStr).format("DD MMM")} → ${dayjs(currDayStr).format("DD MMM")}`}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "#1349c6",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ▸ {trendLabel}
                  </span>
                </Tooltip>
              ),
              key: `dod-trend-${prevDayStr}-${currDayStr}`,
              align: "center",
              width: 90,
              render: (_, record) => {
                const prevRev = record.dailyRev[prevDayStr] || 0;
                const currRev = record.dailyRev[currDayStr] || 0;

                if (!prevRev && !currRev)
                  return <span style={{ color: "#8896ab" }}>-</span>;
                if (!prevRev)
                  return (
                    <Tag
                      color="success"
                      style={{
                        border: "none",
                        fontWeight: 600,
                        fontSize: "var(--font-size-xs)",
                      }}
                    >
                      NEW
                    </Tag>
                  );

                const change = ((currRev - prevRev) / prevRev) * 100;
                const isUp = change >= 0;
                return (
                  <Tag
                    color={isUp ? "success" : "error"}
                    style={{
                      border: "none",
                      fontWeight: 600,
                      fontSize: "var(--font-size-xs)",
                      margin: 0,
                    }}
                  >
                    {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                  </Tag>
                );
              },
              sorter: (a, b) => {
                const aPrev = a.dailyRev[prevDayStr] || 0;
                const aCurr = a.dailyRev[currDayStr] || 0;
                const bPrev = b.dailyRev[prevDayStr] || 0;
                const bCurr = b.dailyRev[currDayStr] || 0;
                const aChange = aPrev ? ((aCurr - aPrev) / aPrev) * 100 : 0;
                const bChange = bPrev ? ((bCurr - bPrev) / bPrev) * 100 : 0;
                return aChange - bChange;
              },
            });
          }
        });

        // Week Total
        dayCols.push({
          title: "Week Total",
          key: `week-total-${week.key}`,
          align: "right",
          width: 120,
          render: (_, record) => {
            const rev = record.weeklyRev[week.key] || 0;
            return rev ? (
              <span style={{ fontWeight: 600, color: "#1349c6" }}>
                ₹{rev.toLocaleString("en-IN")}
              </span>
            ) : (
              "-"
            );
          },
          sorter: (a, b) =>
            (a.weeklyRev[week.key] || 0) - (b.weeklyRev[week.key] || 0),
        });

        // WoW Trend
        dayCols.push({
          title: "WoW Trend",
          key: `wow-trend-${week.key}`,
          align: "center",
          width: 110,
          render: (_, record) => {
            const trend = getTrend(record, "week", week.key);
            if (trend === null)
              return <span style={{ color: "#8896ab" }}>-</span>;
            const isUp = trend >= 0;
            return (
              <Tag
                color={isUp ? "success" : "error"}
                style={{ border: "none", fontWeight: 600 }}
              >
                {isUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
              </Tag>
            );
          },
          sorter: (a, b) =>
            (getTrend(a, "week", week.key) || 0) -
            (getTrend(b, "week", week.key) || 0),
        });

        return {
          title: weekTitle,
          children: dayCols,
        };
      });

      // Month Total
      weekCols.push({
        title: "Month Total",
        key: `month-total-${month.key}`,
        align: "right",
        width: 130,
        render: (_, record) => {
          const rev = record.monthlyRev[month.key] || 0;
          return rev ? (
            <span style={{ fontWeight: 800, color: "#0f172a" }}>
              ₹{rev.toLocaleString("en-IN")}
            </span>
          ) : (
            "-"
          );
        },
        sorter: (a, b) =>
          (a.monthlyRev[month.key] || 0) - (b.monthlyRev[month.key] || 0),
      });

      // MoM Trend
      weekCols.push({
        title: "MoM Trend",
        key: `mom-trend-${month.key}`,
        align: "center",
        width: 110,
        render: (_, record) => {
          const trend = getTrend(record, "month", month.key);
          if (trend === null)
            return <span style={{ color: "#8896ab" }}>-</span>;
          const isUp = trend >= 0;
          return (
            <Tag
              color={isUp ? "success" : "error"}
              style={{ border: "none", fontWeight: 600 }}
            >
              {isUp ? "▲" : "▼"} {trend.toFixed(1)}%
            </Tag>
          );
        },
        sorter: (a, b) =>
          (getTrend(a, "month", month.key) || 0) -
          (getTrend(b, "month", month.key) || 0),
      });

      return {
        title: monthTitle,
        children: weekCols,
      };
    });

    return [...fixedCols, ...dynamicCols];
  }, [fixedCols, monthGroups, expandedMonths, expandedWeeks]);

  // Chart configuration — Area chart: Revenue + Orders + Returns
  const chartSeries = useMemo(() => {
    const dailyData = {};
    const dailyOrders = {};
    const dailyReturns = {};
    filteredData.forEach((d) => {
      if (!dailyData[d.date]) {
        dailyData[d.date] = 0;
        dailyOrders[d.date] = 0;
        dailyReturns[d.date] = 0;
      }
      dailyData[d.date] += d.orderedRevenue;
      dailyOrders[d.date] += d.orderedUnits || 0;
      dailyReturns[d.date] += d.customerReturns || 0;
    });

    Object.keys(dailyData).forEach((k) => {
      dailyData[k] = Math.round(dailyData[k]);
      dailyOrders[k] = Math.round(dailyOrders[k]);
      dailyReturns[k] = Math.round(dailyReturns[k]);
    });

    const sortedDates = Object.keys(dailyData).sort((a, b) =>
      String(a).localeCompare(String(b)),
    );
    return {
      options: {
        chart: {
          id: "gms-revenue-trend",
          type: "area",
          toolbar: { show: false },
          zoom: { enabled: false },
          sparkline: { enabled: false },
        },
        colors: ["#1349c6", "#067647", "#d92d20"],
        stroke: { width: [2.5, 2, 1.5], curve: "smooth", dashArray: [0, 0, 4] },
        fill: {
          type: "gradient",
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.3,
            opacityTo: 0.02,
            stops: [0, 90, 100],
          },
        },
        dataLabels: { enabled: false },
        markers: { size: 3, strokeWidth: 1, hover: { size: 6 } },
        xaxis: {
          categories: sortedDates.map((d) => dayjs(d).format("DD MMM")),
          labels: {
            style: { colors: "#64748b", fontSize: "10px", fontWeight: 600 },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
          tickAmount: Math.min(sortedDates.length, 10),
        },
        yaxis: [
          {
            title: {
              text: "Revenue (₹)",
              style: { fontSize: "10px", color: "#64748b", fontWeight: 600 },
            },
            labels: {
              formatter: (val) =>
                `₹${val >= 100000 ? (val / 100000).toFixed(1) + "L" : val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`,
              style: { colors: "#64748b", fontSize: "10px" },
            },
          },
          {
            opposite: true,
            title: {
              text: "Units",
              style: { fontSize: "10px", color: "#067647", fontWeight: 600 },
            },
            labels: { style: { colors: "#067647", fontSize: "10px" } },
          },
        ],
        tooltip: {
          enabled: true,
          shared: true,
          intersect: false,
          theme: "light",
          y: {
            formatter: (val, { seriesIndex }) => {
              if (seriesIndex === 0) return `₹${val.toLocaleString("en-IN")}`;
              return `${val} units`;
            },
          },
        },
        grid: { borderColor: "#eef1f5", strokeDashArray: 4 },
        legend: {
          position: "top",
          horizontalAlign: "right",
          fontSize: "var(--font-size-xs)",
          fontWeight: 600,
          markers: { radius: 3 },
        },
      },
      series: [
        { name: "Revenue", data: sortedDates.map((d) => dailyData[d]) },
        { name: "Orders", data: sortedDates.map((d) => dailyOrders[d]) },
        { name: "Returns", data: sortedDates.map((d) => dailyReturns[d]) },
      ],
    };
  }, [filteredData]);

  const windowMeta = useMemo(() => {
    if (filteredData.length === 0) return null;
    const asins = new Set(filteredData.map((d) => d.asin).filter(Boolean));
    const sellers = new Set(
      filteredData.map((d) => d.resolvedDbBrand).filter(Boolean),
    );
    const dates = filteredData
      .map((d) => d.date)
      .filter(Boolean)
      .sort();
    return {
      records: filteredData.length,
      asins: asins.size,
      sellers: sellers.size,
      last: dates.length ? dates[dates.length - 1] : null,
    };
  }, [filteredData]);

  // Count of active filter dimensions for the "N active" summary
  const activeFilterCount =
    selectedBrands.length +
    selectedManagers.length +
    (searchQuery.trim() ? 1 : 0);

  // Ticks every 30s so the "Synced 4m ago" label doesn't go stale
  const now = useNow(30000);
  const isStale = lastLoadedAt ? now - lastLoadedAt > 5 * 60 * 1000 : false;

  if (loading && gmsData.length === 0) {
    return <Spinner />;
  }

  return (
    <div className="ops ads-page gms-page">
      {loading && gmsData.length > 0 && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}
        >
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}
      {isFilterPending && !loading && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}
        >
          <LoadingIndicator type="line-simple" size="sm" />
        </div>
      )}
      {error && !loading && <LoadError message={error} onRetry={loadAllData} />}

      {/* ══ GMS COMMAND HEADER ══════════════════════════════════════
          One cohesive surface: title/actions → filters → dataset strip.
          Breadcrumb + title stay in the app shell (setPageMeta) to avoid
          duplicating them, matching AdsManagerPage's approach. */}
      <section className="gms-cmd" aria-label="GMS Tracker controls">
        {/* ── Row 1: title + live/date context, then view switcher + actions ── */}
        <div className="gms-cmd__top">
          <div className="gms-cmd__id">
            <h1 className="gms-cmd__title">GMS Tracker</h1>
            <p className="gms-cmd__sub">
              Spreadsheet matrix of ordered revenue across{" "}
              {viewLevel === "seller" ? "sellers" : "ASINs"} with month, week
              and day analysis.
            </p>
          </div>

          <div className="gms-cmd__actions">
            <div className="ops-seg" role="tablist" aria-label="Row grouping">
              {[
                { label: "ASIN View", value: "asin" },
                { label: "Seller View", value: "seller" },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={viewLevel === o.value}
                  className={`ops-seg__btn ${
                    viewLevel === o.value ? "ops-seg__btn--on" : ""
                  }`}
                  onClick={() =>
                    startFilterTransition(() => setViewLevel(o.value))
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>

            <span className="gms-cmd__spacer" />

            {(isAdmin ||
              isGlobalUser ||
              hasPermission("gms_tracker_export")) && (
              <Tooltip title="Export this dataset">
                <Button
                  icon={<DownloadOutlined />}
                  size="small"
                  className="gms-cmd__btn"
                  onClick={() => {
                    setExportLevel(viewLevel);
                    setIsExportOpen(true);
                  }}
                >
                  Export
                </Button>
              </Tooltip>
            )}

            {(isAdmin ||
              isGlobalUser ||
              hasPermission("gms_tracker_import")) && (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                size="small"
                className="gms-cmd__btn gms-cmd__btn--primary"
                onClick={() => setIsUploadOpen(true)}
              >
                Upload Data
              </Button>
            )}

            {(isAdmin ||
              isGlobalUser ||
              hasPermission("gms_tracker_export")) && (
              <Tooltip title="Permanently delete all uploaded GMS records">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  className="gms-cmd__btn gms-cmd__btn--danger"
                  onClick={clearAllData}
                >
                  Clear Data
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── Row 2: filter controls + sync ── */}
        <div className="gms-cmd__bar">
          <span className="gms-cmd__label">Filters</span>

          <div className="gms-cmd__controls">
            <Select
              mode="multiple"
              placeholder="All Sellers"
              size="small"
              allowClear
              maxTagCount="responsive"
              loading={loading}
              value={selectedBrands}
              onChange={(val) =>
                startFilterTransition(() => setSelectedBrands(val))
              }
              options={dbSellers.map((s) => ({
                label: s.name,
                value: s._id || s.id,
              }))}
              className="ops-select gms-cmd__select"
              style={{ minWidth: 150, maxWidth: 230 }}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />

            <Select
              mode="multiple"
              placeholder="All Managers"
              size="small"
              allowClear
              maxTagCount="responsive"
              loading={loading}
              value={selectedManagers}
              onChange={(val) =>
                startFilterTransition(() => setSelectedManagers(val))
              }
              options={dbManagers.map((m) => ({
                label:
                  [m.firstName, m.lastName].filter(Boolean).join(" ").trim() ||
                  m.email,
                value: m._id || m.id,
              }))}
              className="ops-select gms-cmd__select"
              style={{ minWidth: 150, maxWidth: 230 }}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />

            <Input.Search
              placeholder="Search ASIN, SKU, Parent, Title, Brand..."
              size="small"
              allowClear
              className="gms-cmd__search"
              prefix={
                <SearchOutlined
                  style={{ color: "var(--ops-ink-3)", fontSize: 13 }}
                />
              }
              value={searchQuery}
              onChange={(e) =>
                startFilterTransition(() => setSearchQuery(e.target.value))
              }
            />

            {activeFilterCount > 0 && (
              <button
                type="button"
                className="ops-filterchip"
                onClick={() =>
                  startFilterTransition(() => {
                    setSelectedBrands([]);
                    setSelectedManagers([]);
                    setSearchQuery("");
                  })
                }
                title="Clear all filters"
              >
                Clear all
              </button>
            )}
          </div>

          <span className="gms-cmd__spacer" />

          {/* Sync state lives in the control surface, not floating */}
          <div className="gms-cmd__sync">
            <span className="ops-pill ops-pill--live">
              <span className="ops-pill__dot" />
              {viewLevel === "seller" ? "Seller rows" : "ASIN rows"}
            </span>
            <span
              className={`gms-cmd__fresh${isStale ? " gms-cmd__fresh--stale" : ""}`}
              title={
                lastLoadedAt
                  ? `Last synced ${dayjs(lastLoadedAt).format("DD MMM YYYY, HH:mm")}`
                  : undefined
              }
            >
              <span className="gms-cmd__freshdot" />
              {lastLoadedAt ? `Synced ${timeAgo(lastLoadedAt)}` : "Syncing…"}
            </span>
            <Tooltip title="Refresh data">
              <Button
                size="small"
                loading={loading}
                onClick={loadAllData}
                aria-label="Refresh data"
                icon={<ReloadOutlined />}
                className="gms-cmd__refresh"
              />
            </Tooltip>
          </div>
        </div>

        {/* ── Row 3: dataset metadata strip (not KPI cards) ── */}
        {windowMeta && (
          <div className="gms-cmd__meta" role="note" aria-label="Dataset summary">
            <span className="gms-cmd__window ops-num">
              {startDate ? dayjs(startDate).format("DD MMM YYYY") : "Earliest"}
              {" – "}
              {endDate ? dayjs(endDate).format("DD MMM YYYY") : "Latest"}
            </span>
            <span className="gms-cmd__mstat">
              <span className="ops-num">
                {windowMeta.records.toLocaleString("en-IN")}
              </span>
              <span className="gms-cmd__mlabel">Records</span>
            </span>
            <span className="gms-cmd__mstat">
              <span className="ops-num">
                {windowMeta.asins.toLocaleString("en-IN")}
              </span>
              <span className="gms-cmd__mlabel">ASINs</span>
            </span>
            <span className="gms-cmd__mstat">
              <span className="ops-num">
                {windowMeta.sellers.toLocaleString("en-IN")}
              </span>
              <span className="gms-cmd__mlabel">Sellers</span>
            </span>
            {windowMeta.last && (
              <span className="gms-cmd__mstat">
                <span className="ops-num">{windowMeta.last}</span>
                <span className="gms-cmd__mlabel">Last data</span>
              </span>
            )}
            {activeFilterCount > 0 && (
              <span className="gms-cmd__mstat gms-cmd__mstat--filter">
                <span className="ops-num">
                  {windowMeta.records.toLocaleString("en-IN")}
                </span>
                <span className="gms-cmd__mlabel">
                  of {gmsData.length.toLocaleString("en-IN")} shown
                </span>
              </span>
            )}
          </div>
        )}
      </section>


      {/* KPI STRIP + TREND + MATRIX */}
      <div className="ops-grid">
        {!loading && percentageChanges.window && (
          <div className="gms-kpi-note">
            Deltas compare the most recent {percentageChanges.window.text.replace("vs prior ", "")} against the{" "}
            <em>equally-sized preceding window</em>
          </div>
        )}
        {loading ? (
          <div className="ads-kpis">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="ops-panel ads-kpi">
                <div
                  className="ops-skel"
                  style={{ width: "62%", height: 10 }}
                />
                <div
                  className="ops-skel"
                  style={{ width: "74%", height: 20, marginTop: 10 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="ads-kpis" aria-label="Key performance indicators">
            {[
              {
                label: "Ordered Revenue",
                value: formatCompactINR(kpiMetrics.orderedRevenue),
                change: percentageChanges.changes?.orderedRevenue,
              },
              {
                label: "Ordered Units",
                value: formatCompactCount(kpiMetrics.orderedUnits),
                change: percentageChanges.changes?.orderedUnits,
              },
              {
                label: "Shipped Revenue",
                value: formatCompactINR(kpiMetrics.shippedRevenue),
                change: percentageChanges.changes?.shippedRevenue,
              },
              {
                label: "Shipped Units",
                value: formatCompactCount(kpiMetrics.shippedUnits),
                change: percentageChanges.changes?.shippedUnits,
              },
              {
                label: "Shipped COGS",
                value: formatCompactINR(kpiMetrics.shippedCOGS),
                change: percentageChanges.changes?.shippedCOGS,
                invert: true,
              },
              {
                label: "Profit",
                value: formatCompactINR(kpiMetrics.profit),
                change: percentageChanges.changes?.profit,
                sub: `${(kpiMetrics.marginPct || 0).toFixed(1)}% margin`,
                emphasis: true,
              },
              {
                label: "Customer Returns",
                value: formatCompactCount(kpiMetrics.customerReturns),
                change: percentageChanges.changes?.customerReturns,
                invert: true,
              },
              {
                label: "Return Ratio",
                value: `${(kpiMetrics.returnRatio || 0).toFixed(2)}%`,
                change: percentageChanges.changes?.returnRatio,
                invert: true,
              },
            ].map((kpi, idx) => {
              const hasChange = kpi.change !== null && kpi.change !== undefined;
              const good = kpi.invert ? kpi.change <= 0 : kpi.change >= 0;
              const flat = hasChange && Math.abs(kpi.change) < 0.05;
              const deltaCls = !hasChange
                ? "ops-delta--none"
                : flat
                  ? "ops-delta--flat"
                  : good
                    ? "ops-delta--pos"
                    : "ops-delta--neg";
              const arrow = !hasChange || flat ? "■" : kpi.change > 0 ? "▲" : "▼";
              const direction = hasChange
                ? kpi.change > 0
                  ? "up"
                  : kpi.change < 0
                    ? "down"
                    : "flat"
                : "unknown";
              return (
                <div
                  key={idx}
                  className={`ops-panel ads-kpi${kpi.emphasis ? " ads-kpi--emph" : ""}`}
                >
                  <div className="ads-kpi__head">
                    <span className="ads-kpi__label">{kpi.label}</span>
                    {hasChange ? (
                      <span
                        className={`ops-delta ${deltaCls} ops-num`}
                        title={
                          percentageChanges.window
                            ? `${percentageChanges.window.title} (${percentageChanges.window.text})`
                            : undefined
                        }
                      >
                        <span aria-hidden="true">{arrow}</span>{" "}
                        {Math.abs(kpi.change).toFixed(1)}%
                        <span className="sr-only">
                          {" "}
                          {direction} versus prior period
                        </span>
                      </span>
                    ) : (
                      <span
                        className="ads-kpi__noprior"
                        title="No prior period to compare against"
                      >
                        n/a
                      </span>
                    )}
                  </div>
                  <div
                    className={`ads-kpi__value ops-num${
                      kpi.emphasis && kpiMetrics.profit < 0 ? " is-neg" : ""
                    }`}
                  >
                    {kpi.value}
                  </div>
                  {kpi.sub && (
                    <div className="ads-kpi__sub">{kpi.sub}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filteredData.length > 0 && (
          <Panel
            id="panel-trend"
            span={12}
            kicker="Revenue · Orders · Returns"
            meta={`Daily trend of ordered revenue, units and customer returns in the filtered window`}
          >
            <Chart
              options={chartSeries.options}
              series={chartSeries.series}
              type="area"
              height={300}
            />
          </Panel>
        )}

        <Panel
          id="panel-matrix"
          span={12}
          className="gms-matrix-panel"
          kicker="Spreadsheet matrix"
          meta={`${tableDataSource.length} rows · ${viewLevel === "seller" ? "Seller" : "ASIN"} view`}
          actions={
            <Tooltip title="Horizontal breakdown of Ordered Revenue by Month, Week, and Day. Click a month or week header to collapse; click again to expand days.">
              <InfoCircleOutlined
                style={{ color: "#8896ab", fontSize: "var(--font-size-sm)" }}
              />
            </Tooltip>
          }
        >
          {tableDataSource.length > 0 ? (
            <div className="gms-matrix">
              <Table
                columns={tableColumns}
                dataSource={tableDataSource}
                loading={loading || isFilterPending}
                pagination={{
                  current: tablePage,
                  pageSize: tablePageSize,
                  showSizeChanger: true,
                  pageSizeOptions: ["25", "50", "100"],
                  size: "small",
                  onChange: (page, size) => {
                    setTablePage(page);
                    setTablePageSize(size);
                  },
                  total: tableDataSource.length,
                  showTotal: (total) => `${total} rows`,
                }}
                size="small"
                scroll={{ x: "max-content" }}
                bordered
                className="gms-tracker-table"
              />
            </div>
          ) : (
            <div style={{ padding: "24px 8px" }}>
              <MiniState
                tone="empty"
                title="No data loaded"
                note="Upload an Amazon GMS export report to populate the matrix, or adjust the date range and filters."
              />
            </div>
          )}
        </Panel>
      </div>

      {/* FILE UPLOAD MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800 }}>Upload GMS Report</span>}
        open={isUploadOpen}
        onCancel={() => {
          if (!isUploading) {
            setIsUploadOpen(false);
            setFileList([]);
          }
        }}
        footer={null}
        destroyOnHidden
        centered
        width={450}
        closable={!isUploading}
        mask={{ closable: !isUploading }}
      >
        {isUploading ? (
          <div style={{ padding: "20px 10px", textAlign: "center" }}>
            <Progress
              type="circle"
              percent={uploadProgress}
              strokeColor="#0f172a"
            />
            <div
              style={{
                marginTop: 16,
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              {uploadStatus}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: "var(--font-size-xs)",
                color: "#64748b",
              }}
            >
              Please do not close this window while processing is running.
            </div>
          </div>
        ) : (
          <div style={{ padding: "4px 0" }}>
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 4,
                }}
              >
                1. ASSOCIATE DATE / MONTH FOR REPORT
              </div>
              <DatePicker
                value={uploadDate}
                onChange={setUploadDate}
                style={{ width: "100%", borderRadius: 6 }}
                picker="date"
                placeholder="Select date for this sheet"
              />
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                Assigns the loaded metrics to the chosen date for MoM/WoW/DoD
                trend comparison.
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 4,
                }}
              >
                2. SELECT FILE TO PARSE
              </div>
              <Upload.Dragger
                accept=".csv,.xlsx,.xls"
                beforeUpload={handleFileUpload}
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                maxCount={1}
              >
                <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                  <UploadOutlined
                    style={{
                      color: "#1349c6",
                      fontSize: "var(--font-size-2xl)",
                    }}
                  />
                </p>
                <p
                  className="ant-upload-text"
                  style={{
                    fontSize: "var(--font-size-xs)",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Click or drag GMS CSV/Excel report here
                </p>
                <p
                  className="ant-upload-hint"
                  style={{ fontSize: 10, color: "#64748b", padding: "0 8px" }}
                >
                  Required headers: ASIN, Product Title, Brand, StoreCode,
                  Ordered Revenue, Ordered Units, Shipped Revenue, Shipped COGS,
                  Shipped Units, Customer Returns
                </p>
              </Upload.Dragger>
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <Button
                onClick={() => {
                  setIsUploadOpen(false);
                  setFileList([]);
                }}
                style={{
                  borderRadius: 6,
                  fontSize: "var(--font-size-sm)",
                  height: 32,
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EXPORT DATA CONFIGURATION MODAL */}
      <Modal
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingBottom: 10,
              borderBottom: "1px solid #eef1f5",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                background: "linear-gradient(135deg, #1349c6 0%, #1349c6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(79,70,229,0.2)",
              }}
            >
              <DownloadOutlined style={{ fontSize: "var(--font-size-base)" }} />
            </div>
            <div>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "var(--font-size-base)",
                  color: "#0f172a",
                  display: "block",
                }}
              >
                Export GMS Report
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "#64748b",
                  display: "block",
                  marginTop: 1,
                }}
              >
                Configure and download GMS matrix spreadsheets
              </span>
            </div>
          </div>
        }
        open={isExportOpen}
        onCancel={() => setIsExportOpen(false)}
        footer={null}
        destroyOnHidden
        centered
        width={520}
      >
        <div style={{ padding: "12px 0 4px 0" }}>
          {/* Level Switcher Option */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "#1349c6",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  background: "#e8eefb",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 9,
                }}
              >
                01
              </span>
              EXPORT LEVEL
            </div>
            <Segmented
              value={exportLevel}
              onChange={(value) => setExportLevel(value)}
              options={[
                { label: "ASIN Wise Matrix", value: "asin" },
                { label: "Seller Wise Matrix", value: "seller" },
              ]}
              block
              className="gms-view-toggle"
              style={{ fontWeight: 600 }}
            />
          </div>

          {/* Data Type */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "#1349c6",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  background: "#e8eefb",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 9,
                }}
              >
                02
              </span>
              DATA GRANULARITY
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              {[
                { key: "daily", label: "Daily", desc: "Day-by-day revenue" },
                { key: "weekly", label: "Weekly", desc: "Week totals + WoW" },
                {
                  key: "monthly",
                  label: "Monthly",
                  desc: "Month totals + MoM",
                },
              ].map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => setExportDataType(opt.key)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    border: `1.5px solid ${exportDataType === opt.key ? "#1349c6" : "#e5e7eb"}`,
                    background: exportDataType === opt.key ? "#eff6ff" : "#fff",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: exportDataType === opt.key ? "#1349c6" : "#1e293b",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {opt.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* File Format */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "#1349c6",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  background: "#e8eefb",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 9,
                }}
              >
                03
              </span>
              FILE FORMAT
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { key: "xlsx", label: "XLSX", desc: "Excel spreadsheet" },
                { key: "csv", label: "CSV", desc: "Plain text data" },
              ].map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => setExportFileType(opt.key)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    textAlign: "center",
                    border: `1.5px solid ${exportFileType === opt.key ? "#1349c6" : "#e5e7eb"}`,
                    background: exportFileType === opt.key ? "#eff6ff" : "#fff",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: exportFileType === opt.key ? "#1349c6" : "#1e293b",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {opt.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date Filtering Options */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "#1349c6",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  background: "#e8eefb",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 9,
                }}
              >
                02
              </span>
              DATE RANGE BREAKDOWN
            </div>
            <Radio.Group
              value={exportDateType}
              onChange={(e) => setExportDateType(e.target.value)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "100%",
              }}
            >
              <div
                className={`gms-export-option-card ${exportDateType === "all" ? "active" : ""}`}
                onClick={() => setExportDateType("all")}
              >
                <Radio value="all">
                  <div style={{ marginLeft: 4 }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      All Time Data
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}
                    >
                      Export all historical records available in the database
                    </div>
                  </div>
                </Radio>
              </div>
              <div
                className={`gms-export-option-card ${exportDateType === "current" ? "active" : ""}`}
                onClick={() => setExportDateType("current")}
              >
                <Radio value="current">
                  <div style={{ marginLeft: 4 }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      Currently Filtered Range
                      {startDate && endDate && (
                        <span
                          style={{
                            color: "#1349c6",
                            fontWeight: 600,
                            marginLeft: 6,
                            fontSize: "var(--font-size-xs)",
                          }}
                        >
                          ({dayjs(startDate).format("DD MMM YYYY")} -{" "}
                          {dayjs(endDate).format("DD MMM YYYY")})
                        </span>
                      )}
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}
                    >
                      Export only records within the page's current date range
                      filters
                    </div>
                  </div>
                </Radio>
              </div>
              <div
                className={`gms-export-option-card ${exportDateType === "custom" ? "active" : ""}`}
                onClick={() => setExportDateType("custom")}
              >
                <Radio value="custom">
                  <div style={{ marginLeft: 4 }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      Custom Range
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}
                    >
                      Define a custom date range window for the exported report
                    </div>
                  </div>
                </Radio>
              </div>
            </Radio.Group>

            {exportDateType === "custom" && (
              <div style={{ marginTop: 8, paddingLeft: 4 }}>
                <RangePicker
                  value={exportCustomDates}
                  onChange={setExportCustomDates}
                  style={{
                    width: "100%",
                    borderRadius: "var(--radius-md)",
                    height: 36,
                  }}
                />
              </div>
            )}
          </div>

          {/* Brand Filtering Options */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "#1349c6",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  background: "#e8eefb",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 9,
                }}
              >
                03
              </span>
              BRAND / SELLER FILTER
            </div>
            <Radio.Group
              value={exportBrandType}
              onChange={(e) => setExportBrandType(e.target.value)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "100%",
              }}
            >
              <div
                className={`gms-export-option-card ${exportBrandType === "all" ? "active" : ""}`}
                onClick={() => setExportBrandType("all")}
              >
                <Radio value="all">
                  <div style={{ marginLeft: 4 }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      All Brands / Sellers
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}
                    >
                      Export records for all sellers and brands without
                      filtering
                    </div>
                  </div>
                </Radio>
              </div>
              <div
                className={`gms-export-option-card ${exportBrandType === "current" ? "active" : ""}`}
                onClick={() => setExportBrandType("current")}
              >
                <Radio value="current">
                  <div style={{ marginLeft: 4 }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      Currently Selected Page Brands
                      {selectedBrands.length > 0 && (
                        <span
                          style={{
                            color: "#1349c6",
                            fontWeight: 600,
                            marginLeft: 6,
                            fontSize: "var(--font-size-xs)",
                          }}
                        >
                          ({selectedBrands.length} selected)
                        </span>
                      )}
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}
                    >
                      Export only records matching the currently active page
                      brand filters
                    </div>
                  </div>
                </Radio>
              </div>
              <div
                className={`gms-export-option-card ${exportBrandType === "custom" ? "active" : ""}`}
                onClick={() => setExportBrandType("custom")}
              >
                <Radio value="custom">
                  <div style={{ marginLeft: 4 }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      Custom Selected Brands
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}
                    >
                      Manually choose one or more specific brands/sellers to
                      export
                    </div>
                  </div>
                </Radio>
              </div>
            </Radio.Group>

            {exportBrandType === "custom" && (
              <div style={{ marginTop: 8, paddingLeft: 4 }}>
                <Select
                  mode="multiple"
                  placeholder="Select custom brands to export"
                  value={exportCustomBrands}
                  onChange={setExportCustomBrands}
                  style={{ width: "100%", borderRadius: "var(--radius-md)" }}
                  allowClear
                  maxTagCount="responsive"
                  showSearch
                  filterOption={(input, opt) =>
                    (opt?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={uniqueBrands.map((b) => ({ label: b, value: b }))}
                />
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              borderTop: "1px solid #eef1f5",
              paddingTop: 14,
            }}
          >
            <Button
              onClick={() => setIsExportOpen(false)}
              style={{
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                height: 34,
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              style={{
                borderRadius: "var(--radius-md)",
                fontWeight: 600,
                fontSize: "var(--font-size-sm)",
                height: 34,
              }}
            >
              Export to {exportFileType === "csv" ? "CSV" : "Excel"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
