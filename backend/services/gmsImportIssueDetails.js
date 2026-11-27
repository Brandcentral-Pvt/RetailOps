// Shared, deliberately plain-language descriptions for GMS import errors.
// Retain stable internal codes for diagnostics; never display SQL details or
// guess an ASIN for a file-level error or an old history entry.
const labels = {
  asin:'ASIN', date:'Date', brand:'Brand', storeCode:'StoreCode',
  orderedRevenue:'Ordered Revenue', orderedUnits:'Ordered Units',
  shippedRevenue:'Shipped Revenue', shippedCOGS:'Shipped COGS',
  shippedUnits:'Shipped Units', customerReturns:'Customer Returns',
};
const monetary = new Set(['orderedRevenue','shippedRevenue','shippedCOGS']);
const units = new Set(['orderedUnits','shippedUnits','customerReturns']);
const text = (value, max=255) => value == null ? '' : String(value).trim().slice(0,max);
function issue(row,code,message,context={}) {
  const result={row:Number.isInteger(row)&&row>0?row:null,code,message:text(message,350)};
  if(context.asin!=null)result.asin=text(context.asin,100);
  if(context.date!=null)result.date=text(context.date,40);
  if(context.brand!=null)result.brand=text(context.brand,255);
  if(context.column!=null)result.column=text(context.column,100);
  return result;
}
function presentIssue(raw) {
  const i=raw||{}, message=String(i.message||'');
  let column=i.column||'', remarks='';
  const field=message.split(':')[0];
  const fieldLabel=labels[field];
  switch(i.code){
    case 'HEADER': {
      const key=message.split(':').pop().trim();
      column=labels[key]||column||'Column headings';
      remarks=labels[key]
        ? 'The '+labels[key]+' column is missing or appears more than once. Keep exactly one column with this heading in row 1.'
        : 'Check the column headings against the GMS upload template. Keep each required heading exactly once in row 1.';
      break;
    }
    case 'EMPTY_REPORT':
      column='Report';
      remarks='The file contains no data rows. Download a GMS report with at least one ASIN and reporting date, then upload it again.';
      break;
    case 'FORMULA_CELL':
      remarks='This cell contains an Excel formula. Copy the calculated result and use Paste Special > Values before uploading.';
      break;
    case 'EXCEL_ERROR_CELL':
      remarks='This cell contains an Excel error, such as #VALUE! or #N/A. Correct the original value or replace the error with the correct result.';
      break;
    case 'INVALID_ROW':
      if(monetary.has(field)){
        column=fieldLabel;
        remarks='Enter a valid amount in '+fieldLabel+', such as 1250.50 or -250.00, with no more than two decimal places. Blank cells are treated as zero.';
        if(/precision|range/i.test(message)&&!/decimal places/i.test(message))remarks='The amount in '+fieldLabel+' is too large or cannot be read accurately. Check the amount in the original report and enter it accurately as a number or exact text.';
      }else if(units.has(field)){
        column=fieldLabel;
        remarks='Enter a whole number in '+fieldLabel+', such as 10, 0 or -2. Do not use fractional quantities. Blank cells are treated as zero.';
        if(/range/i.test(message))remarks='The quantity in '+fieldLabel+' is outside the supported range. Verify the quantity in the original report.';
      }else if(/ASIN/i.test(message)){
        column='ASIN';remarks='Enter a valid 10-character Amazon ASIN using letters and numbers. Check for missing characters, extra characters or a blank ASIN.';
      }else if(/date|reporting years|YYYY/i.test(message)){
        column='Date';remarks='Enter a valid reporting date, such as 2026-11-27 or 27/11/2026. Check that the day and month exist and the year is between 2000 and 2099.';
      }else if(/brand/i.test(message)){
        column='Brand';remarks='Keep the brand name within 255 characters. Check the brand in the original report.';
      }else if(/store|marketplace|Amazon India/i.test(message)){
        column='StoreCode';remarks='This report supports Amazon India only. Use IN for an India report. Do not change a different marketplace to IN.';
      }else{
        column=column||'Row data';remarks='Check the values in this row against the original Amazon report and correct the invalid entry.';
      }
      break;
    case 'CONFLICTING_DUPLICATE': {
      column='Duplicate record';
      const first=/first row (\d+)/i.exec(message)?.[1];
      remarks='This ASIN has different values for the same reporting date'+(first?' in this row and Excel row '+first:'')+'. Verify the correct values and keep one record for that ASIN and date.';
      break;
    }
    case 'ASIN_AMBIGUOUS':
      column='Seller assignment';remarks='This ASIN is assigned to more than one seller in RetailOps. Ask your administrator to check the correct assignment before uploading again.';break;
    case 'ASIN_FORBIDDEN':
      column='Seller access';remarks='Your account cannot import this ASIN. Ask your administrator to check your seller access or ask an authorized employee to upload the report.';break;
    case 'UNMATCHED_IMPORT_FORBIDDEN':
      column='Seller assignment';remarks='This ASIN has no confirmed seller in RetailOps. Ask a global-access GMS importer to upload it, or have an administrator assign it to the correct seller.';break;
    case 'ASIN_NOT_FOUND':
    case 'ASIN_UNASSIGNED':
    case 'SELLER_MAPPING':
      column='Seller assignment';remarks='This older validation result could not resolve the ASIN assignment. Upload the original report again using the latest importer. If the issue remains, ask your administrator to check the ASIN and your access.';break;
    case 'AMBIGUOUS_FACT':
      column='Existing GMS record';remarks='RetailOps already contains multiple GMS records for this ASIN and date. Ask your administrator to review the existing records before retrying. Do not delete or change revenue in the sheet to bypass this issue.';break;
    case 'FACT_CONFLICT':
      column='Existing GMS record';remarks='A GMS record for this ASIN and date is already linked to a different seller or store. Ask your administrator to verify the existing record before uploading again.';break;
    case 'LEGACY_OWNER_UNKNOWN':
      column='Existing GMS record';remarks='The existing GMS record has no confirmed seller. Ask an authorized global-access importer to review and upload the correction.';break;
    case 'ACCESS_CHANGED':
      column='Import access';remarks='Your permission to import GMS data changed after validation. Ask your administrator to check your access, then upload again.';break;
    case 'PREVIEW_CHANGED':
      column='Report';remarks='The ASIN assignment or saved GMS data changed after validation. Upload and validate the original file again before confirming.';break;
    case 'COMMIT_FAILED':
      column='Report';remarks='The report could not be saved. No partial records were saved by this import. Upload and validate again; contact support if it happens again.';break;
    case 'FILE_VALIDATION':
      column='Report';
      if(/one worksheet/i.test(message))remarks='Keep exactly one worksheet in the Excel file, containing the GMS report, then upload again.';
      else if(/no worksheet/i.test(message))remarks='No worksheet could be read. Save the GMS data in a valid Excel or CSV file and upload again.';
      else if(/exceeds/i.test(message))remarks='The report exceeds the allowed file dimensions. Split the report into smaller files (up to 500,000 rows, 64 columns and 100 MB each).';
      else if(/formula/i.test(message))remarks='The Excel file contains formulas. Copy the report and use Paste Special > Values, then upload again.';
      else if(/error cells/i.test(message))remarks='The Excel file contains error cells. Correct the values in the original sheet before uploading again.';
      else if(/timed out|stopped|failed/i.test(message))remarks='The file could not be checked completely. Try uploading again or split it into smaller files. Contact support if it happens again.';
      else remarks='RetailOps could not read this report. Save a new copy as CSV or Excel using the GMS template and upload again.';
      break;
    default:
      column=column||'Report';remarks='This older validation issue needs review. Upload the original report again to receive updated correction instructions.';
  }
  return {...i,column:column||'Row data',remarks};
}
module.exports={issue,presentIssue,labels};
