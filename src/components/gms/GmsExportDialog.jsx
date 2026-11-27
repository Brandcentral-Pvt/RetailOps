import React,{useState,useRef,useEffect} from 'react';
import {Alert,Button,DatePicker,Drawer,Flex,Form,Radio,Segmented,Select,Typography} from 'antd';
import {DownloadOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
const {Text}=Typography;
export default function GmsExportDialog({open,onClose,onSubmit,level,startDate,endDate,sellerOptions,currentFilterCount,currentSellerIds,search,disabled}){
  const [form]=Form.useForm();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);
  const format=Form.useWatch('exportFileType',form)||'xlsx';
  const dateMode=Form.useWatch('exportDateType',form)||'current';
  const sellerMode=Form.useWatch('exportBrandType',form)||'current';
  const defaults={exportFileType:'xlsx',exportLevel:level,exportDataType:'daily',exportDateType:'current',exportBrandType:'current',exportCustomBrands:[]};
  useEffect(()=>{if(open){setError('');form.resetFields();form.setFieldValue('exportLevel',level);}},[open,level,form]);
  const range=dayjs(startDate||dayjs().startOf('month')).format('DD MMM YYYY')+' to '+dayjs(endDate||dayjs().endOf('month')).format('DD MMM YYYY');
  async function submit(values){
    if(lock.current||disabled)return;
    lock.current=true;setBusy(true);setError('');
    try{
      if(values.exportDateType==='custom'&&(!values.exportCustomDates?.[0]||!values.exportCustomDates?.[1]))throw new Error('Select both export dates.');
      if(values.exportBrandType==='custom'&&!values.exportCustomBrands?.length)throw new Error('Select at least one seller.');
      await onSubmit({...defaults,...values});
      onClose();
    }catch(e){setError(e.message||'Export could not be started. Try again.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <Drawer open={open} title="Export GMS report" width="min(560px, 100vw)" forceRender onClose={()=>{if(!busy)onClose();}} mask={{closable:!busy}} keyboard={!busy}
    footer={<Flex justify="flex-end" gap={8}><Button disabled={busy} onClick={onClose}>Cancel</Button><Button type="primary" icon={<DownloadOutlined/>} loading={busy} disabled={disabled} onClick={()=>form.submit()}>Export {format==='csv'?'complete CSV':'complete Excel'}</Button></Flex>}>
    <Form form={form} layout="vertical" initialValues={defaults} onFinish={submit} requiredMark={false} className="gms-export-form">
      {error&&<Alert type="error" showIcon title={error} style={{marginBottom:16}}/>}
      <Form.Item name="exportFileType" label="Report format">
        <Radio.Group className="gms-export-options">
          <Radio value="xlsx">Excel: complete financial workbook</Radio>
          <Radio value="csv">CSV: complete daily data</Radio>
        </Radio.Group>
      </Form.Item>
      <Alert type="info" showIcon title={format==='xlsx'?'Complete financial workbook':'Complete daily records'}
        description={format==='xlsx'?'Includes the complete daily data, executive summary, ASIN and seller analytics, daily/weekly/monthly comparisons, prior period detail when available, and a revenue matrix.':'Includes all six financial metrics, date, ASIN, uploaded title and seller mapping. Use Excel for separate analytical worksheets.'}/>
      <Text type="secondary" className="gms-export-note">Every matching stored record is exported, regardless of the current table page.</Text>
      {format==='xlsx'&&<>
        <Form.Item name="exportLevel" label="Revenue matrix grouping"><Segmented block options={[{label:'ASIN wise',value:'asin'},{label:'Seller wise',value:'seller'}]}/></Form.Item>
        <Form.Item name="exportDataType" label="Revenue matrix detail"><Segmented block options={[{label:'Daily',value:'daily'},{label:'Weekly',value:'weekly'},{label:'Monthly',value:'monthly'}]}/></Form.Item>
        <Text type="secondary" className="gms-export-note">Matrix options do not remove any complete-data or analytics sheets.</Text>
      </>}
      <Form.Item name="exportDateType" label="Report dates">
        <Radio.Group className="gms-export-options">
          <Radio value="current">Current report range <Text type="secondary">({range})</Text></Radio>
          <Radio value="all">All available history</Radio>
          <Radio value="custom">Custom dates</Radio>
        </Radio.Group>
      </Form.Item>
      {dateMode==='custom'&&<Form.Item name="exportCustomDates" label="Custom reporting dates" rules={[{required:true,message:'Select a start and end date'}]}>
        <DatePicker.RangePicker format="DD MMM YYYY" style={{width:'100%'}} disabledDate={d=>d&&(d.isBefore(dayjs('2000-01-01'),'day')||d.isAfter(dayjs('2099-12-31'),'day'))}/>
      </Form.Item>}
      <Form.Item name="exportBrandType" label="Seller scope">
        <Radio.Group className="gms-export-options">
          <Radio value="current">Current page filters {currentFilterCount>0&&<Text type="secondary">({currentFilterCount} active)</Text>}</Radio>
          <Radio value="all">All authorized sellers and brands</Radio>
          <Radio value="custom">Select sellers</Radio>
        </Radio.Group>
      </Form.Item>
      {sellerMode==='custom'&&<Form.Item name="exportCustomBrands" label="Sellers" rules={[{required:true,type:'array',min:1,message:'Select at least one seller'}]}>
        <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={sellerOptions} placeholder="Choose sellers"/>
      </Form.Item>}
      {sellerMode==='current'&&currentSellerIds?.length===0&&<Alert type="warning" showIcon title="No sellers match the current filters" description="The export will contain no matching records. Change the page filters or choose another seller scope."/>}
      {sellerMode==='current'&&search.trim()&&<Text type="secondary">Search included: {search}</Text>}
      {dateMode==='all'&&format==='xlsx'&&<Alert style={{marginTop:12}} type="warning" showIcon title="All-time report" description="There is no single preceding equal-length period for all-time data. Large exports may take longer or require a narrower date range."/>}
    </Form>
  </Drawer>;
}
