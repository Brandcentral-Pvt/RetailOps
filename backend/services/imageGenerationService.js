const { sql, getPool } = require('../database/db');

/**
 * Image Generation Service
 * NOTE: Stable Diffusion 3 Medium is no longer available on NVIDIA NIM.
 * This service now provides a graceful fallback — saves the prompt for manual generation
 * and marks the ASIN for image attention.
 */
async function generateImage(prompt, asinCode) {
    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    if (!apiKey) {
        console.warn(`[AI-IMAGE] NVIDIA_NIM_API_KEY not configured. Prompt saved for ${asinCode}.`);
        return null;
    }

    // SD3 Medium endpoint is deprecated. Log the prompt for manual use.
    console.log(`[AI-IMAGE] Image generation temporarily unavailable (SD3 Medium deprecated).`);
    console.log(`[AI-IMAGE] Prompt for ${asinCode}: ${prompt}`);

    // Store the prompt in the ASIN's LqsDetails for future use
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('asinCode', sql.VarChar, asinCode)
            .query('SELECT Id, LqsDetails FROM Asins WHERE AsinCode = @asinCode');
        
        if (result.recordset.length > 0) {
            const asin = result.recordset[0];
            let lqsDetails = {};
            try { lqsDetails = JSON.parse(asin.LqsDetails || '{}'); } catch (e) {}
            
            lqsDetails.pendingImagePrompt = prompt;
            lqsDetails.imagePromptDate = new Date().toISOString();
            
            await pool.request()
                .input('id', sql.VarChar, asin.Id)
                .input('lqsDetails', sql.NVarChar, JSON.stringify(lqsDetails))
                .query("UPDATE Asins SET LqsDetails = @lqsDetails, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id");
        }
    } catch (e) {
        console.warn(`[AI-IMAGE] Could not save prompt for ${asinCode}:`, e.message);
    }

    return null;
}

/**
 * Triggers image generation for an ASIN if it has low image count
 */
async function triggerAiImageTask(asinId) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.VarChar, asinId)
            .query("SELECT * FROM Asins WHERE Id = @id");
        
        const asin = result.recordset[0];
        if (!asin) return null;

        const prompt = `Professional product photography of ${asin.Title || asin.AsinCode}, ${asin.Category || ''}, studio lighting, high resolution, 8k, pristine white background, commercial quality.`;

        const imageUrl = await generateImage(prompt, asin.AsinCode);
        return imageUrl;
    } catch (error) {
        console.error(`[AI-IMAGE] Error in triggerAiImageTask:`, error.message);
        return null;
    }
}

module.exports = {
    generateImage,
    triggerAiImageTask
};
