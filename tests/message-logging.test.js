// Mock the openai module before requiring src/openai
jest.mock('openai', () => {
    const mockCreate = jest.fn();
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: mockCreate
            }
        }
    }));
});

const OpenAI = require('openai');

// Set env vars before requiring the module under test
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENAI_MODEL = 'gpt-4o-mini';
process.env.COMPANY_NAME = 'Test Company';

const {
    generateGPTReply,
    clearConversationHistory,
    cleanupOldConversations,
    getConversationStats
} = require('../src/openai');

describe('GPT Integration (openai.js)', () => {
    const testPhone = '6512345678';

    // Helper: get the mocked `create` function
    const getMockCreate = () => new OpenAI().chat.completions.create;

    beforeEach(() => {
        clearConversationHistory(testPhone);
        jest.clearAllMocks();
    });

    afterEach(() => {
        clearConversationHistory(testPhone);
    });

    describe('generateGPTReply', () => {
        it('should return the assistant reply from OpenAI', async () => {
            getMockCreate().mockResolvedValue({
                choices: [{ message: { content: 'Hello, how can I help you?' } }],
                usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
            });

            const reply = await generateGPTReply('Hi there', testPhone);
            expect(reply).toBe('Hello, how can I help you?');
        });

        it('should accumulate conversation history across calls', async () => {
            getMockCreate()
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'First reply' } }],
                    usage: {}
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'Second reply' } }],
                    usage: {}
                });

            await generateGPTReply('Message one', testPhone);
            await generateGPTReply('Message two', testPhone);

            // The second call should include the full history
            const secondCallMessages = getMockCreate().mock.calls[1][0].messages;
            const roles = secondCallMessages.map(m => m.role);
            // system, user, assistant (from 1st turn), user (2nd turn)
            expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
        });

        it('should throw when OpenAI returns an empty response', async () => {
            getMockCreate().mockResolvedValue({
                choices: [{ message: { content: '' } }],
                usage: {}
            });

            await expect(generateGPTReply('test', testPhone)).rejects.toThrow(
                'OpenAI returned an empty response'
            );
        });

        it('should include the system prompt with company name', async () => {
            getMockCreate().mockResolvedValue({
                choices: [{ message: { content: 'Hi' } }],
                usage: {}
            });

            await generateGPTReply('Hello', testPhone);

            const systemMsg = getMockCreate().mock.calls[0][0].messages[0];
            expect(systemMsg.role).toBe('system');
            expect(systemMsg.content).toContain('Test Company');
        });
    });

    describe('clearConversationHistory', () => {
        it('should reset history so the next call starts fresh', async () => {
            getMockCreate().mockResolvedValue({
                choices: [{ message: { content: 'Hi' } }],
                usage: {}
            });

            await generateGPTReply('First message', testPhone);
            clearConversationHistory(testPhone);
            await generateGPTReply('After clear', testPhone);

            // After clearing, only system + one user message
            const messages = getMockCreate().mock.calls[1][0].messages;
            expect(messages.length).toBe(2); // system + user
        });
    });

    describe('getConversationStats', () => {
        it('should return a stats object with activeConversations', () => {
            const stats = getConversationStats();
            expect(stats).toHaveProperty('activeConversations');
            expect(typeof stats.activeConversations).toBe('number');
            expect(Array.isArray(stats.conversations)).toBe(true);
        });
    });

    describe('cleanupOldConversations', () => {
        it('should return 0 when no stale conversations exist', () => {
            const cleaned = cleanupOldConversations();
            expect(typeof cleaned).toBe('number');
            expect(cleaned).toBeGreaterThanOrEqual(0);
        });
    });
});
