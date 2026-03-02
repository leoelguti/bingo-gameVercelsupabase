// Variables globales
let calledNumbers = new Set();
const totalBalls = 75;
let currentNumber = null;
let isAnimating = false;
let gameMode = 'figure';
let winners = new Set();
let lastBalls = [];
let ballCount = 0;
let cardPrice = 10;
let totalPrize = 0;
let selectedFigure = 'X';
let cardsGenerated = false;

// Sonidos
const spinSound = new Audio('spin-sound.mp3');
const winnerSound = new Audio('winner-sound.mp3');

// Inicializar la cuadrícula de bolas
function initializeBallsGrid() {
    const grid = document.getElementById('ballsGrid');
    for (let i = 1; i <= totalBalls; i++) {
        const ball = document.createElement('div');
        ball.className = 'ball';
        ball.id = `ball-${i}`;
        ball.textContent = i;
        grid.appendChild(ball);
    }
}

// Generar número aleatorio
function generateRandomNumber() {
    if (!cardsGenerated) {
        showMessage('Por favor, genera los cartones antes de generar una bola.');
        return;
    }

    if (isAnimating || calledNumbers.size >= totalBalls) return;
    
    spinSound.play();
    isAnimating = true;
    const numberDisplay = document.getElementById('randomNumber');
    let counter = 0;
    
    const animation = setInterval(() => {
        let randomNum;
        do {
            randomNum = Math.floor(Math.random() * totalBalls) + 1;
        } while (calledNumbers.has(randomNum));
        
        const letter = getLetterForNumber(randomNum);
        numberDisplay.textContent = `${letter}${randomNum}`;
        counter++;
        
        if (counter >= 4) { // 40 iterations * 100ms = 4000ms (4 seconds)
            clearInterval(animation);
            finalizeNumberGeneration(randomNum);
        }
    }, 100);
}

// Obtener la letra correspondiente al número
function getLetterForNumber(number) {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
}

// Finalizar la generación del número
function finalizeNumberGeneration(number) {
    currentNumber = number;
    calledNumbers.add(number);
    ballCount++;
    document.getElementById('countDisplay').textContent = ballCount;

    lastBalls.push(number);
    if (lastBalls.length > 6) lastBalls.shift();
    updateLastBallsDisplay();

    const ball = document.getElementById(`ball-${number}`);
    ball.classList.add('called');
    isAnimating = false;
    markNumberInCards(number);
    checkWinners();
}

// Actualizar el registro de las últimas bolas
function updateLastBallsDisplay() {
    const lastBallsList = document.getElementById('lastBallsList');
    lastBallsList.innerHTML = '';
    lastBalls.forEach(ball => {
        const ballDiv = document.createElement('div');
        ballDiv.className = 'ball';
        ballDiv.textContent = ball;
        lastBallsList.appendChild(ballDiv);
    });
}

// Generar cartón de bingo
function generateBingoCard() {
    const card = {
        B: generateColumnNumbers(1, 15, 5),
        I: generateColumnNumbers(16, 30, 5),
        N: generateColumnNumbers(31, 45, 5),
        G: generateColumnNumbers(46, 60, 5),
        O: generateColumnNumbers(61, 75, 5)
    };
    card.N[2] = 'FREE';
    return card;
}

// Generar números para una columna
function generateColumnNumbers(min, max, count) {
    const numbers = new Set();
    while (numbers.size < count) {
        numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(numbers);
}

// Crear elemento visual del cartón
function createBingoCardElement(card, index) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'bingo-card';
    cardDiv.dataset.cardIndex = index;

    const header = document.createElement('div');
    header.className = 'bingo-header';
    'BINGO'.split('').forEach(letter => {
        const letterDiv = document.createElement('div');
        letterDiv.textContent = letter;
        header.appendChild(letterDiv);
    });
    cardDiv.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'bingo-grid';
    for (let row = 0; row < 5; row++) {
        'BINGO'.split('').forEach((letter, col) => {
            const cell = document.createElement('div');
            cell.className = 'bingo-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            const number = card[letter][row];
            cell.textContent = number === 'FREE' ? 'FREE' : number;
            if (number === 'FREE') cell.classList.add('free', 'marked');
            grid.appendChild(cell);
        });
    }
    cardDiv.appendChild(grid);
    const serial = document.createElement('div');
    serial.className = 'text-white text-sm mt-2';
    serial.textContent = `Serial: ${index + 1}`;
    cardDiv.appendChild(serial);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Nombre';
    nameInput.className = 'card-name-input';
    cardDiv.appendChild(nameInput);

    return cardDiv;
}

