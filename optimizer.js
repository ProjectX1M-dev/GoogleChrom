/**
 * TradingHub.Mk Strategy Optimizer
 * Implements optimization algorithms for Pine Script strategies
 */

class StrategyOptimizer {
    constructor() {
        this.isOptimizing = false;
        this.currentOptimization = null;
        this.results = [];
        this.bestResult = null;
        this.progressCallback = null;
    }

    /**
     * Start optimization process
     */
    async optimize(parameters, settings = {}) {
        if (this.isOptimizing) {
            throw new Error('Optimization already in progress');
        }

        try {
            this.isOptimizing = true;
            this.results = [];
            this.bestResult = null;

            const config = {
                maxIterations: settings.maxIterations || 100,
                optimizationDepth: settings.optimizationDepth || 'standard',
                parallelProcessing: settings.parallelProcessing || false,
                ...settings
            };

            console.log('Starting optimization with config:', config);

            this.currentOptimization = {
                parameters,
                config,
                startTime: Date.now(),
                iteration: 0,
                totalIterations: this.calculateTotalIterations(parameters, config)
            };

            // Choose optimization algorithm based on depth setting
            let results;
            switch (config.optimizationDepth) {
                case 'basic':
                    results = await this.basicOptimization(parameters, config);
                    break;
                case 'deep':
                    results = await this.deepOptimization(parameters, config);
                    break;
                default:
                    results = await this.standardOptimization(parameters, config);
            }

            this.isOptimizing = false;
            return results;

        } catch (error) {
            this.isOptimizing = false;
            console.error('Optimization error:', error);
            throw error;
        }
    }

    /**
     * Basic optimization - Grid search with limited combinations
     */
    async basicOptimization(parameters, config) {
        console.log('Running basic optimization...');
        
        const parameterSets = this.generateParameterSets(parameters, 'basic');
        const maxSets = Math.min(parameterSets.length, config.maxIterations);
        
        for (let i = 0; i < maxSets; i++) {
            if (!this.isOptimizing) break;
            
            const paramSet = parameterSets[i];
            const result = await this.testParameterSet(paramSet, i);
            
            this.results.push(result);
            this.updateBestResult(result);
            this.updateProgress(i + 1, maxSets);
            
            // Small delay to prevent UI blocking
            await this.delay(50);
        }
        
        return this.compileResults();
    }

    /**
     * Standard optimization - Balanced approach with smart sampling
     */
    async standardOptimization(parameters, config) {
        console.log('Running standard optimization...');
        
        // Phase 1: Coarse grid search
        let parameterSets = this.generateParameterSets(parameters, 'coarse');
        let maxSets = Math.min(parameterSets.length, Math.floor(config.maxIterations * 0.6));
        
        for (let i = 0; i < maxSets; i++) {
            if (!this.isOptimizing) break;
            
            const paramSet = parameterSets[i];
            const result = await this.testParameterSet(paramSet, i);
            
            this.results.push(result);
            this.updateBestResult(result);
            this.updateProgress(i + 1, config.maxIterations);
            
            await this.delay(75);
        }
        
        // Phase 2: Fine-tune around best results
        if (this.isOptimizing && this.results.length > 0) {
            const topResults = this.getTopResults(5);
            const fineParameterSets = this.generateFineParameterSets(topResults, parameters);
            const remainingIterations = config.maxIterations - this.results.length;
            maxSets = Math.min(fineParameterSets.length, remainingIterations);
            
            for (let i = 0; i < maxSets; i++) {
                if (!this.isOptimizing) break;
                
                const paramSet = fineParameterSets[i];
                const result = await this.testParameterSet(paramSet, this.results.length);
                
                this.results.push(result);
                this.updateBestResult(result);
                this.updateProgress(this.results.length, config.maxIterations);
                
                await this.delay(75);
            }
        }
        
        return this.compileResults();
    }

