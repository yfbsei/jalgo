import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import jAlgo from 'j-algo-core';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

/**
 * Discord webhook configuration for different message types
 */
const DISCORD_WEBHOOKS = {
  SIGNALS: process.env.DISCORD_WEBHOOK_SIGNALS || process.env.DISCORD_WEBHOOK,
  TRADE_EXITS: process.env.DISCORD_WEBHOOK_EXITS || process.env.DISCORD_WEBHOOK,
  STATS: process.env.DISCORD_WEBHOOK_STATS || process.env.DISCORD_WEBHOOK
};

/**
 * Default trading configuration
 */
const DEFAULT_CONFIG = {
  // Trading pair and market settings
  symbol: process.env.TRADING_PAIR || "BTCUSDT",
  interval: process.env.TIMEFRAME || "5m",
  isFutures: process.env.MARKET_TYPE === "futures",
  
  // Algorithm parameters
  fastLength: parseInt(process.env.FAST_LENGTH || "6"),
  ATRPeriod: parseInt(process.env.ATR_PERIOD || "16"),
  ATRMultiplier: parseFloat(process.env.ATR_MULTIPLIER || "9"),
  ATRMultiplierFast: parseFloat(process.env.ATR_MULTIPLIER_FAST || "5.1"),
  
  // Scalp mode parameters
  scalpPeriod: parseInt(process.env.SCALP_PERIOD || "21"),
  
  // Risk-reward parameters
  rewardMultiple: parseFloat(process.env.REWARD_MULTIPLE || "1.5"),
  initialCapital: parseFloat(process.env.INITIAL_CAPITAL || "100"),
  riskPerTrade: parseFloat(process.env.RISK_PER_TRADE || "10"),
  
  // Leverage parameters
  useLeverage: process.env.USE_LEVERAGE === "true",
  leverageAmount: parseFloat(process.env.LEVERAGE_AMOUNT || "2.0"),
  
  // Backtesting parameter (set to false for live trading)
  isBacktest: false
};

/**
 * Fetch historical klines (candlestick) data from Binance
 * 
 * @param {string} symbol - Trading pair (e.g., 'BTCUSDT')
 * @param {string} interval - Kline interval (e.g., '1h', '4h', '1d')
 * @param {number} limit - Number of candles to fetch (max 1000 per request)
 * @param {boolean} isFutures - Whether to fetch from futures or spot market
 * @returns {Object} - Object containing OHLC arrays
 */
