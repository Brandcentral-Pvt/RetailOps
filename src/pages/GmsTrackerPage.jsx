import { LoadingIndicator } from "@/components/Spinner";
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
  Modal,
  Typography,
  Space,
  Input,
  Tag,
  Tooltip,
  message,
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
import GmsImportDialog from "../components/gms/GmsImportDialog";
import { Panel, MiniState, timeAgo, useNow } from "./opsCenter/primitives";
import "./opsCenter/ops.css";
import "./ads/ads.css";
import "./gms.css";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

const { Text } = Typography;

// Report filters select IDs, not names. A selected manager without matching
// sellers is an explicit empty filter, not unrestricted access.
function selectedSellerIds(sellers, managers, directory) {
  const direct = sellers.length ? new Set(sellers.map(String)) : null;
  if (!managers.length) return direct ? [...direct] : null;
  const ids = new Set();
  const chosen = new Set(managers.map(String));
  for (const manager of directory) {
    if (!chosen.has(String(manager._id || manager.id))) continue;
    for (const seller of manager.assignedSellers || []) {
      const id = typeof seller === "object" ? seller._id || seller.id || seller.SellerId || seller.Id : seller;
      if (id != null) ids.add(String(id));
    }
  }
  return direct ? [...direct].filter(id => ids.has(id)) : [...ids];
}

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
  if (value == null) return 'N/A';
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
};

