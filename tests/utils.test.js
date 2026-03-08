const { logger, isBusinessHours, shouldTriggerHandoff, formatPhoneNumber } = require('../src/utils');

describe('Utils Functions', () => {
    // Mock environment variables
    beforeEach(() => {
        process.env.BUSINESS_HOURS_START = '09:00';
        process.env.BUSINESS_HOURS_END = '18:00';
        process.env.BUSINESS_TIMEZONE = 'Asia/Singapore';
        process.env.ENABLE_HUMAN_HANDOFF = 'true';
        process.env.HANDOFF_KEYWORDS = 'human,agent,support';
    });

    afterEach(() => {
        // Clean up environment variables
        delete process.env.BUSINESS_HOURS_START;
        delete process.env.BUSINESS_HOURS_END;
        delete process.env.BUSINESS_TIMEZONE;
        delete process.env.ENABLE_HUMAN_HANDOFF;
        delete process.env.HANDOFF_KEYWORDS;
    });

    describe('logger', () => {
        it('should have info, warn, and error methods', () => {
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
        });
    });

    describe('shouldTriggerHandoff', () => {
        it('should trigger handoff for "human" keyword', () => {
            const result = shouldTriggerHandoff('I need to speak to a human');
            expect(result).toBe(true);
        });

        it('should trigger handoff for "agent" keyword', () => {
            const result = shouldTriggerHandoff('Can I talk to an agent?');
            expect(result).toBe(true);
        });

        it('should trigger handoff for "support" keyword', () => {
            const result = shouldTriggerHandoff('I need support');
            expect(result).toBe(true);
        });

        it('should not trigger handoff for normal messages', () => {
            const result = shouldTriggerHandoff('What are your business hours?');
            expect(result).toBe(false);
        });

        it('should not trigger handoff when disabled', () => {
            process.env.ENABLE_HUMAN_HANDOFF = 'false';
            const result = shouldTriggerHandoff('I need to speak to a human');
            expect(result).toBe(false);
        });
    });

    describe('formatPhoneNumber', () => {
        it('should format phone number correctly', () => {
            const result = formatPhoneNumber('+65 1234 5678');
            expect(result).toBe('6512345678');
        });

        it('should add country code for local Singapore numbers', () => {
            const result = formatPhoneNumber('12345678');
            expect(result).toBe('6512345678');
        });

        it('should handle numbers with existing country code', () => {
            const result = formatPhoneNumber('6512345678');
            expect(result).toBe('6512345678');
        });
    });

    describe('isBusinessHours', () => {
        it('should be a function', () => {
            expect(typeof isBusinessHours).toBe('function');
        });

        // Note: Testing business hours requires mocking moment-timezone
        // which is complex. In a real project, you'd want to add more comprehensive tests
    });
});

// Integration test example
describe('WhatsApp Integration', () => {
    const { verifyWebhook } = require('../src/whatsapp');

    beforeEach(() => {
        process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
    });

    afterEach(() => {
        delete process.env.WHATSAPP_VERIFY_TOKEN;
    });

    describe('verifyWebhook', () => {
        it('should verify webhook with correct parameters', () => {
            const queryParams = {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'test-verify-token',
                'hub.challenge': 'test-challenge'
            };

            const result = verifyWebhook(queryParams);
            expect(result).toBe('test-challenge');
        });

        it('should fail verification with incorrect token', () => {
            const queryParams = {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'wrong-token',
                'hub.challenge': 'test-challenge'
            };

            const result = verifyWebhook(queryParams);
            expect(result).toBe(null);
        });

        it('should fail verification with incorrect mode', () => {
            const queryParams = {
                'hub.mode': 'unsubscribe',
                'hub.verify_token': 'test-verify-token',
                'hub.challenge': 'test-challenge'
            };

            const result = verifyWebhook(queryParams);
            expect(result).toBe(null);
        });
    });
});