async function fetchBinanceData(symbol, interval, limit = 1000, isFutures = false) {
  try {
    // Choose the appropriate API endpoint
    const baseUrl = isFutures 
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';
    
    // Construct the URL with parameters
    const url = `${baseUrl}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    // Fetch data
    const response = await fetch(url);
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error(`Failed to fetch data: ${JSON.stringify(data)}`);
    }
    
    // Format the data into OHLC format
    const formattedData = {
      openTime: data.map(d => d[0]),
      open: data.map(d => parseFloat(d[1])),
      high: data.map(d => parseFloat(d[2])),
      low: data.map(d => parseFloat(d[3])),
      close: data.map(d => parseFloat(d[4])),
      volume: data.map(d => parseFloat(d[5])),
      closeTime: data.map(d => d[6])
    };
    
    return formattedData;
  } catch (error) {
    console.error('Error fetching data from Binance:', error);
    throw error;
  }
}

/**
 * Create and send a statistics panel to Discord as a rich embed
 * 
 * @param {Object} state - Current state from jAlgo
 * @param {Object} stats - Statistics data from jAlgo
 * @param {Object} config - Configuration object
 * @param {string} webhookUrl - Discord webhook URL
 */
async function sendStatsPanel(state, stats, config, webhookUrl) {
  try {
    // Calculate total trades
    const totalLongTrades = stats.totalLongTrades;
    const totalShortTrades = stats.totalShortTrades;
    const totalTrades = totalLongTrades + totalShortTrades;
    
    // Format colors for profit/loss visualization
    const profitColor = state.totalProfitLoss >= 0 ? 0x00FF00 : 0xFF0000; // Green or Red
    
    // Create a rich embed with all stats
    const embed = {
      username: 'J-algo',
      avatar_url: 'https://raw.githubusercontent.com/yfbsei/J-algo-app/refs/heads/main/static/images/jalgo-app-logo.png',
      embeds: [{
        title: `Stats Panel - ${config.symbol} ${config.interval}`,
        color: profitColor,
        description: `Trading statistics for ${config.symbol} ${config.interval} on ${config.isFutures ? 'Futures' : 'Spot'}`,
        fields: [
          // Trade signals section
          { name: 'Long Signals', value: totalLongTrades.toString(), inline: true },
          { name: 'Short Signals', value: totalShortTrades.toString(), inline: true },
          { name: 'Total Signals', value: totalTrades.toString(), inline: true },
          
          // Performance section
          { name: 'Successful Longs', value: state.longWins.toString(), inline: true },
          { name: 'Successful Shorts', value: state.shortWins.toString(), inline: true },
          { name: 'Overall Win %', value: `${stats.overallWinRate.toFixed(2)}%`, inline: true },
          
          // Target hits section
          { name: 'Long Target Hits', value: state.longTargetHits.toString(), inline: true },
          { name: 'Short Target Hits', value: state.shortTargetHits.toString(), inline: true },
          { name: 'Total Target Hits', value: (state.longTargetHits + state.shortTargetHits).toString(), inline: true },
          
          // Capital and profit metrics
          { name: 'Initial Capital', value: `$${config.initialCapital.toFixed(2)}`, inline: true },
          { name: 'Current Capital', value: `$${state.currentCapital.toFixed(2)}`, inline: true },
          { name: 'Total P/L', value: `$${state.totalProfitLoss.toFixed(2)}`, inline: true },
          
          // More detailed metrics
          { name: 'Total Profit', value: `$${state.totalProfit.toFixed(2)}`, inline: true },
          { name: 'Total Loss', value: `$${state.totalLoss.toFixed(2)}`, inline: true },
          { name: 'Efficiency', value: `${stats.efficiency.toFixed(2)}%`, inline: true },
          
          // System settings
          { name: 'R:R Ratio', value: `1:${config.rewardMultiple}`, inline: true },
          { name: 'Risk Per Trade', value: `${config.riskPerTrade}%`, inline: true },
          { name: 'Leverage', value: config.useLeverage ? `${config.leverageAmount}x` : 'OFF', inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'J-algo Trading Bot'
        }
      }]
    };
    
    // Send to Discord
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(embed)
    });
    
    console.log(`Stats panel sent to Discord at ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error("Error creating or sending stats panel:", error);
  }
}

/**
 * Send trade signal, exit, or update to Discord
 * 
 * @param {Object} signal - Signal object
 * @param {Object} state - Current trading state
 * @param {string} webhookUrl - Discord webhook URL
 * @param {string} type - Signal type: 'entry', 'exit', 'update'
 */