const formatCompactCount = (value) => {
  if (value == null) return 'N/A';
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e4) return `${sign}${(abs / 1e3).toFixed(1)}k`;
  return `${sign}${Math.round(abs).toLocaleString("en-IN")}`;
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function GmsTrackerPage() {
  const { user } = useAuth();
  // Match server effective permissions rather than legacy role-based UI bypasses.
  const effectivePermissions = user?.permissions || [];
  const can = (permission) => effectivePermissions.includes('*') || effectivePermissions.includes(permission);
  const canClear = can('gms_tracker_delete') && user?.scope === 'global';
  const { setPageMeta } = useHeader();
  const [storedAnalytics, setAnalytics] = useState(null);
  const [requestLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedManagers, setSelectedManagers] = useState([]);
  const { startDate, endDate } = useDateRange();
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const loading = requestLoading || searchQuery !== debouncedSearch;
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
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
  const [tableSort, setTableSort] = useState({key:'orderedRevenue',direction:'desc'});
  const filterKey = JSON.stringify([selectedBrands,selectedManagers,debouncedSearch,viewLevel,startDate,endDate]);
  const analytics=storedAnalytics?.clientFilterKey===filterKey?storedAnalytics:null;
  const reportLoading=searchQuery!==debouncedSearch || (!analytics && !error);
  const [pageFilterKey,setPageFilterKey]=useState(filterKey);
  const effectivePage=pageFilterKey===filterKey?tablePage:1;
  // An old period column is not a meaningful sort after a date change.
  const effectiveSort=pageFilterKey===filterKey?tableSort:{key:'orderedRevenue',direction:'desc'};
  const sortKey=effectiveSort.key, sortDirection=effectiveSort.direction;
  useEffect(()=>{
    if(pageFilterKey!==filterKey){setPageFilterKey(filterKey);setTablePage(1);setTableSort({key:'orderedRevenue',direction:'desc'});}
  },[filterKey,pageFilterKey]);

  // Database Sellers / Brands / Managers
  const [dbSellers, setDbSellers] = useState([]);
  const [dbManagers, setDbManagers] = useState([]);
  const dbManagersRef = useRef([]);
  const dbSellersRef = useRef([]); // Cached for date-change refetch (avoids re-fetching static data)
  const staticLoadedRef = useRef(false);

  // Deferred filter transition for smooth UX during heavy filter recomputation
  const [isFilterPending, startFilterTransition] = useTransition();

  const loadMountedRef = useRef(false);
  const loadRequestRef = useRef(0);
  const abortRef = useRef(null);
  // Cancel obsolete loads and only publish the latest successful response.
  const loadAllData = useCallback(async ({ refreshMetadata = false } = {}) => {
    if (!loadMountedRef.current) return false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++loadRequestRef.current;
    const isCurrent = () => loadMountedRef.current && requestId === loadRequestRef.current && !controller.signal.aborted;
    setLoading(true);
    setError(null);
    if(refreshMetadata)setAnalytics(null);
    try {
      let sellers = dbSellersRef.current;
      let managers = dbManagersRef.current;
      if (refreshMetadata || !staticLoadedRef.current) {
        const [sellersRes, managersRes] = await Promise.all([
          sellerApi.getAll({ limit: 1000 }).catch(() => null),
          userApi.getManagers().catch(() => null),
        ]);
        if (!isCurrent()) return false;
        if (sellersRes?.success && Array.isArray(sellersRes.data?.sellers)) {
          sellers = sellersRes.data.sellers;
          dbSellersRef.current = sellers;
          setDbSellers(sellers);
        }
        if (managersRes?.success && Array.isArray(managersRes.data)) {
          managers = managersRes.data;
          dbManagersRef.current = managers;
          setDbManagers(managers);
        } else if (selectedManagers.length && !managers.length) throw new Error('Manager filter metadata unavailable');
        staticLoadedRef.current = Boolean(sellersRes?.success && managersRes?.success);
      }
      const gmsRes = await gmsApi.analytics({
        startDate: dayjs(startDate || dayjs().startOf("month")).format("YYYY-MM-DD"),
        endDate: dayjs(endDate || dayjs().endOf("month")).format("YYYY-MM-DD"),
        sellerIds: selectedSellerIds(selectedBrands, selectedManagers, managers),
        search: debouncedSearch, level: viewLevel,
        page:effectivePage,pageSize:tablePageSize,sort:{key:sortKey,direction:sortDirection},
      }, { signal: controller.signal });
      if (!isCurrent()) return false;
      if (!gmsRes?.success || !Array.isArray(gmsRes.data?.matrixRows) || !gmsRes.data?.meta || !gmsRes.data?.pagination) throw new Error(gmsRes?.message || "Invalid GMS analytics response.");
      setAnalytics({...gmsRes.data,clientFilterKey:filterKey});
      setLastLoadedAt(Date.now());
      return true;
    } catch (err) {
      if (!isCurrent()) return false;
      setError(err.message || "Failed to load GMS data. Please try again.");
      setAnalytics(null);
      setLastLoadedAt(null);
      return false;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [startDate, endDate, selectedBrands, selectedManagers, debouncedSearch, viewLevel, effectivePage, tablePageSize, sortKey, sortDirection, filterKey]);

  useEffect(() => {
    loadMountedRef.current = true;
    loadAllData();
    return () => {
      loadMountedRef.current = false;
      abortRef.current?.abort();
      loadRequestRef.current++;
    };
  }, [loadAllData]);

  useEffect(() => {
    setPageMeta({
      title: 'GMS Tracker',
      subtitle: 'Spreadsheet matrix of Ordered Revenue across ASINs and Sellers',
      breadcrumbs: [{ label: 'Workspace' }, { label: 'GMS Tracker' }],
    });
  }, [setPageMeta]);

  const latestLoad = useRef(loadAllData);
  useEffect(() => { latestLoad.current = loadAllData; }, [loadAllData]);

  // Handle GMS spreadsheet matrix export via background job served in Downloads drawer
  const handleExport = async () => {
    try {
      if (loading || searchQuery !== debouncedSearch || error) throw new Error('Wait for the active report to finish loading');
      const exportParams = {
        exportLevel,
        exportDateType,
        exportCustomDates:
          exportDateType === "custom" &&
          exportCustomDates &&
          exportCustomDates[0] &&
          exportCustomDates[1]
            ? [
                exportCustomDates[0].format("YYYY-MM-DD"),
                exportCustomDates[1].format("YYYY-MM-DD"),
              ]
            : null,
        exportBrandType,
        exportCustomBrands: [],
        exportDataType,
        exportFileType,
        startDate:
          exportDateType === "current"
            ? dayjs(startDate || dayjs().startOf("month")).format("YYYY-MM-DD")
            : null,
        endDate:
          exportDateType === "current"
            ? dayjs(endDate || dayjs().endOf("month")).format("YYYY-MM-DD")
            : null,
        sellerIds: exportBrandType === 'current' ? selectedSellerIds(selectedBrands, selectedManagers, dbManagersRef.current) : exportBrandType === 'custom' ? exportCustomBrands : null,
        search: exportBrandType === 'current' ? searchQuery : '',
      };

      message.loading({
        content: "Initiating complete GMS export...",
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

  // Export filter options retain the actual seller IDs.
  const uniqueBrands = useMemo(() => dbSellers.map(s => ({
    label:s.name, value:String(s._id || s.id),
  })).filter(s=>s.label&&s.value!=='undefined').sort((a,b)=>a.label.localeCompare(b.label)),[dbSellers]);

  const kpiMetrics = analytics?.kpis || {};
  const comparison = analytics?.comparison;
  const prior = comparison?.window;
  const percentageChanges = {
    changes: comparison?.changes,
    window: prior ? { text: 'vs prior ' + prior.days + 'd', title: prior.from + ' to ' + prior.to } : null,
  };

  // Matrix rows, values and dates are computed by the shared backend engine.
  const tableDataSource = analytics?.matrixRows || [];
  const pageInfo=analytics?.pagination;
  const totalRows=pageInfo?.totalRows ?? 0;
  const monthGroups = useMemo(() => analytics?.monthGroups || {}, [analytics]);
  const fixedCols = useMemo(() => [
    {title:'Seller (DB)',dataIndex:'dbBrand',key:'dbBrand',width:140, sorter:(a,b)=>(a.dbBrand||'').localeCompare(b.dbBrand||''),
      render:(v,r)=><Space><Text strong={!r.isUnmatched}>{v||'-'}</Text>{r.isUnmatched&&<Tag color="orange">Unmatched</Tag>}</Space>},
    {title:'ASIN',dataIndex:'asin',key:'asin',width:120,render:v=><Text strong style={{fontFamily:'monospace'}}>{v}</Text>,sorter:(a,b)=>a.asin.localeCompare(b.asin)},
    {title:'Brand (Sheet)',dataIndex:'brand',key:'brand',width:120,sorter:(a,b)=>a.brand.localeCompare(b.brand)},
    {title:'Store Code',dataIndex:'storeCode',key:'storeCode',width:90,sorter:(a,b)=>a.storeCode.localeCompare(b.storeCode)},
    {title:'Ordered Units',dataIndex:'orderedUnits',key:'orderedUnits',width:100,align:'right',render:v=>v==null?'-':v.toLocaleString('en-IN'),sorter:true},
    {title:'Period Revenue',dataIndex:'orderedRevenue',key:'orderedRevenue',width:145,align:'right',render:v=>v==null?'-':`₹${v.toLocaleString("en-IN",{maximumFractionDigits:2})}`,sorter:true},
  ], []);

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
                const rev = record.monthlyRev[month.key];
                return rev != null ? (
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
              title: "MoM (full months)",
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
                title: "Week Segment Total",
                key: `week-total-${week.key}`,
                align: "right",
                width: 120,
                render: (_, record) => {
                  const rev = record.weeklyRev[week.key];
                  return rev != null ? (
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
                title: "WoW (same days)",
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
              const rev = record.dailyRev[dayStr];
              return rev != null ? `₹${rev.toLocaleString("en-IN")}` : "-";
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
                const change = getTrend(record, "day", currDayStr);
                if (change === null || dayjs(currDayStr).diff(dayjs(prevDayStr), "day") !== 1)
                  return <span style={{ color: "#8896ab" }}>-</span>;
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
                const aChange = getTrend(a, "day", currDayStr) ?? 0;
                const bChange = getTrend(b, "day", currDayStr) ?? 0;
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
            const rev = record.weeklyRev[week.key];
            return rev != null ? (
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
          const rev = record.monthlyRev[month.key];
          return rev != null ? (
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
              {isUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
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

    function serverColumns(columns){
      return columns.map(col=>{
        if(col.children)return {...col,children:serverColumns(col.children)};
        const key=String(col.key||'');
        const trend=/^(mom-trend|wow-trend|dod-trend)-/.test(key);
        if(trend){const {sorter,...rest}=col;return rest;}
        if(!col.sorter)return col;
        return {...col,sorter:true,sortOrder:key===sortKey?(sortDirection==='asc'?'ascend':'descend'):null};
      });
    }
    return serverColumns([...fixedCols, ...dynamicCols]);
  }, [fixedCols, monthGroups, expandedMonths, expandedWeeks, sortKey, sortDirection]);

  // Chart configuration — Area chart: Revenue + Orders + Returns
  const chartSeries = useMemo(() => {
    const daily = analytics?.daily || [];
    const sortedDates = daily.map(d=>d.date);
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
                formatCompactINR(val),
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
              if (val == null) return "N/A";
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
        { name: "Revenue", data: daily.map(d=>d.orderedRevenue) },
        { name: "Orders", data: daily.map(d=>d.orderedUnits) },
        { name: "Returns", data: daily.map(d=>d.customerReturns) },
      ],
    };
  }, [analytics]);

  const windowMeta = analytics?.meta || null;
  // Count of active filter dimensions for the "N active" summary
  const activeFilterCount =
    selectedBrands.length +
    selectedManagers.length +
    (searchQuery.trim() ? 1 : 0);

  // Ticks every 30s so the "Synced 4m ago" label doesn't go stale
  const now = useNow(30000);
  const isStale = lastLoadedAt ? now - lastLoadedAt > 5 * 60 * 1000 : false;

  // Keep import history and completion state mounted during refreshes.
  // The content area renders its own loading state below.

  return (
    <div className="ops ads-page gms-page">
      {loading && (windowMeta?.records || 0) > 0 && (
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
      {error && !loading && <LoadError message={error} onRetry={() => loadAllData({ refreshMetadata: true })} />}

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

            {can("gms_tracker_export") && (
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

            {can("gms_tracker_import") && (
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

            {canClear && (
              <Tooltip title="Global clear is paused during staged-import rollout">
                <span>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  className="gms-cmd__btn gms-cmd__btn--danger"
                  disabled
                >
                  Clear Data
                </Button>
                </span>
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
              placeholder="Search ASIN, Title, Brand, Store..."
              maxLength={200}
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
              {error ? "Sync failed" : loading ? "Syncing…" : lastLoadedAt ? `Synced ${timeAgo(lastLoadedAt)}` : "Not synced"}
            </span>
            <Tooltip title="Refresh data">
              <Button
                size="small"
                loading={loading}
                onClick={() => loadAllData({ refreshMetadata: true })}
                aria-label="Refresh data"
                icon={<ReloadOutlined />}
                className="gms-cmd__refresh"
              />
            </Tooltip>
          </div>
        </div>

        {/* ── Row 3: dataset metadata strip (not KPI cards) ── */}
        {windowMeta && !reportLoading && (
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
            <span className="gms-cmd__mstat"><span className="ops-num">{windowMeta.unmatchedRecords ?? 0}</span><span className="gms-cmd__mlabel">Unmatched records</span></span>
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
                  matching filters
                </span>
              </span>
            )}
          </div>
        )}
      </section>


      {/* KPI STRIP + TREND + MATRIX */}
      {!error && <div className="ops-grid">
        {!reportLoading && percentageChanges.window && (
          <div className="gms-kpi-note">
            Selected period vs <em>{prior.from} to {prior.to}</em> ({prior.days} days). Coverage: {comparison.currentCoverage?.observedDays ?? 0}/{comparison.currentCoverage?.expectedDays ?? 0} current days, {comparison.previousCoverage?.observedDays ?? 0}/{prior.days} prior days. {(!comparison.currentCoverage?.complete || !comparison.previousCoverage?.complete) && "Incomplete date coverage; comparisons unavailable."}
          </div>
        )}
        {reportLoading ? (
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
        ) : !windowMeta?.records ? (
          <Panel id="panel-gms-empty" span={12} kicker="Key performance indicators">
            <MiniState tone="empty" title="No GMS records in this selection" note="Metrics are unavailable until data is loaded for these dates and filters." />
          </Panel>
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
                label: "Gross Profit",
                value: formatCompactINR(kpiMetrics.profit),
                change: percentageChanges.changes?.profit,
                sub: kpiMetrics.marginPct == null ? 'Margin unavailable' : `${kpiMetrics.marginPct.toFixed(1)}% margin`,
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
                value: kpiMetrics.returnRatio == null ? 'N/A' : `${kpiMetrics.returnRatio.toFixed(2)}%`,
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
                        {Math.abs(kpi.change).toFixed(1)}{kpi.label === 'Return Ratio' ? ' pp' : '%'}
                        <span className="sr-only">
                          {" "}
                          {direction} versus prior period
                        </span>
                      </span>
                    ) : (
                      <span
                        className="ads-kpi__noprior"
                        title="No comparable prior period or zero baseline"
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

        {!reportLoading && (windowMeta?.records || 0) > 0 && (
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
          meta={`${totalRows.toLocaleString("en-IN")} rows · ${viewLevel === "seller" ? "Seller" : "ASIN"} view`}
          actions={
            <Tooltip title="Horizontal breakdown of Ordered Revenue by Month, Week, and Day. Click a month or week header to expand or collapse. Revenue and identifier columns sort across all matching rows, not just the current page.">
              <InfoCircleOutlined
                style={{ color: "#8896ab", fontSize: "var(--font-size-sm)" }}
              />
            </Tooltip>
          }
        >
          {tableDataSource.length > 0 || loading ? (
            <div className="gms-matrix">
              <Table
                columns={tableColumns}
                dataSource={tableDataSource}
                loading={loading || isFilterPending}
                rowKey="key"
                onChange={(pagination,_filters,sorter,extra)=>{
                  const next=Array.isArray(sorter)?sorter[0]:sorter;
                  setPageFilterKey(filterKey);
                  if(extra.action==='sort'){
                    setTableSort(next?.order?{key:String(next.columnKey),direction:next.order==='ascend'?'asc':'desc'}:{key:'orderedRevenue',direction:'desc'});
                    setTablePage(1);
                  }else if(extra.action==='paginate'){
                    const size=Number(pagination.pageSize||50);
                    setTablePage(size===tablePageSize?Number(pagination.current||1):1);
                    setTablePageSize(size);
                    setTableSort({key:sortKey,direction:sortDirection});
                  }
                }}
                pagination={{
                  current:pageInfo?.page ?? effectivePage,
                  pageSize:tablePageSize,
                  showSizeChanger:true,
                  pageSizeOptions:["25","50","100"],
                  size:"small",
                  total:totalRows,
                  showTotal:(total,range)=>`${range[0]}–${range[1]} of ${total.toLocaleString("en-IN")} rows`,
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
      </div>}

      {can("gms_tracker_import") && (
        <GmsImportDialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)}
          onCommitted={() => latestLoad.current({ refreshMetadata: true })} />
      )}

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
                Download complete financial data and analytical reports
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
          <div style={{marginBottom:16}}>
            <Typography.Text strong>Export format</Typography.Text>
            <Segmented block value={exportFileType} onChange={setExportFileType}
              options={[{label:"Excel: complete workbook",value:"xlsx"},{label:"CSV: complete daily data",value:"csv"}]}
              style={{marginTop:8}} />
            <div style={{marginTop:10,padding:12,border:"1px solid #e5e7eb",borderRadius:8,background:"#f8fafc"}}>
              <Typography.Text strong>{exportFileType==="xlsx"?"Complete financial workbook":"Complete daily records"}</Typography.Text>
              <p style={{margin:"6px 0 0",fontSize:12,color:"#475569"}}>
                {exportFileType==="xlsx"
                  ?"Includes every matching daily record, executive summary, ASIN and seller analytics, daily/weekly/monthly comparisons and the revenue matrix. Prior period detail is included for selected date ranges."
                  :"Includes every matching ASIN/date record with all six uploaded financial metrics, original report title, catalog title and seller mapping. Use Excel for multi-sheet comparisons and analytics."}
              </p>
              <p style={{margin:"6px 0 0",fontSize:12,color:"#475569"}}>Exports all matching records, not just the visible table page. Date and seller filters below still apply.</p>
            </div>
          </div>
          {exportFileType==="xlsx"&&(
            <div style={{marginBottom:16}}>
              <Typography.Text strong>Revenue matrix grouping</Typography.Text>
              <Segmented block value={exportLevel} onChange={setExportLevel}
                options={[{label:"ASIN wise",value:"asin"},{label:"Seller wise",value:"seller"}]} style={{margin:"8px 0 12px"}}/>
              <Typography.Text strong>Revenue matrix detail</Typography.Text>
              <Segmented block value={exportDataType} onChange={setExportDataType}
                options={[{label:"Daily",value:"daily"},{label:"Weekly",value:"weekly"},{label:"Monthly",value:"monthly"}]} style={{marginTop:8}}/>
              <Typography.Text type="secondary" style={{fontSize:12}}>These options change the matrix only. Complete Data and all analytics sheets are always included.</Typography.Text>
            </div>
          )}

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
                      Current Page Filters
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
                      Export the active seller, manager and search filters
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
                  options={uniqueBrands}
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
              Export {exportFileType === "csv" ? "complete CSV" : "complete Excel"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
