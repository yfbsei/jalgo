// example-usage.js - Example of how to use the J-algo Live Trader

import { LiveTrader } from './j-algo-live-trader.js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main function to demonstrate the use of the Live Trader
 */
async function runExample() {
  console.log("J-algo Live Trader Example");
  console.log("======================================");
  
  // Example of creating and running a single trader instance
  const config = {
    // Trading pair and market settings
    symbol: "BTCUSDT",
    interval: "1m",
    isFutures: true,
    
    // Algorithm parameters
    fastLength: 6,
    ATRPeriod: 16,
    ATRMultiplier: 9,
    ATRMultiplierFast: 5.1,
    
    // Scalp mode parameters
    scalpPeriod: 21,
    
    // Risk-reward parameters
    rewardMultiple: 0.5,
    initialCapital: 100,
    riskPerTrade: 10,
    
    // Leverage parameters
    useLeverage: true,
    leverageAmount: 5.0
  };
  
  console.log("Creating trader for BTC/USDT 4h with the following settings:");
  console.log(JSON.stringify(config, null, 2));
  
  try {
    // Create and initialize the trader
    const trader = new LiveTrader(config);
    const success = await trader.initialize();
    
    if (success) {
      console.log("Trader successfully initialized!");
      console.log("Now monitoring the market for signals...");
      console.log("Press Ctrl+C to stop the trader.");
      
      // Handle process termination
      process.on('SIGINT', () => {
        console.log("\nShutting down trader...");
        trader.stop();
        console.log("Trader stopped. Exiting.");
        process.exit(0);
      });
    } else {
      console.error("Failed to initialize trader. Exiting.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error running example:", error);
    process.exit(1);
  }
}

/**
 * Example of creating multiple traders from a configuration file
 */
async function runMultipleTraders() {
  console.log("J-algo Multiple Traders Example");
  console.log("==========================================");
  
  try {
    // Sample configuration
    const configurations = [
      {
        symbol: "BTCUSDT",
        interval: "4h",
        isFutures: true,
        rewardMultiple: 1.5,
        riskPerTrade: 5,
        useLeverage: true,
        leverageAmount: 2.0,
        initialCapital: 100
      },
      {
        symbol: "ETHUSDT",
        interval: "4h",
        isFutures: true,
        rewardMultiple: 1.5,
        riskPerTrade: 5,
        useLeverage: true,
        leverageAmount: 2.0,
        initialCapital: 100
      },
      {
        symbol: "SOLUSDT",
        interval: "4h",
        isFutures: true,
        rewardMultiple: 1.5,
        riskPerTrade: 5,
        useLeverage: true,
        leverageAmount: 2.0,
        initialCapital: 100
      }
    ];
    
    // Save configuration to file
    fs.writeFileSync('config.json', JSON.stringify(configurations, null, 2));
    console.log("Configuration saved to config.json");
    
    console.log("Creating traders for multiple symbols...");
    const traders = [];
    
    for (const config of configurations) {
      console.log(`Initializing trader for ${config.symbol} ${config.interval}...`);
      const trader = new LiveTrader(config);
      await trader.initialize();
      traders.push(trader);
      
      // Small delay between initializations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Started ${traders.length} trader instances!`);
    console.log("Monitoring markets for signals...");
    console.log("Press Ctrl+C to stop all traders.");
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log("\nShutting down all traders...");
      traders.forEach(trader => trader.stop());
      console.log("All traders stopped. Exiting.");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("Error running multiple traders:", error);
    process.exit(1);
  }
}

// Uncomment the function you want to run
runExample();
// runMultipleTraders();
