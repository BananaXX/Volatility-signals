
```javascript
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Telegram configuration
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot;
if (TELEGRAM_TOKEN) {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
}

// Deriv WebSocket connection
let derivWS = null;
let isConnectedToDerivs = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Bot state
let botState = {
    isRunning: false,
    currentVol: '1HZ75V', // Default to Vol 75 (1s) as requested
    indexType: '1s', // 'regular' or '1s'
    currentPrice: 0,
    lastPrice: 0,
    priceHistory: [],
    signals: [],
    marketData: {
        bid: 0,
        ask: 0,
        spread: 0,
        timestamp: null,
        volatility: 0
    },
    performance: {
        totalTrades: 0,
        winningTrades: 0,
        dailyPL```javascript
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Telegram configuration
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot;
if (TELEGRAM_TOKEN) {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
}

// Deriv WebSocket connection
let derivWS = null;
let isConnectedToDerivs = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Bot state
let botState = {
    isRunning: false,
    currentVol: '1HZ75V', // Default to Vol 75 (1s) as requested
    indexType: '1s', // 'regular' or '1s'
    currentPrice: 0,
    lastPrice: 0,
    priceHistory: [],
    signals: [],
    marketData: {
        bid: 0,
        ask: 0,
        spread: 0,
        timestamp: null,
        volatility: 0
    },
    performance: {
        totalTrades: 0,
        winningTrades: 0,
        dailyPL: 0,
        lastSignalTime: null
    }: 0,
        lastSignalTime: null
    }
};

