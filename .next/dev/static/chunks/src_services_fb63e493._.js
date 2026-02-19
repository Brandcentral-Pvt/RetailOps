(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/services/db.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db,
    "initializeDatabase",
    ()=>initializeDatabase
]);
const __TURBOPACK__import$2e$meta__ = {
    get url () {
        return `file://${__turbopack_context__.P("src/services/db.js")}`;
    }
};
// Database service for Revenue Calculator
// Calls the backend API for all operations
const API_BASE = ("TURBOPACK compile-time value", "object") !== 'undefined' && __TURBOPACK__import$2e$meta__.env?.VITE_API_URL || 'http://localhost:3001/api';
const initializeDatabase = async ()=>{
    console.log('[DB] Remote mode: MongoDB backend via API');
};
/**
 * Database Service Class
 */ class DatabaseService {
    /**
   * Make API request
   */ async request(path, options = {}, fallback = null) {
        try {
            const token = localStorage.getItem('authToken');
            const headers = {
                'Content-Type': 'application/json',
                ...token && {
                    'Authorization': `Bearer ${token}`
                },
                ...options.headers
            };
            const res = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers
            });
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.removeItem('authToken');
                    window.location.href = '/login';
                }
                throw new Error(`HTTP ${res.status}`);
            }
            return await res.json();
        } catch (error) {
            console.error(`[DB] Request failed for ${path}:`, error);
            return fallback;
        }
    }
    // --- Auth & Config ---
    async login(email, password) {
        const user = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password
            })
        }, null);
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
            return user;
        }
        return null;
    }
    logout() {
        localStorage.removeItem('user');
    }
    getUser() {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    }
    getKeepaKey() {
        return localStorage.getItem('fba_keepa_key') || '';
    }
    saveKeepaKey(key) {
        localStorage.setItem('fba_keepa_key', key);
    }
    saveUser(user) {
        const existing = this.getUser();
        const merged = {
            ...existing || {},
            ...user
        };
        localStorage.setItem('user', JSON.stringify(merged));
    }
    // --- Referral Fees ---
    /**
   * @returns {Promise<ReferralFee[]>}
   */ async getReferralFees() {
        return this.request('/fees/referral', {}, []);
    }
    /**
   * @param {ReferralFee | Omit<ReferralFee, 'id'>} fee
   */ async saveReferralFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/referral', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    /**
   * @param {Omit<ReferralFee, 'id'>[]} fees
   */ async saveReferralFeesBulk(fees) {
        for (const fee of fees){
            await this.saveReferralFee(fee);
        }
    }
    async deleteReferralFee(id) {
        await this.request(`/fees/referral/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearReferralFees() {
        await this.request('/fees/referral/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Closing Fees ---
    /**
   * @returns {Promise<ClosingFee[]>}
   */ async getClosingFees() {
        return this.request('/fees/closing', {}, []);
    }
    /**
   * @param {ClosingFee | Omit<ClosingFee, 'id'>} fee
   */ async saveClosingFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/closing', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    /**
   * @param {Omit<ClosingFee, 'id'>[]} fees
   */ async saveClosingFeesBulk(fees) {
        for (const fee of fees){
            await this.saveClosingFee(fee);
        }
    }
    async deleteClosingFee(id) {
        await this.request(`/fees/closing/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearClosingFees() {
        await this.request('/fees/closing/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Shipping Fees ---
    /**
   * @returns {Promise<ShippingFee[]>}
   */ async getShippingFees() {
        return this.request('/fees/shipping', {}, []);
    }
    /**
   * @param {ShippingFee | Omit<ShippingFee, 'id'>} fee
   */ async saveShippingFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/shipping', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    /**
   * @param {Omit<ShippingFee, 'id'>[]} fees
   */ async saveShippingFeesBulk(fees) {
        for (const fee of fees){
            await this.saveShippingFee(fee);
        }
    }
    async deleteShippingFee(id) {
        await this.request(`/fees/shipping/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearShippingFees() {
        await this.request('/fees/shipping/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Storage Fees ---
    /**
   * @returns {Promise<StorageFee[]>}
   */ async getStorageFees() {
        return this.request('/fees/storage', {}, []);
    }
    /**
   * @param {StorageFee | Omit<StorageFee, 'id'>} fee
   */ async saveStorageFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/storage', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteStorageFee(id) {
        await this.request(`/fees/storage/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- Category Mapping ---
    /**
   * @returns {Promise<CategoryMap[]>}
   */ async getCategoryMappings() {
        return this.request('/mappings', {}, []);
    }
    /**
   * @param {CategoryMap | Omit<CategoryMap, 'id'>} map
   */ async saveCategoryMapping(map) {
        const data = {
            ...map,
            id: map.id || crypto.randomUUID()
        };
        await this.request('/mappings', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteCategoryMapping(id) {
        await this.request(`/mappings/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearCategoryMappings() {
        await this.request('/mappings/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Node Map ---
    /**
   * @returns {Promise<NodeMap[]>}
   */ async getNodeMaps() {
        return this.request('/nodemaps', {}, []);
    }
    /**
   * @param {NodeMap | Omit<NodeMap, 'id'>} map
   */ async saveNodeMap(map) {
        const data = {
            ...map,
            id: map.id || crypto.randomUUID()
        };
        await this.request('/nodemaps', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteNodeMap(id) {
        await this.request(`/nodemaps/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearNodeMaps() {
        await this.request('/nodemaps/all', {
            method: 'DELETE'
        }, null);
    }
    // --- ASINs ---
    /**
   * @returns {Promise<AsinItem[]>}
   */ async getAsins(params = {}) {
        return this.request('/asins', {
            params
        }, []);
    }
    /**
   * @param {{ asin: string; stapleLevel: any }[]} items
   */ async addAsinsBulk(items) {
        const payload = items.map((item)=>({
                ...item,
                status: 'pending',
                stepLevel: 'Standard',
                createdAt: new Date().toISOString()
            }));
        await this.request('/asins/bulk', {
            method: 'POST',
            body: JSON.stringify(payload)
        }, null);
    }
    async updateMissingStepLevels() {
        const items = await this.getAsins();
        const missing = items.filter((i)=>!i.stepLevel);
        for (const item of missing){
            await this.updateAsin(item.id, {
                stepLevel: 'Standard'
            });
        }
        return missing.length;
    }
    /**
   * @param {string} id
   * @param {Partial<AsinItem>} updates
   */ async updateAsin(id, updates) {
        await this.request(`/asins/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }, null);
    }
    async clearAsins() {
        await this.request('/asins', {
            method: 'DELETE'
        }, null);
    }
    async deleteAsin(id) {
        await this.request(`/asins/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- Refund Fees ---
    /**
   * @returns {Promise<RefundFee[]>}
   */ async getRefundFees() {
        return this.request('/fees/refund', {}, []);
    }
    /**
   * @param {RefundFee | Omit<RefundFee, 'id'>} fee
   */ async saveRefundFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/refund', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteRefundFee(id) {
        await this.request(`/fees/refund/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearRefundFees() {
        await this.request('/fees/refund/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Calculation ---
    async calculateProfits(asinIds = []) {
        await this.request('/revenue/calculate', {
            method: 'POST',
            body: JSON.stringify({
                asinIds
            })
        }, null);
    }
    // --- ASINs ---
    /**
   * Get all ASINs
   * @returns {Promise<ASIN[]>}
   */ async getAsins(params = {}) {
        return this.request('/asins', {
            params
        }, []);
    }
    /**
   * Get single ASIN
   * @param {string} id
   * @returns {Promise<ASIN>}
   */ async getAsin(id) {
        return this.request(`/asins/${id}`, {}, null);
    }
    /**
   * Create or Update ASIN
   * @param {Partial<ASIN>} asin
   */ async saveAsin(asin) {
        if (asin.id || asin._id) {
            const id = asin.id || asin._id;
            return this.request(`/asins/${id}`, {
                method: 'PUT',
                body: JSON.stringify(asin)
            }, null);
        } else {
            return this.request('/asins', {
                method: 'POST',
                body: JSON.stringify(asin)
            }, null);
        }
    }
    /**
   * Delete ASIN
   * @param {string} id
   */ async deleteAsin(id) {
        return this.request(`/asins/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- Actions ---
    /**
   * Get all actions
   * @returns {Promise<Action[]>}
   */ async getActions() {
        return this.request('/actions', {}, []);
    }
    /**
   * Create a new action
   * @param {Partial<Action>} action
   */ async createAction(action) {
        return this.request('/actions', {
            method: 'POST',
            body: JSON.stringify(action)
        }, null);
    }
    /**
   * Update an action
   * @param {string} id
   * @param {Partial<Action>} updates
   */ async updateAction(id, updates) {
        return this.request(`/actions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }, null);
    }
    /**
   * Delete an action
   * @param {string} id
   */ async deleteAction(id) {
        return this.request(`/actions/${id}`, {
            method: 'DELETE'
        }, null);
    }
    /**
   * Add a message to an action
   * @param {string} actionId
   * @param {string} content
   */ async addMessage(actionId, content) {
        return this.request(`/actions/${actionId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                content
            })
        }, null);
    }
    /**
   * Get all users (for assignment)
   * @returns {Promise<User[]>}
   */ async getUsers() {
        return this.request('/users', {}, []);
    }
    /**
   * Get all sellers
   * @returns {Promise<Seller[]>}
   */ async getSellers() {
        return this.request('/sellers', {}, []);
    }
    // --- NEW: Workflow Actions ---
    /**
   * Start a task
   * @param {string} actionId
   */ async startAction(actionId) {
        return this.request(`/actions/${actionId}/start`, {
            method: 'POST'
        }, null);
    }
    /**
   * Complete a task
   * @param {string} actionId
   * @param {object} completionData - { remarks, stage, recurring, audioTranscript }
   */ async completeAction(actionId, completionData) {
        return this.request(`/actions/${actionId}/complete`, {
            method: 'POST',
            body: JSON.stringify(completionData)
        }, null);
    }
    /**
   * Upload audio for task completion
   * @param {string} actionId
   * @param {Blob} audioBlob
   * @param {string} transcript
   */ async uploadAudio(actionId, audioBlob, transcript) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        if (transcript) {
            formData.append('transcript', transcript);
        }
        try {
            const res = await fetch(`${API_BASE}/actions/${actionId}/upload-audio`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error(`[DB] Audio upload failed:`, error);
            return null;
        }
    }
    /**
   * Get action history (stage transitions)
   * @param {string} actionId
   */ async getActionHistory(actionId) {
        return this.request(`/actions/${actionId}/history`, {}, null);
    }
    /**
   * Analyze ASIN and get suggested actions
   * @param {string} asinId
   */ async analyzeAsin(asinId) {
        return this.request(`/actions/analyze-asin/${asinId}`, {
            method: 'POST'
        }, null);
    }
    /**
   * Create actions from ASIN analysis
   * @param {string} asinId
   */ async createActionsFromAnalysis(asinId) {
        return this.request(`/actions/create-from-analysis/${asinId}`, {
            method: 'POST'
        }, null);
    }
    /**
   * Get overdue actions
   */ async getOverdueActions() {
        return this.request('/actions/reports/overdue', {}, []);
    }
    /**
   * Get Goal vs Achievement report
   */ async getGoalAchievementReport() {
        return this.request('/actions/reports/goal-achievement', {}, null);
    }
    // --- Action Review Workflow ---
    async startAction(id) {
        return this.request(`/actions/${id}/start`, {
            method: 'POST'
        }, null);
    }
    async submitActionForReview(id, formData) {
        // Check if formData is instance of FormData (for audio uploads)
        const isFormData = formData instanceof FormData;
        const options = {
            method: 'POST',
            body: isFormData ? formData : JSON.stringify(formData)
        };
        // If it's FormData, let the browser set the boundary header
        if (isFormData) {
            const token = localStorage.getItem('authToken');
            options.headers = {
                ...token && {
                    'Authorization': `Bearer ${token}`
                }
            };
            // Important: Remove default Content-Type to let fetch set it with boundary
            return fetch(`${API_BASE}/actions/${id}/submit-review`, options).then((res)=>res.json()).catch((err)=>{
                console.error('[DB] Submit for review failed:', err);
                return null;
            });
        }
        return this.request(`/actions/${id}/submit-review`, options, null);
    }
    async reviewAction(id, decision, comments) {
        return this.request(`/actions/${id}/review-action`, {
            method: 'POST',
            body: JSON.stringify({
                decision,
                comments
            })
        }, null);
    }
    // --- OKR Methods ---
    /**
   * Get all objectives
   */ async getObjectives() {
        return this.request('/objectives', {}, []);
    }
    /**
   * Get all task templates
   */ async getTaskTemplates() {
        return this.request('/actions/templates', {}, []);
    }
    /**
   * Create a new task template
   * @param {object} template
   */ async createTemplate(template) {
        return this.request('/actions/templates', {
            method: 'POST',
            body: JSON.stringify(template)
        }, null);
    }
    /**
   * Update a task template
   * @param {string} id
   * @param {object} updates
   */ async updateTemplate(id, updates) {
        return this.request(`/actions/templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }, null);
    }
    /**
   * Delete a task template
   * @param {string} id
   */ async deleteTemplate(id) {
        return this.request(`/actions/templates/${id}`, {
            method: 'DELETE'
        }, null);
    }
    /**
   * Create a new objective
   * @param {object} objective
   */ async createObjective(objective) {
        return this.request('/objectives', {
            method: 'POST',
            body: JSON.stringify(objective)
        }, null);
    }
    /**
   * Create a new key result
   * @param {object} keyResult
   */ async createKeyResult(keyResult) {
        return this.request('/objectives/key-results', {
            method: 'POST',
            body: JSON.stringify(keyResult)
        }, null);
    }
    /**
   * Update an objective
   */ async updateObjective(id, objective) {
        return this.request(`/objectives/${id}`, {
            method: 'PUT',
            body: JSON.stringify(objective)
        }, null);
    }
    /**
   * Delete an objective
   */ async deleteObjective(id) {
        return this.request(`/objectives/${id}`, {
            method: 'DELETE'
        }, null);
    }
    /**
   * Update a key result
   */ async updateKeyResult(id, keyResult) {
        return this.request(`/objectives/key-results/${id}`, {
            method: 'PUT',
            body: JSON.stringify(keyResult)
        }, null);
    }
    /**
   * Delete a key result
   */ async deleteKeyResult(id) {
        return this.request(`/objectives/key-results/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- AI Methods ---
    /**
   * Generate OKR structure using AI
   * @param {object} params - { prompt, type, industry }
   */ async generateAIOKR(params) {
        return this.request('/ai/generate-okr', {
            method: 'POST',
            body: JSON.stringify(params)
        }, null);
    }
    /**
   * Get AI suggestions for tasks
   * @param {string} context - Goal or KR context
   */ /**
   * Get AI suggestions for tasks
   * @param {string} context - Goal or KR context
   */ async getAISuggestions(context) {
        return this.request('/ai/suggest-tasks', {
            method: 'POST',
            body: JSON.stringify({
                context
            })
        }, null);
    }
    /**
   * Get all system settings
   * @param {string} group - Optional group to filter by
   */ async getSettings(group) {
        const data = await this.request(`/settings${group ? `?group=${group}` : ''}`, {}, {
            success: true,
            data: {}
        });
        return data.data;
    }
    /**
   * Update system settings
   * @param {object} settings - Key-value pair of settings
   * @param {string} group - Group name
   */ async updateSettings(settings, group = 'general') {
        return this.request('/settings/update', {
            method: 'POST',
            body: JSON.stringify({
                settings,
                group
            })
        }, null);
    }
    /**
   * Get setting by key
   * @param {string} key
   */ async getSettingByKey(key) {
        const data = await this.request(`/settings/${key}`, {}, {
            success: true,
            data: null
        });
        return data.data;
    }
    /**
   * Get system activity logs
   */ async getSystemLogs() {
        return this.request('/logs', {
            method: 'GET'
        }, null);
    }
}
const db = new DatabaseService();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/services/engine.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateProfits",
    ()=>calculateProfits,
    "fetchKeepaData",
    ()=>fetchKeepaData
]);
// Profit calculation engine for Revenue Calculator
// Refactored to use backend API
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/db.js [app-client] (ecmascript)");
;
const delay = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
const fetchKeepaData = async (asins, forceRefresh = false)=>{
    // Keeping fetchKeepaData client-side for now as it uses the user's local API key
    // This logic is complex but works well client-side to avoid sharing API keys with server if privacy is concern
    // Or we can move this to backend later if we want centralized key management
    const targets = forceRefresh ? asins : asins.filter((a)=>a.status === 'pending' || a.status === 'error');
    if (targets.length === 0) return;
    const apiKey = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].getKeepaKey().trim();
    if (!apiKey) {
        console.warn("Skipping Keepa Fetch: Missing API Key.");
        return;
    }
    const chunkSize = 100;
    for(let i = 0; i < targets.length; i += chunkSize){
        const chunk = targets.slice(i, i + chunkSize);
        const validAsins = chunk.map((a)=>a.asin.trim()).filter((a)=>/^[A-Z0-9]{10}$/i.test(a));
        if (validAsins.length === 0) {
            for (const item of chunk)await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                status: 'error',
                errorMessage: 'Invalid ASIN format'
            });
            continue;
        }
        const asinList = validAsins.join(',');
        let attempts = 0;
        const maxAttempts = 5;
        let success = false;
        console.log(`[Keepa] Fetching chunk ${i / chunkSize + 1} (${validAsins.length} items): ${asinList}`);
        while(attempts < maxAttempts && !success){
            try {
                const url = `https://api.keepa.com/product?key=${apiKey}&domain=10&asin=${asinList}&stats=1&history=0&offersSuccessful=1`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                if (response.status === 429) {
                    attempts++;
                    const waitTime = 5000 * Math.pow(2, attempts);
                    await delay(waitTime);
                    continue;
                }
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                const textResponse = await response.text();
                const data = JSON.parse(textResponse);
                if (data.error) {
                    if (data.error.message && data.error.message.toLowerCase().includes('token')) {
                        attempts++;
                        const waitTime = 5000 * Math.pow(2, attempts);
                        await delay(waitTime);
                        continue;
                    }
                    throw new Error(data.error.message);
                }
                const products = data.products || [];
                for (const item of chunk){
                    const product = products.find((p)=>p.asin.toUpperCase() === item.asin.toUpperCase());
                    if (product) {
                        let rawPrice = -1;
                        const stats = product.stats;
                        if (stats && stats.current) {
                            const buyBox = stats.buyBoxPrice;
                            const newPrice = stats.current[1];
                            const amazonPrice = stats.current[0];
                            if (typeof buyBox === 'number' && buyBox > 0) rawPrice = buyBox;
                            else if (typeof newPrice === 'number' && newPrice > 0) rawPrice = newPrice;
                            else if (typeof amazonPrice === 'number' && amazonPrice > 0) rawPrice = amazonPrice;
                        }
                        const price = rawPrice > 0 ? rawPrice / 100 : 0;
                        const itemWeight = product.itemWeight || 0;
                        const packageWeight = product.packageWeight || 0;
                        const l = product.packageLength || 0;
                        const w = product.packageWidth || 0;
                        const h = product.packageHeight || 0;
                        const lCm = l / 10;
                        const wCm = w / 10;
                        const hCm = h / 10;
                        const volumetricWeight = Math.round(lCm * wCm * hCm / 5000);
                        let finalWeight = 0;
                        if (packageWeight > 0) finalWeight = packageWeight;
                        else finalWeight = volumetricWeight;
                        const title = product.title || `ASIN ${item.asin}`;
                        const brand = product.brand || 'Unknown';
                        const image = product.imagesCSV ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}` : '';
                        let category = 'Uncategorized';
                        let categoryPath = '';
                        let categoryId = '';
                        if (product.categoryTree && product.categoryTree.length > 0) {
                            const leaf = product.categoryTree[product.categoryTree.length - 1];
                            category = leaf.name;
                            categoryPath = product.categoryTree.map((c)=>c.name).join(' > ');
                            categoryId = String(leaf.catId);
                        } else if (product.categories && product.categories.length > 0) {
                            categoryId = String(product.categories[product.categories.length - 1]);
                        }
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                            title,
                            brand,
                            category,
                            categoryPath,
                            categoryId,
                            image,
                            price,
                            weight: finalWeight,
                            volumetricWeight,
                            dimensions: `${lCm.toFixed(1)}x${wCm.toFixed(1)}x${hCm.toFixed(1)} cm`,
                            status: 'fetched'
                        });
                    } else {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                            status: 'error',
                            errorMessage: 'ASIN not found in Keepa return data'
                        });
                    }
                }
                success = true;
            } catch (error) {
                if (error.message.includes('403') || error.message.includes('key')) {
                    for (const item of chunk)await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                        status: 'error',
                        errorMessage: 'Invalid API Key'
                    });
                    return;
                }
                attempts++;
                await delay(5000);
                if (attempts >= maxAttempts) {
                    for (const item of chunk)await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                        status: 'error',
                        errorMessage: error.message
                    });
                }
            }
        }
        await delay(2000);
    }
};
const calculateProfits = async (asins)=>{
    try {
        console.log('[FeeCalc] Triggering backend calculation...');
        // If asins array provided, pass IDs, otherwise empty array triggers all
        const ids = asins ? asins.map((a)=>a.id).filter(Boolean) : [];
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].calculateProfits(ids);
        console.log('[FeeCalc] Backend calculation initiated');
    } catch (error) {
        console.error('[FeeCalc] Calculation error:', error);
        throw error;
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_services_fb63e493._.js.map