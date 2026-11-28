'use strict';
// Add only the missing Ads capabilities and refresh their labels; preserve grants.
module.exports={up:require('../database/adsPermissions').registerAdsPermissions};
