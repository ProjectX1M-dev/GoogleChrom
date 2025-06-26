/**
 * Example test file to verify Jest setup
 */

describe('TradingHub.Mk Extension', () => {
    test('should pass basic test', () => {
        expect(true).toBe(true);
    });
    
    test('should handle basic math', () => {
        expect(2 + 2).toBe(4);
    });
    
    test('should work with arrays', () => {
        const testArray = [1, 2, 3];
        expect(testArray).toHaveLength(3);
        expect(testArray).toContain(2);
    });
});

// Mock Chrome APIs for testing
global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        }
    },
    tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
    },
    storage: {
        sync: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

describe('Message Passing', () => {
    test('should mock chrome.runtime.sendMessage', () => {
        const mockMessage = { type: 'TEST', data: 'test' };
        chrome.runtime.sendMessage(mockMessage);
        
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(mockMessage);
    });
});