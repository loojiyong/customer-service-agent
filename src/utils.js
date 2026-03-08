const moment = require('moment-timezone');

/**
 * Enhanced logging utility
 */
const logger = {
    info: (message, meta = {}) => {
        console.log(JSON.stringify({
            level: 'info',
            message,
            timestamp: new Date().toISOString(),
            ...meta
        }));
    },
    
    warn: (message, meta = {}) => {
        console.warn(JSON.stringify({
            level: 'warn',
            message,
            timestamp: new Date().toISOString(),
            ...meta
        }));
    },
    
    error: (message, error = null) => {
        const logData = {
            level: 'error',
            message,
            timestamp: new Date().toISOString()
        };
        
        if (error) {
            logData.error = {
                message: error.message,
                stack: error.stack,
                name: error.name
            };
        }
        
        console.error(JSON.stringify(logData));
    }
};

/**
 * Check if current time is within business hours
 */
function isBusinessHours() {
    try {
        const timezone = process.env.BUSINESS_TIMEZONE || 'Asia/Singapore';
        const startHour = process.env.BUSINESS_HOURS_START || '09:00';
        const endHour = process.env.BUSINESS_HOURS_END || '18:00';
        
        const now = moment().tz(timezone);
        const currentTime = now.format('HH:mm');
        const currentDay = now.day(); // 0 = Sunday, 6 = Saturday
        
        // Check if it's weekend (Saturday = 6, Sunday = 0)
        if (currentDay === 0 || currentDay === 6) {
            logger.info('Outside business hours - Weekend', { 
                currentDay, 
                currentTime, 
                timezone 
            });
            return false;
        }
        
        // Check if current time is within business hours
        const isWithinHours = currentTime >= startHour && currentTime <= endHour;
        
        logger.info('Business hours check', {
            currentTime,
            startHour,
            endHour,
            timezone,
            currentDay,
            isWithinHours
        });
        
        return isWithinHours;
        
    } catch (error) {
        logger.error('Error checking business hours', error);
        // Default to business hours if there's an error
        return true;
    }
}

/**
 * Check if message should trigger human handoff
 */
function shouldTriggerHandoff(messageText) {
    if (!process.env.ENABLE_HUMAN_HANDOFF || process.env.ENABLE_HUMAN_HANDOFF.toLowerCase() !== 'true') {
        return false;
    }
    
    const handoffKeywords = (process.env.HANDOFF_KEYWORDS || 'human,agent,support,help,representative').toLowerCase().split(',');
    const text = messageText.toLowerCase().trim();
    
    // Check for exact matches or phrases
    const triggerPhrases = [
        ...handoffKeywords,
        'speak to someone',
        'talk to human',
        'customer service',
        'customer support',
        'live agent',
        'real person',
        'escalate',
        'complaint',
        'manager',
        'supervisor'
    ];
    
    const shouldTrigger = triggerPhrases.some(phrase => 
        text.includes(phrase.trim())
    );
    
    if (shouldTrigger) {
        logger.info('Human handoff triggered', { 
            messageText: messageText.substring(0, 100),
            triggerPhrase: triggerPhrases.find(phrase => text.includes(phrase.trim()))
        });
    }
    
    return shouldTrigger;
}

/**
 * Format phone number for WhatsApp API
 */
function formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // If the number doesn't start with country code, you might need to add one
    // This is a basic implementation - you may need to customize based on your region
    if (formatted.length === 8 && !formatted.startsWith('65')) {
        // Singapore local number example - add 65 country code
        formatted = '65' + formatted;
    }
    
    return formatted;
}

/**
 * Validate required environment variables
 */
function validateEnvironmentVariables() {
    const required = [
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_VERIFY_TOKEN', 
        'WHATSAPP_PHONE_NUMBER_ID'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        logger.error('Missing required environment variables', { missing });
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    logger.info('Environment variables validated successfully');
    return true;
}

/**
 * Sanitize text for logging (remove sensitive information)
 */
function sanitizeForLogging(text, maxLength = 200) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    // Remove potential sensitive information
    let sanitized = text
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_NUMBER]') // Credit card
        .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]') // SSN pattern
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email
        .replace(/\b\+?[\d\s\-\(\)]{10,}\b/g, '[PHONE]'); // Phone numbers
    
    // Truncate if too long
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '...';
    }
    
    return sanitized;
}

/**
 * Rate limiting helper (simple in-memory implementation)
 */
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.windowMs = 60000; // 1 minute window
        this.maxRequests = 10; // 10 requests per minute per phone number
    }
    
    isAllowed(phoneNumber) {
        const now = Date.now();
        const userRequests = this.requests.get(phoneNumber) || [];
        
        // Remove old requests outside window
        const recentRequests = userRequests.filter(time => now - time < this.windowMs);
        
        if (recentRequests.length >= this.maxRequests) {
            logger.warn('Rate limit exceeded', { phoneNumber, requestCount: recentRequests.length });
            return false;
        }
        
        // Add current request
        recentRequests.push(now);
        this.requests.set(phoneNumber, recentRequests);
        
        return true;
    }
    
    cleanup() {
        const now = Date.now();
        for (const [phoneNumber, requests] of this.requests.entries()) {
            const recentRequests = requests.filter(time => now - time < this.windowMs);
            if (recentRequests.length === 0) {
                this.requests.delete(phoneNumber);
            } else {
                this.requests.set(phoneNumber, recentRequests);
            }
        }
    }
}

const rateLimiter = new RateLimiter();

/**
 * Generate response time statistics
 */
function measureResponseTime(startTime) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    logger.info('Response time measured', { 
        responseTimeMs: responseTime,
        responseTimeSec: (responseTime / 1000).toFixed(2)
    });
    
    return responseTime;
}

/**
 * Format error for user-friendly display
 */
function formatUserError(error) {
    // Don't expose technical details to users
    const userFriendlyMessages = {
        'ENOTFOUND': 'We\'re experiencing connectivity issues. Please try again.',
        'ETIMEDOUT': 'The request timed out. Please try again.',
        'ECONNREFUSED': 'Service temporarily unavailable. Please try again.',
        'insufficient_quota': 'Service temporarily unavailable. Please contact support.',
        'rate_limit_exceeded': 'Too many requests. Please wait a moment before trying again.'
    };
    
    const errorCode = error.code || error.message?.toLowerCase();
    
    for (const [code, message] of Object.entries(userFriendlyMessages)) {
        if (errorCode?.includes(code)) {
            return message;
        }
    }
    
    return 'Something went wrong. Please try again or contact support.';
}

/**
 * Health check utility
 */
async function healthCheck() {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: {
            node_version: process.version,
            timezone: process.env.BUSINESS_TIMEZONE || 'Asia/Singapore',
            business_hours: {
                start: process.env.BUSINESS_HOURS_START || '09:00',
                end: process.env.BUSINESS_HOURS_END || '18:00'
            }
        },
        services: {
            whatsapp_configured: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
            business_hours_active: isBusinessHours(),
            handoff_enabled: process.env.ENABLE_HUMAN_HANDOFF === 'true'
        }
    };
    
    return health;
}

module.exports = {
    logger,
    isBusinessHours,
    shouldTriggerHandoff,
    formatPhoneNumber,
    validateEnvironmentVariables,
    sanitizeForLogging,
    rateLimiter,
    measureResponseTime,
    formatUserError,
    healthCheck
};