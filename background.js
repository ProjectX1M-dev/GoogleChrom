/**
 * TradingHub.Mk Background Script
 * Handles extension lifecycle, message passing, and coordination between components
 */

class BackgroundController {
    constructor() {
        this.extensionState = {
            isActive: false,
            currentTab: null,
            lastActivity: null,
            isAnalyzing: false,
            isOptimizing: false
        };
        
        this.init();
    }
    
    init() {
        console.log('TradingHub.Mk background script initialized');
        
        // Set up message listeners
        this.setupMessageListeners();
        
        // Set up tab listeners
        this.setupTabListeners();
        
        // Set up extension lifecycle listeners
        this.setupLifecycleListeners();
    }
    
    setupMessageListeners() {
        // Listen for messages from popup and content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Background received message:', message);
            
            this.handleMessage(message, sender)
                .then(response => {
                    sendResponse(response);
                })
                .catch(error => {
                    console.error('Error handling message:', error);
                    sendResponse({ error: error.message });
                });
            
            // Return true to indicate we'll send a response asynchronously
            return true;
        });
    }
    
    setupTabListeners() {
        // Listen for tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('tradingview.com/chart')) {
                console.log('TradingView tab loaded:', tab.url);
                this.extensionState.currentTab = tab;
                this.extensionState.isActive = true;
                this.extensionState.lastActivity = Date.now();
                
                // Send message to content script
                this.sendMessageToContentScript(tabId, {
                    type: 'TAB_LOADED',
                    url: tab.url,
                    timestamp: Date.now()
                });
            }
        });
        
        // Listen for tab activation
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                if (tab.url && tab.url.includes('tradingview.com')) {
                    this.extensionState.currentTab = tab;
                    this.extensionState.isActive = true;
                }
            } catch (error) {
                console.error('Error getting active tab:', error);
            }
        });
    }
    
    setupLifecycleListeners() {
        // Handle extension startup
        chrome.runtime.onStartup.addListener(() => {
            console.log('TradingHub.Mk extension started');
        });
        
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('TradingHub.Mk extension installed:', details.reason);
            
            if (details.reason === 'install') {
                // Set default settings
                chrome.storage.sync.set({
                    settings: {
                        autoOptimize: false,
                        optimizationDepth: 'standard',
                        maxIterations: 100,
                        theme: 'light',
                        notifications: true,
                        showAdvanced: false,
                        cacheResults: true,
                        parallelProcessing: false
                    }
                });
            }
        });
    }
    
    async handleMessage(message, sender) {
        const { type, ...data } = message;
        
        switch (type) {
            case 'POPUP_OPENED':
                return this.handlePopupOpened(data);
                
            case 'ANALYZE_STRATEGY':
                return this.handleAnalyzeStrategy(data);
                
            case 'OPTIMIZE_PARAMETERS':
                return this.handleOptimizeParameters(data);
                
            case 'STOP_OPTIMIZATION':
                return this.handleStopOptimization(data);
                
            case 'CONTENT_SCRIPT_READY':
                return this.handleContentScriptReady(data, sender);
                
            case 'GET_SETTINGS':
                return this.handleGetSettings(data);
                
            case 'OPTIMIZATION_PROGRESS':
                return this.handleOptimizationProgress(data);
                
            default:
                console.warn('Unknown message type:', type);
                return { success: false, error: 'Unknown message type' };
        }
    }
    
    async handlePopupOpened(data) {
        console.log('Popup opened at:', new Date(data.timestamp));
        
        // Update extension state
        this.extensionState.lastActivity = data.timestamp;
        
        return {
            success: true,
            state: this.extensionState
        };
    }
    
    async handleAnalyzeStrategy(data) {
        console.log('Analyzing strategy...');
        
        if (this.extensionState.isAnalyzing) {
            return {
                success: false,
                error: 'Analysis already in progress'
            };
        }
        
        try {
            this.extensionState.isAnalyzing = true;
            
            // Get current settings to determine analysis parameters
            const result = await chrome.storage.sync.get('settings');
            const settings = result.settings || {};
            
            // Send message to content script to analyze current strategy
            if (this.extensionState.currentTab) {
                const response = await this.sendMessageToContentScript(this.extensionState.currentTab.id, {
                    type: 'ANALYZE_CURRENT_STRATEGY',
                    timestamp: data.timestamp,
                    settings: settings
                });
                
                return response;
            } else {
                return {
                    success: false,
                    error: 'No active TradingView tab found'
                };
            }
            
        } catch (error) {
            console.error('Error in handleAnalyzeStrategy:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.extensionState.isAnalyzing = false;
        }
    }
    
    async handleOptimizeParameters(data) {
        console.log('Optimizing parameters...');
        
        if (this.extensionState.isOptimizing) {
            return {
                success: false,
                error: 'Optimization already in progress'
            };
        }
        
        try {
            this.extensionState.isOptimizing = true;
            
            // Get current settings to determine optimization parameters
            const result = await chrome.storage.sync.get('settings');
            const settings = result.settings || {};
            
            // Send message to content script to start optimization
            if (this.extensionState.currentTab) {
                const response = await this.sendMessageToContentScript(this.extensionState.currentTab.id, {
                    type: 'OPTIMIZE_STRATEGY_PARAMETERS',
                    timestamp: data.timestamp,
                    settings: settings
                });
                
                return response;
            } else {
                return {
                    success: false,
                    error: 'No active TradingView tab found'
                };
            }
            
        } catch (error) {
            console.error('Error in handleOptimizeParameters:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.extensionState.isOptimizing = false;
        }
    }
    
    async handleStopOptimization(data) {
        console.log('Stopping optimization...');
        
        try {
            if (this.extensionState.currentTab) {
                const response = await this.sendMessageToContentScript(this.extensionState.currentTab.id, {
                    type: 'STOP_OPTIMIZATION',
                    timestamp: data.timestamp
                });
                
                this.extensionState.isOptimizing = false;
                return response;
            } else {
                return {
                    success: false,
                    error: 'No active TradingView tab found'
                };
            }
            
        } catch (error) {
            console.error('Error in handleStopOptimization:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async handleContentScriptReady(data, sender) {
        console.log('Content script ready on tab:', sender.tab.id);
        
        return {
            success: true,
            message: 'Background script acknowledged'
        };
    }
    
    async handleGetSettings(data) {
        try {
            const result = await chrome.storage.sync.get('settings');
            return {
                success: true,
                settings: result.settings || {}
            };
        } catch (error) {
            console.error('Error getting settings:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async handleOptimizationProgress(data) {
        // Forward progress updates to popup if it's open
        try {
            // Note: In a real implementation, we'd need to track popup connections
            // For now, we'll just log the progress
            console.log('Optimization progress:', data.progress);
            
            return {
                success: true,
                message: 'Progress updated'
            };
        } catch (error) {
            console.error('Error handling optimization progress:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async sendMessageToContentScript(tabId, message) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, message);
            console.log('Message sent to content script:', message);
            console.log('Content script response:', response);
            return response;
        } catch (error) {
            console.error('Error sending message to content script:', error);
            throw error;
        }
    }
}

// Initialize background controller
new BackgroundController();