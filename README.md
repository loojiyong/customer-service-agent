# WhatsApp Message Logging Webhook for AWS Lambda

A WhatsApp Business API webhook that logs incoming messages and sends acknowledgment responses. Built for AWS Lambda deployment with Singapore (ap-southeast-1) region support.

![WhatsApp Agent](https://img.shields.io/badge/WhatsApp-Message%20Logger-25D366?style=for-the-badge&logo=whatsapp)
![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?style=for-the-badge&logo=aws-lambda)
![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-2088FF?style=for-the-badge&logo=github-actions)

## 🚀 Features

- **Message Logging**: Comprehensive logging of all incoming WhatsApp messages
- **Business Hours**: Automatic handling of business hours with custom timezone support
- **Human Handoff**: Smart detection of when to escalate to human agents
- **Message Acknowledgment**: Automatic acknowledgment messages for received messages
- **Rate Limiting**: Built-in rate limiting to prevent spam
- **Security**: Webhook signature verification for secure communication
- **Scalable**: Serverless architecture that scales automatically
- **Monitoring**: Comprehensive logging and error handling

*Note: OpenAI integration has been deprecated. This webhook now focuses on message logging and basic acknowledgments.*

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or later)
2. **AWS CLI** configured with appropriate permissions
3. **WhatsApp Business API** access
4. **Git** (optional, for version control)

### AWS Permissions Required

Your AWS IAM user/role needs the following permissions:
- Lambda function creation and management
- CloudWatch logs creation
- API Gateway management
- IAM role creation (for Lambda execution)

## 🛠️ Installation

### 1. Clone or Download the Project

```bash
git clone <repository-url>
cd whatsapp-agent
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` file with your credentials:

```env
# WhatsApp Business API Configuration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_VERIFY_TOKEN=your_verify_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here

# Business Logic Configuration
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=18:00
BUSINESS_TIMEZONE=Asia/Singapore

# Company Information
COMPANY_NAME=Your Company Name
COMPANY_DESCRIPTION=Brief description of your company and services
ACKNOWLEDGMENT_MESSAGE=Thank you for your message! We have received it and will respond soon.
```

### 4. Deploy to AWS Lambda

The project includes a GitHub Actions workflow that automatically packages and deploys to AWS Lambda when you push to the main branch.

**Setup GitHub secrets in your repository (`Settings > Secrets and variables > Actions`):**

| Secret Name | Description |
|-------------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS Access Key for deployment |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key for deployment |
| `LAMBDA_FUNCTION_NAME` | Lambda function name to update |

**Deploy:**
```bash
git add .
git commit -m "Deploy webhook"
git push origin main
```

GitHub Actions will automatically package and deploy the function.

## 🔧 Configuration

### WhatsApp Business API Setup

