import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Alert,App,Button,Tabs} from 'antd';
import dayjs from 'dayjs';
import {sellerApi,userApi,gmsApi,exportApi} from '../services/api';
import {useDateRange} from '../contexts/DateRangeContext';
import {useAuth} from '../contexts/AuthContext';
import {useHeader} from '../contexts/HeaderContext';
import GmsReportToolbar from '../components/gms/GmsReportToolbar';
import {GmsFinancialSummary,GmsTrend,GmsComparisonTable} from '../components/gms/GmsFinancialOverview';
import GmsMatrix from '../components/gms/GmsMatrix';
import GmsImportDialog from '../components/gms/GmsImportDialog';
import GmsExportDialog from '../components/gms/GmsExportDialog';
import './gms.css';

const defaultSort={key:'orderedRevenue',direction:'desc'};
const idOf=value=>{
  const id=typeof value==='object'&&value!==null?value._id??value.id??value.SellerId??value.Id:value;
  return id==null?null:String(id);
};
function selectedSellerIds(sellers,managers,directory){
  const direct=sellers.length?new Set(sellers.map(String)):null;
  if(!managers.length)return direct?[...direct]:null;
  const ids=new Set(),chosen=new Set(managers.map(String));
  for(const manager of directory){
    if(!chosen.has(idOf(manager)))continue;
    for(const seller of manager.assignedSellers||[]){
      const id=idOf(seller);if(id!=null)ids.add(id);
    }
  }
  return direct?[...direct].filter(id=>ids.has(id)):[...ids];
}
const optionsOf=(rows,label)=>rows.map(r=>({value:idOf(r),label:label(r)})).filter(r=>r.value!=null&&r.label).sort((a,b)=>a.label.localeCompare(b.label));
const day=(value,fallback)=>dayjs(value||fallback).format('YYYY-MM-DD');

