import React,{useEffect,useState,useRef,useCallback} from 'react';
import {Download} from 'lucide-react';
import {useHeader} from '../../contexts/HeaderContext';
import {useAuth} from '../../contexts/AuthContext';
import {exportApi} from '../../services/api';
import DownloadsDrawer from '../common/DownloadsDrawer';
import {Badge,Button,Tooltip} from 'antd';

const DownloadDrawer=()=>{
 const {downloadOpen,setDownloadOpen}=useHeader();
 const {user}=useAuth();
 const permissions=user?.permissions||[];
 const canAds=['adsreport_view','adsreport_export'].every(p=>permissions.includes('*')||permissions.includes(p));
 const principal=JSON.stringify([user?.Id||user?.id||user?._id,user?.role?.name,user?.assignedSellers,permissions]);
 const [notice,setNotice]=useState({principal:null,ready:false});
 const seen=useRef(new Set());
 const openRef=useRef(downloadOpen);openRef.current=downloadOpen;
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const onExport=()=>{setDownloadOpen(true);setRevision(v=>v+1);};
  window.addEventListener('export-started',onExport);
  return ()=>window.removeEventListener('export-started',onExport);
 },[setDownloadOpen]);
 useEffect(()=>{seen.current=new Set();setNotice({principal,ready:false});},[principal]);
 useEffect(()=>{
  if(!user)return;
  let stopped=false,timer,controller;
  const check=async()=>{
   controller=new AbortController();
   const [legacy,ads]=await Promise.allSettled([exportApi.getDownloads(),canAds?exportApi.getAdsDownloads({signal:controller.signal}):Promise.resolve(null)]);
   if(stopped)return;
   const ready=[];
   if(legacy.status==='fulfilled'&&legacy.value?.success&&Array.isArray(legacy.value.data)){
    for(const d of legacy.value.data)if(String(d.Status||d.status).toLowerCase()==='completed'&&(d.Id||d.id||d._id))ready.push('legacy:'+(d.Id||d.id||d._id));
   }
   if(ads.status==='fulfilled'&&ads.value?.success&&Array.isArray(ads.value.data?.rows)){
    for(const j of ads.value.data.rows)if(j.status==='COMPLETED')ready.push('ads:'+j.id);
   }
   let fresh=false;
   for(const id of ready){if(!seen.current.has(id)){seen.current.add(id);fresh=true;}}
   if(fresh&&!openRef.current)setNotice({principal,ready:true});
   timer=setTimeout(check,15000);
  };
  void check();
  return ()=>{stopped=true;clearTimeout(timer);controller?.abort();};
 },[principal,canAds,revision,Boolean(user)]);
 const hasNew=notice.principal===principal&&notice.ready&&!downloadOpen;
 const handleOpen=()=>{setNotice({principal,ready:false});setDownloadOpen(true);};
 const handleClose=()=>{setNotice({principal,ready:false});setDownloadOpen(false);setRevision(v=>v+1);};
 return <>
  <Tooltip title={hasNew?'Downloads: new files ready':'Downloads'}>
   <Button type="text" className="ro-header-icon" onClick={handleOpen}
    aria-label={`Downloads${hasNew?', new files ready':''}`} aria-expanded={downloadOpen}
    icon={<Badge dot={hasNew}><Download size={18}/></Badge>}/>
  </Tooltip>
  <DownloadsDrawer key={principal} isOpen={downloadOpen} onClose={handleClose} refreshRevision={revision}/>
 </>;
};
export default DownloadDrawer;