1. **Get Access Token**: Obtain from Facebook Developer Console
2. **Phone Number ID**: Get from your WhatsApp Business API setup
3. **Verify Token**: Create a secure random string (you'll use this in webhook setup)

### Environment Variables Explained

| Variable | Description | Required |
|----------|-------------|----------|
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API access token | ✅ |
| `WHATSAPP_VERIFY_TOKEN` | Token for webhook verification | ✅ |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID | ✅ |
| `BUSINESS_HOURS_START` | Business hours start time (HH:MM) | ❌ |
| `BUSINESS_HOURS_END` | Business hours end time (HH:MM) | ❌ |
| `BUSINESS_TIMEZONE` | Business timezone | ❌ |
| `COMPANY_NAME` | Your company name for message context | ❌ |
| `ENABLE_HUMAN_HANDOFF` | Enable human handoff feature | ❌ |
| `HANDOFF_KEYWORDS` | Comma-separated keywords that trigger handoff | ❌ |
| `ACKNOWLEDGMENT_MESSAGE` | Message sent to acknowledge received messages | ❌ |

## � CI/CD with GitHub Actions

### Automatic Deployment

The project includes a simple GitHub Actions workflow that automatically packages and deploys to AWS Lambda when you push to the main branch.

#### Required GitHub Secrets

**Prerequisites:** Create a Lambda function in AWS first with Node.js 18.x runtime.

**Quick Lambda setup:**
```bash
aws lambda create-function \
  --function-name whatsapp-webhook \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler src/index.handler \
  --zip-file fileb://initial.zip \
  --region ap-southeast-1
```

Set these secrets in your GitHub repository (`Settings > Secrets and variables > Actions`):

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `AWS_ACCESS_KEY_ID` | AWS Access Key for deployment | ✅ |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key for deployment | ✅ |
| `LAMBDA_FUNCTION_NAME` | Lambda function name to update | ✅ |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API token | ✅ |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | ✅ |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID | ✅ |
| `COMPANY_NAME` | Your company name | ❌ |
| `BUSINESS_HOURS_START` | Business hours start (09:00) | ❌ |
| `BUSINESS_HOURS_END` | Business hours end (18:00) | ❌ |





## 🔗 WhatsApp Business API Integration

After deployment, you'll get a webhook URL. Configure it in your WhatsApp Business API:

1. **Webhook URL**: `https://your-lambda-url.amazonaws.com/webhook`
2. **Verify Token**: Use your `WHATSAPP_VERIFY_TOKEN`
3. **Webhook Fields**: Subscribe to `messages`

### Webhook Events Handled

- ✅ Text messages
- ✅ Button interactions
- ✅ Quick reply interactions
- ✅ Media messages (basic handling)
- ✅ Message status updates

## 📊 Message Logging Features

### Message History

The system maintains message history for each phone number:
- Stores all received messages in memory
- Automatic cleanup after 24 hours
- Message statistics and tracking

### Business Logic

1. **Business Hours Check**: Responds with out-of-hours message when contacted outside business hours
2. **Human Handoff**: Detects keywords like "human", "agent", "support" to escalate
3. **Message Acknowledgment**: Sends automatic acknowledgment for all received messages

### Customizing Acknowledgment Messages

Edit the acknowledgment message in your `.env` file:

```env
ACKNOWLEDGMENT_MESSAGE=Thank you for contacting us! We have received your message and will respond soon.
```

## 📊 Monitoring and Debugging

### View Logs

```bash
# Real-time logs
npm run logs
```

### Health Check

The webhook provides a basic health check endpoint for monitoring.

## 🔐 Security Features

- **Webhook Signature Verification**: Validates incoming requests
- **Rate Limiting**: Prevents spam and abuse
- **Environment Variables**: Secure credential storage
- **Input Sanitization**: Cleans and validates user input
- **Error Handling**: Comprehensive error handling without exposing sensitive data

## 📱 Supported Message Types

### Incoming Messages
- Text messages
- Button replies
- Quick replies
- Interactive list selections
- Media messages (images, documents, audio, video)

### Outgoing Messages
- Text responses
- Interactive buttons
- Quick replies
- Automated responses

## 🛠️ Development

### Local Testing

```bash
npm run dev
# or
npx serverless offline
```

### Running Tests

```bash
npm test
```

### Code Formatting

```bash
npm run format
```

### Linting

```bash
npm run lint
```

## 📂 Project Structure

```
whatsapp-ai-webhook/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions workflow
├── src/
│   ├── index.js              # Main Lambda handler
│   ├── whatsapp.js           # WhatsApp API integration
│   ├── openai.js             # Message logging (OpenAI deprecated)
│   └── utils.js              # Utility functions
├── tests/
│   ├── utils.test.js         # Unit tests
│   └── message-logging.test.js # Message logging tests
├── docs/
│   └── github-badge.md       # GitHub Actions badge setup
├── serverless.yml            # Serverless configuration
├── package.json              # Dependencies and scripts
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🚨 Troubleshooting

### Common Issues

1. **Deployment Fails**
   - Check AWS credentials: `aws sts get-caller-identity`
   - Verify IAM permissions
   - Check serverless configuration

2. **Webhook Not Receiving Messages**
   - Verify webhook URL in WhatsApp Business API
   - Check verify token matches
   - Review CloudWatch logs

3. **Environment Variables Not Working**
   - Ensure `.env` file is properly formatted
   - Check for extra spaces or quotes
   - Verify deployment includes environment variables

### Debug Commands

```bash
# Check deployment status
npx serverless info --region ap-southeast-1

# View function logs
npx serverless logs --function whatsappWebhook --region ap-southeast-1

# Test local deployment
npx serverless invoke local --function whatsappWebhook
```

## 🔄 Updates and Maintenance

### Updating Dependencies

```bash
npm update
npm audit fix
```

### Rollback

```bash
npx serverless rollback --timestamp TIMESTAMP --region ap-southeast-1
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review AWS CloudWatch logs
3. Open an issue in the repository
4. Check WhatsApp Business API documentation

---

**⚡ Quick Start Summary:**

**Option 1 - GitHub Actions (Recommended):**
1. `npm install`
**Deployment:**
1. Configure GitHub secrets (AWS credentials and Lambda function name)
2. `git push origin main` (auto-deploy)
3. Configure WhatsApp webhook with the provided Lambda URL

Your WhatsApp message logger is ready! 🎉