/**
 * TradingHub.Mk Pine Script Analyzer
 * Extracts and analyzes Pine Script code from TradingView editor
 */

class PineScriptAnalyzer {
    constructor() {
        this.currentScript = null;
        this.parameters = [];
        this.strategy = null;
        this.analysisResults = null;
    }

    /**
     * Extract Pine Script code from TradingView editor
     */
    extractPineScript() {
        try {
            // Multiple selectors to find the Pine Script editor
            const editorSelectors = [
                '.monaco-editor .view-lines',
                '[data-name="pine-editor"] .monaco-editor .view-lines',
                '.pine-editor .monaco-editor .view-lines',
                '.cm-editor .cm-content',
                '.CodeMirror-code',
                'textarea[data-name="pine-script"]'
            ];

            let scriptContent = '';
            
            for (const selector of editorSelectors) {
                const editor = document.querySelector(selector);
                if (editor) {
                    if (editor.tagName === 'TEXTAREA') {
                        scriptContent = editor.value;
                    } else if (editor.classList.contains('cm-content')) {
                        // CodeMirror 6
                        scriptContent = editor.textContent;
                    } else if (editor.classList.contains('view-lines')) {
                        // Monaco Editor
                        const lines = editor.querySelectorAll('.view-line');
                        scriptContent = Array.from(lines)
                            .map(line => line.textContent)
                            .join('\n');
                    } else if (editor.classList.contains('CodeMirror-code')) {
                        // CodeMirror 5
                        const lines = editor.querySelectorAll('.CodeMirror-line');
                        scriptContent = Array.from(lines)
                            .map(line => line.textContent)
                            .join('\n');
                    }
                    
                    if (scriptContent.trim()) {
                        break;
                    }
                }
            }

            if (!scriptContent.trim()) {
                throw new Error('No Pine Script code found in editor');
            }

            this.currentScript = scriptContent;
            console.log('Pine Script extracted:', scriptContent.substring(0, 200) + '...');
            return scriptContent;

        } catch (error) {
            console.error('Error extracting Pine Script:', error);
            throw error;
        }
    }

    /**
     * Parse Pine Script and identify strategy parameters
     */
    parseScript(scriptContent = null) {
        const script = scriptContent || this.currentScript;
        if (!script) {
            throw new Error('No script content to parse');
        }

        try {
            this.parameters = [];
            this.strategy = {
                name: 'Unknown Strategy',
                version: 'v5',
                type: 'strategy',
                inputs: [],
                variables: []
            };

            // Parse strategy declaration
            this.parseStrategyDeclaration(script);
            
            // Parse input parameters
            this.parseInputParameters(script);
            
            // Parse variable declarations
            this.parseVariables(script);
            
            // Identify optimization candidates
            this.identifyOptimizationCandidates();

            console.log('Script parsing completed:', {
                strategy: this.strategy.name,
                inputs: this.parameters.length,
                variables: this.strategy.variables.length
            });

            return {
                strategy: this.strategy,
                parameters: this.parameters,
                optimizationCandidates: this.parameters.filter(p => p.optimizable)
            };

        } catch (error) {
            console.error('Error parsing Pine Script:', error);
            throw error;
        }
    }

