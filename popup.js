/**
 * TradingHub.Mk Popup Script
 * Handles popup UI interactions and communication with background script
 */

class PopupController {
    constructor() {
        this.connectionStatus = document.getElementById('connectionStatus');
        this.extensionStatus = document.getElementById('extensionStatus');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.optimizeBtn = document.getElementById('optimizeBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        
        this.isAnalyzing = false;
        this.isOptimizing = false;
        this.currentAnalysis = null;
        
        this.init();
    }
    
    async init() {
        console.log('TradingHub.Mk popup initialized');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check connection status
        await this.checkConnectionStatus();
        
        // Send initialization message to background script
        this.sendMessageToBackground({
            type: 'POPUP_OPENED',
            timestamp: Date.now()
        });
        
        // Set up optimization progress listener
        this.setupProgressListener();
    }
    
    setupEventListeners() {
        this.analyzeBtn.addEventListener('click', () => this.handleAnalyze());
        this.optimizeBtn.addEventListener('click', () => this.handleOptimize());
        this.settingsBtn.addEventListener('click', () => this.handleSettings());
    }
    
    setupProgressListener() {
        // Listen for optimization progress updates
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'OPTIMIZATION_PROGRESS') {
                this.updateOptimizationProgress(message.progress);
            }
        });
    }
    
    async checkConnectionStatus() {
        try {
            // Check if we're on TradingView
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url && tab.url.includes('tradingview.com')) {
                this.updateConnectionStatus('connected', 'Connected to TradingView');
                this.extensionStatus.textContent = 'Active';
                
                // Enable action buttons
                this.analyzeBtn.disabled = false;
                this.optimizeBtn.disabled = false;
            } else {
                this.updateConnectionStatus('disconnected', 'Navigate to TradingView');
                this.extensionStatus.textContent = 'Inactive';
                
                // Disable action buttons
                this.analyzeBtn.disabled = true;
                this.optimizeBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error checking connection status:', error);
            this.updateConnectionStatus('error', 'Connection Error');
            this.extensionStatus.textContent = 'Error';
        }
    }
    
    updateConnectionStatus(status, message) {
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        // Remove existing status classes
        statusDot.classList.remove('connected', 'error');
        
        // Add new status class
        if (status === 'connected') {
            statusDot.classList.add('connected');
        } else if (status === 'error') {
            statusDot.classList.add('error');
        }
        
        statusText.textContent = message;
    }
    
    async handleAnalyze() {
        if (this.isAnalyzing) return;
        
        console.log('Analyze button clicked');
        
        this.isAnalyzing = true;
        this.updateAnalyzeButton('analyzing');
        
        try {
            const response = await this.sendMessageToBackground({
                type: 'ANALYZE_STRATEGY',
                timestamp: Date.now()
            });
            
            if (response && response.success) {
                this.currentAnalysis = response.data;
                this.showAnalysisResults(response.data);
            } else {
                this.showError(response?.error || 'Analysis failed');
            }
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('Analysis failed: ' + error.message);
        } finally {
            this.isAnalyzing = false;
            this.updateAnalyzeButton('idle');
        }
    }
    
    async handleOptimize() {
        if (this.isOptimizing) return;
        
        console.log('Optimize button clicked');
        
        // Check if we have analysis results
        if (!this.currentAnalysis) {
            this.showError('Please analyze the strategy first');
            return;
        }
        
        this.isOptimizing = true;
        this.updateOptimizeButton('optimizing');
        
        try {
            const response = await this.sendMessageToBackground({
                type: 'OPTIMIZE_PARAMETERS',
                timestamp: Date.now()
            });
            
            if (response && response.success) {
                this.showOptimizationResults(response.data);
            } else {
                this.showError(response?.error || 'Optimization failed');
            }
            
        } catch (error) {
            console.error('Optimization error:', error);
            this.showError('Optimization failed: ' + error.message);
        } finally {
            this.isOptimizing = false;
            this.updateOptimizeButton('idle');
        }
    }
    
    updateAnalyzeButton(state) {
        switch (state) {
            case 'analyzing':
                this.analyzeBtn.innerHTML = '<span class="btn-icon">⏳</span>Analyzing...';
                this.analyzeBtn.disabled = true;
                break;
            case 'idle':
            default:
                this.analyzeBtn.innerHTML = '<span class="btn-icon">📊</span>Analyze Strategy';
                this.analyzeBtn.disabled = false;
                break;
        }
    }
    
    updateOptimizeButton(state) {
        switch (state) {
            case 'optimizing':
                this.optimizeBtn.innerHTML = '<span class="btn-icon">⚡</span>Optimizing...';
                this.optimizeBtn.disabled = true;
                break;
            case 'idle':
            default:
                this.optimizeBtn.innerHTML = '<span class="btn-icon">⚡</span>Optimize Parameters';
                this.optimizeBtn.disabled = false;
                break;
        }
    }
    
    updateOptimizationProgress(progress) {
        if (this.isOptimizing) {
            this.optimizeBtn.innerHTML = `<span class="btn-icon">⚡</span>Optimizing... ${progress.percentage}%`;
        }
    }
    
    showAnalysisResults(data) {
        const message = `Analysis Complete!\n\n` +
                       `Strategy: ${data.strategy.name}\n` +
                       `Parameters: ${data.parameters.length}\n` +
                       `Optimizable: ${data.parameters.filter(p => p.optimizable).length}\n` +
                       `Complexity: ${data.analysis.complexity.score}/50`;
        
        alert(message);
    }
    
    showOptimizationResults(data) {
        const improvement = data.improvement > 0 ? `+${data.improvement.toFixed(1)}%` : `${data.improvement.toFixed(1)}%`;
        const duration = Math.round(data.duration / 1000);
        
        const message = `Optimization Complete!\n\n` +
                       `Best Score: ${data.results.bestResult.score.toFixed(2)}\n` +
                       `Improvement: ${improvement}\n` +
                       `Tests Run: ${data.results.totalTests}\n` +
                       `Duration: ${duration}s`;
        
        alert(message);
    }
    
    showError(message) {
        alert(`Error: ${message}`);
    }
    
    async handleSettings() {
        console.log('Settings button clicked');
        
        try {
            // Open the settings page using Chrome's options page API
            await chrome.runtime.openOptionsPage();
        } catch (error) {
            console.error('Error opening settings page:', error);
            // Fallback: try to open settings page manually
            chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
        }
    }
    
    sendMessageToBackground(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message to background:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    console.log('Message sent to background:', message);
                    console.log('Background response:', response);
                    resolve(response);
                }
            });
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});