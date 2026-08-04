jest.mock('../../database/db', () => ({
    sql: {},
    getPool: jest.fn(),
    generateId: jest.fn(),
}));

const nvidiaAiService = require('../../services/nvidiaAiService');

describe('NvidiaAiService vision requests', () => {
    const originalApiKey = process.env.NVIDIA_NIM_API_KEY;

    beforeEach(() => {
        process.env.NVIDIA_NIM_API_KEY = 'test-key';
        jest.resetAllMocks();
    });

    afterAll(() => {
        process.env.NVIDIA_NIM_API_KEY = originalApiKey;
    });

    it('uses the vision model and image-data payload for image analysis', async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => Buffer.from('fake-image-bytes'),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '{"quality_score": 92, "has_white_background": true, "has_high_resolution": true, "image_type": "main", "compliance_issues": [], "visual_issues": [], "suggestions": [], "recreation_prompt": "", "product_category": "tools", "text_in_image": ""}' } }],
                }),
            });

        const result = await nvidiaAiService.analyzeProductImage('https://example.com/image.jpg', { type: 'full' });

        expect(result.quality_score).toBe(92);
        expect(global.fetch).toHaveBeenCalledTimes(2);

        const visionRequest = global.fetch.mock.calls[1];
        expect(visionRequest[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
        expect(visionRequest[1].headers.Authorization).toBe('Bearer test-key');

        const body = JSON.parse(visionRequest[1].body);
        expect(body.model).toBe(process.env.NVIDIA_VISION_MODEL || 'nvidia/nemotron-nano-12b-v2-vl');
        expect(body.stream).toBe(false);
        expect(body.messages[0].content[0].text).toContain('Amazon product image');
        expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    });
});
