'use strict';
const {createReportExportController}=require('./reportExportJobsController');
module.exports=createReportExportController(require('../services/adsExportJobs'),data=>'ads-intelligence-'+(data.filters.allHistory?'all-history':data.filters.startDate+'-'+data.filters.endDate)+'.'+data.format);
