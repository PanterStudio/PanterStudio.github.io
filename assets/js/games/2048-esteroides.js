// 2048 con Esteroides - Estructura base

document.addEventListener('DOMContentLoaded', () => {
    const size = 4;
    const gameContainer = document.getElementById('game-container');
    let board = [];

    function createBoard() {
        board = [];
        gameContainer.innerHTML = '';
        for (let i = 0; i < size * size; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.textContent = '';
            gameContainer.appendChild(tile);
            board.push(tile);
        }
    }

    function restartGame() {
        createBoard();
        // Aquí se inicializarán los valores iniciales del juego
    }

    document.getElementById('restart-btn').addEventListener('click', restartGame);

    // Inicializar juego al cargar
    restartGame();
});
