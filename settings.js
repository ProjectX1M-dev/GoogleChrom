/**
 * TradingHub.Mk Settings Script
 * Handles settings page UI interactions and storage management
 */

class SettingsController {
    constructor() {
        this.defaultSettings = {
            autoOptimize: false,
            optimizationDepth: 'standard',
            maxIterations: 100,
            theme: 'light',
            notifications: true,
            showAdvanced: false,
            cacheResults: true,
            parallelProcessing: false
        };
        
        this.elements = {};
        this.init();
    }
    
    async init() {
        console.log('TradingHub.Mk settings page initialized');
        
        // Get DOM elements
        this.getElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load and display current settings
        await this.loadSettings();
    }
    
    getElements() {
        // Setting controls
        this.elements.autoOptimize = document.getElementById('autoOptimize');
        this.elements.optimizationDepth = document.getElementById('optimizationDepth');
        this.elements.maxIterations = document.getElementById('maxIterations');
        this.elements.themeLight = document.getElementById('themeLight');
        this.elements.themeDark = document.getElementById('themeDark');
        this.elements.themeAuto = document.getElementById('themeAuto');
        this.elements.notifications = document.getElementById('notifications');
        this.elements.showAdvanced = document.getElementById('showAdvanced');
        this.elements.cacheResults = document.getElementById('cacheResults');
        this.elements.parallelProcessing = document.getElementById('parallelProcessing');
        
        // Action buttons
        this.elements.saveBtn = document.getElementById('saveBtn');
        this.elements.resetBtn = document.getElementById('resetBtn');
        this.elements.exportBtn = document.getElementById('exportBtn');
        
        // Status message
        this.elements.statusMessage = document.getElementById('statusMessage');
    }
    
    setupEventListeners() {
        // Save button
        this.elements.saveBtn.addEventListener('click', () => this.saveSettings());
        
        // Reset button
        this.elements.resetBtn.addEventListener('click', () => this.resetSettings());
        
        // Export button
        this.elements.exportBtn.addEventListener('click', () => this.exportSettings());
        
        // Real-time validation for max iterations
        this.elements.maxIterations.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value < 10) e.target.value = 10;
            if (value > 1000) e.target.value = 1000;
        });
        
        // Theme change listeners
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', () => this.previewTheme());
        });
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get('settings');
            const settings = result.settings || this.defaultSettings;
            
            console.log('Loaded settings:', settings);
            this.populateUI(settings);
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showStatusMessage('Error loading settings', 'error');
            this.populateUI(this.defaultSettings);
        }
    }
    
    populateUI(settings) {
        // Checkboxes
        this.elements.autoOptimize.checked = settings.autoOptimize;
        this.elements.notifications.checked = settings.notifications;
        this.elements.showAdvanced.checked = settings.showAdvanced;
        this.elements.cacheResults.checked = settings.cacheResults;
        this.elements.parallelProcessing.checked = settings.parallelProcessing;
        
        // Select dropdown
        this.elements.optimizationDepth.value = settings.optimizationDepth;
        
        // Number input
        this.elements.maxIterations.value = settings.maxIterations;
        
        // Radio buttons for theme
        switch (settings.theme) {
            case 'light':
                this.elements.themeLight.checked = true;
                break;
            case 'dark':
                this.elements.themeDark.checked = true;
                break;
            case 'auto':
                this.elements.themeAuto.checked = true;
                break;
        }
    }
    
    async saveSettings() {
        try {
            this.elements.saveBtn.disabled = true;
            this.elements.saveBtn.textContent = 'Saving...';
            
            const settings = this.collectSettings();
            
            await chrome.storage.sync.set({ settings });
            
            console.log('Settings saved:', settings);
            this.showStatusMessage('Settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatusMessage('Error saving settings', 'error');
        } finally {
            setTimeout(() => {
                this.elements.saveBtn.disabled = false;
                this.elements.saveBtn.innerHTML = '<span class="btn-icon">💾</span>Save Settings';
            }, 1000);
        }
    }
    
    collectSettings() {
        const themeRadio = document.querySelector('input[name="theme"]:checked');
        
        return {
            autoOptimize: this.elements.autoOptimize.checked,
            optimizationDepth: this.elements.optimizationDepth.value,
            maxIterations: parseInt(this.elements.maxIterations.value),
            theme: themeRadio ? themeRadio.value : 'light',
            notifications: this.elements.notifications.checked,
            showAdvanced: this.elements.showAdvanced.checked,
            cacheResults: this.elements.cacheResults.checked,
            parallelProcessing: this.elements.parallelProcessing.checked
        };
    }
    
    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            try {
                await chrome.storage.sync.set({ settings: this.defaultSettings });
                this.populateUI(this.defaultSettings);
                this.showStatusMessage('Settings reset to defaults', 'success');
                console.log('Settings reset to defaults');
            } catch (error) {
                console.error('Error resetting settings:', error);
                this.showStatusMessage('Error resetting settings', 'error');
            }
        }
    }
    
    async exportSettings() {
        try {
            const result = await chrome.storage.sync.get('settings');
            const settings = result.settings || this.defaultSettings;
            
            const dataStr = JSON.stringify(settings, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'tradinghub-mk-settings.json';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            this.showStatusMessage('Settings exported successfully!', 'success');
            console.log('Settings exported');
            
        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showStatusMessage('Error exporting settings', 'error');
        }
    }
    
    previewTheme() {
        const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value;
        
        if (selectedTheme === 'dark') {
            document.body.style.filter = 'invert(1) hue-rotate(180deg)';
            setTimeout(() => {
                document.body.style.filter = '';
            }, 500);
        }
    }
    
    showStatusMessage(message, type) {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
        
        // Hide message after 3 seconds
        setTimeout(() => {
            this.elements.statusMessage.style.opacity = '0';
            setTimeout(() => {
                this.elements.statusMessage.className = 'status-message';
            }, 300);
        }, 3000);
    }
}

// Initialize settings controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsController();
});