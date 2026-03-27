require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.NVIDIA_NIM_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function findModels() {
  try {
    const models = await client.models.list();
    const minimaxModels = models.data.filter(m => m.id.toLowerCase().includes('minimax'));
    console.log('Available Minimax Models:');
    minimaxModels.forEach(m => console.log(m.id));
    if (minimaxModels.length === 0) {
        console.log('No minimax models found in the list. Printing all models to find hints:');
        models.data.forEach(m => console.log(m.id));
    }
  } catch (err) {
    console.error('Error listing models:', err);
  }
}

findModels();
