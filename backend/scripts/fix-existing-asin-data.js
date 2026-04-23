/**
 * Migration Script: Fix existing ASIN data using rawOctoparseData
 * Run with: node scripts/fix-existing-asin-data.js
 * 
 * This script updates existing ASINs with correct values from rawOctoparseData
 * without triggering new scrapes.
 */

const mongoose = require('mongoose');
const Asin = require('../models/Asin');
require('dotenv').config();

// Copy the helper methods from above (or import the service)
// For simplicity, we'll recreate the necessary helpers here

function parseBSR(rawData) {
    const bsrField = rawData?.alt_bsr || rawData?.BSR || rawData?.bsr || '';
    const subBsrField = rawData?.alt_sub_bsr || rawData?.sub_BSR || '';
    
    let main = 0;
    let sub = 0;
    let subBsrString = '';
    let allRanks = [];
    
    if (bsrField && typeof bsrField === 'string' && bsrField.trim()) {
        const mainMatch = bsrField.match(/#([\d,]+)\s+in\s+([^#(]+)/);
        if (mainMatch) {
            main = parseInt(mainMatch[1].replace(/,/g, ''));
            allRanks.push(mainMatch[0].trim());
        }
        
        const allMatches = bsrField.match(/#[\d,]+[\s\S]+?(?=#|$)/g);
        if (allMatches && allMatches.length > 0) {
            allRanks = allMatches.map(m => m.trim().replace(/\s+/g, ' ')).filter(Boolean);
        }
    }
    
    if (subBsrField && typeof subBsrField === 'string' && subBsrField.trim()) {
        const subMatch = subBsrField.match(/#([\d,]+)\s+in\s+(.+)/);
        if (subMatch) {
            sub = parseInt(subMatch[1].replace(/,/g, ''));
            subBsrString = subBsrField.trim();
            if (!allRanks.includes(subBsrString)) {
                allRanks.push(subBsrString);
            }
        }
    }
    
    return { main, sub, subBsrString, allRanks };
}

function countImagesAndVideos(rawData) {
    let imagesCount = 0;
    let videoCount = 0;
    
    const imgHtml = rawData?.image_count || rawData?.Field6 || '';
    
    if (imgHtml && typeof imgHtml === 'string' && imgHtml.length > 0) {
        const imageLiMatches = imgHtml.match(/<li[^>]*class="[^"]*imageThumbnail[^"]*"[^>]*>/gi) || [];
        imagesCount = imageLiMatches.length;
        
        const videoLiMatches = imgHtml.match(/<li[^>]*class="[^"]*videoThumbnail[^"]*"[^>]*>/gi) || [];
        
        const videoCountSpan = imgHtml.match(/<span[^>]*id="videoCount"[^>]*>(\d+)\s*VIDEOS?<\/span>/i);
        if (videoCountSpan) {
            videoCount = parseInt(videoCountSpan[1]) || 0;
        } else {
            videoCount = videoLiMatches.length;
        }
        
        if (imagesCount === 0) {
            const allLiMatches = imgHtml.match(/<li[^>]*>/gi) || [];
            imagesCount = allLiMatches.length - videoLiMatches.length;
        }
    } else {
        imagesCount = parseInt(rawData?.imageCount || rawData?.imagesCount || 0);
        videoCount = parseInt(rawData?.videoCount || rawData?.video_count || 0);
    }
    
    if (imagesCount === 0 && (rawData?.Main_Image || rawData?.mainImage)) {
        imagesCount = 1;
    }
    
    return { imagesCount, videoCount };
}

function detectAplusContent(rawData) {
    const aplusContent = rawData?.A_plus || rawData?.aplus_content || '';
    if (aplusContent && typeof aplusContent === 'string') {
        const aplusMarkers = ['aplus-v2', 'aplus-standard', 'launchpad-module', 'apm-'];
        for (const marker of aplusMarkers) {
            if (aplusContent.toLowerCase().includes(marker.toLowerCase())) {
                return true;
            }
        }
        if (aplusContent.length > 300 && (aplusContent.includes('<div') || aplusContent.includes('<img'))) {
            return true;
        }
    }
    return false;
}

function cleanPrice(str) {
    if (!str) return 0;
    const cleaned = str.toString().replace(/[₹$€£,]/g, '').trim();
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
}

function cleanReviewCount(str) {
    if (!str) return 0;
    const s = str.toString().trim();
    const parenMatch = s.match(/\(([\d,]+)\)/);
    if (parenMatch) {
        return parseInt(parenMatch[1].replace(/,/g, '')) || 0;
    }
    const numMatch = s.match(/([\d,]+)/);
    if (numMatch) {
        return parseInt(numMatch[1].replace(/,/g, '')) || 0;
    }
    return 0;
}

function parseRatingBreakdown(ratingStr) {
    const breakdown = { fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 };
    if (!ratingStr) return breakdown;
    
    const percMatch = ratingStr.toString().match(/(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%/);
    if (percMatch) {
        breakdown.fiveStar = parseFloat(percMatch[1]);
        breakdown.fourStar = parseFloat(percMatch[2]);
        breakdown.threeStar = parseFloat(percMatch[3]);
        breakdown.twoStar = parseFloat(percMatch[4]);
        breakdown.oneStar = parseFloat(percMatch[5]);
    }
    return breakdown;
}

function parseBulletPoints(bulletHtml) {
    if (!bulletHtml || typeof bulletHtml !== 'string') return [];
    const bulletPoints = [];
    
    // Check individual bp fields first
    if (typeof bulletHtml === 'object') {
        for (let i = 1; i <= 5; i++) {
            const bp = bulletHtml[`bp_${i}`];
            if (bp && bp.trim()) bulletPoints.push(bp.trim());
        }
    }
    
    if (bulletPoints.length === 0 && typeof bulletHtml === 'string') {
        const matches = bulletHtml.match(/<li[^>]*>(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/li>/gi);
        if (matches) {
            for (const match of matches) {
                const text = match.replace(/<[^>]+>/g, '').trim();
                if (text) bulletPoints.push(text);
            }
        }
    }
    
    return bulletPoints;
}

function extractSellerFromRaw(rawData) {
    const sellerFields = ['sold_by', 'Sold_by', 'seller', 'Seller', 'merchant', 'Merchant', 'Field11'];
    for (const field of sellerFields) {
        const value = rawData[field];
        if (value && typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return '';
}

function parseSecondaryBuybox(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.length < 50) {
        return { offers: [] };
    }
    const offers = [];
    const sellers = htmlContent.match(/Sold by\s*<\/span>\s*<[^>]+>\s*<a[^>]*>([^<]+)</gi);
    const prices = htmlContent.match(/₹\s*([\d,]+)\.(\d{2})/g);
    for (let i = 0; i < Math.max(sellers?.length || 0, prices?.length || 0); i++) {
        const offer = {};
        if (sellers && sellers[i]) {
            const m = sellers[i].match(/>([^<]+)</);
            if (m) offer.seller = m[1].trim();
        }
        if (prices && prices[i]) {
            offer.price = parseFloat(prices[i].replace(/[₹,\s]/g, ''));
        }
        if (offer.seller || offer.price) offers.push(offer);
    }
    return { offers };
}

async function fixExistingAsins() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        // Find all ASINs that have rawOctoparseData and need fixing
        const asins = await Asin.find({
            'rawOctoparseData.alt_bsr': { $exists: true, $ne: '' }
        });
        
        console.log(`Found ${asins.length} ASINs with rawOctoparseData to process`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const asin of asins) {
            const raw = asin.rawOctoparseData;
            if (!raw || Object.keys(raw).length === 0) {
                skippedCount++;
                continue;
            }
            
            const updates = {};
            
            // 1. Fix BSR mapping
            const bsrData = parseBSR(raw);
            if (bsrData.main > 0 && bsrData.main !== asin.bsr) {
                updates.bsr = bsrData.main;
                console.log(`  ASIN ${asin.asinCode}: BSR ${asin.bsr} -> ${bsrData.main}`);
            }
            if (bsrData.subBsrString && bsrData.subBsrString !== asin.subBsr) {
                updates.subBsr = bsrData.subBsrString;
                updates.subBSRs = bsrData.allRanks;
                console.log(`  ASIN ${asin.asinCode}: subBsr "${asin.subBsr}" -> "${bsrData.subBsrString}"`);
            }
            
            // 2. Fix video count (only if current videoCount is 0 but raw has videos)
            const imageVideoData = countImagesAndVideos(raw);
            if (imageVideoData.videoCount > 0 && asin.videoCount === 0) {
                updates.videoCount = imageVideoData.videoCount;
                console.log(`  ASIN ${asin.asinCode}: videoCount 0 -> ${imageVideoData.videoCount}`);
            }
            if (imageVideoData.imagesCount > 0 && asin.imagesCount === 0) {
                updates.imagesCount = imageVideoData.imagesCount;
                console.log(`  ASIN ${asin.asinCode}: imagesCount 0 -> ${imageVideoData.imagesCount}`);
            }
            
            // 3. Fix A+ content detection
            const hasAplus = detectAplusContent(raw);
            if (hasAplus !== asin.hasAplus) {
                updates.hasAplus = hasAplus;
                console.log(`  ASIN ${asin.asinCode}: hasAplus ${asin.hasAplus} -> ${hasAplus}`);
                
                // Update A+ timers
                const now = new Date();
                if (hasAplus) {
                    updates.aplusPresentSince = asin.aplusPresentSince || now;
                    updates.aplusAbsentSince = null;
                } else {
                    updates.aplusAbsentSince = asin.aplusAbsentSince || now;
                    updates.aplusPresentSince = null;
                }
            }
            
            // 4. Fix review count if missing
            if (raw.review_count && asin.reviewCount === 0) {
                const reviewCount = cleanReviewCount(raw.review_count);
                if (reviewCount > 0) {
                    updates.reviewCount = reviewCount;
                    console.log(`  ASIN ${asin.asinCode}: reviewCount 0 -> ${reviewCount}`);
                }
            }
            
            // 5. Fix rating if missing
            if (raw.avg_rating && asin.rating === 0) {
                const rating = parseFloat(raw.avg_rating);
                if (!isNaN(rating) && rating > 0) {
                    updates.rating = rating;
                    console.log(`  ASIN ${asin.asinCode}: rating 0 -> ${rating}`);
                }
            }
                // 6. Fix rating breakdown
            if (raw.Rating_breakdown) {
                const breakdown = parseRatingBreakdown(raw.Rating_breakdown);
                const hasBreakdown = Object.values(breakdown).some(v => v > 0);
                const currentHasBreakdown = Object.values(asin.ratingBreakdown || {}).some(v => v > 0);
                if (hasBreakdown && !currentHasBreakdown) {
                    updates.ratingBreakdown = breakdown;
                    console.log(`  ASIN ${asin.asinCode}: ratingBreakdown updated`);
                }
            }
            
            // 7. Buy Box & All Offers
            const soldBy = extractSellerFromRaw(raw) || asin.soldBy || '';
            const priceVal = cleanPrice(raw.current_price || raw.Price || raw.currentPrice || raw.Field1 || '');
            let allOffers = [];
            
            if (soldBy) {
                allOffers.push({
                    seller: soldBy,
                    price: priceVal || asin.currentPrice || 0,
                    isBuyBoxWinner: true
                });
            }
            
            const secondBuyboxData = parseSecondaryBuybox(raw.second_buybox || raw.Alt_buyBox || raw.Field25 || '');
            if (secondBuyboxData.offers.length > 0) {
                secondBuyboxData.offers.forEach(offer => {
                    if (offer.seller !== soldBy || allOffers.length === 0) {
                        allOffers.push({
                            seller: offer.seller,
                            price: offer.price,
                            isBuyBoxWinner: false
                        });
                    }
                });
            }
            
            if (allOffers.length > 0 && JSON.stringify(allOffers) !== JSON.stringify(asin.allOffers || [])) {
                updates.allOffers = allOffers;
                console.log(`  ASIN ${asin.asinCode}: allOffers updated (${allOffers.length} offers)`);
            }
            
            // 8. Fix bullet points
            if (raw.bullet_points_count || raw.bp_1) {
                const bulletPointsText = parseBulletPoints(raw);
                if (bulletPointsText.length > 0 && (!asin.bulletPointsText || asin.bulletPointsText.length === 0)) {
                    updates.bulletPointsText = bulletPointsText;
                    updates.bulletPoints = bulletPointsText.length;
                    console.log(`  ASIN ${asin.asinCode}: bulletPoints 0 -> ${bulletPointsText.length}`);
                }
            }
            
            // 9. Fix price if missing
            if (raw.second_asp && asin.currentPrice === 0) {
                const p = cleanPrice(raw.second_asp);
                if (p > 0) {
                    updates.currentPrice = p;
                    updates.currentASP = p;
                    console.log(`  ASIN ${asin.asinCode}: price 0 -> ${p}`);
                }
            }
            
            // Apply updates if any
            if (Object.keys(updates).length > 0) {
                updates.updatedAt = new Date();
                await Asin.updateOne({ _id: asin._id }, { $set: updates });
                updatedCount++;
            } else {
                skippedCount++;
            }
        }
        
        console.log('\n=== Migration Complete ===');
        console.log(`Total ASINs processed: ${asins.length}`);
        console.log(`ASINs updated: ${updatedCount}`);
        console.log(`ASINs skipped (no raw data): ${skippedCount}`);
        
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
fixExistingAsins();