async function sendSignal(signal, state, webhookUrl, type = 'entry') {
  try {
    let embed = {
      username: 'J-algo',
      avatar_url: 'https://raw.githubusercontent.com/yfbsei/J-algo-app/refs/heads/main/static/images/jalgo-app-logo.png',
      embeds: [{
        title: `${signal.symbol} ${signal.interval} - ${type.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        footer: {
          text: `J-algo - ${signal.isFutures ? 'Futures' : 'Spot'}`
        }
      }]
    };
    
    if (type === 'entry') {
      embed.embeds[0].color = signal.position === 'long' ? 0x00FF00 : 0xFF0000;
      embed.embeds[0].description = `
        **New ${signal.position.toUpperCase()} Signal**
        
        Entry: \`${signal.price.toFixed(2)}\`
        Stop Loss: \`${signal.stopLevel.toFixed(2)}\`
        Target: \`${signal.targetLevel.toFixed(2)}\`
        
        Risk: \`$${state.riskAmount.toFixed(2)}\` (${signal.config.riskPerTrade}% of capital)
        Potential Reward: \`$${(state.riskAmount * signal.config.rewardMultiple).toFixed(2)}\`
        
        Time: ${new Date().toLocaleString()}
      `;
    } else if (type === 'exit') {
      // Determine color based on profit/loss
      const isProfitable = signal.profitLoss > 0;
      embed.embeds[0].color = isProfitable ? 0x00FF00 : 0xFF0000;
      
      embed.embeds[0].description = `
        **${signal.position.toUpperCase()} Trade Exit - ${signal.reason}**
        
        Entry: \`${signal.entryPrice.toFixed(2)}\`
        Exit: \`${signal.exitPrice.toFixed(2)}\`
        
        P/L: \`${isProfitable ? '+' : ''}$${signal.profitLoss.toFixed(2)}\`
        Risk Amount: \`$${signal.riskedAmount.toFixed(2)}\`
        
        Current Capital: \`$${state.currentCapital.toFixed(2)}\`
        Total P/L: \`$${state.totalProfitLoss.toFixed(2)}\`
        
        Time: ${new Date().toLocaleString()}
      `;
    } else if (type === 'update') {
      embed.embeds[0].color = 0x999999;
      embed.embeds[0].description = `
        **Trade Update - ${signal.position.toUpperCase()}**
        
        Previous Stop Loss: \`${signal.previousStop.toFixed(2)}\`
        New Stop Loss: \`${signal.newStop.toFixed(2)}\`
        
        Entry: \`${signal.entryPrice.toFixed(2)}\`
        Target: \`${signal.targetLevel.toFixed(2)}\`
        
        Time: ${new Date().toLocaleString()}
      `;
    }
    
    // Send to Discord
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(embed)
    });
    
    console.log(`${type.toUpperCase()} signal sent to Discord at ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error(`Error sending ${type} signal to Discord:`, error);
  }
}

/**
 * LiveTrader class that handles live trading with Binance
 */
class LiveTrader {
  /**
   * Create a new LiveTrader instance
   * @param {Object} config - Trading configuration
   */
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.candles = null;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    
    // Trading state for jAlgo
    this.state = null;
    
    // Active trades tracking
    this.activeLongTrade = null;
    this.activeShortTrade = null;
    
    // Trade ID counter
    this.tradeIdCounter = 0;
    
    // Last candle timestamp to avoid duplicate processing
    this.lastCandleTime = 0;
  }
  
  /**
   * Generate a unique trade ID
   * @returns {string} - Unique trade ID
   */
  generateTradeId() {
    this.tradeIdCounter++;
    return `${this.config.symbol}-${Date.now()}-${this.tradeIdCounter}`;
  }
  
  /**
   * Initialize the trader and connect to market data
   */
  async initialize() {
    console.log(`Initializing J-algo Live Trader for ${this.config.symbol} ${this.config.interval} on Binance ${this.config.isFutures ? 'Futures' : 'Spot'}`);
    
    try {
      // Fetch initial candle data
      this.candles = await fetchBinanceData(
        this.config.symbol, 
        this.config.interval, 
        1000, // Fetch maximum allowed candles
        this.config.isFutures
      );
      
      console.log(`Initial data fetched: ${this.candles.close.length} candles`);
      
      // Initialize jAlgo with this data
      const initialResult = jAlgo(this.candles, null, this.config);
      this.state = initialResult.state;
      
      console.log(`Algorithm initialized. Ready to start trading.`);
      
      // Connect to WebSocket for real-time updates
      await this.connectWebSocket();
      
      // Send initial stats panel
      await sendStatsPanel(
        this.state, 
        initialResult.stats, 
        this.config, 
        DISCORD_WEBHOOKS.STATS
      );
      
      return true;
    } catch (error) {
      console.error("Failed to initialize LiveTrader:", error);
      return false;
    }
  }
  
  /**
   * Connect to the Binance WebSocket for real-time market data
   * @returns {Promise<boolean>} - Success status
   */
  async connectWebSocket() {
    return new Promise((resolve) => {
      try {
        // Determine the correct base URL based on market type
        const baseURL = this.config.isFutures ? "fstream" : "stream";
        const symbol = this.config.symbol.toLowerCase();
        const wsEndpoint = `wss://${baseURL}.binance.com/ws/${symbol}@kline_${this.config.interval}`;
        
        // Close existing socket if any
        if (this.socket) {
          this.socket.terminate();
        }
        
        // Create new WebSocket connection
        this.socket = new WebSocket(wsEndpoint);
        
        // Set up event handlers
        this.socket.on('open', () => {
          console.log(`WebSocket connected to ${wsEndpoint}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000; // Reset delay
          resolve(true);
        });
        
        this.socket.on('message', this.handleMessage.bind(this));
        
        this.socket.on('error', (error) => {
          console.error("WebSocket error:", error);
          this.isConnected = false;
          resolve(false);
        });
        
        this.socket.on('close', (code, reason) => {
          console.log(`WebSocket disconnected: ${code} ${reason}`);
          this.isConnected = false;
          
          // Try to reconnect
          this.attemptReconnect();
        });
        
        // Set a timeout in case connection takes too long
        setTimeout(() => {
          if (!this.isConnected) {
            console.error("WebSocket connection timeout");
            this.socket.terminate();
            resolve(false);
          }
        }, 10000); // 10 second timeout
        
      } catch (error) {
        console.error("Error setting up WebSocket:", error);
        resolve(false);
      }
    });
  }
  
  /**
   * Attempt to reconnect to WebSocket with exponential backoff
   */
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(30000, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));
    
    console.log(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        // Re-fetch candle data before reconnecting
        this.candles = await fetchBinanceData(
          this.config.symbol, 
          this.config.interval, 
          1000,
          this.config.isFutures
        );
        
        await this.connectWebSocket();
      } catch (error) {
        console.error("Reconnection failed:", error);
      }
    }, delay);
  }
  
  /**
   * Handle incoming WebSocket messages
   * @param {Buffer|String} data - Raw message data
   */
  async handleMessage(data) {
    try {
      // Parse the message data
      const event = JSON.parse(data.toString());
      
      // Check if we received a kline event
      if (!event.k) {
        return;
      }
      
      const kline = event.k;
      
      // Skip if we've already processed this candle
      if (this.lastCandleTime === kline.t) {
        return;
      }
      
      // Update last candle timestamp
      this.lastCandleTime = kline.t;
      
      // Only process completed candles
      if (kline.x) {
        console.log(`Processing completed candle: ${new Date(kline.T).toLocaleString()}`);
        
        // Update candle data arrays
        this.candles.open.push(parseFloat(kline.o));
        this.candles.high.push(parseFloat(kline.h));
        this.candles.low.push(parseFloat(kline.l));
        this.candles.close.push(parseFloat(kline.c));
        this.candles.volume.push(parseFloat(kline.v));
        this.candles.openTime.push(kline.t);
        this.candles.closeTime.push(kline.T);
        
        // Remove oldest elements to maintain array size
        this.candles.open.shift();
        this.candles.high.shift();
        this.candles.low.shift();
        this.candles.close.shift();
        this.candles.volume.shift();
        this.candles.openTime.shift();
        this.candles.closeTime.shift();
        
        // Process updated data through jAlgo
        await this.processCandle();
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }
  
  /**
   * Process a new candle with jAlgo and handle signals
   */
  async processCandle() {
    try {
      // Keep a copy of previous state for comparison
      const prevState = { ...this.state };
      
      // Run the trading algorithm
      const result = jAlgo(this.candles, this.state, this.config);
      
      // debug
      console.log("Indicators:", JSON.stringify({
        defATR: result.indicators.defATR.slice(-3),
        var_ma: result.indicators.var_ma.slice(-3),
        scalpLine: result.indicators.scalpLine.slice(-3)
      }));
      console.log("Signal generated:", result.signal);

      // Update state
      this.state = result.state;
      
      // Get the current candle data
      const currentClose = this.candles.close[this.candles.close.length - 1];
      const currentHigh = this.candles.high[this.candles.high.length - 1];
      const currentLow = this.candles.low[this.candles.low.length - 1];
      const currentTime = new Date(this.candles.closeTime[this.candles.closeTime.length - 1]).toLocaleString();
      
      // Check for target hits and trade exits
      // Check if a long trade was closed
      if (prevState.inLongTrade && !this.state.inLongTrade) {
        let exitReason = "Unknown";
        let profitLoss = 0;
        
        // Determine if it was closed by target hit or new signal
        if (currentHigh >= prevState.longTargetLevel) {
          exitReason = "Target Hit";
          profitLoss = prevState.riskAmount * this.config.rewardMultiple * (this.config.useLeverage ? this.config.leverageAmount : 1);
        } else if (result.signal && result.signal.position === 'short') {
          exitReason = "New Signal (Short)";
          
          // Calculate partial P/L based on how far price moved
          const longPL = currentClose - prevState.longEntryPrice;
          const longRisk = prevState.longEntryPrice - prevState.longStopReference;
          
          if (longPL > 0) {
            // In profit but didn't hit target
            const targetDistance = prevState.longTargetLevel - prevState.longEntryPrice;
            const actualDistance = longPL;
            const percentageToTarget = Math.min(actualDistance / targetDistance, 1.0);
            profitLoss = percentageToTarget * prevState.riskAmount * this.config.rewardMultiple * (this.config.useLeverage ? this.config.leverageAmount : 1);
          } else {
            // In loss
            const percentageLoss = Math.min(Math.abs(longPL) / Math.abs(longRisk), 1.0);
            profitLoss = -percentageLoss * prevState.riskAmount * (this.config.useLeverage ? this.config.leverageAmount : 1);
          }
        }
        
        // Send exit signal to Discord
        await sendSignal({
          symbol: this.config.symbol,
          interval: this.config.interval,
          isFutures: this.config.isFutures,
          position: 'long',
          entryPrice: prevState.longEntryPrice,
          exitPrice: currentClose,
          profitLoss: profitLoss,
          riskedAmount: prevState.riskAmount,
          reason: exitReason,
          config: this.config
        }, this.state, DISCORD_WEBHOOKS.TRADE_EXITS, 'exit');
        
        // Send stats panel
        await sendStatsPanel(this.state, result.stats, this.config, DISCORD_WEBHOOKS.STATS);
        
        // Clear active long trade
        this.activeLongTrade = null;
      }
      
      // Check if a short trade was closed
      if (prevState.inShortTrade && !this.state.inShortTrade) {
        let exitReason = "Unknown";
        let profitLoss = 0;
        
        // Determine if it was closed by target hit or new signal
        if (currentLow <= prevState.shortTargetLevel) {
          exitReason = "Target Hit";
          profitLoss = prevState.riskAmount * this.config.rewardMultiple * (this.config.useLeverage ? this.config.leverageAmount : 1);
        } else if (result.signal && result.signal.position === 'long') {
          exitReason = "New Signal (Long)";
          
          // Calculate partial P/L based on how far price moved
          const shortPL = prevState.shortEntryPrice - currentClose;
          const shortRisk = prevState.shortStopReference - prevState.shortEntryPrice;
          
          if (shortPL > 0) {
            // In profit but didn't hit target
            const targetDistance = prevState.shortEntryPrice - prevState.shortTargetLevel;
            const actualDistance = shortPL;
            const percentageToTarget = Math.min(actualDistance / targetDistance, 1.0);
            profitLoss = percentageToTarget * prevState.riskAmount * this.config.rewardMultiple * (this.config.useLeverage ? this.config.leverageAmount : 1);
          } else {
            // In loss
            const percentageLoss = Math.min(Math.abs(shortPL) / Math.abs(shortRisk), 1.0);
            profitLoss = -percentageLoss * prevState.riskAmount * (this.config.useLeverage ? this.config.leverageAmount : 1);
          }
        }
        
        // Send exit signal to Discord
        await sendSignal({
          symbol: this.config.symbol,
          interval: this.config.interval,
          isFutures: this.config.isFutures,
          position: 'short',
          entryPrice: prevState.shortEntryPrice,
          exitPrice: currentClose,
          profitLoss: profitLoss,
          riskedAmount: prevState.riskAmount,
          reason: exitReason,
          config: this.config
        }, this.state, DISCORD_WEBHOOKS.TRADE_EXITS, 'exit');
        
        // Send stats panel
        await sendStatsPanel(this.state, result.stats, this.config, DISCORD_WEBHOOKS.STATS);
        
        // Clear active short trade
        this.activeShortTrade = null;
      }
      
      // Process new entry signals
      if (result.signal) {
        const signal = result.signal;
        
        if (signal.position === 'long') {
          // Create trade object
          this.activeLongTrade = {
            id: this.generateTradeId(),
            entryTime: currentTime,
            entryPrice: currentClose,
            stopLevel: this.state.longStopReference,
            targetLevel: this.state.longTargetLevel,
            riskAmount: this.state.riskAmount
          };
          
          // Send signal to Discord
          await sendSignal({
            symbol: this.config.symbol,
            interval: this.config.interval,
            isFutures: this.config.isFutures,
            position: 'long',
            price: currentClose,
            stopLevel: this.state.longStopReference,
            targetLevel: this.state.longTargetLevel,
            config: this.config
          }, this.state, DISCORD_WEBHOOKS.SIGNALS, 'entry');
        } 
        else if (signal.position === 'short') {
          // Create trade object
          this.activeShortTrade = {
            id: this.generateTradeId(),
            entryTime: currentTime,
            entryPrice: currentClose,
            stopLevel: this.state.shortStopReference,
            targetLevel: this.state.shortTargetLevel,
            riskAmount: this.state.riskAmount
          };
          
          // Send signal to Discord
          await sendSignal({
            symbol: this.config.symbol,
            interval: this.config.interval,
            isFutures: this.config.isFutures,
            position: 'short',
            price: currentClose,
            stopLevel: this.state.shortStopReference,
            targetLevel: this.state.shortTargetLevel,
            config: this.config
          }, this.state, DISCORD_WEBHOOKS.SIGNALS, 'entry');
        }
      }
      
      // Check if stop reference levels have changed for active trades
      if (this.activeLongTrade && prevState.longStopReference !== this.state.longStopReference) {
        // Send stop update
        await sendSignal({
          symbol: this.config.symbol,
          interval: this.config.interval,
          isFutures: this.config.isFutures,
          position: 'long',
          previousStop: prevState.longStopReference,
          newStop: this.state.longStopReference,
          entryPrice: this.activeLongTrade.entryPrice,
          targetLevel: this.activeLongTrade.targetLevel
        }, this.state, DISCORD_WEBHOOKS.SIGNALS, 'update');
        
        // Update the active trade object
        this.activeLongTrade.stopLevel = this.state.longStopReference;
      }
      
      if (this.activeShortTrade && prevState.shortStopReference !== this.state.shortStopReference) {
        // Send stop update
        await sendSignal({
          symbol: this.config.symbol,
          interval: this.config.interval,
          isFutures: this.config.isFutures,
          position: 'short',
          previousStop: prevState.shortStopReference,
          newStop: this.state.shortStopReference,
          entryPrice: this.activeShortTrade.entryPrice,
          targetLevel: this.activeShortTrade.targetLevel
        }, this.state, DISCORD_WEBHOOKS.SIGNALS, 'update');
        
        // Update the active trade object
        this.activeShortTrade.stopLevel = this.state.shortStopReference;
      }
      
      // Log state information for debugging
      console.log(`Processed candle at ${currentTime}: Close=${currentClose}, High=${currentHigh}, Low=${currentLow}`);
      console.log(`Current capital: ${this.state.currentCapital.toFixed(2)}, Total P/L: ${this.state.totalProfitLoss.toFixed(2)}`);
      
      // Every 24 hours, send updated stats panel even if no trades
      const hoursSinceLastStatsUpdate = (Date.now() - (this.lastStatsUpdate || 0)) / (1000 * 60 * 60);
      if (!this.lastStatsUpdate || hoursSinceLastStatsUpdate >= 24) {
        await sendStatsPanel(this.state, result.stats, this.config, DISCORD_WEBHOOKS.STATS);
        this.lastStatsUpdate = Date.now();
      }
    } catch (error) {
      console.error("Error processing candle:", error);
    }
  }
  
  /**
   * Stop the trader and clean up resources
   */
  stop() {
    if (this.socket) {
      this.socket.terminate();
      this.socket = null;
    }
    this.isConnected = false;
    console.log("Live trader stopped");
  }
}

/**
 * Create and start multiple instances of LiveTrader for different symbols/timeframes
 * @param {Array} configurations - Array of configuration objects
 * @returns {Array} - Array of LiveTrader instances
 */
async function createMultipleTraders(configurations = []) {
  const traders = [];
  
  for (const config of configurations) {
    console.log(`Creating trader for ${config.symbol} ${config.interval}`);
    
    const trader = new LiveTrader(config);
    await trader.initialize();
    
    traders.push(trader);
    
    // Small delay between initializations to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return traders;
}

/**
 * Main function to start the live trader
 */
async function main() {
  console.log("Starting J-algo Live Trader");
  console.log("======================================");
  
  try {
    // Check for configuration file
    let configurations = [];
    
    if (process.env.CONFIG_FILE && fs.existsSync(process.env.CONFIG_FILE)) {
      // Load configuration from file
      const configFile = fs.readFileSync(process.env.CONFIG_FILE, 'utf8');
      configurations = JSON.parse(configFile);
      console.log(`Loaded ${configurations.length} configurations from file`);
    } else {
      // Use default configuration
      configurations.push(DEFAULT_CONFIG);
      console.log("Using default configuration");
    }
    
    // Print configuration details
    configurations.forEach((config, index) => {
      console.log(`\nConfiguration #${index + 1}:`);
      console.log(`Symbol: ${config.symbol}`);
      console.log(`Interval: ${config.interval}`);
      console.log(`Market: ${config.isFutures ? 'Futures' : 'Spot'}`);
      console.log(`Risk Per Trade: ${config.riskPerTrade}%`);
      console.log(`Reward Multiple: ${config.rewardMultiple}`);
      console.log(`Leverage: ${config.useLeverage ? config.leverageAmount + 'x' : 'OFF'}`);
      console.log(`Initial Capital: ${config.initialCapital}`);
    });
    
    // Create traders for each configuration
    const traders = await createMultipleTraders(configurations);
    
    console.log(`\nStarted ${traders.length} trader instances`);
    console.log("Monitoring markets for signals...");
    
    // Handle application shutdown
    process.on('SIGINT', async () => {
      console.log("\nShutting down traders...");
      
      for (const trader of traders) {
        trader.stop();
      }
      
      console.log("All traders stopped. Exiting.");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("Error in main function:", error);
    process.exit(1);
  }
}

// If this file is run directly (not imported), start the trader
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

// Export the LiveTrader class for use in other modules
export { LiveTrader, sendSignal, sendStatsPanel, fetchBinanceData };
