# GitHub Secrets Setup Script for WhatsApp Webhook (PowerShell)
# This script helps you set up the required GitHub secrets for automatic deployment

param(
    [switch]$Help
)

if ($Help) {
    Write-Host "GitHub Secrets Setup for WhatsApp Webhook"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "This script helps set up GitHub secrets for automatic deployment."
    Write-Host ""
    Write-Host "Prerequisites:"
    Write-Host "1. GitHub CLI installed (winget install GitHub.CLI)"
    Write-Host "2. Authenticated with GitHub (gh auth login)"
    Write-Host "3. In a GitHub repository directory"
    Write-Host ""
    Write-Host "Usage: .\setup-github-secrets.ps1"
    exit 0
}

# Function to print colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if GitHub CLI is installed and authenticated
function Test-GitHubCLI {
    try {
        $null = Get-Command gh -ErrorAction Stop
    }
    catch {
        Write-Error "GitHub CLI (gh) is not installed."
        Write-Host ""
        Write-Host "Please install GitHub CLI first:"
        Write-Host "- Windows: winget install GitHub.CLI"
        Write-Host ""
        Write-Host "Then authenticate with: gh auth login"
        exit 1
    }
    
    # Test authentication
    try {
        gh auth status *>$null
    }
    catch {
        Write-Error "GitHub CLI is not authenticated."
        Write-Host "Please run: gh auth login"
        exit 1
    }
    
    Write-Success "GitHub CLI is installed and authenticated!"
}

# Get repository information
function Get-RepoInfo {
    try {
        $repoUrl = git remote get-url origin 2>$null
        Write-Info "Repository: $repoUrl"
    }
    catch {
        Write-Error "Not in a git repository or no origin remote found."
        Write-Host "Please make sure you're in your GitHub repository directory."
        exit 1
    }
}

# Set a GitHub secret
function Set-GitHubSecret {
    param(
        [string]$SecretName,
        [string]$SecretDescription,
        [bool]$Required = $true
    )
    
    Write-Host ""
    if ($Required) {
        Write-Host "[REQUIRED] $SecretDescription" -ForegroundColor Yellow
    } else {
        Write-Host "[OPTIONAL] $SecretDescription" -ForegroundColor Blue
    }
    
    $secretValue = Read-Host "Enter $SecretName"
    
    if ($secretValue) {
        try {
            gh secret set $SecretName --body $secretValue
            Write-Success "✓ $SecretName set successfully"
            return $true
        }
        catch {
            Write-Error "Failed to set $SecretName"
            return $false
        }
    }
    elseif ($Required) {
        Write-Warning "⚠ $SecretName is required but not set"
        return $false
    }
    else {
        Write-Info "ℹ $SecretName skipped (optional)"
        return $true
    }
}

# Main setup function
function Set-GitHubSecrets {
    Write-Info "Setting up GitHub secrets for automatic deployment..."
    Write-Host ""
    Write-Host "You'll need to provide the following information:"
    
    # AWS Credentials
    Write-Host ""
    Write-Host "=== AWS CREDENTIALS ==="
    Set-GitHubSecret "AWS_ACCESS_KEY_ID" "AWS Access Key ID for deployment"
    Set-GitHubSecret "AWS_SECRET_ACCESS_KEY" "AWS Secret Access Key for deployment"
    
    # WhatsApp Configuration
    Write-Host ""
    Write-Host "=== WHATSAPP CONFIGURATION ==="
    Set-GitHubSecret "WHATSAPP_ACCESS_TOKEN" "WhatsApp Business API Access Token"
    Set-GitHubSecret "WHATSAPP_VERIFY_TOKEN" "WhatsApp Webhook Verify Token (you create this)"
    Set-GitHubSecret "WHATSAPP_PHONE_NUMBER_ID" "WhatsApp Business Phone Number ID"
    
    # Optional Business Configuration
    Write-Host ""
    Write-Host "=== BUSINESS CONFIGURATION (Optional) ==="
    Set-GitHubSecret "BUSINESS_HOURS_START" "Business hours start (e.g., 09:00)" $false
    Set-GitHubSecret "BUSINESS_HOURS_END" "Business hours end (e.g., 18:00)" $false
    Set-GitHubSecret "BUSINESS_TIMEZONE" "Business timezone (e.g., Asia/Singapore)" $false
    
    # Optional Company Information
    Write-Host ""
    Write-Host "=== COMPANY INFORMATION (Optional) ==="
    Set-GitHubSecret "COMPANY_NAME" "Your company name" $false
    Set-GitHubSecret "COMPANY_DESCRIPTION" "Brief company description" $false
    
    # Optional Messages
    Write-Host ""
    Write-Host "=== CUSTOM MESSAGES (Optional) ==="
    Set-GitHubSecret "DEFAULT_GREETING" "Default greeting message" $false
    Set-GitHubSecret "OUT_OF_HOURS_MESSAGE" "Out of hours message" $false
    Set-GitHubSecret "HANDOFF_MESSAGE" "Human handoff message" $false
    Set-GitHubSecret "ACKNOWLEDGMENT_MESSAGE" "Message acknowledgment text" $false
    
    Write-Success "GitHub secrets setup complete!"
}

# Display next steps
function Show-NextSteps {
    Write-Host ""
    Write-Host "🚀 NEXT STEPS:"
    Write-Host "=============="
    Write-Host "1. Push your code to GitHub:"
    Write-Host "   git add ."
    Write-Host "   git commit -m 'Add WhatsApp webhook with GitHub Actions'"
    Write-Host "   git push origin main"
    Write-Host ""
    Write-Host "2. The GitHub Action will automatically deploy to AWS Lambda"
    Write-Host ""
    Write-Host "3. Get your webhook URL from the GitHub Actions output or AWS console"
    Write-Host ""
    Write-Host "4. Configure your WhatsApp Business API:"
    Write-Host "   - Webhook URL: https://your-api-id.execute-api.ap-southeast-1.amazonaws.com/dev/webhook"
    Write-Host "   - Verify Token: [your WHATSAPP_VERIFY_TOKEN]"
    Write-Host "   - Subscribe to: messages"
    Write-Host ""
    Write-Host "5. Test your webhook!"
    Write-Host ""
    Write-Success "Setup complete! 🎉"
}

# Main execution
function Main {
    Write-Host "🔐 GitHub Secrets Setup for WhatsApp Webhook"
    Write-Host "=============================================="
    Write-Host ""
    
    Test-GitHubCLI
    Get-RepoInfo
    Set-GitHubSecrets
    Show-NextSteps
}

# Set execution policy for current session if needed
if ((Get-ExecutionPolicy) -eq 'Restricted') {
    Write-Warning "PowerShell execution policy is Restricted. You may need to run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
}

# Run main function
Main