#!/bin/bash

# WhatsApp AI Webhook Deployment Script
# This script helps deploy the webhook to AWS Lambda

set -e

echo "🚀 WhatsApp AI Webhook Deployment Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js v18 or later."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or later is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install and configure AWS CLI."
        echo "Install: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the project directory?"
        exit 1
    fi
    
    npm install
    print_success "Dependencies installed!"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env file from .env.example."
            print_warning "Please edit .env file with your actual credentials before proceeding."
            echo ""
            echo "Required environment variables:"
            echo "- WHATSAPP_ACCESS_TOKEN"
            echo "- WHATSAPP_VERIFY_TOKEN" 
            echo "- WHATSAPP_PHONE_NUMBER_ID"
            echo ""
            read -p "Press Enter after updating .env file..."
        else
            print_error ".env file not found and .env.example doesn't exist."
            exit 1
        fi
    fi
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    # Check required variables
    REQUIRED_VARS=("WHATSAPP_ACCESS_TOKEN" "WHATSAPP_VERIFY_TOKEN" "WHATSAPP_PHONE_NUMBER_ID")
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${MISSING_VARS[@]}"
        exit 1
    fi
    
    print_success "Environment variables configured!"
}

# Deploy to AWS Lambda
deploy_lambda() {
    print_status "Deploying to AWS Lambda..."
    
    # Check if serverless is installed locally
    if [ ! -f "node_modules/.bin/serverless" ]; then
        print_status "Installing Serverless Framework locally..."
        npm install serverless --save-dev
    fi
    
    # Deploy using serverless
    npx serverless deploy --region ap-southeast-1 --verbose
    
    if [ $? -eq 0 ]; then
        print_success "Deployment completed successfully!"
        
        # Get the webhook URL
        WEBHOOK_URL=$(npx serverless info --region ap-southeast-1 --verbose | grep -o 'https://[^[:space:]]*' | head -1)
        
        if [ ! -z "$WEBHOOK_URL" ]; then
            echo ""
            print_success "Your webhook URL is: ${WEBHOOK_URL}/webhook"
            echo ""
            echo "Next steps:"
            echo "1. Copy the webhook URL above"
            echo "2. Go to your WhatsApp Business API configuration"
            echo "3. Set the webhook URL to: ${WEBHOOK_URL}/webhook"
            echo "4. Set the verify token to your WHATSAPP_VERIFY_TOKEN"
            echo "5. Subscribe to 'messages' webhook events"
            echo ""
        fi
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Test deployment
test_deployment() {
    print_status "Testing deployment..."
    
    # Test webhook verification
    WEBHOOK_URL=$(npx serverless info --region ap-southeast-1 --verbose | grep -o 'https://[^[:space:]]*' | head -1)
    
    if [ ! -z "$WEBHOOK_URL" ]; then
        TEST_URL="${WEBHOOK_URL}/webhook?hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=test123"
        
        print_status "Testing webhook verification..."
        RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/webhook_test "$TEST_URL")
        
        if [ "$RESPONSE" = "200" ]; then
            CHALLENGE_RESPONSE=$(cat /tmp/webhook_test)
            if [ "$CHALLENGE_RESPONSE" = "test123" ]; then
                print_success "Webhook verification test passed!"
            else
                print_warning "Webhook responded but challenge doesn't match"
            fi
        else
            print_warning "Webhook verification test failed (HTTP $RESPONSE)"
        fi
        
        rm -f /tmp/webhook_test
    fi
}

# Show logs
show_logs() {
    print_status "Showing recent logs..."
    npx serverless logs --function whatsappWebhook --region ap-southeast-1 --tail
}

# Main deployment flow
main() {
    echo ""
    print_status "Starting deployment process..."
    echo ""
    
    # Parse command line arguments
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            install_dependencies
            setup_environment
            deploy_lambda
            test_deployment
            ;;
        "logs")
            show_logs
            ;;
        "test")
            test_deployment
            ;;
        "setup")
            check_prerequisites
            install_dependencies
            setup_environment
            ;;
        *)
            echo "Usage: $0 [deploy|logs|test|setup]"
            echo ""
            echo "Commands:"
            echo "  deploy  - Full deployment (default)"
            echo "  logs    - Show function logs"
            echo "  test    - Test the deployed webhook"
            echo "  setup   - Only setup prerequisites and environment"
            exit 1
            ;;
    esac
    
    print_success "All done! 🎉"
}

# Run main function
main "$@"