    /**
     * Deep optimization - Comprehensive search with advanced algorithms
     */
    async deepOptimization(parameters, config) {
        console.log('Running deep optimization...');
        
        // Phase 1: Initial grid search (30% of iterations)
        let parameterSets = this.generateParameterSets(parameters, 'coarse');
        let maxSets = Math.min(parameterSets.length, Math.floor(config.maxIterations * 0.3));
        
        for (let i = 0; i < maxSets; i++) {
            if (!this.isOptimizing) break;
            
            const paramSet = parameterSets[i];
            const result = await this.testParameterSet(paramSet, i);
            
            this.results.push(result);
            this.updateBestResult(result);
            this.updateProgress(i + 1, config.maxIterations);
            
            await this.delay(100);
        }
        
        // Phase 2: Genetic algorithm (40% of iterations)
        if (this.isOptimizing && this.results.length > 0) {
            const geneticIterations = Math.floor(config.maxIterations * 0.4);
            await this.geneticOptimization(parameters, geneticIterations);
        }
        
        // Phase 3: Local search refinement (30% of iterations)
        if (this.isOptimizing && this.bestResult) {
            const localIterations = config.maxIterations - this.results.length;
            await this.localSearchOptimization(parameters, localIterations);
        }
        
        return this.compileResults();
    }

    /**
     * Generate parameter sets for testing
     */
    generateParameterSets(parameters, density = 'standard') {
        const sets = [];
        const densityMap = {
            'basic': 3,
            'coarse': 5,
            'standard': 7,
            'fine': 10
        };
        
        const stepsPerParam = densityMap[density] || 5;
        
        // Generate all combinations
        const generateCombinations = (params, index = 0, current = {}) => {
            if (index >= params.length) {
                sets.push({ ...current });
                return;
            }
            
            const param = params[index];
            const steps = this.generateParameterSteps(param, stepsPerParam);
            
            for (const value of steps) {
                current[param.name] = value;
                generateCombinations(params, index + 1, current);
                
                // Limit total combinations to prevent memory issues
                if (sets.length >= 10000) return;
            }
        };
        
        generateCombinations(parameters);
        
        // Shuffle for better distribution
        return this.shuffleArray(sets);
    }

    generateParameterSteps(param, stepCount) {
        const steps = [];
        
        if (param.type === 'boolean') {
            return [true, false];
        }
        
        if (param.type === 'integer' || param.type === 'float') {
            const min = param.min;
            const max = param.max;
            const stepSize = (max - min) / (stepCount - 1);
            
            for (let i = 0; i < stepCount; i++) {
                let value = min + (stepSize * i);
                
                if (param.type === 'integer') {
                    value = Math.round(value);
                }
                
                if (!steps.includes(value)) {
                    steps.push(value);
                }
            }
        }
        
        return steps;
    }

    /**
     * Generate fine parameter sets around best results
     */
    generateFineParameterSets(topResults, parameters) {
        const sets = [];
        
        topResults.forEach(result => {
            parameters.forEach(param => {
                const currentValue = result.parameters[param.name];
                const variations = this.generateParameterVariations(param, currentValue);
                
                variations.forEach(variation => {
                    const newSet = { ...result.parameters };
                    newSet[param.name] = variation;
                    sets.push(newSet);
                });
            });
        });
        
        return this.removeDuplicateSets(sets);
    }

    generateParameterVariations(param, currentValue) {
        const variations = [];
        
        if (param.type === 'integer' || param.type === 'float') {
            const step = param.step || 1;
            const range = Math.max(step * 3, (param.max - param.min) * 0.1);
            
            for (let i = -2; i <= 2; i++) {
                if (i === 0) continue;
                
                let newValue = currentValue + (step * i);
                newValue = Math.max(param.min, Math.min(param.max, newValue));
                
                if (param.type === 'integer') {
                    newValue = Math.round(newValue);
                }
                
                if (newValue !== currentValue) {
                    variations.push(newValue);
                }
            }
        }
        
        return variations;
    }

