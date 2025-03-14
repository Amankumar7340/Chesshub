document.addEventListener('DOMContentLoaded', () => {
    let board = null;
    let game = new Chess();
   // Connect to Socket.IO server with auto-detection of URL
    const socket = io({
        transports: ['websocket', 'polling']
    });
    
    let playerColor = 'white';
    let currentGameId = null;
    let playerTurn = false;

    
    
    // DOM elements
    const $status = $('#status');
    const $fen = $('#fen');
    const $pgn = $('#pgn');
    const $gameId = $('#gameId');
    const $joinGameId = $('#joinGameId');
    const $startBtn = $('#startBtn');
    const $joinBtn = $('#joinBtn');
    const $flipBtn = $('#flipBtn');

       // Initialize the board
       function initializeBoard() {
        const config = {
            draggable: true,
            position: 'start',
            pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd
        };
        board = Chessboard('board', config);
        $(window).resize(board.resize);
        updateStatus();
    }

    

    // Function to check if a piece can be picked up
    function onDragStart(source, piece) {
        // Don't allow moves if the game is over
        if (game.game_over()) return false;

        // Only allow the current player to move their pieces
        if (!playerTurn) return false;

        // Only pick up pieces for the correct player
        if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
            (playerColor === 'black' && piece.search(/^w/) !== -1)) {
            return false;
        }
    }

    // Function to handle piece drops
    function onDrop(source, target) {
        // Check if the move is legal
        const move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Always promote to a queen for simplicity
        });

        // If illegal move, return piece to source square
        if (move === null) return 'snapback';

        // Send the move to the server
        socket.emit('move', {
            gameId: currentGameId,
            move: move,
            fen: game.fen(),
            pgn: game.pgn()
        });

        playerTurn = false;
        updateStatus();
    }

    // Function to update board position after piece snap
    function onSnapEnd() {
        board.position(game.fen());
    }

    // Update the game status
    function updateStatus() {
        let status = '';

        if (game.in_checkmate()) {
            status = (game.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate';
            socket.emit('gameOver', { gameId: currentGameId, result: status });
        } else if (game.in_draw()) {
            status = 'Game is a draw';
            socket.emit('gameOver', { gameId: currentGameId, result: status });
        } else {
            status = (game.turn() === 'w' ? 'White' : 'Black') + ' to move';
            if ((game.turn() === 'w' && playerColor === 'white') || 
                (game.turn() === 'b' && playerColor === 'black')) {
                status += ' (Your turn)';
                playerTurn = true;
            } else {
                status += ' (Opponent\'s turn)';
                playerTurn = false;
            }

            if (game.in_check()) {
                status += ', ' + (game.turn() === 'w' ? 'White' : 'Black') + ' is in check';
            }
        }

        $status.text(status);
        $fen.text(game.fen());
        $pgn.text(game.pgn());
    }

    // Create a new game
    $startBtn.on('click', () => {
        socket.emit('createGame');
    });

    // Join an existing game
    $joinBtn.on('click', () => {
        const gameIdToJoin = $joinGameId.val().trim();
        if (gameIdToJoin) {
            socket.emit('joinGame', gameIdToJoin);
        }
    });

    // Flip the board
    $flipBtn.on('click', () => {
        board.flip();
    });

    // Socket event handlers
    socket.on('gameCreated', (data) => {
        currentGameId = data.gameId;
        playerColor = data.color;
        $gameId.text(currentGameId);
        game.reset();
        board.position(game.fen());
        playerTurn = (playerColor === 'white');
        updateStatus();
    });

    socket.on('gameJoined', (data) => {
        currentGameId = data.gameId;
        playerColor = data.color;
        $gameId.text(currentGameId);
        if (data.fen) {
            game.load(data.fen);
            board.position(game.fen());
        }
        if (playerColor === 'black') {
            board.flip();
        }
        playerTurn = (game.turn() === 'b' && playerColor === 'black');
        updateStatus();
    });

    socket.on('opponentJoined', () => {
        $status.text('Opponent joined! Your turn (white).');
        playerTurn = true;
    });

    socket.on('opponentMove', (data) => {
        game.move(data.move);
        board.position(game.fen());
        playerTurn = true;
        updateStatus();
    });

    socket.on('gameEnded', (data) => {
        $status.text(data.result);
        playerTurn = false;
    });

    socket.on('opponentDisconnected', () => {
        $status.text('Opponent disconnected. Game over.');
        playerTurn = false;
    });

    socket.on('joinError', (data) => {
        alert(data.message);
    });

    // Initialize the board
    initializeBoard();
});