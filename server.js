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
    currentVol: '1HZ75V',
    indexType: '1s',
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
    }
};

// CORRECTED Deriv volatility indices mapping
const volatilityIndices = {
    regular: {
        10: { symbol: 'R_10', name: 'Volatility 10 Index', stopLoss: 30, takeProfit: 75, riskPercent: 1, frequency: '~2s' },
        25: { symbol: 'R_25', name: 'Volatility 25 Index', stopLoss: 50, takeProfit: 125, riskPercent: 1.5, frequency: '~2s' },
        50: { symbol: 'R_50', name: 'Volatility 50 Index', stopLoss: 100, takeProfit: 250, riskPercent: 2, frequency: '~2s' },
        75: { symbol: 'R_75', name: 'Volatility 75 Index', stopLoss: 150, takeProfit: 375, riskPercent: 2.5, frequency: '~2s' },
        100: { symbol: 'R_100', name: 'Volatility 100 Index', stopLoss: 250, takeProfit: 625, riskPercent: 3, frequency: '~2s' }
    },
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
        
        subscribeToVolatilityIndex(botState.currentVol);
        
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
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
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
    
    derivWS.send(JSON.stringify({
        forget_all: "ticks"
    }));
    
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
    if (response.tick) {
        const tick = response.tick;
        
        botState.lastPrice = botState.currentPrice;
        botState.currentPrice = parseFloat(tick.quote);
        botState.marketData = {
            bid: parseFloat(tick.bid || tick.quote),
            ask: parseFloat(tick.ask || tick.quote),
            spread: Math.abs((tick.ask || tick.quote) - (tick.bid || tick.quote)),
            timestamp: new Date(tick.epoch * 1000),
            symbol: tick.symbol
        };
        
        botState.priceHistory.push({
            price: botState.currentPrice,
            timestamp: botState.marketData.timestamp
        });
        
        const maxHistory = botState.indexType === '1s' ? 300 : 150;
        if (botState.priceHistory.length > maxHistory) {
            botState.priceHistory = botState.priceHistory.slice(-maxHistory);
        }
        
        if (botState.isRunning) {
            analyzeRealMarket();
        }
    }
    
    if (response.msg_type === 'tick') {
        const currentIndex = getCurrentVolatilityIndex();
        console.log(`✅ Successfully subscribed to ${response.echo_req.ticks} (${currentIndex.name})`);
    }
    
    if (response.error) {
        console.error('❌ Deriv API Error:', response.error.message);
        
        if (response.error.code === 'InvalidSymbol') {
            console.log('🔄 Invalid symbol, trying fallback...');
            if (botState.indexType === '1s') {
                botState.indexType = 'regular';
                botState.currentVol = 'R_75';
                setTimeout(() => subscribeToVolatilityIndex('R_75'), 2000);
            }
        }
    }
}

function analyzeRealMarket() {
    const minDataPoints = botState.indexType === '1s' ? 30 : 20;
    if (botState.priceHistory.length < minDataPoints) return;
    
    const currentIndex = getCurrentVolatilityIndex();
    const dataPoints = botState.indexType === '1s' ? 60 : 30;
    const prices = botState.priceHistory.slice(-dataPoints).map(p => p.price);
    
    const sma5 = calculateSMA(prices.slice(-5));
    const sma10 = calculateSMA(prices.slice(-10));
    const sma20 = calculateSMA(prices.slice(-20));
    const rsi = calculateRSI(prices);
    const volatility = calculateVolatility(prices);
    const priceChange = ((botState.currentPrice - botState.lastPrice) / botState.lastPrice) * 100;
    
    const volatilityThreshold = botState.indexType === '1s' ? 1.5 : 2.0;
    const priceChangeThreshold = botState.indexType === '1s' ? 0.05 : 0.1;
    
    const signals = {
        trend: sma5 > sma10 ? (sma10 > sma20 ? 'STRONG_BULLISH' : 'BULLISH') : 
               sma5 < sma10 ? (sma10 < sma20 ? 'STRONG_BEARISH' : 'BEARISH') : 'NEUTRAL',
        momentum: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
        volatilityState: volatility > volatilityThreshold ? 'HIGH' : volatility < 0.5 ? 'LOW' : 'NORMAL',
        priceAction: Math.abs(priceChange) > priceChangeThreshold ? 'STRONG_MOVE' : 'WEAK_MOVE'
    };
    
    const signalStrength = calculateSignalStrength(signals, rsi, volatility);
    const strengthThreshold = botState.indexType === '1s' ? 80 : 75;
    
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
    
    if (signals.trend === 'STRONG_BULLISH' || signals.trend === 'STRONG_BEARISH') strength += 20;
    else if (signals.trend === 'BULLISH' || signals.trend === 'BEARISH') strength += 10;
    
    if (signals.momentum === 'OVERSOLD' && signals.trend.includes('BULLISH')) strength += 15;
    if (signals.momentum === 'OVERBOUGHT' && signals.trend.includes('BEARISH')) strength += 15;
    
    if (signals.volatilityState === 'HIGH' && signals.priceAction === 'STRONG_MOVE') strength += 10;
    
    if (signals.volatilityState === 'LOW') strength -= 20;
    
    if (botState.indexType === '1s') {
        if (signals.priceAction !== 'STRONG_MOVE') strength -= 10;
    }
    
    return Math.max(0, Math.min(100, strength));
}

function shouldGenerateSignal() {
    const minInterval = botState.indexType === '1s' ? 180000 : 300000;
    
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
    
    botState.signals.unshift(signal);
    if (botState.signals.length > 50) {
        botState.signals = botState.signals.slice(0, 50);
    }
    botState.performance.lastSignalTime = Date.now();
    
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
    for (const type of ['1s', 'regular']) {
        for (const vol of Object.values(volatilityIndices[type])) {
            if (vol.symbol === botState.currentVol) {
                return vol;
            }
        }
    }
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
    const { volatility, type } = req.body;
    
    const indexType = type || botState.indexType;
    const volIndex = volatilityIndices[indexType] && volatilityIndices[indexType][volatility];
    
    if (volIndex) {
        if (derivWS && derivWS.readyState === WebSocket.OPEN) {
            derivWS.send(JSON.stringify({
                forget_all: "ticks"
            }));
        }
        
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        derivConnection: isConnectedToDerivs,
        botRunning: botState.isRunning,
        timestamp: new Date().toISOString()
    });
});

// Initialize Deriv connection on startup
connectToDerivAPI();

app.listen(PORT, () => {
    console.log(`🚀 CORRECTED Volatility Bot server running on port ${PORT}`);
    console.log(`📊 Default: Vol 75 (1s) - Symbol: ${botState.currentVol}`);
    console.log(`📱 Telegram Bot: ${TELEGRAM_TOKEN ? 'Configured' : 'Not configured'}`);
}); no
