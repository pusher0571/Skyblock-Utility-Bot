# SBT Utility Discord Bot

A Discord bot for the Hypixel Skyblock, featuring various utility commands and systems.

## Features

- 🎯 Daily Quest System with customizable difficulty levels
- 🎫 Ticket System for user support
- 📜 Rules Management
- 🎮 Hypixel API Integration
- 🔒 Role and User-based Permission System

## Prerequisites

- Node.js (v16 or higher recommended)
- npm (comes with Node.js)
- A Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications))
- A Hypixel API Key (from [Hypixel API](https://api.hypixel.net/))

## Installation

### Local Installation

1. Clone the repository:
```bash
git clone https://github.com/pusher0571/Skyblock-Utility-Bot.git
cd sbt-utility
```

2. Install dependencies:
```bash
npm install
```

3. Copy `config.example.js` to `config.js` and fill in your configuration:
```bash
cp config.example.js config.js
```

4. Start the bot:
```bash
node index2.js
```

### Docker Installation

1. Build the Docker image:
```bash
docker build -t sbt-utility .
```

2. Create a `config.js` file with your configuration (see `config.example.js`)

3. Run the container:
```bash
docker run -d \
  --name sbt-utility \
  -v $(pwd)/config.js:/app/config.js \
  sbt-utility
```

To view the logs:
```bash
docker logs sbt-utility
```

To stop the container:
```bash
docker stop sbt-utility
```

To start the container again:
```bash
docker start sbt-utility
```

## Contributing

Feel free to submit issues and enhancement requests! If you'd like to contribute:

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 