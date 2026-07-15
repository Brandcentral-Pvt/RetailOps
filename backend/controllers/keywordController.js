const keywordResearchService = require('../services/keywordResearchService');

exports.search = async (req, res) => {
    try {
        const {
            keywords,
            searchIndex,
            brand,
            minPrice,
            maxPrice,
            minReviewsRating,
            minSavingPercent,
            availability,
            condition,
            sortBy,
            itemCount = 10,
            itemPage = 1,
            marketplace,
        } = req.query;

        if (!keywords || !keywords.trim()) {
            return res.status(400).json({ success: false, error: 'Keywords are required' });
        }

        const result = await keywordResearchService.searchItems({
            keywords: keywords.trim(),
            searchIndex: searchIndex || undefined,
            brand: brand || undefined,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            minReviewsRating: minReviewsRating ? Number(minReviewsRating) : undefined,
            minSavingPercent: minSavingPercent ? Number(minSavingPercent) : undefined,
            availability: availability || undefined,
            condition: condition || undefined,
            sortBy: sortBy || undefined,
            itemCount: Math.min(Math.max(Number(itemCount) || 10, 1), 50),
            itemPage: Math.max(Number(itemPage) || 1, 1),
            marketplace: marketplace || 'www.amazon.in',
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[KeywordController] Search error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

exports.getCategories = async (req, res) => {
    const categories = [
        { value: 'All', label: 'All Categories' },
        { value: 'Automotive', label: 'Automotive' },
        { value: 'Baby', label: 'Baby' },
        { value: 'Beauty', label: 'Beauty' },
        { value: 'Books', label: 'Books' },
        { value: 'Clothing', label: 'Clothing & Accessories' },
        { value: 'Electronics', label: 'Electronics' },
        { value: 'Grocery', label: 'Grocery & Gourmet Foods' },
        { value: 'HealthPersonalCare', label: 'Health & Personal Care' },
        { value: 'HomeAndKitchen', label: 'Home & Kitchen' },
        { value: 'Industrial', label: 'Industrial & Scientific' },
        { value: 'Jewelry', label: 'Jewelry' },
        { value: 'Kitchen', label: 'Kitchen' },
        { value: 'LawnAndGarden', label: 'Lawn & Garden' },
        { value: 'Luggage', label: 'Luggage & Travel Gear' },
        { value: 'Music', label: 'Music' },
        { value: 'MusicalInstruments', label: 'Musical Instruments' },
        { value: 'OfficeProducts', label: 'Office Products' },
        { value: 'PetSupplies', label: 'Pet Supplies' },
        { value: 'Shoes', label: 'Shoes' },
        { value: 'Software', label: 'Software' },
        { value: 'Sports', label: 'Sports & Outdoors' },
        { value: 'Tools', label: 'Tools & Home Improvement' },
        { value: 'Toys', label: 'Toys & Games' },
        { value: 'VideoGames', label: 'Video Games' },
        { value: 'Watches', label: 'Watches' },
    ];
    res.json({ success: true, categories });
};