    /**
     * Genetic algorithm optimization
     */
    async geneticOptimization(parameters, iterations) {
        console.log('Running genetic algorithm...');
        
        const populationSize = Math.min(20, Math.max(10, Math.floor(iterations / 5)));
        let population = this.initializePopulation(parameters, populationSize);
        
        const generations = Math.floor(iterations / populationSize);
        
        for (let gen = 0; gen < generations; gen++) {
            if (!this.isOptimizing) break;
            
            // Evaluate population
            for (let i = 0; i < population.length; i++) {
                if (!this.isOptimizing) break;
                
                const individual = population[i];
                if (!individual.fitness) {
                    const result = await this.testParameterSet(individual.genes, this.results.length);
                    individual.fitness = result.score;
                    
                    this.results.push(result);
                    this.updateBestResult(result);
                    this.updateProgress(this.results.length, this.currentOptimization.totalIterations);
                    
                    await this.delay(100);
                }
            }
            
            // Selection and reproduction
            population = this.evolvePopulation(population, parameters);
        }
    }

    initializePopulation(parameters, size) {
        const population = [];
        
        // Include best known results
        const topResults = this.getTopResults(Math.min(5, size));
        topResults.forEach(result => {
            population.push({
                genes: result.parameters,
                fitness: result.score
            });
        });
        
        // Fill remaining with random individuals
        while (population.length < size) {
            const individual = {};
            parameters.forEach(param => {
                individual[param.name] = this.generateRandomValue(param);
            });
            
            population.push({
                genes: individual,
                fitness: null
            });
        }
        
        return population;
    }

    evolvePopulation(population, parameters) {
        // Sort by fitness
        population.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
        
        const newPopulation = [];
        const eliteCount = Math.floor(population.length * 0.2);
        
        // Keep elite individuals
        for (let i = 0; i < eliteCount; i++) {
            newPopulation.push(population[i]);
        }
        
        // Generate offspring
        while (newPopulation.length < population.length) {
            const parent1 = this.selectParent(population);
            const parent2 = this.selectParent(population);
            const offspring = this.crossover(parent1, parent2, parameters);
            
            if (Math.random() < 0.1) {
                this.mutate(offspring, parameters);
            }
            
            newPopulation.push({
                genes: offspring,
                fitness: null
            });
        }
        
        return newPopulation;
    }

    selectParent(population) {
        // Tournament selection
        const tournamentSize = 3;
        let best = population[Math.floor(Math.random() * population.length)];
        
        for (let i = 1; i < tournamentSize; i++) {
            const candidate = population[Math.floor(Math.random() * population.length)];
            if ((candidate.fitness || 0) > (best.fitness || 0)) {
                best = candidate;
            }
        }
        
        return best;
    }

    crossover(parent1, parent2, parameters) {
        const offspring = {};
        
        parameters.forEach(param => {
            if (Math.random() < 0.5) {
                offspring[param.name] = parent1.genes[param.name];
            } else {
                offspring[param.name] = parent2.genes[param.name];
            }
        });
        
        return offspring;
    }

    mutate(individual, parameters) {
        parameters.forEach(param => {
            if (Math.random() < 0.1) {
                individual[param.name] = this.generateRandomValue(param);
            }
        });
    }

    /**
     * Local search optimization around best result
     */
    async localSearchOptimization(parameters, iterations) {
        console.log('Running local search optimization...');
        
        let currentBest = { ...this.bestResult };
        let improved = true;
        let iteration = 0;
        
        while (improved && iteration < iterations && this.isOptimizing) {
            improved = false;
            
            for (const param of parameters) {
                if (!this.isOptimizing || iteration >= iterations) break;
                
                const neighbors = this.generateNeighbors(currentBest.parameters, param);
                
                for (const neighbor of neighbors) {
                    if (!this.isOptimizing || iteration >= iterations) break;
                    
                    const result = await this.testParameterSet(neighbor, this.results.length);
                    this.results.push(result);
                    iteration++;
                    
                    if (result.score > currentBest.score) {
                        currentBest = result;
                        improved = true;
                        this.updateBestResult(result);
                    }
                    
                    this.updateProgress(this.results.length, this.currentOptimization.totalIterations);
                    await this.delay(100);
                }
            }
        }
    }

    generateNeighbors(parameters, param) {
        const neighbors = [];
        const currentValue = parameters[param.name];
        
        if (param.type === 'integer' || param.type === 'float') {
            const step = param.step || 1;
            
            [-2, -1, 1, 2].forEach(multiplier => {
                let newValue = currentValue + (step * multiplier);
                newValue = Math.max(param.min, Math.min(param.max, newValue));
                
                if (param.type === 'integer') {
                    newValue = Math.round(newValue);
                }
                
                if (newValue !== currentValue) {
                    const neighbor = { ...parameters };
                    neighbor[param.name] = newValue;
                    neighbors.push(neighbor);
                }
            });
        }
        
        return neighbors;
    }

