const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all routes for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store active games
const games = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create a new game
    socket.on('createGame', () => {
        const gameId = uuidv4().substring(0, 8);
        games[gameId] = {
            white: socket.id,
            black: null,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
            pgn: ''
        };
        
        socket.join(gameId);
        socket.emit('gameCreated', { gameId, color: 'white' });
        console.log(`Game created: ${gameId}`);
    });

    // Join an existing game
    socket.on('joinGame', (gameId) => {
        if (games[gameId] && !games[gameId].black) {
            games[gameId].black = socket.id;
            socket.join(gameId);
            socket.emit('gameJoined', { gameId, color: 'black', fen: games[gameId].fen });
            io.to(games[gameId].white).emit('opponentJoined', { gameId });
            console.log(`Player joined game: ${gameId}`);
        } else {
            socket.emit('joinError', { message: 'Game not available' });
        }
    });

    // Handle a move
    socket.on('move', (data) => {
        const { gameId, fen, pgn, move } = data;
        
        if (games[gameId]) {
            games[gameId].fen = fen;
            games[gameId].pgn = pgn;
            
            // Broadcast the move to the opponent
            socket.to(gameId).emit('opponentMove', { move, fen, pgn });
            console.log(`Move in game ${gameId}: ${move.from} -> ${move.to}`);
        }
    });

    // Handle game end
    socket.on('gameOver', (data) => {
        const { gameId, result } = data;
        if (games[gameId]) {
            io.to(gameId).emit('gameEnded', { result });
            console.log(`Game ${gameId} ended: ${result}`);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find games where this player was participating
        for (const gameId in games) {
            const game = games[gameId];
            if (game.white === socket.id || game.black === socket.id) {
                io.to(gameId).emit('opponentDisconnected');
                console.log(`Player left game: ${gameId}`);
                delete games[gameId];
            }
        }
    });
});

// For local development
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// For Vercel
module.exports = server;