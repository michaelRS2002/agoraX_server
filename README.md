# 🚀 AgoraX Server

Real-time communication server for the AgoraX platform. This WebSocket-based server powers live chat, user presence tracking, and meeting room management for virtual collaboration.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Events](#-api-events)
- [Development](#-development)
- [Deployment](#-deployment)
- [Authors](#-authors)

## ✨ Features

- **Real-time Chat**: Instant messaging within meeting rooms
- **User Presence**: Track online users globally and per room
- **Room Management**: Dynamic room creation and user management
- **Transcript Persistence**: Automatic chat message archiving for meeting transcripts
- **CORS Support**: Configurable cross-origin resource sharing
- **Backend Integration**: Seamless participant data synchronization

## 🏗️ Architecture

The server is built with:
- **Socket.IO**: WebSocket library for real-time bidirectional communication
- **TypeScript**: Type-safe development
- **Node.js**: Runtime environment

### Key Components

- **Global User Tracking**: Maintains a list of all connected users
- **Room-based Communication**: Isolated chat spaces for different meetings
- **Event-driven Architecture**: Handles connections, messages, and disconnections
- **Transcript System**: Persists chat messages to files for meeting summaries

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/michaelRS2002/agoraX_server.git
cd agoraX_server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
PORT=4000
ORIGIN=http://localhost:3001,http://localhost:5173
BACKEND_BASE=http://localhost:3000
TRANSCRIPTS_DIR=./tmp/transcripts
```

4. Start the development server:
```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## 🔧 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port number | - | Yes |
| `ORIGIN` | Comma-separated list of allowed CORS origins | - | Yes |
| `BACKEND_BASE` | URL of the backend API service | `http://localhost:3000` | No |
| `TRANSCRIPTS_DIR` | Directory path for storing chat transcripts | Auto-detected | No |

## 📡 API Events

### Client → Server

#### `newUser`
Identifies a user globally.
```typescript
socket.emit('newUser', userId: string)
```

#### `joinRoom`
User joins a meeting room.
```typescript
socket.emit('joinRoom', {
  roomId: string,
  username: string,
  email: string,
  userId: string
})
```

#### `leaveRoom`
User leaves a meeting room.
```typescript
socket.emit('leaveRoom', roomId: string)
```

#### `sendMessage`
Send a chat message to a room.
```typescript
socket.emit('sendMessage', {
  roomId: string,
  user: string,
  text: string
})
```

### Server → Client

#### `usersOnline`
Broadcasts the list of globally online users.
```typescript
socket.on('usersOnline', (users: Array<{socketId: string, userId: string}>) => {})
```

#### `roomUsers`
Broadcasts the list of users in a specific room.
```typescript
socket.on('roomUsers', (users: Array<{socketId: string, username: string}>) => {})
```

#### `message`
Receives a chat message.
```typescript
socket.on('message', (message: {
  id: string,
  user: string,
  text: string,
  timestamp: Date
}) => {})
```

## 💻 Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server

### Project Structure

```
agoraX_server/
├── api/
│   └── index.ts          # Main server file
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Code Documentation

The codebase uses TSDoc for inline documentation. All major functions, events, and components are documented with:
- Parameter types and descriptions
- Return value descriptions
- Event emission details
- Usage examples where applicable

## 🚢 Deployment

### Docker (Recommended)

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t agorax-server .
docker run -p 4000:4000 --env-file .env agorax-server
```

### Traditional Deployment

1. Build the project: `npm run build`
2. Set environment variables
3. Start the server: `npm start`
4. Use a process manager like PM2 for production:
```bash
pm2 start dist/index.js --name agorax-server
```

## 🔒 Security Considerations

- Configure `ORIGIN` to only allow trusted domains
- Use HTTPS in production
- Implement rate limiting for production deployments
- Validate and sanitize all user inputs
- Keep dependencies updated

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 👥 Autores

**Equipo AgoraX**
- GitHub: [@michaelRS2002](https://github.com/michaelRS2002)
- Github: [@AirWa1l](https://github.com/AirWa1l)
- Github: [@Mausterl26](https://github.com/Mausterl26)
- Github: [@LjuandalZPH](https://github.com/LjuandalZPH)
- Github: [@vilhood](https://github.com/vilhood)