// Generar cartones
function generateCards() {
    const container = document.getElementById('bingoCards');
    container.innerHTML = '';
    const input = document.getElementById('cardCount');
    const cardCount = Math.min(Math.max(parseInt(input.value) || 4, 1), 600);
    const priceInput = document.getElementById('cardPrice');
    cardPrice = parseInt(priceInput.value) || 10;
    const figureInput = document.getElementById('figure');
    selectedFigure = figureInput.value;
    calledNumbers.clear();
    winners.clear();
    gameMode = 'figure';
    document.getElementById('gameMode').textContent = 'Modo: Figura';
    document.getElementById('randomNumber').textContent = '?';
    document.querySelectorAll('.ball').forEach(ball => ball.classList.remove('called'));

    totalPrize = cardCount * cardPrice; // Calcular el premio total
    for (let i = 0; i < cardCount; i++) {
        const card = generateBingoCard();
        const cardElement = createBingoCardElement(card, i);
        container.appendChild(cardElement);
    }

    cardsGenerated = true; // Marcar que los cartones han sido generados
}

// Marcar número en los cartones
function markNumberInCards(number) {
    const cards = document.querySelectorAll('.bingo-card');
    cards.forEach(card => {
        const cells = card.querySelectorAll('.bingo-cell');
        cells.forEach(cell => {
            if (cell.textContent === number.toString()) {
                cell.classList.add('marked');
            }
        });
    });
}

// Preguntar si alguien cantó figura, línea o bingo
function askForWinner(message) {
    const winnerQuestionBox = document.getElementById('winnerQuestionBox');
    const winnerQuestionText = document.getElementById('winnerQuestionText');
    winnerQuestionText.textContent = message;
    winnerQuestionBox.classList.remove('hidden');

    return new Promise((resolve) => {
        document.getElementById('winnerYes').onclick = () => {
            winnerQuestionBox.classList.add('hidden');
            resolve(true);
        };
        document.getElementById('winnerNo').onclick = () => {
            winnerQuestionBox.classList.add('hidden');
            resolve(false);
        };
    });
}

// Reiniciar las marcas de los cartones y las bolas generadas
function resetMarksAndBalls() {
    calledNumbers.clear();
    ballCount = 0;
    lastBalls = [];
    document.getElementById('countDisplay').textContent = ballCount;
    document.getElementById('randomNumber').textContent = '?';
    document.querySelectorAll('.ball').forEach(ball => ball.classList.remove('called'));
    updateLastBallsDisplay();
}

// Verificar ganadores
async function checkWinners() {
    const cards = document.querySelectorAll('.bingo-card');
    let newWinners = [];
    cards.forEach(card => {
        const cardIndex = card.dataset.cardIndex;
        if (gameMode === 'figure' && checkFigure(card, selectedFigure)) {
            if (!winners.has(`${cardIndex}-figure`)) {
                winners.add(`${cardIndex}-figure`);
                card.style.border = '4px solid gold';
                const markedNumbers = getMarkedNumbers(card, 'figure');
                newWinners.push({ message: `¡Figura ${selectedFigure}! Cartón #${parseInt(cardIndex) + 1} ha ganado!`, cardIndex, prizeType: `Figura ${selectedFigure}` });
                updateWinnersLog(cardIndex, `Figura ${selectedFigure}`, markedNumbers);
                addWinningLabel(card, `Figura ${selectedFigure}`);
            }
        } else if (gameMode === 'line' && checkLine(card)) {
            if (!winners.has(`${cardIndex}-line`)) {
                winners.add(`${cardIndex}-line`);
                card.style.border = '4px solid gold';
                const markedNumbers = getMarkedNumbers(card, 'line');
                newWinners.push({ message: `¡Línea! Cartón #${parseInt(cardIndex) + 1} ha ganado!`, cardIndex, prizeType: 'Línea' });
                updateWinnersLog(cardIndex, 'Línea', markedNumbers);
                addWinningLabel(card, 'Línea');
            }
        } else if (gameMode === 'bingo' && checkFullCard(card)) {
            if (!winners.has(`${cardIndex}-bingo`)) {
                winners.add(`${cardIndex}-bingo`);
                card.style.border = '4px solid gold';
                const markedNumbers = getMarkedNumbers(card, 'bingo');
                newWinners.push({ message: `¡Bingo! Cartón #${parseInt(cardIndex) + 1} ha ganado!`, cardIndex, prizeType: 'Bingo' });
                updateWinnersLog(cardIndex, 'Bingo', markedNumbers);
                addWinningLabel(card, 'Bingo');
            }
        }
    });

    if (newWinners.length > 0) {
        winnerSound.play();
        showMessage(newWinners.map(winner => winner.message).join('\n'));

        let anyWinnerSang = false;
        for (const winner of newWinners) {
            const response = await askForWinner(`¿Alguien cantó ${winner.prizeType} para el cartón #${parseInt(winner.cardIndex) + 1}?`);
            if (!response) {
                updateWinnersLog(winner.cardIndex, `${winner.prizeType} (No cantado)`, getMarkedNumbers(cards[winner.cardIndex], winner.prizeType.toLowerCase()));
            } else {
                anyWinnerSang = true;
            }
        }

        if (anyWinnerSang) {
            if (gameMode === 'figure') {
                resetGame();
                gameMode = 'line';
                document.getElementById('gameMode').textContent = 'Modo: Línea';
            } else if (gameMode === 'line') {
                gameMode = 'bingo';
                document.getElementById('gameMode').textContent = 'Modo: Bingo';
            }
        }
    }
}