    /**
     * Test a parameter set (simulated for now)
     */
    async testParameterSet(parameters, iteration) {
        // Simulate backtesting delay
        await this.delay(100 + Math.random() * 200);
        
        // Generate simulated results
        const score = this.generateSimulatedScore(parameters);
        
        return {
            iteration,
            parameters: { ...parameters },
            score,
            metrics: this.generateSimulatedMetrics(score),
            timestamp: Date.now()
        };
    }

    generateSimulatedScore(parameters) {
        // Simulate realistic optimization results
        let score = 50; // Base score
        
        // Add some parameter-based logic
        Object.values(parameters).forEach(value => {
            if (typeof value === 'number') {
                score += (Math.sin(value / 10) * 20) + (Math.random() * 10 - 5);
            }
        });
        
        // Add some randomness but keep it realistic
        score += Math.random() * 30 - 15;
        
        return Math.max(0, Math.min(100, score));
    }

    generateSimulatedMetrics(score) {
        const baseReturn = score / 2;
        
        return {
            totalReturn: baseReturn + (Math.random() * 20 - 10),
            sharpeRatio: (score / 50) + (Math.random() * 0.5 - 0.25),
            maxDrawdown: Math.max(5, 30 - (score / 3) + (Math.random() * 10)),
            winRate: Math.max(30, Math.min(80, score + (Math.random() * 20 - 10))),
            profitFactor: Math.max(0.5, (score / 40) + (Math.random() * 0.5)),
            trades: Math.floor(100 + Math.random() * 200)
        };
    }

    /**
     * Utility methods
     */
    calculateTotalIterations(parameters, config) {
        const combinations = parameters.reduce((total, param) => {
            if (param.type === 'boolean') return total * 2;
            if (param.type === 'integer' || param.type === 'float') {
                const steps = Math.min(10, (param.max - param.min) / param.step);
                return total * steps;
            }
            return total;
        }, 1);
        
        return Math.min(combinations, config.maxIterations);
    }

    updateBestResult(result) {
        if (!this.bestResult || result.score > this.bestResult.score) {
            this.bestResult = result;
        }
    }

    updateProgress(current, total) {
        if (this.progressCallback) {
            this.progressCallback({
                current,
                total,
                percentage: Math.round((current / total) * 100),
                bestScore: this.bestResult?.score || 0,
                resultsCount: this.results.length
            });
        }
    }

    getTopResults(count) {
        return this.results
            .sort((a, b) => b.score - a.score)
            .slice(0, count);
    }

    compileResults() {
        const endTime = Date.now();
        const duration = endTime - this.currentOptimization.startTime;
        
        return {
            success: true,
            duration,
            totalTests: this.results.length,
            bestResult: this.bestResult,
            topResults: this.getTopResults(10),
            summary: {
                bestScore: this.bestResult?.score || 0,
                averageScore: this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length,
                improvement: this.calculateImprovement(),
                parameters: this.bestResult?.parameters || {}
            }
        };
    }

    calculateImprovement() {
        if (this.results.length < 2) return 0;
        
        const firstScore = this.results[0].score;
        const bestScore = this.bestResult.score;
        
        return ((bestScore - firstScore) / firstScore) * 100;
    }

    // Utility methods
    generateRandomValue(param) {
        if (param.type === 'boolean') {
            return Math.random() < 0.5;
        }
        
        if (param.type === 'integer') {
            return Math.floor(Math.random() * (param.max - param.min + 1)) + param.min;
        }
        
        if (param.type === 'float') {
            return Math.random() * (param.max - param.min) + param.min;
        }
        
        return param.current;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    removeDuplicateSets(sets) {
        const unique = [];
        const seen = new Set();
        
        sets.forEach(set => {
            const key = JSON.stringify(set);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(set);
            }
        });
        
        return unique;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop current optimization
     */
    stop() {
        this.isOptimizing = false;
    }

    /**
     * Set progress callback
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrategyOptimizer;
}