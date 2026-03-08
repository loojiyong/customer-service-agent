const { logger } = require('./utils');

// OpenAI integration has been deprecated
// This module now provides simple message logging functionality

// Simple in-memory message storage for logging purposes
const messageLog = new Map();

/**
 * Log received message (OpenAI integration deprecated)
 */
function logMessage(messageText, customerPhone) {
    try {
        logger.info('Logging customer message', { 
            customerPhone,
            messageText: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
            timestamp: new Date().toISOString()
        });

        // Store message in memory log
        const customerMessages = messageLog.get(customerPhone) || [];
        customerMessages.push({
            message: messageText,
            timestamp: Date.now()
        });
        
        messageLog.set(customerPhone, customerMessages);

        logger.info('Message logged successfully', { 
            customerPhone,
            totalMessages: customerMessages.length
        });

        return true;

    } catch (error) {
        logger.error('Error logging message', {
            error: error.message,
            customerPhone,
            messageText: messageText.substring(0, 50)
        });

        return false;
    }
}

/**
 * Get message history for a customer
 */
function getMessageHistory(customerPhone) {
    const messages = messageLog.get(customerPhone);
    
    if (!messages) {
        return [];
    }

    // Clean up old messages (older than 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentMessages = messages.filter(msg => msg.timestamp > oneDayAgo);
    
    if (recentMessages.length !== messages.length) {
        messageLog.set(customerPhone, recentMessages);
    }

    return recentMessages;
}

/**
 * Clear message history (can be called for cleanup)
 */
function clearMessageHistory(customerPhone) {
    messageLog.delete(customerPhone);
    logger.info('Message history cleared', { customerPhone });
}

/**
 * Get message statistics
 */
function getMessageStats() {
    return {
        activeCustomers: messageLog.size,
        messages: Array.from(messageLog.entries()).map(([phone, messages]) => ({
            phone,
            messageCount: messages.length,
            lastMessage: messages[messages.length - 1]?.timestamp
        }))
    };
}

/**
 * Cleanup old messages (call periodically)
 */
function cleanupOldMessages() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [phone, messages] of messageLog.entries()) {
        const recentMessages = messages.filter(msg => msg.timestamp > oneDayAgo);
        
        if (recentMessages.length === 0) {
            messageLog.delete(phone);
            cleaned++;
        } else if (recentMessages.length !== messages.length) {
            messageLog.set(phone, recentMessages);
        }
    }
    
    if (cleaned > 0) {
        logger.info(`Cleaned up message history for ${cleaned} customers`);
    }
    
    return cleaned;
}

module.exports = {
    logMessage,
    getMessageHistory,
    clearMessageHistory,
    getMessageStats,
    cleanupOldMessages
};