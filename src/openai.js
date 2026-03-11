const OpenAI = require('openai');
const { logger } = require('./utils');

// Lazy-initialised OpenAI client so the module can be imported without a key
let _client = null;
function getClient() {
    if (!_client) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _client;
}

// In-memory conversation history per customer phone number
// Format: Map<phone, { messages: [{role, content}], lastActivity: timestamp }>
const conversationStore = new Map();

const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_HISTORY_MESSAGES = 20; // keep last 20 messages per conversation

/**
 * Build the system prompt from environment variables
 */
function buildSystemPrompt() {
    const companyName = process.env.COMPANY_NAME || 'Our Company';
    const companyDescription = process.env.COMPANY_DESCRIPTION || 'a helpful business';
    const businessHoursStart = process.env.BUSINESS_HOURS_START || '09:00';
    const businessHoursEnd = process.env.BUSINESS_HOURS_END || '18:00';
    const timezone = process.env.BUSINESS_TIMEZONE || 'Asia/Singapore';

    return `You are a helpful customer service assistant for ${companyName}. ${companyDescription}

Your role is to:
- Answer customer questions accurately and helpfully
- Be friendly, professional, and concise (WhatsApp messages should be brief)
- If you cannot answer something with confidence, suggest the customer speak to a human agent by typing "human"
- Never make up information about products, prices, or policies you are not certain of
- Keep responses short and conversational – this is a WhatsApp chat, not an email

Business hours: ${businessHoursStart} – ${businessHoursEnd} ${timezone}.

If asked about your nature, you may say you are an AI assistant for ${companyName}.`;
}

/**
 * Retrieve and prune conversation history for a customer
 */
function getConversationHistory(customerPhone) {
    const now = Date.now();
    const entry = conversationStore.get(customerPhone);

    if (!entry || now - entry.lastActivity > CONVERSATION_TTL_MS) {
        // Start fresh
        return [];
    }

    return entry.messages;
}

/**
 * Persist an updated message list for a customer
 */
function saveConversationHistory(customerPhone, messages) {
    conversationStore.set(customerPhone, {
        messages: messages.slice(-MAX_HISTORY_MESSAGES),
        lastActivity: Date.now()
    });
}

/**
 * Generate a GPT reply for an incoming customer message.
 * Returns the assistant reply string.
 */
async function generateGPTReply(messageText, customerPhone) {
    const model = process.env.OPENAI_MODEL || 'gpt-5-mini';

    const history = getConversationHistory(customerPhone);

    // Append the new user message
    const updatedHistory = [...history, { role: 'user', content: messageText }];

    logger.info('Calling OpenAI chat completion', {
        customerPhone,
        model,
        historyLength: history.length,
        userMessage: messageText.substring(0, 100)
    });

    const response = await getClient().chat.completions.create({
        model,
        messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...updatedHistory
        ],
        max_completion_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500', 10)
    });

    logger.info(response)

    const assistantMessage = response.choices[0]?.message?.content?.trim();

    if (!assistantMessage) {
        throw new Error('OpenAI returned an empty response');
    }

    logger.info('OpenAI response received', {
        customerPhone,
        model,
        usage: response.usage,
        replyPreview: assistantMessage.substring(0, 100)
    });

    // Save full updated history including the assistant reply
    saveConversationHistory(customerPhone, [
        ...updatedHistory,
        { role: 'assistant', content: assistantMessage }
    ]);

    return assistantMessage;
}

/**
 * Clear conversation history for a customer (e.g. after handoff)
 */
function clearConversationHistory(customerPhone) {
    conversationStore.delete(customerPhone);
    logger.info('Conversation history cleared', { customerPhone });
}

/**
 * Remove stale conversations older than TTL
 */
function cleanupOldConversations() {
    const now = Date.now();
    let cleaned = 0;

    for (const [phone, entry] of conversationStore.entries()) {
        if (now - entry.lastActivity > CONVERSATION_TTL_MS) {
            conversationStore.delete(phone);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} stale conversation(s)`);
    }

    return cleaned;
}

/**
 * Conversation statistics
 */
function getConversationStats() {
    return {
        activeConversations: conversationStore.size,
        conversations: Array.from(conversationStore.entries()).map(([phone, entry]) => ({
            phone,
            messageCount: entry.messages.length,
            lastActivity: new Date(entry.lastActivity).toISOString()
        }))
    };
}

module.exports = {
    generateGPTReply,
    clearConversationHistory,
    cleanupOldConversations,
    getConversationStats
};