// Mostrar mensaje en el contenedor
function showMessage(message) {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    messageText.textContent = message;
    messageBox.classList.remove('hidden');
}

// Cerrar el contenedor de mensajes
document.getElementById('closeMessageBox').addEventListener('click', () => {
    const messageBox = document.getElementById('messageBox');
    messageBox.classList.add('hidden');
});

// Obtener los números marcados en un cartón
function getMarkedNumbers(card, prizeType) {
    const markedCells = card.querySelectorAll('.bingo-cell.marked');
    if (prizeType === 'figure') {
        return Array.from(markedCells).map(cell => cell.textContent);
    } else if (prizeType === 'line') {
        const winningLine = getWinningLine(card);
        return winningLine.map(cell => cell.textContent);
    } else if (prizeType === 'bingo') {
        return Array.from(markedCells).map(cell => cell.textContent);
    }
    return [];
}

// Obtener la línea ganadora
function getWinningLine(card) {
    const rows = [0, 1, 2, 3, 4];
    const cols = [0, 1, 2, 3, 4];
    for (let row of rows) {
        const cells = card.querySelectorAll(`.bingo-cell[data-row="${row}"]`);
        if (Array.from(cells).every(cell => cell.classList.contains('marked') || cell.classList.contains('free'))) {
            return Array.from(cells);
        }
    }
    for (let col of cols) {
        const cells = card.querySelectorAll(`.bingo-cell[data-col="${col}"]`);
        if (Array.from(cells).every(cell => cell.classList.contains('marked') || cell.classList.contains('free'))) {
            return Array.from(cells);
        }
    }
    return [];
}

// Reiniciar el juego
function resetGame() {
    resetMarksAndBalls();
    winners.clear();
    document.querySelectorAll('.bingo-card').forEach(card => {
        card.style.border = 'none';
        card.querySelectorAll('.bingo-cell').forEach(cell => {
            if (!cell.classList.contains('free')) {
                cell.classList.remove('marked');
            }
        });
    });
}

// Verificar si hay figura completa en un cartón
function checkFigure(card, figure) {
    const cells = card.querySelectorAll('.bingo-cell');
    const markedCells = Array.from(cells).filter(cell => cell.classList.contains('marked') || cell.classList.contains('free'));
    switch (figure) {
        case 'X':
            return checkX(markedCells);
        case 'L':
            return checkL(markedCells);
        case 'N':
            return checkN(markedCells);
        case 'T':
            return checkT(markedCells);
        case 'H':
            return checkH(markedCells);
        default:
            return false;
    }
}

// Funciones para verificar cada figura
function checkX(markedCells) {
    const xPattern = [
        [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
        [0, 4], [1, 3], [3, 1], [4, 0]
    ];
    return xPattern.every(([row, col]) => markedCells.some(cell => cell.dataset.row == row && cell.dataset.col == col));
}

function checkL(markedCells) {
    const lPattern = [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
        [4, 1], [4, 2], [4, 3], [4, 4]
    ];
    return lPattern.every(([row, col]) => markedCells.some(cell => cell.dataset.row == row && cell.dataset.col == col));
}

function checkN(markedCells) {
    const nPattern = [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
        [1, 1], [2, 2], [3, 3], [4, 4]
    ];
    return nPattern.every(([row, col]) => markedCells.some(cell => cell.dataset.row == row && cell.dataset.col == col));
}

function checkT(markedCells) {
    const tPattern = [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 2], [2, 2], [3, 2], [4, 2]
    ];
    return tPattern.every(([row, col]) => markedCells.some(cell => cell.dataset.row == row && cell.dataset.col == col));
}

function checkH(markedCells) {
    const hPattern = [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
        [2, 1], [2, 2], [2, 3], [2, 4],
        [0, 4], [1, 4], [3, 4], [4, 4]
    ];
    return hPattern.every(([row, col]) => markedCells.some(cell => cell.dataset.row == row && cell.dataset.col == col));
}

