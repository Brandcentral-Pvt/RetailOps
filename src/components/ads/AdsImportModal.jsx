import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal, Select, Space, Table, Tag, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { apiClient } from '../../lib/api-client';

const AdsImportModal = ({ isOpen, onClose, selectedSeller }) => {
    const [sellerId,setSellerId]=useState(null);
    const [sellers,setSellers]=useState([]);
    const [file,setFile]=useState(null);
    const [result,setResult]=useState(null);
    const [error,setError]=useState(null);
    const [busy,setBusy]=useState(false);
    const [loadingSellers,setLoadingSellers]=useState(false);

    useEffect(()=>{
        if (!isOpen) return undefined;
        let active=true;
        setSellerId(selectedSeller||null);setFile(null);setResult(null);setError(null);setSellers([]);
        setLoadingSellers(true);
        apiClient.get('/upload/ads-validation-sellers').then(res=>{
            if (active) setSellers(res.data?.data||[]);
        }).catch(()=>{if(active)setError('Seller options could not be loaded. Reopen this dialog to retry.');})
          .finally(()=>{if(active)setLoadingSellers(false);});
        return ()=>{active=false;};
    },[isOpen,selectedSeller]);
    const seller=sellers.find(s=>s.id===sellerId);

    const validate=async()=>{
        if (!file||!seller?.context) return;
        setBusy(true);setError(null);setResult(null);
        try {
            const form=new FormData();
            form.append('sellerId',sellerId);form.append('reportType','daily');form.append('file',file);
            const res=await apiClient.post('/upload/ads-validate',form,{timeout:120000});
            setResult(res.data?.data||null);
            if (!res.data?.success) setError(res.data?.message||'Validation failed.');
        } catch(e) {
            setResult(e.response?.data?.data||null);
            setError(e.response?.data?.message||'Validation could not be completed.');
        } finally {setBusy(false);}
    };
    return <Modal title="Validate advertising report" open={isOpen} onCancel={busy?undefined:onClose}
        closable={!busy} maskClosable={!busy} keyboard={!busy} centered width={760}
        styles={{body:{maxHeight:'65vh',overflowY:'auto'}}}
        footer={<Space><Button disabled={busy} onClick={onClose}>Close</Button>
          <Button type="primary" loading={busy} disabled={!file||!seller?.context||loadingSellers} onClick={validate}>Validate CSV</Button></Space>}>
      <Space direction="vertical" size="middle" style={{width:'100%'}}>
        <Alert type="info" showIcon message="Validation only"
          description="Ads Intelligence is transitioning to the 63-column daily product template. Validation is read-only; importing records remains paused."/>
        <div><label htmlFor="ads-validation-seller">Seller</label><Select id="ads-validation-seller" value={sellerId||undefined}
          placeholder="Select the report's seller" loading={loadingSellers} showSearch optionFilterProp="label"
          disabled={busy} style={{width:'100%',marginTop:6}}
          options={sellers.map(s=>({value:s.id,label:s.name+' ('+s.marketplace+')',disabled:!s.context}))}
          onChange={v=>{setSellerId(v);setResult(null);setError(null);}}/></div>
        {seller?.context&&<Space><Tag>{seller.context.marketplace}</Tag><Tag>{seller.context.currency}</Tag><Tag>Daily v1</Tag></Space>}
        {seller&&!seller.context&&<Alert type="warning" message="Seller marketplace/currency requires administrator verification."/>}
        <Upload.Dragger accept=".csv" maxCount={1} disabled={busy} fileList={file?[file]:[]}
          beforeUpload={f=>{setResult(null);if(!/\.csv$/i.test(f.name)||f.size>32*1024*1024||!f.size){setFile(null);setError('Select a nonempty CSV up to 32 MiB.');return Upload.LIST_IGNORE;}setError(null);setFile(f);return false;}}
          onRemove={()=>{setFile(null);setResult(null);setError(null);return true;}}>
          <p className="ant-upload-drag-icon"><InboxOutlined/></p><p>Choose a product_daily v1 CSV</p>
          <p>All 63 headers are required. Dates come from the report, not a fallback date.</p>
        </Upload.Dragger>
        {error&&<Alert type="error" showIcon message={error}/>}
        {result&&<Space direction="vertical" style={{width:'100%'}}>
          <Alert type={result.valid?'success':'warning'} showIcon message={result.valid?'Validation passed':'Validation requires correction'}
            description="No advertising facts or catalog records were changed."/>
          <div>{result.rows.toLocaleString()} rows · {result.uniqueAsins.toLocaleString()} ASINs · {result.uniqueDates} dates</div>
          <div>{result.startDate||'N/A'} to {result.endDate||'N/A'}</div>
          <Space wrap><Tag color="green">{result.validRows.toLocaleString()} valid</Tag><Tag color="red">{result.invalidRows.toLocaleString()} invalid</Tag>
            <Tag>{result.exactDuplicates} exact duplicates</Tag><Tag>{result.conflictingDuplicates} conflicting duplicates</Tag></Space>
          {!!result.issueCount&&<Table size="small" rowKey={(_,i)=>i} dataSource={result.issues} pagination={{pageSize:10}}
            columns={[{title:'Row',dataIndex:'row',width:70},{title:'Column',dataIndex:'column',width:190},{title:'Issue',dataIndex:'message'}]}/>}
          {result.issuesTruncated&&<Alert type="warning" message={'Showing the first '+result.issues.length+' of '+result.issueCount+' issues.'}/>}
        </Space>}
      </Space>
    </Modal>;
};
export default AdsImportModal;