    parseStrategyDeclaration(script) {
        // Match strategy() or indicator() declaration
        const strategyRegex = /(?:strategy|indicator)\s*\(\s*(?:title\s*=\s*)?["']([^"']+)["']/i;
        const match = script.match(strategyRegex);
        
        if (match) {
            this.strategy.name = match[1];
            this.strategy.type = script.toLowerCase().includes('strategy(') ? 'strategy' : 'indicator';
        }

        // Detect Pine Script version
        const versionRegex = /@version\s*=\s*(\d+)/;
        const versionMatch = script.match(versionRegex);
        if (versionMatch) {
            this.strategy.version = `v${versionMatch[1]}`;
        }
    }

    parseInputParameters(script) {
        // Match input declarations with various patterns
        const inputPatterns = [
            // input.int, input.float, input.bool, etc.
            /(\w+)\s*=\s*input\.(\w+)\s*\(\s*([^,)]+)(?:,\s*title\s*=\s*["']([^"']+)["'])?(?:,\s*minval\s*=\s*([\d.-]+))?(?:,\s*maxval\s*=\s*([\d.-]+))?(?:,\s*step\s*=\s*([\d.-]+))?/g,
            // Legacy input() function
            /(\w+)\s*=\s*input\s*\(\s*([^,)]+)(?:,\s*["']([^"']+)["'])?(?:,\s*type\s*=\s*(\w+))?(?:,\s*minval\s*=\s*([\d.-]+))?(?:,\s*maxval\s*=\s*([\d.-]+))?/g
        ];

        inputPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(script)) !== null) {
                const param = this.createParameterFromMatch(match, pattern);
                if (param && !this.parameters.find(p => p.name === param.name)) {
                    this.parameters.push(param);
                    this.strategy.inputs.push(param);
                }
            }
        });
    }

    createParameterFromMatch(match, pattern) {
        try {
            let param = {
                name: match[1],
                currentValue: this.parseValue(match[2] || match[3]),
                optimizable: true,
                type: 'number',
                title: null,
                minValue: null,
                maxValue: null,
                step: null
            };

            // Determine parameter type and constraints based on pattern
            if (pattern.toString().includes('input\\.')) {
                // New input.* syntax
                param.type = this.mapInputType(match[2]);
                param.title = match[4] || match[1];
                param.minValue = match[5] ? parseFloat(match[5]) : null;
                param.maxValue = match[6] ? parseFloat(match[6]) : null;
                param.step = match[7] ? parseFloat(match[7]) : null;
            } else {
                // Legacy input() syntax
                param.title = match[3] || match[1];
                param.type = this.mapLegacyInputType(match[4]);
                param.minValue = match[5] ? parseFloat(match[5]) : null;
                param.maxValue = match[6] ? parseFloat(match[6]) : null;
            }

            // Set default constraints if not specified
            this.setDefaultConstraints(param);

            return param;
        } catch (error) {
            console.warn('Error creating parameter from match:', error);
            return null;
        }
    }

    mapInputType(type) {
        const typeMap = {
            'int': 'integer',
            'float': 'float',
            'bool': 'boolean',
            'string': 'string',
            'source': 'source',
            'timeframe': 'timeframe'
        };
        return typeMap[type] || 'number';
    }

    mapLegacyInputType(type) {
        if (!type) return 'number';
        
        const typeMap = {
            'integer': 'integer',
            'float': 'float',
            'bool': 'boolean',
            'string': 'string',
            'source': 'source',
            'resolution': 'timeframe'
        };
        return typeMap[type] || 'number';
    }

    parseValue(valueStr) {
        if (!valueStr) return null;
        
        valueStr = valueStr.trim();
        
        // Boolean values
        if (valueStr === 'true') return true;
        if (valueStr === 'false') return false;
        
        // String values
        if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
            return valueStr.slice(1, -1);
        }
        
        // Numeric values
        const numValue = parseFloat(valueStr);
        if (!isNaN(numValue)) return numValue;
        
        return valueStr;
    }

    setDefaultConstraints(param) {
        if (param.type === 'integer' || param.type === 'float') {
            if (param.minValue === null) {
                param.minValue = param.currentValue > 0 ? 1 : -100;
            }
            if (param.maxValue === null) {
                param.maxValue = Math.max(param.currentValue * 3, 100);
            }
            if (param.step === null) {
                param.step = param.type === 'integer' ? 1 : 0.1;
            }
        } else if (param.type === 'boolean') {
            param.optimizable = false; // Booleans are typically not optimized
        }
    }

    parseVariables(script) {
        // Parse variable declarations that might be optimization targets
        const variablePatterns = [
            // Simple variable assignments with numbers
            /(\w+)\s*=\s*([\d.-]+)/g,
            // ta.* function calls with numeric parameters
            /(\w+)\s*=\s*ta\.(\w+)\s*\([^)]*?([\d.-]+)[^)]*?\)/g
        ];

        variablePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(script)) !== null) {
                const variable = {
                    name: match[1],
                    value: parseFloat(match[2] || match[3]),
                    type: 'variable',
                    line: this.getLineNumber(script, match.index)
                };
                
                if (!isNaN(variable.value) && variable.value !== 0) {
                    this.strategy.variables.push(variable);
                }
            }
        });
    }

    identifyOptimizationCandidates() {
        // Mark parameters as optimizable based on common patterns
        this.parameters.forEach(param => {
            const name = param.name.toLowerCase();
            const title = (param.title || '').toLowerCase();
            
            // Common optimization targets
            const optimizableKeywords = [
                'length', 'period', 'lookback', 'window',
                'multiplier', 'factor', 'threshold',
                'stop', 'take', 'profit', 'loss',
                'rsi', 'ma', 'ema', 'sma', 'bb'
            ];
            
            param.optimizable = optimizableKeywords.some(keyword => 
                name.includes(keyword) || title.includes(keyword)
            ) && (param.type === 'integer' || param.type === 'float');
        });
    }

    getLineNumber(script, index) {
        return script.substring(0, index).split('\n').length;
    }

    /**
     * Analyze strategy performance characteristics
     */
    analyzeStrategy() {
        if (!this.currentScript) {
            throw new Error('No script loaded for analysis');
        }

        try {
            const analysis = {
                timestamp: Date.now(),
                script: this.currentScript,
                strategy: this.strategy,
                parameters: this.parameters,
                complexity: this.calculateComplexity(),
                optimizationPotential: this.assessOptimizationPotential(),
                recommendations: this.generateRecommendations()
            };

            this.analysisResults = analysis;
            return analysis;

        } catch (error) {
            console.error('Error analyzing strategy:', error);
            throw error;
        }
    }

    calculateComplexity() {
        const script = this.currentScript;
        
        return {
            lines: script.split('\n').length,
            functions: (script.match(/\w+\s*\(/g) || []).length,
            indicators: (script.match(/ta\.\w+/g) || []).length,
            conditions: (script.match(/if\s+|and\s+|or\s+/g) || []).length,
            parameters: this.parameters.length,
            score: this.calculateComplexityScore()
        };
    }

    calculateComplexityScore() {
        const complexity = this.calculateComplexity();
        let score = 0;
        
        score += Math.min(complexity.lines / 10, 10);
        score += Math.min(complexity.functions / 5, 10);
        score += Math.min(complexity.indicators / 3, 10);
        score += Math.min(complexity.conditions / 5, 10);
        score += Math.min(complexity.parameters / 2, 10);
        
        return Math.round(score);
    }

    assessOptimizationPotential() {
        const optimizableParams = this.parameters.filter(p => p.optimizable);
        
        return {
            parameterCount: optimizableParams.length,
            estimatedCombinations: this.estimateOptimizationCombinations(optimizableParams),
            difficulty: this.assessOptimizationDifficulty(optimizableParams),
            timeEstimate: this.estimateOptimizationTime(optimizableParams)
        };
    }

    estimateOptimizationCombinations(params) {
        let combinations = 1;
        
        params.forEach(param => {
            if (param.type === 'integer' || param.type === 'float') {
                const range = (param.maxValue - param.minValue) / param.step;
                combinations *= Math.min(range, 20); // Cap at 20 values per parameter
            }
        });
        
        return Math.round(combinations);
    }

    assessOptimizationDifficulty(params) {
        const combinations = this.estimateOptimizationCombinations(params);
        
        if (combinations < 100) return 'Easy';
        if (combinations < 1000) return 'Medium';
        if (combinations < 10000) return 'Hard';
        return 'Very Hard';
    }

    estimateOptimizationTime(params) {
        const combinations = this.estimateOptimizationCombinations(params);
        const timePerTest = 2; // seconds per backtest
        const totalSeconds = combinations * timePerTest;
        
        if (totalSeconds < 60) return `${totalSeconds} seconds`;
        if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)} minutes`;
        return `${Math.round(totalSeconds / 3600)} hours`;
    }

    generateRecommendations() {
        const recommendations = [];
        const optimizableParams = this.parameters.filter(p => p.optimizable);
        
        if (optimizableParams.length === 0) {
            recommendations.push({
                type: 'warning',
                message: 'No optimizable parameters found. Consider adding input parameters for key strategy values.'
            });
        } else if (optimizableParams.length > 8) {
            recommendations.push({
                type: 'warning',
                message: 'Too many parameters may lead to overfitting. Consider reducing to 3-6 key parameters.'
            });
        }
        
        if (this.strategy.type === 'indicator') {
            recommendations.push({
                type: 'info',
                message: 'This appears to be an indicator. Convert to strategy for backtesting optimization.'
            });
        }
        
        const complexity = this.calculateComplexityScore();
        if (complexity > 30) {
            recommendations.push({
                type: 'warning',
                message: 'High complexity strategy may be slow to optimize. Consider simplifying logic.'
            });
        }
        
        return recommendations;
    }

    /**
     * Get optimization-ready parameter configuration
     */
    getOptimizationConfig() {
        const optimizableParams = this.parameters.filter(p => p.optimizable);
        
        return {
            parameters: optimizableParams.map(param => ({
                name: param.name,
                title: param.title,
                type: param.type,
                current: param.currentValue,
                min: param.minValue,
                max: param.maxValue,
                step: param.step,
                priority: this.getParameterPriority(param)
            })),
            estimatedTime: this.estimateOptimizationTime(optimizableParams),
            combinations: this.estimateOptimizationCombinations(optimizableParams)
        };
    }

    getParameterPriority(param) {
        const name = param.name.toLowerCase();
        const title = (param.title || '').toLowerCase();
        
        // High priority parameters
        const highPriority = ['length', 'period', 'multiplier', 'threshold'];
        if (highPriority.some(keyword => name.includes(keyword) || title.includes(keyword))) {
            return 'high';
        }
        
        // Medium priority parameters
        const mediumPriority = ['stop', 'take', 'profit', 'loss'];
        if (mediumPriority.some(keyword => name.includes(keyword) || title.includes(keyword))) {
            return 'medium';
        }
        
        return 'low';
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PineScriptAnalyzer;
}