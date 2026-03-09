const axios = require('axios');
const { logger, shouldTriggerHandoff, formatPhoneNumber, formatUserError } = require('./utils');
const { generateGPTReply, clearConversationHistory } = require('./openai');

const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com/v18.0';

/**
 * Verify WhatsApp webhook (GET request)
 */
function verifyWebhook(queryParams) {
    const mode = queryParams['hub.mode'];
    const token = queryParams['hub.verify_token'];
    const challenge = queryParams['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.info('Webhook verified successfully');
        return challenge;
    }

    logger.warn('Webhook verification failed', { mode, token });
    return null;
}

/**
 * Handle incoming webhook events from WhatsApp
 */
async function handleWebhookEvent(webhookBody) {
    // Check if it's a WhatsApp message event
    if (webhookBody.object !== 'whatsapp_business_account') {
        logger.info('Ignoring non-WhatsApp event', { object: webhookBody.object });
        return;
    }

    // Process each entry in the webhook
    for (const entry of webhookBody.entry) {
        // Process each change in the entry
        for (const change of entry.changes) {
            if (change.field === 'messages') {
                await processMessageChange(change.value);
            }
        }
    }
}

/**
 * Process incoming message changes
 */
async function processMessageChange(messageData) {
    // Handle incoming messages
    if (messageData.messages) {
        for (const message of messageData.messages) {
            await processIncomingMessage(message, messageData.metadata);
        }
    }

    // Handle message status updates (delivered, read, etc.)
    if (messageData.statuses) {
        for (const status of messageData.statuses) {
            logger.info('Message status update', { 
                messageId: status.id,
                status: status.status,
                timestamp: status.timestamp 
            });
        }
    }
}

/**
 * Process a single incoming message
 */
async function processIncomingMessage(message, metadata) {
    try {
        logger.info('Processing incoming message', { 
            messageId: message.id,
            from: message.from,
            type: message.type 
        });

        // Skip if it's a status message or system message
        if (message.type === 'system' || !message.from) {
            return;
        }

        const customerPhone = message.from;
        const messageText = extractMessageText(message);
        
        if (!messageText) {
            logger.info('No text content to process', { messageType: message.type });
            return;
        }

        logger.info('Extracted message text', { 
            from: customerPhone, 
            text: messageText,
            messageType: message.type 
        });

        // Check for human handoff request
        if (shouldTriggerHandoff(messageText)) {
            await sendHandoffMessage(customerPhone);
            clearConversationHistory(customerPhone);
            return;
        }

        // Generate a GPT reply
        logger.info('Generating GPT reply', { from: customerPhone });
        const gptReply = await generateGPTReply(messageText, customerPhone);

        await sendWhatsAppMessage(customerPhone, gptReply);

        logger.info('GPT reply sent', { to: customerPhone });

    } catch (error) {
        logger.error('Error processing incoming message', error);
        
        // Send error response to user
        try {
            const userMsg = formatUserError(error);
            await sendWhatsAppMessage(message.from, userMsg);
        } catch (sendError) {
            logger.error('Failed to send error message', sendError);
        }
    }
}

/**
 * Extract text content from different message types
 */
function extractMessageText(message) {
    switch (message.type) {
        case 'text':
            return message.text.body;
        
        case 'button':
            return message.button.text;
        
        case 'interactive':
            if (message.interactive.type === 'button_reply') {
                return message.interactive.button_reply.title;
            } else if (message.interactive.type === 'list_reply') {
                return message.interactive.list_reply.title;
            }
            return null;
        
        case 'image':
        case 'document':
        case 'audio':
        case 'video':
            // Handle media messages - for now, return a generic response
            return `I received your ${message.type}. How can I help you with this?`;
        
        default:
            logger.warn('Unsupported message type', { type: message.type });
            return null;
    }
}

/**
 * Send a text message via WhatsApp Business API
 */
async function sendWhatsAppMessage(to, text, options = {}) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formatPhoneNumber(to),
            type: 'text',
            text: {
                body: text,
                preview_url: options.preview_url || false
            }
        };

        const response = await axios.post(
            `${WHATSAPP_API_BASE_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        logger.info('WhatsApp message sent successfully', { 
            messageId: response.data.messages[0].id,
            to: to 
        });

        return response.data;

    } catch (error) {
        logger.error('Failed to send WhatsApp message', {
            error: error.message,
            whatsappError: error.response?.data,
            status: error.response?.status,
            to: to,
            text: text
        });
        
        throw new Error(`WhatsApp API ${error.response?.status}: ${JSON.stringify(error.response?.data) || error.message}`);
    }
}

/**
 * Send out-of-hours message
 */
async function sendOutOfHoursMessage(to) {
    const message = process.env.OUT_OF_HOURS_MESSAGE || 
        "Thank you for your message! Our business hours are 9 AM to 6 PM SGT. We'll respond to your inquiry during business hours, or for urgent matters, please type 'human' to speak with our team.";
    
    await sendWhatsAppMessage(to, message);
}

/**
 * Send human handoff message
 */
async function sendHandoffMessage(to) {
    const message = process.env.HANDOFF_MESSAGE || 
        "I'm connecting you with a human representative. Please wait a moment while I transfer your conversation.";
    
    await sendWhatsAppMessage(to, message);
    
    // Here you could integrate with your support system
    // For example, create a ticket in your helpdesk system
    logger.info('Human handoff requested', { customerPhone: to });
}

/**
 * Send interactive message with buttons
 */
async function sendInteractiveMessage(to, text, buttons) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formatPhoneNumber(to),
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: text
                },
                action: {
                    buttons: buttons.map((button, index) => ({
                        type: 'reply',
                        reply: {
                            id: `btn_${index}`,
                            title: button
                        }
                    }))
                }
            }
        };

        const response = await axios.post(
            `${WHATSAPP_API_BASE_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        logger.info('Interactive WhatsApp message sent', { 
            messageId: response.data.messages[0].id,
            to: to 
        });

        return response.data;

    } catch (error) {
        logger.error('Failed to send interactive WhatsApp message', error);
        throw error;
    }
}

module.exports = {
    verifyWebhook,
    handleWebhookEvent,
    sendWhatsAppMessage,
    sendInteractiveMessage,
    sendOutOfHoursMessage,
    sendHandoffMessage
};