// CORRECTED Deriv volatility indices mapping
const volatilityIndices = {
    // REGULAR Volatility Indices (every ~2 seconds)
    regular: {
        10: { symbol: 'R_10', name: 'Volatility 10 Index', stopLoss: 30, takeProfit: 75, riskPercent: 1, frequency: '~2s' },
        25: { symbol: 'R_25', name: 'Volatility 25 Index', stopLoss: 50, takeProfit: 125, riskPercent: 1.5, frequency: '~2s' },
        50: { symbol: 'R_50', name: 'Volatility 50 Index', stopLoss: 100, takeProfit: 250, riskPercent: 2, frequency: '~2s' },
        75: { symbol: 'R_75', name: 'Volatility 75 Index', stopLoss: 150, takeProfit: 375, riskPercent: 2.5, frequency: '~2s' },
        100: { symbol: 'R_100', name: 'Volatility 100 Index', stopLoss: 250, takeProfit: 625, riskPercent: 3, frequency: '~2s' }
    },
    // 1-SECOND Volatility Indices (every 1 second exactly)
    '1s': {
        10: { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', stopLoss: 20, takeProfit: 50, riskPercent: 0.8, frequency: '1s' },
        25: { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', stopLoss: 35, takeProfit: 90, riskPercent: 1.2, frequency: '1s' },
        50: { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', stopLoss: 70, takeProfit: 180, riskPercent: 1.8, frequency: '1s' },
        75: { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', stopLoss: 100, takeProfit: 250, riskPercent: 2.2, frequency: '1s' },
        100: { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', stopLoss: 150, takeProfit: 400, riskPercent: 2.8, frequency: '1s' }
    }
};

// Connect to Deriv WebSocket API
function connectToDerivAPI() {
    console.log('🔌 Connecting to Deriv WebSocket API...');
    
    derivWS = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    
    derivWS.on('open', () => {
        console.log('✅ Connected to Deriv WebSocket API');
        isConnectedToDerivs = true;
        reconnectAttempts = 0;
        
        // Subscribe to current volatility index
        subscribeToVolatilityIndex(botState.currentVol);
        
        // Send connection success to Telegram
        if (bot && TELEGRAM_CHAT_ID) {
            const currentIndex = getCurrentVolatilityIndex();
            bot.sendMessage(TELEGRAM_CHAT_ID, `🟢 Bot connected to LIVE Deriv data!\n📊 Monitoring: ${currentIndex.name}\n⚡ Update frequency: ${currentIndex.frequency}`);
        }
    });
    
    derivWS.on('message', (data) => {
        try {
            const response = JSON.parse(data);
            handleDerivMessage(response);
        } catch (error) {
            console.error('❌ Error parsing Deriv message:', error);
        }
    });
    
    derivWS.on('close', () => {
        console.log('🔴 Deriv WebSocket connection closed');
        isConnectedToDerivs = false;
        
        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Reconn// CORRECTED Deriv volatility indices mapping
const volatilityIndices = {
    // REGULAR Volatility Indices (every ~2 seconds)
    regular: {
        10: { symbol: 'R_10', name: 'Volatility 10 Index', stopLoss: 30, takeProfit: 75, riskPercent: 1, frequency: '~2s' },
        25: { symbol: 'R_25', name: 'Volatility 25 Index', stopLoss: 50, takeProfit: 125, riskPercent: 1.5, frequency: '~2s' },
        50: { symbol: 'R_50', name: 'Volatility 50 Index', stopLoss: 100, takeProfit: 250, riskPercent: 2, frequency: '~2s' },
        75: { symbol: 'R_75', name: 'Volatility 75 Index', stopLoss: 150, takeProfit: 375, riskPercent: 2.5, frequency: '~2s' },
        100: { symbol: 'R_100', name: 'Volatility 100 Index', stopLoss: 250, takeProfit: 625, riskPercent: 3, frequency: '~2s' }
    },
    // 1-SECOND Volatility Indices (every 1 second exactly)
    '1s': {
        10: { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', stopLoss: 20, takeProfit: 50, riskPercent: 0.8, frequency: '1s' },
        25: { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', stopLoss: 35, takeProfit: 90, riskPercent: 1.2, frequency: '1s' },
        50: { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', stopLoss: 70, takeProfit: 180, riskPercent: 1.8, frequency: '1s' },
        75: { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', stopLoss: 100, takeProfit: 250, riskPercent: 2.2, frequency: '1s' },
        100: { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', stopLoss: 150, takeProfit: 400, riskPercent: 2.8, frequency: '1s' }
    }
};

// Connect to Deriv WebSocket API
function connectToDerivAPI() {
    console.log('🔌 Connecting to Deriv WebSocket API...');
    
    derivWS = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    
    derivWS.on('open', () => {
        console.log('✅ Connected to Deriv WebSocket API');
        isConnectedToDerivs = true;
        reconnectAttempts = 0;
        
        // Subscribe to current volatility index
        subscribeToVolatilityIndex(botState.currentVol);
        
        // Send connection success to Telegram
        if (bot && TELEGRAM_CHAT_ID) {
            const currentIndex = getCurrentVolatilityIndex();
            bot.sendMessage(TELEGRAM_CHAT_ID, `🟢 Bot connected to LIVE Deriv data!\n📊 Monitoring: ${currentIndex.name}\n⚡ Update frequency: ${currentIndex.frequency}`);
        }
    });
    
    derivWS.on('message', (data) => {
        try {
            const response = JSON.parse(data);
            handleDerivMessage(response);
        } catch (error) {
            console.error('❌ Error parsing Deriv message:', error);
        }
    });
    
    derivWS.on('close', () => {
        console.log('🔴 Deriv WebSocket connection closed');
        isConnectedToDerivs = false;
        
        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(connectToDerivAPIection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(connectToDerivAPI, 5000);
        }
    });
    
    derivWS.on('error', (error) => {
        console.error('❌ Deriv WebSocket error:', error);
        isConnectedToDerivs = false;
    });
}

function subscribeToVolatilityIndex(symbol) {
    if (!derivWS || derivWS.readyState !== WebSocket.OPEN) {
        console.log('⚠️ WebSocket not ready, queuing subscription...');
        setTimeout(() => subscribeToVolatilityIndex(symbol), 1000);
        return;
    }
    
    // First, unsubscribe from any existing subscriptions
    derivWS.send(JSON.stringify({
        forget_all: "ticks"
    }));
    
    // Wait a moment, then subscribe to new symbol
    setTimeout(() => {
        const subscription = {
            ticks: symbol,
            subscribe: 1
        };
        
        console.log(`📊 Subscribing to ${symbol} live data...`);
        derivWS.send(JSON.stringify(subscription));
    }, 500);
}

function handleDerivMessage(response) {
    // Handle tick data (live prices)
    if (response.tick) {
        const tick = response.tick;
        
        // Update bot state with real data
        botState.lastPrice = botState.currentPrice;
        botState.currentPrice = parseFloat(tick.quote);
        botState.marketData = {
            bid: parseFloat(tick.bid || tick.quote),
            ask: parseFloat(tick.ask || tick.quote),
            spread: Math.abs((tick.ask || tick.quote) - (tick.bid || tick.quote)),
            timestamp: new Date(tick.epoch * 1000),
            symbol: tick.symbol
        };
        // CORRECTED Deriv volatility indices mapping
const volatilityIndices = {
    // REGULAR Volatility Indices (every ~2 seconds)
    regular: {
        10: { symbol: 'R_10', name: 'Volatility 10 Index', stopLoss: 30, takeProfit: 75, riskPercent: 1, frequency: '~2s' },
        25: { symbol: 'R_25', name: 'Volatility 25 Index', stopLoss: 50, takeProfit: 125, riskPercent: 1.5, frequency: '~2s' },
        50: { symbol: 'R_50', name: 'Volatility 50 Index', stopLoss: 100, takeProfit: 250, riskPercent: 2, frequency: '~2s' },
        75: { symbol: 'R_75', name: 'Volatility 75 Index', stopLoss: 150, takeProfit: 375, riskPercent: 2.5, frequency: '~2s' },
        100: { symbol: 'R_100', name: 'Volatility 100 Index', stopLoss: 250, takeProfit: 625, riskPercent: 3, frequency: '~2s' }
    },
    // 1-SECOND Volatility Indices (every 1 second exactly)
    '1s': {
        10: { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', stopLoss: 20, takeProfit: 50, riskPercent: 0.8, frequency: '1s' },
        25: { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', stopLoss: 35, takeProfit: 90, riskPercent: 1.2, frequency: '1s' },
        50: { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', stopLoss: 70, takeProfit: 180, riskPercent: 1.8, frequency: '1s' },
        75: { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', stopLoss: 100, takeProfit: 250, riskPercent: 2.2, frequency: '1s' },
        100: { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', stopLoss: 150, takeProfit: 400, riskPercent: 2.8, frequency: '1s' }
    }
};

// Connect to Deriv WebSocket API
function connectToDerivAPI() {
    console.log('🔌 Connecting to Deriv WebSocket API...');
    
    derivWS = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    
    derivWS.on('open', () => {
        console.log('✅ Connected to Deriv WebSocket API');
        isConnectedToDerivs = true;
        reconnectAttempts = 0;
        
        // Subscribe to current volatility index
        subscribeToVolatilityIndex(botState.currentVol);
        
        // Send connection success to Telegram
        if (bot && TELEGRAM_CHAT_ID) {
            const currentIndex = getCurrentVolatilityIndex();
            bot.sendMessage(TELEGRAM_CHAT_ID, `🟢 Bot connected to LIVE Deriv data!\n📊 Monitoring: ${currentIndex.name}\n⚡ Update frequency: ${currentIndex.frequency}`);
        }
    });
    
    derivWS.on('message', (data) => {
        try {
            const response = JSON.parse(data);
            handleDerivMessage(response);
        } catch (error) {
            console.error('❌ Error parsing Deriv message:', error);
        }
    });
    
    derivWS.on('close', () => {
        console.log('🔴 Deriv WebSocket connection closed');
        isConnectedToDerivs = false;
        
        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(connectToDerivAPIection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(connectToDerivAPI, 5000);
        }
    });
    
    derivWS.on('error', (error) => {
        console.error('❌ Deriv WebSocket error:', error);
        isConnectedToDerivs = false;
    });
}

function subscribeToVolatilityIndex(symbol) {
    if (!derivWS || derivWS.readyState !== WebSocket.OPEN) {
        console.log('⚠️ WebSocket not ready, queuing subscription...');
        setTimeout(() => subscribeToVolatilityIndex(symbol), 1000);
        return;
    }
    
    // First, unsubscribe from any existing subscriptions
    derivWS.send(JSON.stringify({
        forget_all: "ticks"
    }));
    
    // Wait a moment, then subscribe to new symbol
    setTimeout(() => {
        const subscription = {
            ticks: symbol,
            subscribe: 1
        };
        
        console.log(`📊 Subscribing to ${symbol} live data...`);
        derivWS.send(JSON.stringify(subscription));
    }, 500);
}

function handleDerivMessage(response) {
    // Handle tick data (live prices)
    if (response.tick) {
        const tick = response.tick;
        
        // Update bot state with real data
        botState.lastPrice = botState.currentPrice;
        botState.currentPrice = parseFloat(tick.quote);
        botState.marketData = {
            bid: parseFloat(tick.bid || tick.quote),
            ask: parseFloat(tick.ask || tick.quote),
            spread: Math.abs((tick.ask || tick.quote) - (tick.bid || tick.quote)),
            timestamp: new Date(tick.epoch * 1000),
            symbol: tick.symbol
        // Update price history for technical analysis
        botState.priceHistory.push({
            price: botState.currentPrice,
            timestamp: botState.marketData.timestamp
        });
        
        // Keep appropriate history based on index type
        const maxHistory = botState.indexType === '1s' ? 300 : 150; // More data for 1s indices
        if (botState.priceHistory.length > maxHistory) {
            botState.priceHistory = botState.priceHistory.slice(-maxHistory);
        }
        
        // Run trading algorithm with REAL data
        if (botState.isRunning) {
            analyzeRealMarket();
        }
    }
    
    // Handle subscription confirmation
    if (response.msg_type === 'tick') {
        const currentIndex = getCurrentVolatilityIndex();
        console.log(`✅ Successfully subscribed to ${response.echo_req.ticks} (${currentIndex.name})`);
    }
    
    // Handle errors
    if (response.error) {
        console.error('❌ Deriv API Error:', response.error.message);
        
        // If symbol not found, try fallback
        if (response.error.code === 'InvalidSymbol') {
            console.log('🔄 Invalid symbol, trying fallback...');
            // Fallback to regular volatility if 1s not available
            if (botState.indexType === '1s') {
                botState.indexType = 'regular';
                botState.currentVol = 'R_75';
                setTimeout(() => subscribeToVolatilityIndex('R_75'), 2000);
            }
        }
    }
}

// Enhanced market analysis for different index types
function analyzeRealMarket() {
    const minDataPoints = botState.indexType === '1s' ? 30 : 20;
    if (botState.priceHistory.length < minDataPoints) return;
    
    const currentIndex = getCurrentVolatilityIndex();
    const dataPoints = botState.indexType === '1s' ? 60 : 30; // More data for 1s analysis
    const prices = botState.priceHistory.slice(-dataPoints).map(p => p.price);
    
    // Calculate technical indicators
    const sma5 = calculateSMA(prices.slice(-5));
    const sma10 = calculateSMA(prices.slice(-10));
    const sma20 = calculateSMA(prices.slice(-20));
    const rsi = calculateRSI(prices);
    const volatility = calculateVolatility(prices);
    const priceChange = ((botState.currentPrice - botState.lastPrice) / botState.lastPrice) * 100;
    
    // Adjust analysis sensitivity based on index type
    const volatilityThreshold = botState.indexType === '1s' ? 1.5 : 2.0;
    const priceChangeThreshold = botState.indexType === '1s' ? 0.05 : 0.1;
    
    // Market condition analysis
    const signals = {
        trend: sma5 > sma10 ? (sma10 > sma20 ? 'STRONG_BULLISH' : 'BULLISH') : 
               sma5 < sma10 ? (sma10 < sma20 ? 'STRONG_BEARISH' : 'BEARISH') : 'NEUTRAL',
        momentum: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
        volatilityState: volatility > volatilityThreshold ? 'HIGH' : volatility < 0.5 ? 'LOW' : 'NORMAL',
        priceAction: Math.abs(priceChange) > priceChangeThreshold ? 'STRONG_MOVE' : 'WEAK_MOVE'
    };
    
    // Generate trading signal based on confluence
    const signalStrength = calculateSignalStrength(signals, rsi, volatility);
    
    // Adjust signal threshold based on index type
    const strengthThreshold = botState.indexType === '1s' ? 80 : 75; // Higher threshold for 1s
    
    if (signalStrength > strengthThreshold && shouldGenerateSignal()) {
        generateRealTradingSignal(signals, signalStrength, {
            rsi,
            volatility,
            sma5,
            sma10,
            sma20,
            priceChange
        });
    }
}

// Rest of the functions remain the same but with proper symbol handling...
function calculateSMA(prices) {
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

function calculateRSI(prices, period = 14) {
    if (prices.length < period) return 50;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100;
}

function calculateSignalStrength(signals, rsi, volatility) {
    let strength = 50;
    
    // Trend strength
    if (signals.trend === 'STRONG_BULLISH' || signals.trend === 'STRONG_BEARISH') strength += 20;
    else if (signals.trend === 'BULLISH' || signals.trend === 'BEARISH') strength += 10;
    
    // RSI divergence
    if (signals.momentum === 'OVERSOLD' && signals.trend.includes('BULLISH')) strength += 15;
    if (signals.momentum === 'OVERBOUGHT' && signals.trend.includes('BEARISH')) strength += 15;
    
    // Volatility confirmation
    if (signals.volatilityState === 'HIGH' && signals.priceAction === 'STRONG_MOVE') strength += 10;
    
    // Penalty for low volatility
    if (signals.volatilityState === 'LOW') strength -= 20;
    
    // Extra requirements for 1s indices
    if (botState.indexType === '1s') {
        if (signals.priceAction !== 'STRONG_MOVE') strength -= 10;
    }
    
    return Math.max(0, Math.min(100, strength));
}

function shouldGenerateSignal() {
    // Adjust frequency based on index type
    const minInterval = botState.indexType === '1s' ? 180000 : 300000; // 3min for 1s, 5min for regular
    
    if (botState.performance.lastSignalTime) {
        const timeSinceLastSignal = Date.now() - botState.performance.lastSignalTime;
        if (timeSinceLastSignal < minInterval) return false;
    }
    
    return true;
}

function generateRealTradingSignal(signals, strength, indicators) {
    const currentIndex = getCurrentVolatilityIndex();
    const direction = signals.trend.includes('BULLISH') ? 'BULLISH' : 'BEARISH';
    const entryPrice = botState.currentPrice;
    
    const signal = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        symbol: botState.currentVol,
        volatility: currentIndex.name,
        indexType: botState.indexType,
        direction: direction,
        entryPrice: entryPrice.toFixed(5),
        stopLoss: direction === 'BULLISH' ? 
            (entryPrice - currentIndex.stopLoss).toFixed(5) : 
            (entryPrice + currentIndex.stopLoss).toFixed(5),
        takeProfit: direction === 'BULLISH' ? 
            (entryPrice + currentIndex.takeProfit).toFixed(5) : 
            (entryPrice - currentIndex.takeProfit).toFixed(5),
        confidence: Math.floor(strength),
        riskPercent: currentIndex.riskPercent,
        riskReward: `1:${(currentIndex.takeProfit / currentIndex.stopLoss).toFixed(1)}`,
        frequency: currentIndex.frequency,
        technicals: {
            rsi: indicators.rsi.toFixed(1),
            volatility: indicators.volatility.toFixed(2),
            trend: signals.trend,
            momentum: signals.momentum
        },
        reason: determineSignalReason(signals, indicators),
        spread: botState.marketData.spread.toFixed(5),
        marketTime: botState.marketData.timestamp.toISOString()
    };
    
    // Update state
    botState.signals.unshift(signal);
    if (botState.signals.length > 50) {
        botState.signals = botState.signals.slice(0, 50);
    }
    botState.performance.lastSignalTime = Date.now();
    
    // Send to Telegram
    sendAdvancedTelegramSignal(signal);
    
    console.log(`🎯 REAL SIGNAL: ${direction} on ${currentIndex.name} (${currentIndex.frequency}) at ${entryPrice}`);
    
    return signal;
}

function determineSignalReason(signals, indicators) {
    const reasons = [];
    
    if (signals.trend === 'STRONG_BULLISH' || signals.trend === 'STRONG_BEARISH') {
        reasons.push('Strong Trend Confirmed');
    }
    
    if (signals.momentum === 'OVERSOLD' && signals.trend.includes('BULLISH')) {
        reasons.push('RSI Oversold + Bullish Trend');
    }
    
    if (signals.momentum === 'OVERBOUGHT' && signals.trend.includes('BEARISH')) {
        reasons.push('RSI Overbought + Bearish Trend');
    }
    
    if (signals.volatilityState === 'HIGH') {
        reasons.push('High Volatility Breakout');
    }
    
    if (botState.indexType === '1s' && signals.priceAction === 'STRONG_MOVE') {
        reasons.push('1s Scalping Opportunity');
    }
    
    return reasons.length > 0 ? reasons.join(' + ') : 'Technical Confluence';
}

async function sendAdvancedTelegramSignal(signal) {
    if (!bot || !TELEGRAM_CHAT_ID) return;
    
    const message = `
🚨 *LIVE TRADING SIGNAL* 🚨

📊 *${signal.volatility}*
⚡ *Update Frequency:* ${signal.frequency}
🎯 *Direction:* ${signal.direction}
💰 *Entry:* ${signal.entryPrice}
🛡️ *Stop Loss:* ${signal.stopLoss}
🎯 *Take Profit:* ${signal.takeProfit}
📈 *Risk/Reward:* ${signal.riskReward}
⚡ *Confidence:* ${signal.confidence}%

📋 *Technical Analysis:*
• RSI: ${signal.technicals.rsi}
• Volatility: ${signal.technicals.volatility}%
• Trend: ${signal.technicals.trend}
• Momentum: ${signal.technicals.momentum}

💡 *Reason:* ${signal.reason}
📊 *Spread:* ${signal.spread}
⏰ *Time:* ${new Date(signal.timestamp).toLocaleTimeString()}

*🔴 LIVE ${signal.indexType.toUpperCase()} DATA - Risk: ${signal.riskPercent}% max*

_Execute manually on Deriv platform_
    `;
    
    try {
        await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log('📱 Advanced Telegram signal sent successfully');
    } catch (error) {
        console.error('❌ Telegram send error:', error);
    }
}

function getCurrentVolatilityIndex() {
    // Find current index from the mapping
    for (const type of ['1s', 'regular']) {
        for (const vol of Object.values(volatilityIndices[type])) {
            if (vol.symbol === botState.currentVol) {
                return vol;
            }
        }
    }
    // Fallback
    return volatilityIndices['1s'][75];
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        isRunning: botState.isRunning,
        isConnectedToDerivs: isConnectedToDerivs,
        currentVol: botState.currentVol,
        indexType: botState.indexType,
        currentPrice: botState.currentPrice.toFixed(5),
        lastUpdate: botState.marketData.timestamp,
        signalsToday: botState.signals.filter(s => 
            new Date(s.timestamp).toDateString() === new Date().toDateString()
        ).length,
        performance: botState.performance,
        marketData: botState.marketData
    });
});

app.post('/api/start', (req, res) => {
    if (!isConnectedToDerivs) {
        return res.status(400).json({ 
            success: false, 
            message: 'Not connected to Deriv. Please wait for connection.' 
        });
    }
    
    botState.isRunning = true;
    res.json({ success: true, message: `Bot started with LIVE ${botState.indexType} data` });
});

app.post('/api/stop', (req, res) => {
    botState.isRunning = false;
    res.json({ success: true, message: 'Bot stopped' });
});

app.post('/api/set-volatility', (req, res) => {
    const { volatility, type } = req.body; // e.g., {volatility: 75, type: '1s'}
    
    const indexType = type || botState.indexType;
    const volIndex = volatilityIndices[indexType] && volatilityIndices[indexType][volatility];
    
    if (volIndex) {
        // Unsubscribe from current
        if (derivWS && derivWS.readyState === WebSocket.OPEN) {
            derivWS.send(JSON.stringify({
                forget_all: "ticks"
            }));
        }
        
        // Update and subscribe to new
        botState.currentVol = volIndex.symbol;
        botState.indexType = indexType;
        setTimeout(() => subscribeToVolatilityIndex(volIndex.symbol), 1000);
        
        res.json({ 
            success: true, 
            message: `Switched to ${volIndex.name}`,
            symbol: volIndex.symbol,
            type: indexType
        });
    } else {
        res.status(400).json({ success: false, message: 'Invalid volatility level or type' });
    }
});

app.get('/api/signals', (req, res) => {
    res.json(botState.signals.slice(0, 20));
});

app.get('/api/available-indices', (req, res) => {
    res.json(volatilityIndices);
});

app.post('/api/telegram-test', async (req, res) => {
    if (!bot || !TELEGRAM_CHAT_ID) {
        return res.status(400).json({ 
            success: false, 
            message: 'Telegram not configured' 
        });
    }
    
    try {
        const currentIndex = getCurrentVolatilityIndex();
        const testMessage = `
🤖 *TEST MESSAGE*

✅ Bot connected to LIVE Deriv data
📊 Current Index: ${currentIndex.name}
⚡ Update Frequency: ${currentIndex.frequency}
💰 Current Price: ${botState.currentPrice.toFixed(5)}
🔗 Connection: ${isConnectedToDerivs ? 'LIVE' : 'DISCONNECTED'}

Ready to send real ${botState.indexType} trading signals!
        `;
        
        await bot.sendMessage(TELEGRAM_CHAT_ID, testMessage, { parse_mode: 'Markdown' });
        res.json({ success: true, message: 'Test message sent with live data' });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize Deriv connection on startup
connectToDerivAPI();

app.listen(PORT, () => {
    console.log(`🚀 CORRECTED Volatility Bot server running on port ${PORT}`);
    console.log(`📊 Default: Vol 75 (1s) - Symbol: ${botState.currentVol}`);
    console.log(`📱 Telegram Bot: ${TELEGRAM_TOKEN ? 'Configured' : 'Not configured'}`);
});
```

### **File 3: `public/index.html`** (Updated UI)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Corrected Volatility Bot - Regular vs 1s</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; min-height: 100vh; padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            text-align: center; margin-bottom: 30px; padding: 30px;
            background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(20px);
            border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .type-selector {
            display: flex; justify-content: center; gap: 15px;
            margin-bottom: 20px; flex-wrap: wrap;
        }
        .type-option {
            padding: 15px 25px; border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px; background: rgba(255, 255, 255, 0.1);
            cursor: pointer; color: white; font-weight: 600;
            transition: all 0.3s ease; text-align: center;
        }
        .type-option.active { border-color: #4ade80; background: rgba(74, 222, 128, 0.2); }
        .type-option:hover { border-color: #4ade80; }
        .vol-selector { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .vol-option {
            padding: 10px 15px; border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px; background: rgba(255, 255, 255, 0.1);
            cursor: pointer; color: white; font-weight: 600; transition: all 0.3s ease;
        }
        .vol-option.active { border-color: #4ade80; background: rgba(74, 222, 128, 0.2); }
        .vol-option:hover { border-color: #4ade80; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .panel {
            background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(20px);
            border-radius: 15px; padding: 25px; border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .btn {
            padding: 12px 24px; border: none; border-radius: 8px;
            font-weight: 600; cursor: pointer; margin: 5px;
            background: linear-gradient(45deg, #4f46e5, #7c3aed); color: white;
            transition: all 0.3s ease;
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(79, 70, 229, 0.4); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; }
        .stat { 
            text-align: center; padding: 15px; 
            background: rgba(255, 255, 255, 0.1); border-radius: 10px; 
        }
        .stat-value { font-size: 1.4em; font-weight: 700; margin-top: 5px; }
        .profit { color: #4ade80; }
        .loss { color: #f87171; }
        .neutral { color: #fbbf24; }
        .connection-status {
            display: flex; align-items: center; gap: 10px;
            padding: 15px; background: rgba(255, 255, 255, 0.1);
            border-radius: 10px; margin-bottom: 20px;
        }
        .status-dot {
            width: 12px; height: 12px; border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .connected { background: #4ade80; }
        .disconnected { background: #f87171; }
        .signal-card {
            background: rgba(255, 255, 255, 0.1); padding: 20px;
            border-radius: 10px; margin-bottom: 15px;
            border-left: 4px solid #4ade80;
        }
        .signal-card.BEARISH { border-left-color: #f87171; }
        .technical-info {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px; margin-top: 10px; font-size: 0.9em;
        }
        .technical-item {
            background: rgba(0, 0, 0, 0.2); padding: 8px;
            border-radius: 5px; text-align: center;
        }
        .price-display {
            font-size: 2em; font-weight: bold; text-align: center;
            padding: 20px; background: rgba(0, 0, 0, 0.3);
            border-radius: 10px; margin-bottom: 20px;
        }
        .index-info {
            background: rgba(0, 0, 0, 0.2); padding: 15px;
            border-radius: 10px; margin-bottom: 15px;
        }
        .frequency-badge {
            display: inline-block; padding: 4px 8px;
            background: rgba(74, 222, 128, 0.2); border-radius: 4px;
            font-size: 0.8em; margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Corrected Volatility Bot</h1>
            <p>Regular vs 1-Second Indices • Real Deriv Data</p>
        </div>

        <div class="panel">
            <h3>⚙️ Index Type Selection</h3>
            <div class="type-selector">
                <div class="type-option" onclick="setIndexType('regular')" id="regular-option">
                    <div><strong>Regular Volatility</strong></div>
                    <small>Updates every ~2 seconds</small><br>
                    <small>Better for swing trading</small>
                </div>
                <div class="type-option active" onclick="setIndexType('1s')" id="1s-option">
                    <div><strong>1-Second Volatility</strong></div>
                    <small>Updates every 1 second</small><br>
                    <small>Perfect for scalping</small>
                </div>
            </div>
            
            <div class="vol-selector">
                <div class="vol-option" onclick="setVolatility(10)">Vol 10</div>
                <div class="vol-option" onclick="setVolatility(25)">Vol 25</div>
                <div class="vol-option" onclick="setVolatility(50)">Vol 50</div>
                <div class="vol-option active" onclick="setVolatility(75)">Vol 75</div>
                <div class="vol-option" onclick="setVolatility(100)">Vol 100</div>
            </div>
        </div>

        <div class="panel connection-status">
            <div class="status-dot disconnected" id="connectionDot"></div>
            <div>
                <strong id="connectionText">Connecting to Deriv...</strong>
                <br><small id="connectionDetails">Establishing real-time data connection</small>
            </div>
        </div>

        <div class="grid">
            <div class="panel">
                <h3>🎛️ Trading Control</h3>
                <div class="index-info">
                    <div><strong>Current Index:</strong> <span id="currentIndex">Loading...</span></div>
                    <div><strong>Symbol:</strong> <span id="currentSymbol">-</span></div>
                    <div><strong>Update Frequency:</strong> <span id="updateFreq">-</span></div>
                </div>
                <button class="btn" onclick="startBot()" id="startBtn">🚀 Start Analysis</button>
                <button class="btn" onclick="stopBot()" id="stopBtn">⏹️ Stop Bot</button>
                <button class="btn" onclick="testTelegram()">📱 Test Telegram</button>
            </div>

            <div class="panel">
                <h3>💹 Live Market Data</h3>
                <div class="price-display">
                    <div style="font-size: 0.6em; opacity: 0.8;">Current Price</div>
                    <div id="livePrice">Connecting...</div>
                </div>
                <div class="stats">
                    <div class="stat">
                        <div>Type</div>
                        <div class="stat-value" id="indexType">1s</div>
                    </div>
                    <div class="stat">
                        <div>Spread</div>
                        <div class="stat-value" id="spread">-</div>
                    </div>
                    <div class="stat">
                        <div>Last Update</div>
                        <div class="stat-value" id="lastUpdate">-</div>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h3>📊 Bot Status</h3>
                <div class="stats">
                    <div class="stat">
                        <div>Bot Status</div>
                        <div class="stat-value neutral" id="botStatus">READY</div>
                    </div>
                    <div class="stat">
                        <div>Signals Today</div>
                        <div class="stat-value" id="signalsCount">0</div>
                    </div>
                    <div class="stat">
                        <div>Data Quality</div>
                        <div class="stat-value profit" id="dataQuality">LIVE</div>
                    </div>
                    <div class="stat">
                        <div>Analysis Mode</div>
                        <div class="stat-value" id="analysisMode">REAL-TIME</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="panel">
            <h3>🎯 Live Trading Signals</h3>
            <div id="signals-list">
                <p>🔄 Starting real-time analysis... Signals will appear when high-confidence conditions are met.</p>
            </div>
        </div>

        <div class="panel">
            <h3>📈 Technical Analysis</h3>
            <div id="technicalAnalysis">
                <p>📊 Technical indicators will display when sufficient data is collected...</p>
            </div>
        </div>
    </div>

    <script>
        let currentVol = 75;
        let currentIndexType = '1s';
        let isConnected = false;
        let updateInterval;

        function setIndexType(type) {
            currentIndexType = type;
            document.querySelectorAll('.type-option').forEach(el => el.classList.remove('active'));
            document.getElementById(type + '-option').classList.add('active');
            
            // Update the volatility selection
            setVolatility(currentVol);
        }

        function setVolatility(vol) {
            currentVol = vol;
            document.querySelectorAll('.vol-option').forEach(el => el.classList.remove('active'));
            event.target.classList.add('active');
            
            fetch('/api/set-volatility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ volatility: vol, type: currentIndexType })
            }).then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('currentSymbol').textContent = data.symbol;
                    document.getElementById('indexType').textContent = data.type;
                    addSystemMessage(`📊 Switched to ${data.message.split(' to ')[1]}`);
                    updateIndexInfo();
                }
            });
        }

        async function updateIndexInfo() {
            try {
                const response = await fetch('/api/available-indices');
                const indices = await response.json();
                
                const currentIndex = indices[currentIndexType][currentVol];
                if (currentIndex) {
                    document.getElementById('currentIndex').textContent = currentIndex.name;
                    document.getElementById('updateFreq').textContent = currentIndex.frequency;
                }
            } catch (error) {
                console.error('Failed to update index info:', error);
            }
        }

        async function startBot() {
            try {
                const response = await fetch('/api/start', { method: 'POST' });
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('botStatus').textContent = 'RUNNING';
                    document.getElementById('botStatus').className = 'stat-value profit';
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('stopBtn').disabled = false;
                    addSystemMessage('🚀 Bot started with LIVE ' + currentIndexType + ' data analysis');
                } else {
                    alert(result.message);
                }
            } catch (error) {
                alert('Error starting bot: ' + error.message);
            }
        }

        async function stopBot() {
            const response = await fetch('/api/stop', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('botStatus').textContent = 'STOPPED';
                document.getElementById('botStatus').className = 'stat-value loss';
                document.getElementById('startBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
                addSystemMessage('⏹️ Bot stopped');
            }
        }

        async function testTelegram() {
            try {
                const response = await fetch('/api/telegram-test', { method: 'POST' });
                const result = await response.json();
                alert(result.message);
            } catch (error) {
                alert('Telegram test failed: ' + error.message);
            }
        }

        function startUpdates() {
            updateInterval = setInterval(async () => {
                await updateStatus();
                await updateSignals();
            }, 2000);
        }

        async function updateStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                // Update connection status
                const dot = document.getElementById('connectionDot');
                const text = document.getElementById('connectionText');
                const details = document.getElementById('connectionDetails');
                
                if (data.isConnectedToDerivs) {
                    dot.className = 'status-dot connected';
                    text.textContent = 'Connected to Deriv API';
                    details.textContent = `Live ${data.indexType} data from ${data.currentVol} • Last: ${data.lastUpdate ? new Date(data.lastUpdate).toLocaleTimeString() : 'No data'}`;
                    isConnected = true;
                } else {
                    dot.className = 'status-dot disconnected';
                    text.textContent = 'Connecting to Deriv...';
                    details.textContent = 'Establishing WebSocket connection';
                    isConnected = false;
                }
                
                // Update other stats
                document.getElementById('signalsCount').textContent = data.signalsToday;
                document.getElementById('botStatus').textContent = data.isRunning ? 'RUNNING' : 'READY';
                document.getElementById('botStatus').className = `stat-value ${data.isRunning ? 'profit' : 'neutral'}`;
                document.getElementById('indexType').textContent = data.indexType;
                
                if (data.currentPrice > 0) {
                    document.getElementById('livePrice').textContent = data.currentPrice;
                    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                }
                
                if (data.marketData && data.marketData.spread) {
                    document.getElementById('spread').textContent = data.marketData.spread.toFixed(5);
                }
                
            } catch (error) {
                console.error('Status update failed:', error);
            }
        }

        async function updateSignals() {
            try {
                const response = await fetch('/api/signals');
                const signals = await response.json();
                
                const signalsList = document.getElementById('signals-list');
                
                if (signals.length === 0) {
                    signalsList.innerHTML = '<p>🔍 Analyzing market conditions... Waiting for high-confidence signals.</p>';
                    return;
                }
                
                signalsList.innerHTML = '';
                signals.slice(0, 10).forEach(signal => {
                    const signalCard = document.createElement('div');
                    signalCard.className = `signal-card ${signal.direction}`;
                    
                    const timeAgo = getTimeAgo(new Date(signal.timestamp));
                    
                    signalCard.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                <strong>${signal.volatility}</strong>
                                <span class="frequency-badge">${signal.frequency}</span>
                            </div>
                            <span style="font-size: 0.9em; opacity: 0.8;">${timeAgo}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px;">
                            <div><strong>Direction:</strong> ${signal.direction}</div>
                            <div><strong>Entry:</strong> ${signal.entryPrice}</div>
                            <div><strong>Stop Loss:</strong> ${signal.stopLoss}</div>
                            <div><strong>Take Profit:</strong> ${signal.takeProfit}</div>
                            <div><strong>Confidence:</strong> ${signal.confidence}%</div>
                            <div><strong>R/R:</strong> ${signal.riskReward}</div>
                        </div>
                        ${signal.technicals ? `
                        <div class="technical-info">
                            <div class="technical-item">
                                <div>RSI</div>
                                <div>${signal.technicals.rsi}</div>
                            </div>
                            <div class="technical-item">
                                <div>Volatility</div>
                                <div>${signal.technicals.volatility}%</div>
                            </div>
                            <div class="technical-item">
                                <div>Trend</div>
                                <div>${signal.technicals.trend}</div>
                            </div>
                            <div class="technical-item">
                                <div>Momentum</div>
                                <div>${signal.technicals.momentum}</div>
                            </div>
                        </div>
                        ` : ''}
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                            <strong>Reason:</strong> ${signal.reason}
                        </div>
                    `;
                    
                    signalsList.appendChild(signalCard);
                });
                
            } catch (error) {
                console.error('Signals update failed:', error);
            }
        }

        function getTimeAgo(date) {
            const now = new Date();
            const diffInMinutes = Math.floor((now - date) / (1000 * 60));
            
            if (diffInMinutes < 1) return 'Just now';
            if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
            
            const diffInHours = Math.floor(diffInMinutes / 60);
            if (diffInHours < 24) return `${diffInHours}h ago`;
            
            const diffInDays = Math.floor(diffInHours / 24);
            return `${diffInDays}d ago`;
        }

        function addSystemMessage(message) {
            console.log(`[SYSTEM] ${message}`);
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            updateStatus();
            updateIndexInfo();
            startUpdates();
            
            // Set default selections
            setIndexType('1s');
            setVolatility(75);
            
            // Initial button states
            document.getElementById('stopBtn').disabled = true;
            
            console.log('🚀 Corrected Volatility Bot initialized');
            console.log('📊 Default: Vol 75 (1s) - Symbol: 1HZ75V');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(event) {
            if (event.ctrlKey) {
                switch(event.key) {
                    case '1':
                        event.preventDefault();
                        startBot();
                        break;
                    case '2':
                        event.preventDefault();
                        stopBot();
                        break;
                    case 't':
                        event.preventDefault();
                        testTelegram();
                        break;
                    case 'r':
                        event.preventDefault();
                        setIndexType('regular');
                        break;
                    case 's':
                        event.preventDefault();
                        setIndexType('1s');
                        break;
                }
            }
        });

        // Auto-refresh connection status
        setInterval(() => {
            if (!isConnected) {
                updateStatus();
            }
        }, 5000);
    </script>
</body>
</html>
```

---

## 🎯 **PERFECT! Now You Have the CORRECT System**

### **Key Differences Fixed:**

**Regular Volatility Indices:**
- ✅ **Vol 10:** `R_10` (updates ~every 2 seconds)
- ✅ **Vol 25:** `R_25` (updates ~every 2 seconds)  
- ✅ **Vol 75:** `R_75` (updates ~every 2 seconds)

**1-Second Volatility Indices:**
- ✅ **Vol 10 (1s):** `1HZ10V` (updates every 1 second)
- ✅ **Vol 25 (1s):** `1HZ25V` (updates every 1 second)
- ✅ **Vol 75 (1s):** `1HZ75V` (updates every 1 second) ← **What you wanted!**

### **🔥 What's New:**

1. **Dual Mode Interface:**
   - Toggle between Regular and 1-Second indices
   - Clear frequency indicators
   - Optimized settings for each type

2. **Smart Parameter Adjustment:**
   - **1s indices:** Tighter stops, faster signals, higher frequency
   - **Regular indices:** Wider stops, less frequent signals, swing focus

3. **Enhanced Telegram Signals:**
   ```
   🚨 LIVE TRADING SIGNAL 🚨
   
   📊 Volatility 75 (1s) Index
   ⚡ Update Frequency: 1s
   🎯 Direction: BULLISH
   💰 Entry: 4,125.50431
   🛡️ Stop Loss: 4,025.50431
   🎯 Take Profit: 4,375.50431
   ```

4. **Correct Symbol Usage:**
   - **Defaults to Vol 75 (1s)** = `1HZ75V`
   - **Real-time connection** to proper Deriv symbols
   - **Automatic fallback** if 1s not available

### **🚀 Deploy This Version:**

1. **Copy these 3 corrected files**
2. **Upload to GitHub**
3. **Deploy to Render**
4. **Setup Telegram**
5. **Start trading with REAL Vol 75 (1s) data!**

### **💡 Pro Tips:**

**For Vol 75 (1s) Trading:**
- **Tighter stops:** 100-point stops vs 150 for regular
- **Faster signals:** 3-minute gaps vs 5-minute for regular
- **Higher frequency:** More opportunities per day
- **Scalping focus:** Perfect for quick in-and-out trades

**Your system will now:**
- ✅ **Connect to 1HZ75V** (Vol 75 1s)
- ✅ **Update every 1 second** with real prices
- ✅ **Generate optimized signals** for 1s trading
- ✅ **Send proper Telegram alerts** with frequency info

**Ready to deploy the CORRECT version?** This will give you exactly what you asked for - Vol 75 (1s) with 1-second updates!
