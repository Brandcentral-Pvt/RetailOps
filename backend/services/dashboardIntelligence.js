'use strict';
const {exactSum,percentage,rounded}=require('./dashboardFinancialMetrics');
function shapePortfolio(rows,coverage){
 const r=rows[0]||{};
 const count=k=>Number(r[k]??0);
 const positive=count('PositiveProducts'),head=count('HeadProducts'),unknown=count('UnknownProducts'),unmatched=count('UnmatchedProducts');
 const total=exactSum([r],'PositiveRevenue'),headRevenue=exactSum([r],'HeadRevenue'),top3=exactSum([r],'Top3Revenue');
 return {
  basis:'positive_known_mapped_seller_asin_net_ordered_revenue',
  observedProducts:count('ObservedProducts'),positiveProducts:positive,headProducts:head,tailProducts:positive-head,
  unknownProducts:unknown,unmatchedProducts:unmatched,zeroProducts:count('ZeroProducts'),negativeProducts:count('NegativeProducts'),
  positiveRevenue:total,headRevenue,tailRevenue:total!=null&&headRevenue!=null?rounded(total-headRevenue):null,
  headRevenueShare:rounded(percentage(headRevenue,total)),headProductShare:rounded(percentage(head,positive)),
  top3RevenueShare:rounded(percentage(top3,total)),top3Revenue:top3,
  observedDays:coverage.observedDays,expectedDays:coverage.expectedDays,
  status:!positive?'no_positive_revenue':unknown||unmatched||!coverage.complete?'observed_partial':'observed_complete',
  population:'Full scoped reporting population, excluding unmapped, unknown and nonpositive product revenue from Pareto denominator.'
 };
}
module.exports={shapePortfolio};
