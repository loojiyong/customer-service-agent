#!/bin/bash

# GitHub Secrets Setup Script for WhatsApp Webhook
# This script helps you set up the required GitHub secrets for automatic deployment

set -e

echo "🔐 GitHub Secrets Setup for WhatsApp Webhook"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
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

# Check if GitHub CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is not installed."
        echo ""
        echo "Please install GitHub CLI first:"
        echo "- macOS: brew install gh"
        echo "- Ubuntu: sudo apt install gh"
        echo "- Windows: winget install GitHub.CLI"
        echo ""
        echo "Then authenticate with: gh auth login"
        exit 1
    fi
    
    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        print_error "GitHub CLI is not authenticated."
        echo "Please run: gh auth login"
        exit 1
    fi
    
    print_success "GitHub CLI is installed and authenticated!"
}

# Get repository info
get_repo_info() {
    if ! git remote get-url origin &> /dev/null; then
        print_error "Not in a git repository or no origin remote found."
        echo "Please make sure you're in your GitHub repository directory."
        exit 1
    fi
    
    REPO_URL=$(git remote get-url origin)
    print_info "Repository: $REPO_URL"
}

# Set a GitHub secret
set_github_secret() {
    local secret_name=$1
    local secret_description=$2
    local required=${3:-true}
    
    echo ""
    if [ "$required" = "true" ]; then
        echo -e "${YELLOW}[REQUIRED]${NC} $secret_description"
    else
        echo -e "${BLUE}[OPTIONAL]${NC} $secret_description"
    fi
    
    read -p "Enter $secret_name: " secret_value
    
    if [ -n "$secret_value" ]; then
        gh secret set "$secret_name" --body "$secret_value"
        print_success "✓ $secret_name set successfully"
    elif [ "$required" = "true" ]; then
        print_warning "⚠ $secret_name is required but not set"
        return 1
    else
        print_info "ℹ $secret_name skipped (optional)"
    fi
    
    return 0
}

# Main setup function
setup_secrets() {
    print_info "Setting up GitHub secrets for automatic deployment..."
    echo ""
    echo "You'll need to provide the following information:"
    
    # AWS Credentials
    echo ""
    echo "=== AWS CREDENTIALS ==="
    set_github_secret "AWS_ACCESS_KEY_ID" "AWS Access Key ID for deployment"
    set_github_secret "AWS_SECRET_ACCESS_KEY" "AWS Secret Access Key for deployment"
    set_github_secret "LAMBDA_FUNCTION_NAME" "Lambda function name (e.g., whatsapp-webhook)"
    
    # WhatsApp Configuration
    echo ""
    echo "=== WHATSAPP CONFIGURATION ==="
    set_github_secret "WHATSAPP_ACCESS_TOKEN" "WhatsApp Business API Access Token"
    set_github_secret "WHATSAPP_VERIFY_TOKEN" "WhatsApp Webhook Verify Token (you create this)"
    set_github_secret "WHATSAPP_PHONE_NUMBER_ID" "WhatsApp Business Phone Number ID"
    
    # Optional Business Configuration
    echo ""
    echo "=== BUSINESS CONFIGURATION (Optional) ==="
    set_github_secret "BUSINESS_HOURS_START" "Business hours start (e.g., 09:00)" false
    set_github_secret "BUSINESS_HOURS_END" "Business hours end (e.g., 18:00)" false
    set_github_secret "BUSINESS_TIMEZONE" "Business timezone (e.g., Asia/Singapore)" false
    
    # Optional Company Information
    echo ""
    echo "=== COMPANY INFORMATION (Optional) ==="
    set_github_secret "COMPANY_NAME" "Your company name" false
    set_github_secret "COMPANY_DESCRIPTION" "Brief company description" false
    
    # Optional Messages
    echo ""
    echo "=== CUSTOM MESSAGES (Optional) ==="
    set_github_secret "DEFAULT_GREETING" "Default greeting message" false
    set_github_secret "OUT_OF_HOURS_MESSAGE" "Out of hours message" false
    set_github_secret "HANDOFF_MESSAGE" "Human handoff message" false
    set_github_secret "ACKNOWLEDGMENT_MESSAGE" "Message acknowledgment text" false
    
    print_success "GitHub secrets setup complete!"
}

# Display next steps
show_next_steps() {
    echo ""
    echo "🚀 NEXT STEPS:"
    echo "=============="
    echo "1. Push your code to GitHub:"
    echo "   git add ."
    echo "   git commit -m 'Deploy WhatsApp webhook'"
    echo "   git push origin main"
    echo ""
    echo "2. GitHub Actions will automatically deploy to AWS Lambda"
    echo ""
    echo "3. Get your webhook URL from AWS console or GitHub Actions output"
    echo ""
    echo "4. Configure your WhatsApp Business API with the webhook URL"
    echo ""
    print_success "Setup complete! 🎉"
}

# Main execution
main() {
    check_gh_cli
    get_repo_info
    setup_secrets
    show_next_steps
}

# Run if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi