# WhatsApp AI Webhook Deployment Script (PowerShell)
# This script helps deploy the webhook to AWS Lambda on Windows

param(
    [Parameter(Position=0)]
    [string]$Command = "deploy"
)

# Function to print colored output
function Write-Status {
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

# Check if required tools are installed
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($versionNumber -lt 18) {
            Write-Error "Node.js version 18 or later is required. Current version: $nodeVersion"
            exit 1
        }
    }
    catch {
        Write-Error "Node.js is not installed. Please install Node.js v18 or later."
        exit 1
    }
    
    # Check npm
    try {
        npm --version | Out-Null
    }
    catch {
        Write-Error "npm is not installed."
        exit 1
    }
    
    # check AWS CLI
    try {
        aws --version | Out-Null
    }
    catch {
        Write-Error "AWS CLI is not installed. Please install and configure AWS CLI."
        Write-Host "Install: https://aws.amazon.com/cli/"
        exit 1
    }
    
    # Check AWS credentials
    try {
        aws sts get-caller-identity | Out-Null
    }
    catch {
        Write-Error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    }
    
    Write-Success "All prerequisites are met!"
}

# Install dependencies
function Install-Dependencies {
    Write-Status "Installing dependencies..."
    
    if (!(Test-Path "package.json")) {
        Write-Error "package.json not found. Are you in the project directory?"
        exit 1
    }
    
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        exit 1
    }
    
    Write-Success "Dependencies installed!"
}

# Setup environment variables
function Set-Environment {
    Write-Status "Setting up environment variables..."
    
    if (!(Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Warning "Created .env file from .env.example."  
            Write-Warning "Please edit .env file with your actual credentials before proceeding."
            Write-Host ""
            Write-Host "Required environment variables:"
            Write-Host "- WHATSAPP_ACCESS_TOKEN"
            Write-Host "- WHATSAPP_VERIFY_TOKEN"
            Write-Host "- WHATSAPP_PHONE_NUMBER_ID"
            Write-Host ""
            Read-Host "Press Enter after updating .env file"
        }
        else {
            Write-Error ".env file not found and .env.example doesn't exist."
            exit 1
        }
    }
    
    # Load environment variables from .env file
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
            }
        }
    }
    
    # Check required variables
    $requiredVars = @("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_PHONE_NUMBER_ID")
    $missingVars = @()
    
    foreach ($var in $requiredVars) {
        if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($var))) {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Error "Missing required environment variables:"
        $missingVars | ForEach-Object { Write-Host "- $_" }
        exit 1
    }
    
    Write-Success "Environment variables configured!"
}

# Deploy to AWS Lambda
function Deploy-Lambda {
    Write-Status "Deploying to AWS Lambda..."
    
    # Check if serverless is installed locally
    if (!(Test-Path "node_modules\.bin\serverless.cmd")) {
        Write-Status "Installing Serverless Framework locally..."
        npm install serverless --save-dev
    }
    
    # Deploy using serverless
    npx serverless deploy --region ap-southeast-1 --verbose
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Deployment completed successfully!"
        
        # Get the webhook URL
        $infoOutput = npx serverless info --region ap-southeast-1 --verbose
        $webhookUrl = ($infoOutput | Select-String -Pattern 'https://[^\s]*').Matches[0].Value
        
        if ($webhookUrl) {
            Write-Host ""
            Write-Success "Your webhook URL is: $webhookUrl/webhook"
            Write-Host ""
            Write-Host "Next steps:"
            Write-Host "1. Copy the webhook URL above"
            Write-Host "2. Go to your WhatsApp Business API configuration"
            Write-Host "3. Set the webhook URL to: $webhookUrl/webhook"
            Write-Host "4. Set the verify token to your WHATSAPP_VERIFY_TOKEN"
            Write-Host "5. Subscribe to 'messages' webhook events"
            Write-Host ""
        }
    }
    else {
        Write-Error "Deployment failed!"
        exit 1
    }
}

# Test deployment
function Test-Deployment {
    Write-Status "Testing deployment..."
    
    # Get webhook URL
    $infoOutput = npx serverless info --region ap-southeast-1 --verbose
    $webhookUrl = ($infoOutput | Select-String -Pattern 'https://[^\s]*').Matches[0].Value
    
    if ($webhookUrl) {
        $verifyToken = [Environment]::GetEnvironmentVariable("WHATSAPP_VERIFY_TOKEN")
        $testUrl = "$webhookUrl/webhook?hub.mode=subscribe&hub.verify_token=$verifyToken&hub.challenge=test123"
        
        Write-Status "Testing webhook verification..."
        
        try {
            $response = Invoke-WebRequest -Uri $testUrl -Method GET
            
            if ($response.StatusCode -eq 200 -and $response.Content -eq "test123") {
                Write-Success "Webhook verification test passed!"
            } else {
                Write-Warning "Webhook responded but challenge doesn't match"
            }
        }
        catch {
            Write-Warning "Webhook verification test failed: $($_.Exception.Message)"
        }
    }
}

# Show logs
function Show-Logs {
    Write-Status "Showing recent logs..."
    npx serverless logs --function whatsappWebhook --region ap-southeast-1 --tail
}

# Main deployment flow
function Main {
    Write-Host ""
    Write-Status "Starting deployment process..."
    Write-Host ""
    
    switch ($Command.ToLower()) {
        "deploy" {
            Test-Prerequisites
            Install-Dependencies
            Set-Environment
            Deploy-Lambda
            Test-Deployment
        }
        "logs" {
            Show-Logs
        }
        "test" {
            Test-Deployment
        }
        "setup" {
            Test-Prerequisites
            Install-Dependencies
            Set-Environment
        }
        default {
            Write-Host "Usage: .\deploy.ps1 [deploy|logs|test|setup]"
            Write-Host ""
            Write-Host "Commands:"
            Write-Host "  deploy  - Full deployment (default)"
            Write-Host "  logs    - Show function logs"
            Write-Host "  test    - Test the deployed webhook"
            Write-Host "  setup   - Only setup prerequisites and environment"
            exit 1
        }
    }
    
    Write-Success "All done! 🎉"
}

# Set execution policy for current session if needed
if ((Get-ExecutionPolicy) -eq 'Restricted') {
    Write-Warning "PowerShell execution policy is Restricted. You may need to run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
}

# Run main function
Main