// Añadir etiqueta de ganador al cartón
function addWinningLabel(card, prizeType) {
    const winningLabel = document.createElement('div');
    winningLabel.className = 'winning-label';
    winningLabel.textContent = `Ganador: ${prizeType}`;
    card.appendChild(winningLabel);
}

// Actualizar el registro de ganadores
function updateWinnersLog(cardIndex, prizeType, markedNumbers) {
    const winnersLog = document.getElementById('winnersList');
    let header = '';

    if (prizeType.includes('Figura')) {
        header = '<strong>Ganadores de figura</strong>';
    } else if (prizeType.includes('Línea')) {
        header = '<strong>Ganadores de línea</strong>';
    } else if (prizeType.includes('Bingo')) {
        header = '<strong>Ganadores de bingo</strong>';
    }

    // Verificar si el encabezado ya existe
    if (!winnersLog.innerHTML.includes(header)) {
        winnersLog.innerHTML += `<h3 class="mt-4">${header}</h3>`;
    }

    winnersLog.innerHTML += `
        <div class="mt-2">
            <p>Cartón #${parseInt(cardIndex) + 1}: ${prizeType}</p>
            <p>Números marcados: ${markedNumbers.join(', ')}</p>
        </div>
    `;
}

// Verificar si hay línea completa en un cartón
function checkLine(card) {
    const rows = [0, 1, 2, 3, 4];
    const cols = [0, 1, 2, 3, 4];
    return rows.some(row => {
        const cells = card.querySelectorAll(`.bingo-cell[data-row="${row}"]`);
        return Array.from(cells).every(cell => cell.classList.contains('marked') || cell.classList.contains('free'));
    }) || cols.some(col => {
        const cells = card.querySelectorAll(`.bingo-cell[data-col="${col}"]`);
        return Array.from(cells).every(cell => cell.classList.contains('marked') || cell.classList.contains('free'));
    });
}

// Verificar si hay cartón completo
function checkFullCard(card) {
    const cells = card.querySelectorAll('.bingo-cell');
    return Array.from(cells).every(cell => cell.classList.contains('marked') || cell.classList.contains('free'));
}

// Mostrar/Ocultar recuadro de premiaciones
document.getElementById('togglePrizeBox').addEventListener('click', () => {
    const prizeBox = document.getElementById('prizeBox');
    prizeBox.classList.toggle('hidden');
    prizeBox.classList.toggle('visible');
    if (prizeBox.classList.contains('visible')) {
        const prizeDetails = document.getElementById('prizeDetails');
        prizeDetails.innerHTML = `
            <strong>Premio Figura:</strong> ${(totalPrize * 0.10).toFixed(2)}<br>
            <strong>Premio Línea:</strong> ${(totalPrize * 0.05).toFixed(2)}<br>
            <strong>Premio Bingo:</strong> ${(totalPrize * 0.45).toFixed(2)}
        `;
    }
});

// Exportar cartones a PDF
document.getElementById('exportPdfButton').addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const cards = document.querySelectorAll('.bingo-card');
    const cardsPerPage = 6;
    const margin = 10;
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const cardWidth = (pageWidth - 4 * margin) / 3; // Adjust card width to fit 3 cards per row
    const cardHeight = (pageHeight - 12 * margin) / 2; // Adjust card height to fit 2 rows per page
    const maxCardsPerPdf = 60; // Limit to 10 pages per PDF

    let pdfCount = 1;
    let doc = new jsPDF();

    for (let i = 0; i < cards.length; i++) {
        if (i > 0 && i % maxCardsPerPdf === 0) {
            const startCard = (pdfCount - 1) * maxCardsPerPdf + 1;
            const endCard = pdfCount * maxCardsPerPdf;
            doc.save(`bingo-cards-${startCard}-to-${endCard}.pdf`);
            pdfCount++;
            doc = new jsPDF();
        }

        const card = cards[i];
        const canvas = await html2canvas(card, { scale: 2 });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);

        const x = margin + (i % 3) * (cardWidth + margin);
        const y = margin + Math.floor((i % cardsPerPage) / 3) * (cardHeight + margin);

        doc.addImage(imgData, 'JPEG', x, y, cardWidth, cardHeight);
        if (i > 0 && (i + 1) % cardsPerPage === 0 && (i + 1) < cards.length) {
            doc.addPage();
        }
    }

    const startCard = (pdfCount - 1) * maxCardsPerPdf + 1;
    const endCard = Math.min(pdfCount * maxCardsPerPdf, cards.length);
    doc.save(`bingo-cards-${startCard}-to-${endCard}.pdf`);
});

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeBallsGrid();
    document.getElementById('generateNumber').addEventListener('click', generateRandomNumber);
    document.getElementById('generateCards').addEventListener('click', generateCards);
});