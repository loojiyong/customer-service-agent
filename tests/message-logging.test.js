const { logMessage, getMessageHistory, getMessageStats, clearMessageHistory } = require('../src/openai');

describe('Message Logging Functions', () => {
    const testPhone = '6512345678';
    const testMessage = 'Hello, this is a test message';

    beforeEach(() => {
        // Clear any existing message history before each test
        clearMessageHistory(testPhone);
    });

    afterEach(() => {
        // Clean up after each test
        clearMessageHistory(testPhone);
    });

    describe('logMessage', () => {
        it('should successfully log a message', () => {
            const result = logMessage(testMessage, testPhone);
            expect(result).toBe(true);
        });

        it('should handle empty messages gracefully', () => {
            const result = logMessage('', testPhone);
            expect(result).toBe(true);
        });

        it('should handle long messages', () => {
            const longMessage = 'a'.repeat(1000);
            const result = logMessage(longMessage, testPhone);
            expect(result).toBe(true);
        });
    });

    describe('getMessageHistory', () => {
        it('should return empty array for new customer', () => {
            const history = getMessageHistory(testPhone);
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        it('should return messages after logging', () => {
            logMessage(testMessage, testPhone);
            const history = getMessageHistory(testPhone);
            
            expect(history.length).toBe(1);
            expect(history[0].message).toBe(testMessage);
            expect(history[0].timestamp).toBeDefined();
        });

        it('should maintain message order', () => {
            const message1 = 'First message';
            const message2 = 'Second message';
            
            logMessage(message1, testPhone);
            logMessage(message2, testPhone);
            
            const history = getMessageHistory(testPhone);
            expect(history.length).toBe(2);
            expect(history[0].message).toBe(message1);
            expect(history[1].message).toBe(message2);
        });
    });

    describe('getMessageStats', () => {
        it('should return stats object', () => {
            const stats = getMessageStats();
            expect(stats).toHaveProperty('activeCustomers');
            expect(stats).toHaveProperty('messages');
            expect(Array.isArray(stats.messages)).toBe(true);
        });

        it('should show correct customer count after logging', () => {
            logMessage(testMessage, testPhone);
            const stats = getMessageStats();
            expect(stats.activeCustomers).toBeGreaterThan(0);
        });
    });

    describe('clearMessageHistory', () => {
        it('should clear message history for customer', () => {
            logMessage(testMessage, testPhone);
            
            let history = getMessageHistory(testPhone);
            expect(history.length).toBe(1);
            
            clearMessageHistory(testPhone);
            
            history = getMessageHistory(testPhone);
            expect(history.length).toBe(0);
        });
    });
});