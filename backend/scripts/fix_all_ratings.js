require('dotenv').config();
const mongoose = require('mongoose');
const Asin = require('../models/Asin');

async function fixRatings() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://jenil:jenilpatel@aiap.sedzp3h.mongodb.net/aiap?retryWrites=true&w=majority&appName=aiap';
    console.log(`🔗 Connecting to: ${mongoUri.split('@').pop()}`); // Log URI without credentials
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB');
    console.log(`📦 Database: ${mongoose.connection.name}`);

    const asins = await Asin.find({});
    console.log(`🔍 Found ${asins.length} ASINs to process`);

    let updatedCount = 0;

    for (const asin of asins) {
      let changed = false;

      // 1. Fix main rating
      if (typeof asin.rating === 'number' && asin.rating > 5) {
        const str = asin.rating.toString();
        // If it looks like a concatenated rating (e.g. 54321), it's likely "4.3" or "5.0"
        // But we don't know the exact value. However, we can try to parse it if it was a string.
        // Since it's already a number, we can only guess or cap it.
        // Actually, looking at previous issues, the concatenated values were like 5.4321...
        // We'll round it to 1 decimal place and cap at 5.
        const originalValue = asin.rating;
        asin.rating = Math.min(5, Math.round(asin.rating * 10) / 10);
        if (asin.rating !== originalValue) changed = true;
      }

      // 2. Fix ratingHistory
      if (asin.ratingHistory && asin.ratingHistory.length > 0) {
        asin.ratingHistory.forEach(h => {
          if (typeof h.rating === 'number' && h.rating > 5) {
            h.rating = Math.min(5, Math.round(h.rating * 10) / 10);
            changed = true;
          }
        });
      }

      // 3. Fix weekHistory
      if (asin.weekHistory && asin.weekHistory.length > 0) {
        asin.weekHistory.forEach(w => {
          if (typeof w.rating === 'number' && w.rating > 5) {
            w.rating = Math.min(5, Math.round(w.rating * 10) / 10);
            changed = true;
          }
        });
      }

      // 4. Fix history
      if (asin.history && asin.history.length > 0) {
        asin.history.forEach(h => {
          if (typeof h.rating === 'number' && h.rating > 5) {
            h.rating = Math.min(5, Math.round(h.rating * 10) / 10);
            changed = true;
          }
        });
      }

      if (changed) {
        await asin.save();
        updatedCount++;
      }
    }

    console.log(`✅ Cleanup complete. Updated ${updatedCount} ASINs.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
  }
}

fixRatings();