export default function GmsTrackerPage(){
  const {user,loading:authLoading}=useAuth(),{message}=App.useApp();
  const {setPageMeta}=useHeader();
  const {startDate,endDate,updateDateRange}=useDateRange();
  const permissions=user?.permissions||[];
  const can=permission=>permissions.includes('*')||permissions.includes(permission);
  const userKey=String(user?.id??user?.Id??user?._id??'');
  const [selectedSellers,setSelectedSellers]=useState([]);
  const [selectedManagers,setSelectedManagers]=useState([]);
  const [search,setSearch]=useState('');
  const [debouncedSearch,setDebouncedSearch]=useState('');
  const [level,setLevel]=useState('asin');
  const [metric,setMetric]=useState('orderedRevenue');
  const [workspaceTab,setWorkspaceTab]=useState('matrix');
  const [pager,setPager]=useState({key:null,page:1,pageSize:50,sort:defaultSort});
  const [stored,setStored]=useState(null),[failure,setFailure]=useState(null);
  const [requestLoading,setRequestLoading]=useState(true);
  const [metadataLoading,setMetadataLoading]=useState(false);
  const [directory,setDirectory]=useState({sellers:[],managers:[],error:'',userKey:null});
  const directoryRef=useRef({sellers:[],managers:[],error:'',userKey:null});
  const [lastLoadedAt,setLastLoadedAt]=useState(null);
  const [importOpen,setImportOpen]=useState(false),[importTab,setImportTab]=useState('upload');
  const [exportOpen,setExportOpen]=useState(false);
  const from=day(startDate,dayjs().startOf('month')),to=day(endDate,dayjs().endOf('month'));
  const filterKey=JSON.stringify([userKey,from,to,selectedSellers,selectedManagers,debouncedSearch,level]);
  const page=pager.key===filterKey?pager.page:1,pageSize=pager.pageSize;
  const sort=pager.key===filterKey?pager.sort:defaultSort;
  const sortKey=sort.key,sortDirection=sort.direction;
  const requestKey=JSON.stringify([filterKey,page,pageSize,sortKey,sortDirection]);
  const error=failure?.requestKey===requestKey?failure.message:null;
  const sameFilter=stored?.filterKey===filterKey&&search===debouncedSearch;
  const analytics=sameFilter?stored.data:null;
  const loading=requestLoading||search!==debouncedSearch||(!error&&stored?.requestKey!==requestKey);
  const reportLoading=authLoading||search!==debouncedSearch||(!analytics&&!error);

  useEffect(()=>{
    const timer=setTimeout(()=>setDebouncedSearch(search),250);
    return ()=>clearTimeout(timer);
  },[search]);
  useEffect(()=>{
    setPageMeta({title:'GMS Tracker',subtitle:'Financial performance, product revenue and seller reporting',breadcrumbs:[{label:'Workspace'},{label:'GMS Tracker'}]});
  },[setPageMeta]);

  const mounted=useRef(false),sequence=useRef(0),abortRef=useRef(null);
  const load=useCallback(async({refreshMetadata=false}={})=>{
    if(!mounted.current||authLoading||!userKey)return false;
    abortRef.current?.abort();
    const controller=new AbortController(),requestId=++sequence.current;
    abortRef.current=controller;
    const current=()=>mounted.current&&requestId===sequence.current&&!controller.signal.aborted;
    setRequestLoading(true);setFailure(null);
    if(refreshMetadata)setStored(null);
    try{
      let data=directoryRef.current;
      if(refreshMetadata||data.userKey!==userKey){
        setMetadataLoading(true);
        const [sellerResult,managerResult]=await Promise.all([
          sellerApi.getAll({limit:1000}).catch(()=>null),
          userApi.getManagers().catch(()=>null),
        ]);
        if(!current())return false;
        const sellerOK=sellerResult?.success&&Array.isArray(sellerResult.data?.sellers);
        const managerOK=managerResult?.success&&Array.isArray(managerResult.data);
        // Do not silently use stale manager assignments after a failed refresh.
        data={userKey,sellers:sellerOK?sellerResult.data.sellers:[],managers:managerOK?managerResult.data:[],
          sellerOK,managerOK,error:[!sellerOK?'Seller options could not load.':'',!managerOK?'Manager options could not load.':''].filter(Boolean).join(' ')};
        directoryRef.current=data;setDirectory(data);setMetadataLoading(false);
      }
      if(selectedManagers.length&&!data.managerOK)throw new Error('Manager assignments are unavailable. Refresh filter options or clear the manager filter.');
      const result=await gmsApi.analytics({startDate:from,endDate:to,sellerIds:selectedSellerIds(selectedSellers,selectedManagers,data.managers),search:debouncedSearch,level,page,pageSize,sort:{key:sortKey,direction:sortDirection}},{signal:controller.signal});
      if(!current())return false;
      if(!result?.success||!Array.isArray(result.data?.matrixRows)||!result.data?.meta||!result.data?.pagination)throw new Error(result?.message||'Invalid GMS analytics response.');
      setStored({data:result.data,filterKey,requestKey});setLastLoadedAt(Date.now());
      return true;
    }catch(err){
      if(!current())return false;
      setFailure({requestKey,message:err.message||'Unable to load GMS analytics.'});setStored(null);setLastLoadedAt(null);
      return false;
    }finally{
      if(current()){setRequestLoading(false);setMetadataLoading(false);}
    }
  },[authLoading,userKey,from,to,selectedSellers,selectedManagers,debouncedSearch,level,page,pageSize,sortKey,sortDirection,filterKey,requestKey]);
  useEffect(()=>{
    mounted.current=true;load();
    return ()=>{mounted.current=false;abortRef.current?.abort();sequence.current++;};
  },[load]);
  const latestLoad=useRef(load);
  useEffect(()=>{latestLoad.current=load;},[load]);

  const sellerOptions=useMemo(()=>optionsOf(directory.sellers,r=>r.name||r.Name),[directory.sellers]);
  const managerOptions=useMemo(()=>optionsOf(directory.managers,r=>[r.firstName,r.lastName].filter(Boolean).join(' ').trim()||r.email||r.Email),[directory.managers]);
  const currentSellerIds=useMemo(()=>selectedSellerIds(selectedSellers,selectedManagers,directory.managers),[selectedSellers,selectedManagers,directory.managers]);
  const resetFilters=()=>{setSelectedSellers([]);setSelectedManagers([]);setSearch('');setDebouncedSearch('');};
  const onPageChange=useCallback((next,size)=>setPager({key:filterKey,page:size===pageSize?next:1,pageSize:size,sort:{key:sortKey,direction:sortDirection}}),[filterKey,pageSize,sortKey,sortDirection]);
  const onSortChange=useCallback(next=>setPager({key:filterKey,page:1,pageSize,sort:next}),[filterKey,pageSize]);
  const showImport=tab=>{setImportTab(tab);setImportOpen(true);};
  const submitExport=async values=>{
    if(!can('gms_tracker_export')||loading||error)throw new Error('Wait for the active report to finish loading.');
    if(values.exportBrandType==='current'&&selectedManagers.length&&!directory.managerOK)throw new Error('Manager assignments are unavailable. Refresh report filters.');
    const custom=values.exportCustomDates;
    const result=await exportApi.startGmsExport({
      exportLevel:values.exportLevel,exportDataType:values.exportDataType,exportFileType:values.exportFileType,
      exportDateType:values.exportDateType,exportBrandType:values.exportBrandType,exportCustomBrands:[],
      exportCustomDates:values.exportDateType==='custom'?[custom[0].format('YYYY-MM-DD'),custom[1].format('YYYY-MM-DD')]:null,
      startDate:values.exportDateType==='current'?from:null,endDate:values.exportDateType==='current'?to:null,
      sellerIds:values.exportBrandType==='current'?currentSellerIds:values.exportBrandType==='custom'?values.exportCustomBrands:null,
      search:values.exportBrandType==='current'?search:'',
    });
    if(!result?.success)throw new Error(result?.message||'Export could not be started.');
    message.success('GMS export started. Track it in Downloads.');
    window.dispatchEvent(new CustomEvent('export-started'));
  };

  return <main className="gms-workspace">
    <GmsReportToolbar startDate={startDate} endDate={endDate} onDateRangeChange={updateDateRange}
      sellers={sellerOptions} managers={managerOptions} selectedSellers={selectedSellers} selectedManagers={selectedManagers}
      search={search} onSellersChange={setSelectedSellers} onManagersChange={setSelectedManagers} onSearchChange={setSearch} onReset={resetFilters}
      metadataLoading={metadataLoading} metadataError={directory.error} analytics={analytics} loading={loading} reportLoading={reportLoading}
      error={error} lastLoadedAt={lastLoadedAt} onRefresh={()=>load({refreshMetadata:true})}
      canImport={can('gms_tracker_import')} canExport={can('gms_tracker_export')} onImport={()=>showImport('upload')} onHistory={()=>showImport('history')} onExport={()=>setExportOpen(true)}/>
    {error?<Alert type="error" showIcon title="Unable to load the report" description={error} action={<Button size="small" onClick={()=>load({refreshMetadata:true})}>Retry</Button>}/>:<>
      <GmsFinancialSummary analytics={analytics} loading={reportLoading} metric={metric}
        onMetricChange={next=>{setMetric(next);setWorkspaceTab('analysis');}}
        onUseLatest={date=>updateDateRange({startDate:dayjs(date).startOf('day').toDate(),endDate:dayjs(date).endOf('day').toDate(),rangeType:'custom'})}/>
      <Tabs className="gms-workspace-tabs" activeKey={workspaceTab} onChange={setWorkspaceTab} items={[
        {key:'matrix',label:'Revenue matrix',children:<GmsMatrix analytics={analytics} loading={loading} level={level} onLevelChange={setLevel} page={page} pageSize={pageSize}
          sortKey={sortKey} sortDirection={sortDirection} onPageChange={onPageChange} onSortChange={onSortChange}/>},
        {key:'analysis',label:'Financial analysis',children:<div className="gms-analysis-stack"><GmsTrend analytics={analytics} loading={reportLoading} metric={metric} onMetricChange={setMetric}/>
          {!reportLoading&&<GmsComparisonTable analytics={analytics}/>}</div>}
      ]}/>
    </>}
    {can('gms_tracker_import')&&<GmsImportDialog open={importOpen} initialTab={importTab} onClose={()=>setImportOpen(false)} onCommitted={()=>latestLoad.current({refreshMetadata:true})}/>}
    {can('gms_tracker_export')&&<GmsExportDialog open={exportOpen} onClose={()=>setExportOpen(false)} onSubmit={submitExport}
      level={level} startDate={startDate} endDate={endDate} sellerOptions={sellerOptions} currentFilterCount={selectedSellers.length+selectedManagers.length+(search.trim()?1:0)}
      currentSellerIds={currentSellerIds} search={search} disabled={loading||!!error}/>}
  </main>;
}
