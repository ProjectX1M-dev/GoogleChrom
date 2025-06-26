/**
 * TradingHub.Mk Content Script
 * Injected into TradingView pages to interact with the DOM and Pine Script editor
 */

class ContentController {
    constructor() {
        this.isInitialized = false;
        this.tradingViewElements = {
            pineEditor: null,
            strategyTester: null,
            chart: null
        };
        
        // Initialize Pine Script analyzer and optimizer
        this.pineAnalyzer = new PineScriptAnalyzer();
        this.optimizer = new StrategyOptimizer();
        
        this.init();
    }
    
    async init() {
        console.log('TradingHub.Mk content script initializing on:', window.location.href);
        
        // Load analyzer and optimizer scripts
        await this.loadScripts();
        
        // Wait for TradingView to load
        await this.waitForTradingViewLoad();
        
        // Set up message listeners
        this.setupMessageListeners();
        
        // Find TradingView elements
        this.findTradingViewElements();
        
        // Set up optimization progress callback
        this.optimizer.setProgressCallback((progress) => {
            this.sendMessageToBackground({
                type: 'OPTIMIZATION_PROGRESS',
                progress
            });
        });
        
        // Notify background script that content script is ready
        this.sendMessageToBackground({
            type: 'CONTENT_SCRIPT_READY',
            url: window.location.href,
            timestamp: Date.now()
        });
        
        this.isInitialized = true;
        console.log('TradingHub.Mk content script initialized successfully');
    }
    
    async loadScripts() {
        // Inject Pine Script analyzer
        const analyzerScript = await fetch(chrome.runtime.getURL('pine-analyzer.js'));
        const analyzerCode = await analyzerScript.text();
        this.injectScript(analyzerCode);
        
        // Inject optimizer
        const optimizerScript = await fetch(chrome.runtime.getURL('optimizer.js'));
        const optimizerCode = await optimizerScript.text();
        this.injectScript(optimizerCode);
    }
    
