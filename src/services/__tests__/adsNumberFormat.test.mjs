import test from 'node:test';
import assert from 'node:assert/strict';
import {adsCount,adsMoney,adsRate,formatAdsValue} from '../../pages/ads/adsNumberFormat.mjs';
test('count, money and rate formatting is consistent and preserves missing vs zero',()=>{
 assert.equal(adsCount('11.0000000000'),'11');
 assert.equal(adsCount('1000000'),'10,00,000');
 assert.equal(adsMoney('7100.0300000000','INR'),'INR 7,100.03');
 assert.equal(adsMoney('1234567','INR'),'INR 12,34,567.00');
 assert.equal(adsMoney('1234567','USD'),'USD 1,234,567.00');
 assert.equal(adsRate('12.3456000000'),'12.35%');
 assert.equal(adsRate('25.0000000000'),'25%');
 assert.equal(adsRate('3.125','x'),'3.13×');
 assert.equal(adsMoney('0','INR'),'INR 0.00');
 assert.equal(adsCount('0.0000000000'),'0');
 assert.equal(adsRate(null),'N/A');assert.equal(adsCount(null,'Unknown'),'Unknown');
});
test('exact decimal rounding, huge counts and sign formatting do not use binary floats',()=>{
 assert.equal(adsMoney('9007199254740993.125','INR'),'INR 9,00,71,99,25,47,40,993.13');
 assert.equal(adsMoney('-1.005','USD'),'USD -1.01');
 assert.equal(adsMoney('999.995','INR'),'INR 1,000.00');
 assert.equal(adsMoney('-0.0001','INR'),'INR 0.00');
 assert.equal(adsCount('9007199254740993'),'9,00,71,99,25,47,40,993');
 assert.equal(formatAdsValue('5.0000','pp',null,{signed:true}),'+5 pp');
 assert.equal(formatAdsValue('-5.125','pp',null,{signed:true}),'-5.13 pp');
 assert.equal(formatAdsValue('0.0000','count',null,{signed:true}),'0');
 assert.equal(adsCount('2.1250000000'),'2.125'); // unexpected fractional count: do not silently truncate
 assert.equal(adsMoney('bad','INR'),'N/A');
});
