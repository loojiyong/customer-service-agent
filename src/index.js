const crypto = require('crypto');
const { verifyWebhook, handleWebhookEvent } = require('./whatsapp');
const { logger } = require('./utils');

/**
 * AWS Lambda handler for WhatsApp webhook
 * Handles both GET (verification) and POST (message) requests
 */
exports.handler = async (event, context) => {
    // Set Lambda context
    context.callbackWaitsForEmptyEventLoop = false;
    
    try {
        logger.info('Received webhook request', {
            method: event.httpMethod,
            path: event.path,
            queryStringParameters: event.queryStringParameters,
            headers: event.headers
        });

        // Handle GET request for webhook verification
        if (event.httpMethod === 'GET') {
            return await handleWebhookVerification(event);
        }
        
        // Handle POST request for incoming messages
        if (event.httpMethod === 'POST') {
            return await handleIncomingMessage(event);
        }

        // Method not allowed
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST'
            },
            body: JSON.stringify({
                error: 'Method not allowed',
                allowed_methods: ['GET', 'POST']
            })
        };

    } catch (error) {
        logger.error('Webhook handler error', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

/**
 * Handle webhook verification (GET request)
 */
async function handleWebhookVerification(event) {
    try {
        const challenge = verifyWebhook(event.queryStringParameters);
        
        if (challenge) {
            logger.info('Webhook verification successful');
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: challenge
            };
        } else {
            logger.warn('Webhook verification failed');
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Webhook verification failed'
                })
            };
        }
    } catch (error) {
        logger.error('Webhook verification error', error);
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Bad request',
                message: error.message
            })
        };
    }
}

/**
 * Handle incoming WhatsApp messages (POST request)
 */
async function handleIncomingMessage(event) {
    try {
        // Verify webhook signature
        const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
        if (!verifyWebhookSignature(event.body, signature)) {
            logger.warn('Invalid webhook signature');
            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Unauthorized - Invalid signature'
                })
            };
        }

        // Parse webhook body
        const webhookBody = JSON.parse(event.body);
        logger.info('Processing webhook event', { webhookBody });

        // Process the webhook event
        await handleWebhookEvent(webhookBody);

        // Return success response
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                status: 'success',
                message: 'Webhook processed successfully'
            })
        };

    } catch (error) {
        logger.error('Message handling error', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}

/**
 * Verify webhook signature for security
 */
function verifyWebhookSignature(payload, signature) {
    if (!signature) {
        return false;
    }

    try {
        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', process.env.WHATSAPP_ACCESS_TOKEN)
            .update(payload, 'utf8')
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature, 'utf8'),
            Buffer.from(expectedSignature, 'utf8')
        );
    } catch (error) {
        logger.error('Signature verification error', error);
        return false;
    }
}