    async waitForTradingViewLoad() {
        return new Promise((resolve) => {
            const checkLoad = () => {
                // Check if TradingView's main elements are loaded
                if (document.querySelector('[data-name="legend"]') || 
                    document.querySelector('.chart-container') ||
                    document.querySelector('#header-toolbar-symbol-search') ||
                    document.querySelector('.monaco-editor')) {
                    resolve();
                } else {
                    setTimeout(checkLoad, 1000);
                }
            };
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkLoad);
            } else {
                checkLoad();
            }
        });
    }
    
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Content script received message:', message);
            
            this.handleMessage(message)
                .then(response => {
                    sendResponse(response);
                })
                .catch(error => {
                    console.error('Error handling message in content script:', error);
                    sendResponse({ error: error.message });
                });
            
            // Return true to indicate we'll send a response asynchronously
            return true;
        });
    }
    
    findTradingViewElements() {
        // Look for Pine Script editor with multiple selectors
        const editorSelectors = [
            '[data-name="pine-editor"]',
            '.pine-editor',
            '#pine-editor',
            '.monaco-editor',
            '[data-testid="pine-editor"]'
        ];
        
        for (const selector of editorSelectors) {
            this.tradingViewElements.pineEditor = document.querySelector(selector);
            if (this.tradingViewElements.pineEditor) break;
        }
        
        // Look for strategy tester
        const testerSelectors = [
            '[data-name="backtesting"]',
            '.strategy-tester',
            '#strategy-tester',
            '[data-testid="strategy-tester"]',
            '.backtesting-container'
        ];
        
        for (const selector of testerSelectors) {
            this.tradingViewElements.strategyTester = document.querySelector(selector);
            if (this.tradingViewElements.strategyTester) break;
        }
        
        // Look for chart container
        this.tradingViewElements.chart = document.querySelector('.chart-container') ||
                                       document.querySelector('[data-name="chart"]') ||
                                       document.querySelector('#chart');
        
        console.log('TradingView elements found:', {
            pineEditor: !!this.tradingViewElements.pineEditor,
            strategyTester: !!this.tradingViewElements.strategyTester,
            chart: !!this.tradingViewElements.chart
        });
    }
    
    async handleMessage(message) {
        const { type, ...data } = message;
        
        switch (type) {
            case 'TAB_LOADED':
                return this.handleTabLoaded(data);
                
            case 'ANALYZE_CURRENT_STRATEGY':
                return this.handleAnalyzeStrategy(data);
                
            case 'OPTIMIZE_STRATEGY_PARAMETERS':
                return this.handleOptimizeParameters(data);
                
            case 'STOP_OPTIMIZATION':
                return this.handleStopOptimization(data);
                
            default:
                console.warn('Unknown message type in content script:', type);
                return { success: false, error: 'Unknown message type' };
        }
    }
    
    async handleTabLoaded(data) {
        console.log('Tab loaded message received:', data.url);
        
        // Re-find elements in case the page structure changed
        this.findTradingViewElements();
        
        return {
            success: true,
            elementsFound: {
                pineEditor: !!this.tradingViewElements.pineEditor,
                strategyTester: !!this.tradingViewElements.strategyTester,
                chart: !!this.tradingViewElements.chart
            }
        };
    }
    
    async handleAnalyzeStrategy(data) {
        console.log('Analyzing current strategy...');
        
        try {
            // Check if Pine Script editor is available
            if (!this.tradingViewElements.pineEditor) {
                this.findTradingViewElements();
            }
            
            if (!this.tradingViewElements.pineEditor) {
                return {
                    success: false,
                    error: 'Pine Script editor not found. Please open a strategy in the Pine Editor.'
                };
            }
            
            // Extract Pine Script code
            const scriptContent = this.pineAnalyzer.extractPineScript();
            
            if (!scriptContent || scriptContent.trim().length === 0) {
                return {
                    success: false,
                    error: 'No Pine Script code found in the editor.'
                };
            }
            
            // Parse the script
            const parseResults = this.pineAnalyzer.parseScript(scriptContent);
            
            // Analyze the strategy
            const analysisResults = this.pineAnalyzer.analyzeStrategy();
            
            console.log('Strategy analysis completed:', analysisResults);
            
            return {
                success: true,
                message: 'Strategy analysis completed successfully',
                data: {
                    script: {
                        length: scriptContent.length,
                        lines: scriptContent.split('\n').length
                    },
                    strategy: parseResults.strategy,
                    parameters: parseResults.parameters,
                    analysis: analysisResults,
                    optimizationConfig: this.pineAnalyzer.getOptimizationConfig()
                }
            };
            
        } catch (error) {
            console.error('Error analyzing strategy:', error);
            return {
                success: false,
                error: `Analysis failed: ${error.message}`
            };
        }
    }
    
    async handleOptimizeParameters(data) {
        console.log('Optimizing strategy parameters...');
        
        try {
            // First analyze the strategy to get parameters
            const analysisResult = await this.handleAnalyzeStrategy(data);
            
            if (!analysisResult.success) {
                return analysisResult;
            }
            
            const optimizableParams = analysisResult.data.parameters.filter(p => p.optimizable);
            
            if (optimizableParams.length === 0) {
                return {
                    success: false,
                    error: 'No optimizable parameters found in the strategy.'
                };
            }
            
            console.log(`Starting optimization of ${optimizableParams.length} parameters...`);
            
            // Start optimization
            const optimizationResults = await this.optimizer.optimize(optimizableParams, data.settings);
            
            console.log('Parameter optimization completed:', optimizationResults);
            
            return {
                success: true,
                message: 'Parameter optimization completed successfully',
                data: {
                    results: optimizationResults,
                    originalParameters: analysisResult.data.parameters,
                    optimizedParameters: optimizationResults.bestResult?.parameters || {},
                    improvement: optimizationResults.summary.improvement,
                    duration: optimizationResults.duration
                }
            };
            
        } catch (error) {
            console.error('Error optimizing parameters:', error);
            return {
                success: false,
                error: `Optimization failed: ${error.message}`
            };
        }
    }
    
    async handleStopOptimization(data) {
        console.log('Stopping optimization...');
        
        try {
            this.optimizer.stop();
            
            return {
                success: true,
                message: 'Optimization stopped successfully'
            };
            
        } catch (error) {
            console.error('Error stopping optimization:', error);
            return {
                success: false,
                error: `Failed to stop optimization: ${error.message}`
            };
        }
    }
    
    sendMessageToBackground(message) {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message to background:', chrome.runtime.lastError);
            } else {
                console.log('Message sent to background from content script:', message);
                console.log('Background response:', response);
            }
        });
    }
    
    // Utility method to inject scripts into the page context
    injectScript(scriptContent) {
        const script = document.createElement('script');
        script.textContent = scriptContent;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }
}

// Initialize content controller when script loads
new ContentController();