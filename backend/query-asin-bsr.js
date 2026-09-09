const sql = require('mssql');
const fs = require('fs');

const asins = [
  'B0H4LMT3VD', 'B0F63CHJWD', 'B0FNWPNWQZ', 'B09S3XCXGM', 'B0FPCWM9YM',
  'B0H2RMTXDR', 'B0D8TQL7H9', 'B0FTXGPR9J', 'B09F6KL23R', 'B0D8VXNHVG',
  'B0H7JXVGDY', 'B0FJS2XGHT', 'B0FPBDM7BF', 'B0DFM8W69F', 'B0FNRKB3P1',
  'B0DFMBRYZX', 'B0DFM7GWFV', 'B0DFM8Y4TT', 'B0DFM8CNXZ', 'B0DFM9SPHG',
  'B0DFM8HL8C', 'B0FNRN3DXS', 'B0C4JLX8DN', 'B09RQKY3TN', 'B0DF2S9SNR',
  'B096FXT7DR', 'B09R44DMKZ', 'B09R46K4QZ', 'B08PNNZG2G', 'B07WG2P3CG',
  'B08QV8NSZ6', 'B0CRB5TKJ5', 'B08WWN3JQN', 'B07VXW6G29', 'B07VFWV65T',
  'B084GP5VB5', 'B0CX8TKFTK', 'B09R4837GD', 'B08L663XNS', 'B0CPP92LKQ',
  'B08QRPTD2V', 'B09RH6Y88R', 'B0CPBHLCBV', 'B09R9DDDFL', 'B0846R7KJ5',
  'B08ZXTLPRS', 'B09SCV8BTQ', 'B09R43F833', 'B09RH6P5S7', 'B0BPY6MDN1',
  'B07VCR6LKY', 'B0CH6BS5M3', 'B0BQMBTLBM', 'B09RV7ZCF3', 'B0CR3XJWNN',
  'B0CP23Y11W', 'B08QRG2QPM', 'B08QR71K93', 'B08QRDGD4H', 'B09R9BGH3P',
  'B0846R2J48', 'B09RFM9CGR', 'B09R23VFNQ', 'B09RH6J69V', 'B0CQCYK4NS',
  'B0CLJ1VB3T', 'B09R44SB87', 'B0CRHLQPZD', 'B0CR9Y49QN', 'B0CL9VPJMZ',
  'B0CPJ8RH7T', 'B0CPPD9CMD', 'B0CL6XNHSZ', 'B0834S3C7G', 'B0CQFQZVK2',
  'B0BQBFYHKY', 'B09V82HTCF', 'B09QXN3XKK', 'B08QS3XC5D', 'B09TXYK62M',
  'B09R9BP46Y', 'B0CVN9HLMD', 'B09QKYP32L', 'B08GH9K16C', 'B0CJY4VF1F',
  'B0846RLR8X', 'B0D8BQH9LK', 'B0CQFT64F8', 'B08QYV6JT2', 'B0DFWF1VPF',
  'B09TXVF1ZD', 'B08P4WCR5Q', 'B0CPBKXL1S', 'B08GM6XZX1', 'B07YBXV24M',
  'B09R99R25N', 'B0CVNB9X3P', 'B08QRC3Z6K', 'B084H31VFT', 'B09QYXTH43',
  'B0DC5DRKDM', 'B09Q5SKWSY', 'B0C24D1M3J', 'B09TXPP44S', 'B0DLWL3VR3',
  'B09SCJ4KT9', 'B083H3GP4Q', 'B0834SG1WR', 'B09Q5XJW1Y', 'B09BZ22PLV',
  'B0CPPB5W8X', 'B09R3YFFSN', 'B0CQFZXCTZ', 'B0CL6V2WCJ', 'B0DPKYWLTD',
  'B0CYH5X5TS', 'B09R9CLN8B', 'B0CR9YCDS3', 'B0CLJ3F4NS', 'B0D2XYR54V',
  'B0DKP4TTRL', 'B0BQJGD8W3', 'B09R9T5P49', 'B0CST1LDQS', 'B0CQC6MVQ7',
  'B0CQFGSX9P', 'B0CQT2Y4W2', 'B0CZDYPWY9', 'B09T6P22R3', 'B09CZ5K7JB',
  'B083RSC8HS', 'B0DKJD13RS', 'B0DCJPXJVD', 'B0BQBJ2LCN', 'B09RPL3CSR',
  'B0CQBYR9QM', 'B0CPJL2LVF', 'B0CPJ767KN', 'B0CK7VH1QD', 'B0CL6QKRXK',
  'B0C94HMD1X', 'B09SLWL9RG', 'B09X9QW3K4', 'B0B8NW3B53', 'B08CRJ9V58',
  'B08DWR8VBT', 'B08JK6M9SK', 'B0DZNRC3F2', 'B0925JQZN4', 'B09VFR41BP',
  'B08FB7VKX2', 'B09515HJQ6', 'B0954ZFMPF', 'B0C4NRZ917', 'B0C39C88B9',
  'B098FZG6H6', 'B0925G2X26', 'B0925JJX1H', 'B0CL283ZQR', 'B09VFPZQ2K',
  'B0FTY3Z3BD', 'B0FNRBXH6M', 'B0C4SXQFX5', 'B08P3RWB9T', 'B08NY9MJLC',
  'B09VFR4248', 'B08FF51M37', 'B08F5GK11L', 'B07JQPJVZH', 'B09R9LHF8R',
  'B09Y224ZGX', 'B082XVFLJH', 'B099DRTWWL', 'B09VFFTX5B', 'B07JNLC6WL',
  'B07LD6VS11', 'B0837S24GG', 'B07YTQTZFS', 'B09VFDQWKV', 'B0GH877S9X',
  'B0B3DBRQ4C', 'B07KYMPCYT', 'B09X76CWBK', 'B07KZTYBM1', 'B07NYRWNL1',
  'B0C865VJ37', 'B09P8MK3RN', 'B07MKYPYCH', 'B09SWQSGJL', 'B07XY3SBBJ',
  'B07QDD1XXZ', 'B093SKZSRK', 'B09W2WCMX4', 'B07JZBBZVG', 'B0F4RBX8W3',
  'B0GW837BVK', 'B0GW85DTCJ', 'B0GW8BN7B8', 'B0B7DW2YCP', 'B0CY57LC8B',
  'B06WP3RBK1', 'B07W5YKHCY', 'B0DH8DWW65', 'B0D576VRQB', 'B0GX1V7J63',
  'B0GX27MRYB', 'B0GY5KDPZM', 'B0GX23NSR2', 'B0H2VVB27L', 'B0H2VRYFDJ',
  'B0GX26RKH6', 'B0GX1Y1LMV', 'B0DFY89SFQ', 'B0H2W22R2Q', 'B0H2VS4NNF',
  'B09N6RD2CN', 'B0H2W24CN5', 'B0DFY8CN73', 'B0BNJFB321', 'B0GX21XYH6',
  'B0C2Z7Z89R', 'B0H2VRD3XR', 'B0GX24M1Q8', 'B0H2W6TM6R', 'B0H2VVF21Q',
  'B0CRPGYPSC', 'B0DRK63658', 'B0D8QMCB7Y', 'B0DN6R4DK7', 'B0CRNLPH6L',
  'B0DN6VKB2F', 'B0CRNL65YC', 'B0DN6S5MDB', 'B0CRNQ7X1C', 'B0CRNN4VV4',
  'B0DN6VCT7X', 'B0D4DQBFXV', 'B0H5CXF61N', 'B0H5CXCWCY', 'B0H5CT8FWH',
  'B0H5CSTFXP', 'B0D9YLDP27', 'B0DFC56YM1', 'B0D9YNW8ML', 'B0D9YNPFGK',
  'B0D9YNQZW7', 'B0D9YPFL6P', 'B0D9YPWBRY', 'B0FJSC7JZ2', 'B0FJS8LP97',
  'B0D8KS5HSC', 'B0CCLCBVY8', 'B0G4MV1N74', 'B0FZCDBRYL', 'B0FY6MCZ1R',
  'B0DR5VK8YR', 'B0BRD4MZ1T', 'B0G53CWJS8', 'B0GGZP4VJZ', 'B0FQPRCQD5',
  'B0DMP97NJW', 'B0CQM5BT4S', 'B0CP9F793J', 'B0C24J2VJV', 'B0F1KP5XPZ',
  'B0F1KQGP2S', 'B09JKV9GZN', 'B0BR14M717', 'B0H54ZB4LP', 'B0H54WN9S2',
  'B0H4H2QS5C', 'B0H9Y2K7VT', 'B0GMZSB64S', 'B0GYCZVBKM', 'B0DYVM3Q2G',
  'B0F3JPCCHH', 'B0FTVR5WBW', 'B0GNMLTDP5', 'B0GNMSRQL1', 'B094WBN8JL',
  'B0CR1FMPP5', 'B0G1BM7TK5', 'B0DXCYXV3L', 'B0CR15QLC6', 'B0GF3434S9',
  'B0GK2DTKHX', 'B0GT11MTSK', 'B0HC3BHJ6Y', 'B0HGRSCSN6', 'B0H3VYP5ZG',
  'B0H6J8RSZ7', 'B0DCP3PRVZ', 'B0F5QS3J5S', 'B0GZGS6ZFK', 'B0GCTWTMFX',
  'B0H45M7QM1', 'B0H9ZLBP19'
];

