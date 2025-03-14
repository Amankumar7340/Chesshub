const fs = require('fs');
const path = require('path');
const https = require('https');

const piecesDir = path.join(__dirname, 'public', 'img', 'chesspieces', 'wikipedia');

// Create directories if they don't exist
fs.mkdirSync(piecesDir, { recursive: true });

const pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];

pieces.forEach(piece => {
    const url = `https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/${piece}.png`;
    const filePath = path.join(piecesDir, `${piece}.png`);
    
    const file = fs.createWriteStream(filePath);
    https.get(url, response => {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${piece}.png`);
        });
    }).on('error', err => {
        fs.unlink(filePath, () => {}); // Delete the file if there's an error
        console.error(`Error downloading ${piece}.png:`, err.message);
    });
});