const nimService = require('./nimService');
const asinTableService = require('./asinTableService');

/**
 * AI Goal Service - Intent-to-Strategy Engine
 * 
 * Handles Step 2 (Preview) and Step 5 (Generation) of the Brandcentral Goal Flow.
 */
class AIGoalService {
  /**
   * Fetches a concise snapshot of a seller's current performance to provide context to the AI.
   */
  async _getSellerContext(sellerId) {
    try {
      const data = await asinTableService.getAsinTableData({ 
        sellerId, 
        limit: 5 
      });
      
      if (!data.data || data.data.length === 0) return "No active ASIN data available for this seller.";

      const topAsins = data.data.map(a => 
        `- ${a.asinCode}: Price ₹${a.currentPrice}, BSR ${a.bsr}, Rating ${a.rating}, LQS ${a.lqs}`
      ).join('\\n');

      return `Current Top ASINs:\\n${topAsins}`;
    } catch (err) {
      console.error('[AI Goal Service] Error fetching seller context:', err);
      return "Unable to retrieve real-time seller data.";
    }
  }

  /**
   * Generates a strategic preview from a raw user intent string.
   * Input: "Reach 1Cr GMS in 90 days"
   */
  async generatePreview(intent, sellerId) {
    console.log('[AI Goal Service] Generating Preview for intent:', intent);
    
    const context = sellerId ? await this._getSellerContext(sellerId) : "No seller context provided.";
    
    const prompt = `
      You are the Brandcentral growth engine.
      Analyze this user intent based on the seller's current performance and provide a strategic goal roadmap preview.
      
      Seller Context:
      ${context}
      
      User Intent: "${intent}"
      
      RETURN JSON ONLY with this exact structure:
      {
        "name": "Clear Roadmap Title",
        "strategy": "2-3 sentence summary of the strategy approach based on the provided context",
        "milestones": [
          { "objective": "Milestone 1 action item" },
          { "objective": "Milestone 2 action item" },
          { "objective": "Milestone 3 action item" }
        ]
      }
      
      Generate 4-6 actionable milestones. If the seller context shows low LQS, prioritize listing optimization. If BSR is high but conversion is low, prioritize creative/image updates.
    `;

    const response = await nimService.chat([
      { role: "system", content: "You are a professional E-commerce Growth Strategy system. Always return valid JSON." },
      { role: "user", content: prompt }
    ], { json: true });

    return nimService.cleanJSON(response);
  }

  /**
   * Generates a 4-week execution roadmap based on a confirmed goal.
   */
  async generatePlan(goal, sellerId) {
    const context = sellerId ? await this._getSellerContext(sellerId) : "No seller context provided.";

    const prompt = `
      Generate a 4-week actionable execution plan for this goal.
      
      Seller Context:
      ${context}

      Goal: ${goal.title} (${goal.metricType})
      Target: ${goal.targetValue}
      Scope: ${goal.scopeType} (${goal.scopeIds.join(', ')})
      
      Strategy Logic:
      1. Analyze the gap between the current context and the target.
      2. Break down the required growth into weekly themes.
      3. Assign specific tasks with an expected impact.
      
      RETURN JSON ARRAY:
      [
        {
          "week": Number,
          "tasks": [
            {
              "title": "Task Title",
              "description": "High-impact description",
              "type": "SEO|ADS|OPS|CREATIVE",
              "priority": "HIGH|MEDIUM|LOW",
              "impactArea": "revenue|conversion|traffic",
              "expectedImpact": "e.g. +5% CTR",
              "impactWeight": 1-10
            }
          ]
        }
      ]
    `;

    const response = await nimService.chat([
      { role: "system", content: "You are a World-Class E-commerce Strategy Consultant. Your plans must be data-driven based on the provided context." },
      { role: "user", content: prompt }
    ], { json: true });

    return nimService.cleanJSON(response);
  }
}

module.exports = new AIGoalService();