const config = {
  user: 'sa',
  password: 'YourStrong@Passw0rd',
  server: '127.0.0.1',
  database: 'retailops',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  requestTimeout: 180000,
  connectionTimeout: 30000,
};

const placeholders = asins.map((_, i) => `@asin${i}`).join(',');

const query = `
  SELECT 
      a.AsinCode as ASIN,
      ah.Date,
      ah.Price,
      ah.BSR,
      ah.Rating,
      ah.ReviewCount,
      ah.StockLevel,
      ah.SubBSR as sub_BSR,
      ah.LQS,
      ah.Source
  FROM AsinHistory ah
  JOIN Asins a ON ah.AsinId = a.Id
  WHERE a.AsinCode IN (${placeholders})
  AND ah.Date >= '2026-06-01' AND ah.Date < '2026-08-01'
  ORDER BY ah.Date, a.AsinCode
`;

async function queryBSR() {
  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    
    asins.forEach((asin, i) => {
      request.input(`asin${i}`, sql.NVarChar, asin);
    });

    const result = await request.query(query);
    
    // Format date as DD-MM-YYYY to match existing data format
    const csvHeader = 'ASIN,Date,Price,BSR,Rating,ReviewCount,StockLevel,sub_BSR,LQS,Source\n';
    const csvRows = result.recordset.map(row => {
      const date = row.Date instanceof Date ? row.Date : new Date(row.Date);
      const formattedDate = date.toISOString().split('T')[0].split('-').reverse().join('-'); // DD-MM-YYYY
      return `${row.ASIN},${formattedDate},${row.Price ?? ''},${row.BSR ?? ''},${row.Rating ?? ''},${row.ReviewCount ?? ''},${row.StockLevel ?? ''},${row.sub_BSR ?? ''},${row.LQS ?? ''},${row.Source ?? ''}`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows + '\n';
    
    const filename = `asin_history_june_july_2026_${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = `G:\\Brandcentral Development\\RetailOps_V2.1\\RetailOps_V2.1\\${filename}`;
    
    fs.writeFileSync(filepath, csvContent);
    
    console.log(`CSV saved to: ${filepath}`);
    console.log(`Total rows: ${result.recordset.length}`);
    console.log(`Unique ASINs: ${new Set(result.recordset.map(r => r.ASIN)).size}`);
    console.log(`Date range: ${result.recordset[0]?.Date} to ${result.recordset[result.recordset.length-1]?.Date}`);
    
    // Summary by month
    const juneRows = result.recordset.filter(r => new Date(r.Date).getMonth() === 5).length;
    const julyRows = result.recordset.filter(r => new Date(r.Date).getMonth() === 6).length;
    console.log(`June 2026 rows: ${juneRows}`);
    console.log(`July 2026 rows: ${julyRows}`);
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err);
  }
}

queryBSR();