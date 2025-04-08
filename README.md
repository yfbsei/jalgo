# J-algo Live Trader

A real-time trading bot that implements the J-algo algorithm for cryptocurrency trading on Binance spot and futures markets with Discord notifications.

## Features

- **Live Trading**: Connect to Binance real-time market data for both spot and futures markets
- **Signal Generation**: Generate trading signals based on the J-algo algorithm
- **Risk Management**: Built-in risk management with configurable risk-per-trade percentage
- **Discord Notifications**: Send trade signals, exits, and statistical updates to Discord
- **Multi-Symbol Support**: Run multiple instances for different trading pairs simultaneously
- **Leverage Trading**: Optional leverage trading for futures markets
- **Statistics Panel**: Visual statistics panel showing performance metrics
- **Stop Loss Tracking**: Automatic trailing stop loss adjustments with notifications

## Installation

1. Clone the repository:

```bash
// the engine is not public
git clone j-algo-engine.git
cd j-algo-engine
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment template and configure your settings:

```bash
cp .env.template .env
```

4. Edit the `.env` file with your preferred settings and Discord webhook URLs.

## Configuration

You can configure the trader using environment variables in the `.env` file or by creating a `config.json` file for multiple trading pairs.

### Environment Variables

Key configuration options include:

- `TRADING_PAIR`: The cryptocurrency pair to trade (e.g., BTCUSDT)
- `TIMEFRAME`: Candlestick timeframe (1m, 5m, 15m, 1h, 4h, 1d, etc.)
- `MARKET_TYPE`: 'spot' or 'futures'
- `DISCORD_WEBHOOK`: Your Discord webhook URL for notifications
- `INITIAL_CAPITAL`: Starting capital for calculating position sizes
- `RISK_PER_TRADE`: Percentage of capital to risk per trade
- `USE_LEVERAGE`: Whether to use leverage (true/false)
- `LEVERAGE_AMOUNT`: Leverage multiplier (e.g., 2.0 for 2x leverage)

See the `.env.template` file for all available options.

### Multiple Trading Pairs

To trade multiple pairs simultaneously, create a `config.json` file with an array of configuration objects:

```json
[
  {
    "symbol": "BTCUSDT",
    "interval": "4h",
    "isFutures": true,
    "rewardMultiple": 1.5,
    "riskPerTrade": 5,
    "useLeverage": true,
    "leverageAmount": 2.0,
    "initialCapital": 100
  },
  {
    "symbol": "ETHUSDT",
    "interval": "4h",
    "isFutures": true,
    "rewardMultiple": 1.5,
    "riskPerTrade": 5,
    "useLeverage": true,
    "leverageAmount": 2.0,
    "initialCapital": 100
  }
]
```

## Usage

### Starting the Trader

Start the trader with:

```bash
npm start
```

This will run the `example-usage.js` file, which shows how to initialize and run the trader.

### Custom Implementation

You can create your own implementation by importing the `LiveTrader` class:

```javascript
import { LiveTrader } from './j-algo-live-trader.js';

const config = {
  symbol: "BTCUSDT",
  interval: "4h",
  isFutures: true,
  rewardMultiple: 1.5,
  riskPerTrade: 10,
  useLeverage: true,
  leverageAmount: 2.0,
  initialCapital: 100
};

async function main() {
  const trader = new LiveTrader(config);
  await trader.initialize();
  
  // The trader is now running and will send signals to Discord
}

main();
```

## Discord Integration

The trader sends three types of notifications to Discord:

1. **Signal Notifications**: When a new trade signal is generated
2. **Exit Notifications**: When a trade is closed (target hit or new opposite signal)
3. **Stats Panels**: Visual statistics showing performance metrics

### Setting Up Discord Webhooks

1. In your Discord server, go to a channel's settings
2. Click on "Integrations" > "Webhooks" > "New Webhook"
3. Copy the webhook URL and paste it into your `.env` file

You can use different webhook URLs for different notification types:
- `DISCORD_WEBHOOK_SIGNALS`: For new trade signals
- `DISCORD_WEBHOOK_EXITS`: For trade exit notifications
- `DISCORD_WEBHOOK_STATS`: For statistics panels

If you only specify `DISCORD_WEBHOOK`, all notifications will be sent to the same webhook.

## Statistics Panel

The statistics panel displays key performance metrics including:

- Number of long and short trades
- Success rates and target hits
- Capital growth and profit/loss
- Risk-reward ratio and efficiency
- Current leverage and scalp mode settings

The panel is sent to Discord upon initialization, after each trade exit, and every 24 hours.

## Algorithm Details

Powered by J-algo engine


## License

ISC License

## Credits

Original algorithm engine by yfbsei
Implementation by yfbsei
