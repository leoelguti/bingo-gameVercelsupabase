// ============================================================
// Bingo Pro Max — Player Client (Multi-Card Selection + Batch Payment)
// ============================================================

let playerName = '';
let playerDisplayName = '';
const supabaseUrl = 'https://rhzgfxbunkbqqkgiregs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoemdmeGJ1bmticXFrZ2lyZWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjA0MTgsImV4cCI6MjA4ODA5NjQxOH0.eMcZdTUP7zvUUhMos-IGQF2Bhh53_V1_vGtB1hDlbAM';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const bingoChannel = supabaseClient.channel('bingo-room');
let calledNumbers = new Set();
let myCards = new Set();       // Serials de mis cartones (cualquier estado)
let myCardStatuses = {};       // { serial: 'reserved' | 'payment_sent' | 'confirmed' }
let allCards = [];
let cardPrice = 0;
let currentTab = 'store';

// Carrito de selección
let selectedCards = new Set();  // Serials seleccionados para comprar

// Payment modal
let activePaymentSerials = []; // Serials en el modal de pago actual
let paymentTimerInterval = null;
let salesLocked = false;        // Bloqueo de ventas cuando la partida comienza
let markingMode = 'auto';       // 'manual' | 'auto'
let currentGameMode = 'figure'; // Modo de juego actual
let animatorPaymentConfig = { bank: '', phone: '', cedula: '' };
let manualMarks = {};           // { serial: Set<value> } para preservar marcas manuales
let totalPrize = 0;             // Pote total del juego
let gamePaused = false;         // Juego pausado mientras se verifica un canto
let currentGameId = '';         // ID único de la partida actual
let currentSelectedFigure = 'X'; // Figura seleccionada por el animador

// ============================================================
// Authentication
// ============================================================
const loginScreen = document.getElementById('loginScreen');
const gameView = document.getElementById('gameView');

// --- Tab Switching ---
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.auth-tab[data-auth-tab="${tab}"]`).classList.add('active');

    document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
    hideAuthError();
    if (window.lucide) window.lucide.createIcons();
}

// --- Password Toggle ---
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide) window.lucide.createIcons();
    }
}

// --- Error Display ---
function showAuthError(msg) {
    const el = document.getElementById('authError');
    document.getElementById('authErrorText').textContent = msg;
    el.classList.remove('hidden');
}

function hideAuthError() {
    document.getElementById('authError').classList.add('hidden');
}

// --- Login ---
async function loginPlayer() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showAuthError('Ingresa tu usuario y contraseña.');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Entrando...</span>';

    try {
        const { data, error } = await supabaseClient.from('bingo_users').select('*').eq('username', username).maybeSingle();
        if (error || !data) {
            showAuthError('Usuario no encontrado.');
            btn.disabled = false;
            btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="log-in" class="w-5 h-5"></i> Entrar al Juego</span>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (data.password === password) {
            const user = { username: data.username, displayName: data.display_name, role: data.role };
            localStorage.setItem('bingoUser', JSON.stringify(user));
            enterGame(user);
        } else {
            showAuthError('Contraseña incorrecta.');
            btn.disabled = false;
            btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="log-in" class="w-5 h-5"></i> Entrar al Juego</span>';
            if (window.lucide) window.lucide.createIcons();
        }
    } catch (err) {
        showAuthError('Error de conexión con el base de datos.');
        btn.disabled = false;
        btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="log-in" class="w-5 h-5"></i> Entrar al Juego</span>';
        if (window.lucide) window.lucide.createIcons();
    }
}

// --- Register ---
async function registerPlayer() {
    const displayName = document.getElementById('registerName').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;

    if (!displayName || !username || !password) {
        showAuthError('Todos los campos son obligatorios.');
        return;
    }

    if (password !== confirm) {
        showAuthError('Las contraseñas no coinciden.');
        return;
    }

    if (password.length < 4) {
        showAuthError('La contraseña debe tener al menos 4 caracteres.');
        return;
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center justify-center gap-2"><div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Creando...</span>';

    try {
        // Verificar si el usuario ya existe
        const { data: existingUser } = await supabaseClient.from('bingo_users').select('username').eq('username', username).maybeSingle();
        if (existingUser) {
            showAuthError('El usuario ya existe.');
            btn.disabled = false;
            btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="user-plus" class="w-5 h-5"></i> Crear Cuenta</span>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const newUser = { username, password, display_name: displayName, role: 'player' };
        const { error } = await supabaseClient.from('bingo_users').insert(newUser);

        if (!error) {
            const user = { username: newUser.username, displayName: newUser.display_name, role: newUser.role };
            localStorage.setItem('bingoUser', JSON.stringify(user));
            enterGame(user);
        } else {
            showAuthError('Error al crear usuario en la base de datos.');
            btn.disabled = false;
            btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="user-plus" class="w-5 h-5"></i> Crear Cuenta</span>';
            if (window.lucide) window.lucide.createIcons();
        }
    } catch (err) {
        showAuthError('Error de conexión con la base de datos.');
        btn.disabled = false;
        btn.innerHTML = '<span class="flex items-center justify-center gap-2"><i data-lucide="user-plus" class="w-5 h-5"></i> Crear Cuenta</span>';
        if (window.lucide) window.lucide.createIcons();
    }
}

// --- Enter Game (common entry point after auth) ---
function enterGame(user) {
    playerName = user.username; // Usar username para relaciones BD
    playerDisplayName = user.displayName; // Usar display name para mensajes UI
    document.getElementById('displayPlayerName').textContent = playerDisplayName;

    loginScreen.style.transition = 'opacity 0.4s';
    loginScreen.style.opacity = '0';
    setTimeout(() => {
        loginScreen.style.display = 'none';
        gameView.classList.remove('hidden');
        initBroadcast();
        loadInitialState();
    }, 400);
}

// --- Auto-login from localStorage ---
(function autoLogin() {
    const stored = localStorage.getItem('bingoUser');
    if (stored) {
        try {
            const user = JSON.parse(stored);
            if (user && user.username) {
                enterGame(user);
                return;
            }
        } catch (e) { /* ignore */ }
    }
})();

// --- Input validation for button enabling ---
document.addEventListener('DOMContentLoaded', () => {
    // Login form validation
    const loginUser = document.getElementById('loginUsername');
    const loginPass = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');

    function validateLoginForm() {
        loginBtn.disabled = !(loginUser.value.trim().length > 0 && loginPass.value.length > 0);
    }
    loginUser.addEventListener('input', validateLoginForm);
    loginPass.addEventListener('input', validateLoginForm);

    // Enter key for login
    loginPass.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !loginBtn.disabled) loginPlayer(); });
    loginUser.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !loginBtn.disabled) loginPlayer(); });

    // Register form validation
    const regName = document.getElementById('registerName');
    const regUser = document.getElementById('registerUsername');
    const regPass = document.getElementById('registerPassword');
    const regConfirm = document.getElementById('registerConfirm');
    const regBtn = document.getElementById('registerBtn');

    function validateRegForm() {
        regBtn.disabled = !(
            regName.value.trim().length >= 2 &&
            regUser.value.trim().length >= 3 &&
            regPass.value.length >= 4 &&
            regConfirm.value.length > 0
        );
    }
    regName.addEventListener('input', validateRegForm);
    regUser.addEventListener('input', validateRegForm);
    regPass.addEventListener('input', validateRegForm);
    regConfirm.addEventListener('input', validateRegForm);

    // Enter key for register
    regConfirm.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !regBtn.disabled) registerPlayer(); });
});

// ============================================================
// Supabase Broadcast Connection
// ============================================================
function initBroadcast() {
    bingoChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('[PLAYER] Conectado a Supabase Broadcast Channel');
            setConnectionStatus(true);

            // Solicitar sync del estado actual al animador
            bingoChannel.send({
                type: 'broadcast',
                event: 'request-sync',
                payload: {}
            });
        } else {
            setConnectionStatus(false);
        }
    });

    bingoChannel.on('broadcast', { event: 'cards-generated' }, (ev) => {
        const data = ev.payload;
        allCards = data.cards;
        cardPrice = data.cardPrice;
        myCards.clear();
        myCardStatuses = {};
        calledNumbers.clear();
        selectedCards.clear();
        salesLocked = false;
        markingMode = 'auto';
        manualMarks = {};
        gamePaused = false;
        totalPrize = 0;
        if (data.gameMode) currentGameMode = data.gameMode;
        if (data.selectedFigure) currentSelectedFigure = data.selectedFigure;
        if (data.gameId) currentGameId = data.gameId;
        updateCartBar();
        closePaymentModal();
        renderStore();
        renderMyCards();
        updateStats();
        updatePrizeDisplay();
        updateSingButtons();
        resetBallDisplay();
        showToast('El animador generó nuevos cartones. ¡Ve a la tienda!', 'info');
    });

    bingoChannel.on('broadcast', { event: 'card-purchased' }, (ev) => {
        const data = ev.payload;
        const card = allCards.find(c => String(c.serial) === String(data.serial));
        if (card) {
            card.status = data.status || 'reserved';
            card.buyer = data.buyer;
            card.reservedAt = data.reservedAt;
        }

        if (data.buyer === playerName || data.buyerDbName === playerName) {
            myCards.add(String(data.serial));
            myCardStatuses[data.serial] = data.status || 'reserved';
            // Quitar de seleccionados (ya se reservó)
            selectedCards.delete(String(data.serial));
        }

        updateCartBar();
        renderStore();
        renderMyCards();
        updateStats();
    });

    bingoChannel.on('broadcast', { event: 'card-released' }, (ev) => {
        const data = ev.payload;
        const card = allCards.find(c => String(c.serial) === String(data.serial));
        if (card) {
            card.status = 'available';
            card.buyer = null;
        }

        if (data.buyer === playerName || data.buyerDbName === playerName) {
            myCards.delete(String(data.serial));
            delete myCardStatuses[data.serial];

            const idx = activePaymentSerials.indexOf(String(data.serial));
            if (idx !== -1) {
                activePaymentSerials.splice(idx, 1);
                if (activePaymentSerials.length === 0) {
                    closePaymentModal();
                    showToast('Tus reservas fueron liberadas.', 'warning');
                }
            }
        }

        renderStore();
        renderMyCards();
        updateStats();
    });

    bingoChannel.on('broadcast', { event: 'payment-confirmed' }, (ev) => {
        const data = ev.payload;
        const card = allCards.find(c => String(c.serial) === String(data.serial));
        if (card) card.status = 'confirmed';

        if (data.buyerDbName === playerName) {
            myCards.add(String(data.serial));
            myCardStatuses[data.serial] = 'confirmed';

            const idx = activePaymentSerials.indexOf(String(data.serial));
            if (idx !== -1) {
                activePaymentSerials.splice(idx, 1);
            }
            if (activePaymentSerials.length === 0) {
                closePaymentModal();
            }
            showToast(`¡Pago confirmado! Cartón #${data.serial} es tuyo.`, 'success');
        }

        renderStore();
        renderMyCards();
        updateStats();
    });

    bingoChannel.on('broadcast', { event: 'new-ball' }, (ev) => {
        const data = ev.payload;
        calledNumbers = new Set(data.calledNumbers);
        updateBallDisplay(data.number, data.lastBalls, data.ballCount);
        markMyCards();
    });

    // === GAME-STARTED: ventas cerradas ===
    bingoChannel.on('broadcast', { event: 'game-started' }, (ev) => {
        const data = ev.payload;
        salesLocked = true;
        allCards = data.cards;
        selectedCards.clear();
        updateCartBar();
        closePaymentModal();

        // Actualizar myCards con los cartones que quedaron
        myCards.clear();
        myCardStatuses = {};
        allCards.forEach(c => {
            if (c.buyer === playerName || c.buyer_name === playerName) {
                myCards.add(String(c.serial));
                myCardStatuses[c.serial] = c.status || 'confirmed';
            }
        });

        // Determinar modo de marcado
        const confirmedCount = Object.values(myCardStatuses).filter(s => s === 'confirmed').length;
        if (confirmedCount <= 3) {
            markingMode = 'manual';
            showToast('🖐 Modo manual activado. Marca tus cartones tocando las celdas.', 'info');
        } else {
            // Mostrar modal de selección
            showModeSelectionModal();
        }

        // Guardar pote y modo de juego
        totalPrize = data.totalPrize || 0;
        if (data.gameMode) currentGameMode = data.gameMode;
        if (data.selectedFigure) currentSelectedFigure = data.selectedFigure;
        if (data.gameId) currentGameId = data.gameId;
        updatePrizeDisplay();

        renderStore();
        renderMyCards();
        updateStats();
        updateSingButtons();

        if (data.removedCount > 0) {
            showToast(`🎯 La partida comenzó. ${data.removedCount} cartón(es) no vendido(s) fueron retirados.`, 'warning');
        } else {
            showToast('🎯 La partida ha comenzado. ¡Buena suerte!', 'info');
        }
    });

    // === PAYMENT CONFIG UPDATED ===
    bingoChannel.on('broadcast', { event: 'payment-config-updated' }, (ev) => {
        const data = ev.payload;
        animatorPaymentConfig = data;
        updatePaymentConfigDisplay();
    });

    bingoChannel.on('broadcast', { event: 'winner-announced' }, (ev) => {
        const data = ev.payload;
        hideClaimOverlay(); // Cerrar overlay de verificación si estaba abierto
        const isMyCard = myCards.has(String(data.cardIndex));
        if (isMyCard) {
            showToast(`🎉 ¡FELICIDADES! Tu cartón #${data.cardIndex} ganó ${data.prizeType}!`, 'success');
            markCardAsWinner(data.cardIndex, data.prizeType);
        } else {
            showToast(`Cartón #${data.cardIndex} ganó ${data.prizeType}.`, 'warning');
        }

        if (data.nextMode) {
            currentGameMode = data.nextMode;
            const modeDisplay = document.getElementById('gameModeDisplay');
            if (data.nextMode === 'line') modeDisplay.textContent = 'Línea';
            else if (data.nextMode === 'bingo') modeDisplay.textContent = 'Bingo';
            else if (data.nextMode === 'figure') modeDisplay.textContent = 'Figura';
            updateSingButtons();
        }
    });

    // === GAME-PAUSED: alguien cantó ===
    bingoChannel.on('broadcast', { event: 'game-paused' }, (ev) => {
        const data = ev.payload;
        gamePaused = true;
        showClaimOverlay(data);
    });

    // === CLAIM-RESULT: resultado de verificación ===
    bingoChannel.on('broadcast', { event: 'claim-result' }, (ev) => {
        const data = ev.payload;
        gamePaused = false;
        hideClaimOverlay();
        if (data.valid) {
            showToast(`✅ "${data.playerName}" ganó ${data.claimType} con cartón #${data.cardSerial}. ¡Verificado!`, 'success');
        } else {
            showToast(`❌ El canto de "${data.playerName}" (${data.claimType}) fue rechazado. El juego continúa.`, 'warning');
        }
    });

    // === GAME-ENDED: Bingo validado, partida finalizada ===
    bingoChannel.on('broadcast', { event: 'game-ended' }, (ev) => {
        const data = ev.payload;
        hideClaimOverlay();
        gamePaused = false;
        showPlayerGameEndedModal(data);
    });

    // === WINNER-PAID: Animador registró el pago del premio ===
    bingoChannel.on('broadcast', { event: 'winner-paid' }, (ev) => {
        const data = ev.payload;
        if (myCards.has(String(data.cardSerial))) {
            showToast(`💰 ¡Tu premio de $${(data.amount || 0).toFixed(2)} por ${data.prizeType} (cartón #${data.cardSerial}) fue registrado como PAGADO!`, 'success');
        }
    });

    // === GAME-BREAK: Receso ===
    bingoChannel.on('broadcast', { event: 'game-break' }, (ev) => {
        const data = ev.payload;
        showToast(`⏸️ Receso de ${data.minutes} minuto(s). Pronto se reanudará.`, 'info');
    });

    bingoChannel.on('broadcast', { event: 'game-reset' }, () => {
        allCards = [];
        myCards.clear();
        myCardStatuses = {};
        calledNumbers.clear();
        cardPrice = 0;
        selectedCards.clear();
        salesLocked = false;
        markingMode = 'auto';
        manualMarks = {};
        updateCartBar();
        closePaymentModal();
        renderStore();
        renderMyCards();
        updateStats();
        resetBallDisplay();
        showToast('El animador inició una nueva partida.', 'info');
    });

    bingoChannel.on('broadcast', { event: 'sync-state' }, (ev) => {
        const data = ev.payload;
        calledNumbers = new Set(data.calledNumbers || []);
        allCards = data.cards || [];
        cardPrice = data.cardPrice || 0;

        allCards.forEach(c => {
            if (c.buyer === playerName || c.buyer_name === playerName) {
                myCards.add(String(c.serial));
                myCardStatuses[c.serial] = c.status || 'reserved';
            }
        });

        if (data.currentNumber) {
            updateBallDisplay(data.currentNumber, data.lastBalls || [], data.ballCount || 0);
        }
        if (data.gameMode) {
            currentGameMode = data.gameMode;
            const modeDisplay = document.getElementById('gameModeDisplay');
            if (data.gameMode === 'figure') modeDisplay.textContent = 'Figura';
            else if (data.gameMode === 'line') modeDisplay.textContent = 'Línea';
            else if (data.gameMode === 'bingo') modeDisplay.textContent = 'Bingo';
        }

        // Cargar paymentConfig del sync
        if (data.paymentConfig) {
            animatorPaymentConfig = data.paymentConfig;
            updatePaymentConfigDisplay();
        }

        // Cargar gameStarted y totalPrize del sync
        if (data.gameStarted) {
            salesLocked = true;
            totalPrize = data.totalPrize || 0;
            if (data.gameId) currentGameId = data.gameId;
            if (data.selectedFigure) currentSelectedFigure = data.selectedFigure;
            updatePrizeDisplay();
            updateSingButtons();
        }

        renderStore();
        renderMyCards();
        updateStats();
    });
}

function setConnectionStatus(connected) {
    const dot = document.getElementById('connectionDot');
    dot.className = connected ? 'connection-dot connected' : 'connection-dot disconnected';
}

// ============================================================
// Initial Load via API
// ============================================================
async function loadInitialState() {
    try {
        const [cardsRes, stateRes, configRes] = await Promise.all([
            supabaseClient.from('bingo_cards').select('*'),
            supabaseClient.from('bingo_game_state').select('state').eq('id', 1).single(),
            supabaseClient.from('bingo_payment_config').select('methods').eq('id', 1).single()
        ]);

        if (!cardsRes.error && cardsRes.data) {
            allCards = cardsRes.data;
            cardPrice = cardsRes.data.length > 0 ? cardsRes.data[0].price : 0;

            allCards.forEach(c => {
                if (c.buyer_name === playerName) {
                    myCards.add(String(c.serial));
                    myCardStatuses[c.serial] = c.status || 'reserved';
                }
            });
        }

        if (!stateRes.error && stateRes.data && stateRes.data.state) {
            const stateData = stateRes.data.state;
            calledNumbers = new Set(stateData.calledNumbers || []);

            // Verificar si la partida ya comenzó
            if (stateData.gameStarted) {
                salesLocked = true;
                totalPrize = stateData.totalPrize || 0;
                updatePrizeDisplay();
            }

            if (stateData.currentNumber) {
                updateBallDisplay(stateData.currentNumber, stateData.lastBalls || [], stateData.ballCount || 0);
            }
            if (stateData.gameMode) currentGameMode = stateData.gameMode;
            if (stateData.selectedFigure) currentSelectedFigure = stateData.selectedFigure;
            if (stateData.currentGameId) currentGameId = stateData.currentGameId;
            const modeDisplay = document.getElementById('gameModeDisplay');
            if (stateData.gameMode === 'figure') modeDisplay.textContent = 'Figura';
            else if (stateData.gameMode === 'line') modeDisplay.textContent = 'Línea';
            else if (stateData.gameMode === 'bingo') modeDisplay.textContent = 'Bingo';
        }

        // Cargar paymentConfig
        if (!configRes.error && configRes.data) {
            animatorPaymentConfig = configRes.data.methods || [];
            updatePaymentConfigDisplay();
        }

        renderStore();
        renderMyCards();
        updateStats();
    } catch (err) {
        console.error('Error cargando estado inicial:', err);
    }
}

// ============================================================
// Ball Display
// ============================================================
function getLetterForNumber(number) {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
}

function updateBallDisplay(number, lastBalls, ballCount) {
    const currentBall = document.getElementById('currentBallDisplay');
    currentBall.textContent = getLetterForNumber(number) + number;
    currentBall.classList.remove('pulse');
    void currentBall.offsetWidth;
    currentBall.classList.add('pulse');

    document.getElementById('ballCountDisplay').innerHTML = `${ballCount}<span class="text-gray-500 text-sm">/75</span>`;

    const container = document.getElementById('lastBallsDisplay');
    container.innerHTML = '';
    if (lastBalls.length === 0) {
        container.innerHTML = '<span class="text-gray-500 text-sm italic">Esperando...</span>';
    } else {
        lastBalls.forEach(b => {
            const div = document.createElement('div');
            div.className = 'mini-ball';
            div.textContent = b;
            container.appendChild(div);
        });
    }

    // Update floating ball tracker for small screens
    const floatingBall = document.getElementById('floatingBallNumber');
    if (floatingBall) {
        floatingBall.textContent = getLetterForNumber(number) + number;
    }
    const floatingLast = document.getElementById('floatingLastBalls');
    if (floatingLast) {
        floatingLast.innerHTML = '';
        const last3 = lastBalls.slice(0, 3);
        last3.forEach(b => {
            const span = document.createElement('span');
            span.className = 'floating-mini-ball';
            span.textContent = b;
            floatingLast.appendChild(span);
        });
    }
}

function resetBallDisplay() {
    document.getElementById('currentBallDisplay').textContent = '?';
    document.getElementById('ballCountDisplay').innerHTML = '0<span class="text-gray-500 text-sm">/75</span>';
    document.getElementById('lastBallsDisplay').innerHTML = '<span class="text-gray-500 text-sm italic">Esperando...</span>';
    document.getElementById('gameModeDisplay').textContent = '—';
}

// ============================================================
// Tabs
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`tab-${tabId}`).classList.add('active');
        currentTab = tabId;
    });
});

// ============================================================
// Stats
// ============================================================
function updateStats() {
    document.getElementById('myCardsCount').textContent = myCards.size;
    document.getElementById('storePriceDisplay').textContent = `$${cardPrice}`;
    const available = allCards.filter(c => c.status === 'available').length;
    document.getElementById('storeAvailableDisplay').textContent = available;
}

// ============================================================
// Cart Bar
// ============================================================
function updateCartBar() {
    const bar = document.getElementById('cartBar');
    const count = selectedCards.size;

    if (count === 0) {
        bar.classList.add('hidden');
        return;
    }

    bar.classList.remove('hidden');
    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartLabel').textContent = `${count} cartón${count > 1 ? 'es' : ''} seleccionado${count > 1 ? 's' : ''}`;
    document.getElementById('cartTotal').textContent = `Total: $${count * cardPrice}`;
    if (window.lucide) window.lucide.createIcons();
}

// Cart buttons
document.getElementById('clearCartBtn').addEventListener('click', () => {
    selectedCards.clear();
    updateCartBar();
    renderStore();
});

document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (selectedCards.size === 0) return;
    checkoutCart();
});

// Toggle card selection
function toggleCardSelection(serial) {
    if (salesLocked) {
        showToast('La partida ya comenzó. No se pueden comprar más cartones.', 'warning');
        return;
    }
    serial = String(serial);
    if (selectedCards.has(serial)) {
        selectedCards.delete(serial);
    } else {
        selectedCards.add(serial);
    }
    updateCartBar();
    renderStore();
}

// ============================================================
// Checkout — Reserve all selected cards, then show payment modal
// ============================================================
async function checkoutCart() {
    if (salesLocked) {
        showToast('La partida ya comenzó. No se pueden comprar más cartones.', 'warning');
        return;
    }
    const serials = Array.from(selectedCards);
    if (serials.length === 0) return;

    try {
        // 1. Validar que los cartones sigan disponibles
        const { data: checkCards, error: checkErr } = await supabaseClient
            .from('bingo_cards')
            .select('serial, status')
            .in('serial', serials);

        if (checkErr) throw checkErr;

        const unavailableList = checkCards.filter(c => c.status !== 'available').map(c => c.serial);

        if (unavailableList.length > 0) {
            showToast('Algunos cartones seleccionados ya no están disponibles.', 'error');
            unavailableList.forEach(serial => selectedCards.delete(String(serial)));
            updateCartBar();
            renderStore();
            return;
        }

        // 2. Reservar en Supabase
        const reservedAt = new Date().toISOString();
        const { error: updateErr } = await supabaseClient
            .from('bingo_cards')
            .update({ status: 'reserved', buyer_name: playerName })
            .in('serial', serials);

        if (updateErr) throw updateErr;

        for (const serial of serials) {
            myCards.add(String(serial));
            myCardStatuses[serial] = 'reserved';

            const card = allCards.find(c => String(c.serial) === String(serial));
            if (card) {
                card.status = 'reserved';
                card.buyer_name = playerName; // local property update based on what Supabase used
                card.buyer = playerName;
            }
        }

        selectedCards.clear();
        updateCartBar();
        renderStore();
        renderMyCards();
        updateStats();

        // 3. Notificar a los demas participanes
        serials.forEach(serial => {
            bingoChannel.send({
                type: 'broadcast',
                event: 'card-purchased',
                payload: { serial, status: 'reserved', buyerDbName: playerName, buyerName: playerDisplayName, timestamp: reservedAt }
            });
        });

        // Abrir modal de pago
        openPaymentModal(serials, reservedAt);
        showToast(`${serials.length} cartón(es) reservado(s). Tienes 10 minutos para pagar.`, 'info');

    } catch (err) {
        console.error('Error en checkout:', err);
        showToast('Error de conexión o base de datos.', 'error');
    }
}

// ============================================================
// Store Rendering — Click to select (available) or open payment (reserved mine)
// ============================================================
function renderStore() {
    const grid = document.getElementById('storeGrid');
    grid.innerHTML = '';

    if (allCards.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i data-lucide="clock" class="w-16 h-16"></i>
                <p>Esperando a que el animador genere los cartones...</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // Si las ventas están cerradas, mostrar aviso
    if (salesLocked) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i data-lucide="lock" class="w-16 h-16" style="color: #f59e0b;"></i>
                <p style="color: #fbbf24; font-weight: 600;">🎯 Ventas cerradas — La partida ha comenzado</p>
                <p style="color: #9ca3af; font-size: 0.85rem;">Ve a la pestaña "Mis Cartones" para seguir tu juego.</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    allCards.forEach(card => {
        const serial = String(card.serial);
        const isMine = myCards.has(serial);
        const isSelected = selectedCards.has(serial);
        const cardStatus = card.status || 'available';
        const isAvailable = cardStatus === 'available';

        let statusClass, statusText;
        if (isSelected) {
            statusClass = 'available selected';
            statusText = '✓ Seleccionado';
        } else if (isMine) {
            const myStatus = myCardStatuses[card.serial] || 'reserved';
            if (myStatus === 'confirmed') {
                statusClass = 'mine';
                statusText = '✓ Confirmado';
            } else if (myStatus === 'payment_sent') {
                statusClass = 'mine';
                statusText = '⏳ Verificando';
            } else {
                statusClass = 'reserved';
                statusText = '⏱ Reservado';
            }
        } else if (isAvailable) {
            statusClass = 'available';
            statusText = 'Disponible';
        } else {
            statusClass = 'purchased';
            statusText = 'Vendido';
        }

        const cardEl = document.createElement('div');
        cardEl.className = `store-card glass-panel ${statusClass}`;

        // Build mini grid
        let miniGridHtml = '';
        'BINGO'.split('').forEach(letter => {
            miniGridHtml += `<div class="mini-header">${letter}</div>`;
        });

        if (card.numbers) {
            for (let row = 0; row < 5; row++) {
                'BINGO'.split('').forEach((letter) => {
                    const val = card.numbers[letter] ? card.numbers[letter][row] : '';
                    const isFree = val === 'FREE';
                    const isMarked = !isFree && calledNumbers.has(parseInt(val));
                    const classes = isFree ? 'mini-cell free' : isMarked ? 'mini-cell marked' : 'mini-cell';
                    miniGridHtml += `<div class="${classes}">${isFree ? '★' : val}</div>`;
                });
            }
        }

        // Selection checkbox for available cards
        let selectCheckHtml = '';
        if (isAvailable || isSelected) {
            selectCheckHtml = `<div class="select-check">${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>' : ''}</div>`;
        }

        let buyBtnHtml;
        if (isAvailable || isSelected) {
            const btnText = isSelected ? 'Quitar' : 'Seleccionar';
            const btnStyle = isSelected
                ? 'background: rgba(99, 102, 241, 0.3); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.4);'
                : '';
            buyBtnHtml = `<button class="buy-btn available" onclick="toggleCardSelection('${card.serial}')" style="${btnStyle}">${btnText}</button>`;
        } else if (isMine) {
            const myStatus = myCardStatuses[card.serial] || 'reserved';
            if (myStatus === 'reserved') {
                buyBtnHtml = `<button class="buy-btn available" onclick="openPaymentModalForReserved()" style="background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">Pagar</button>`;
            } else {
                buyBtnHtml = `<button class="buy-btn sold" disabled>${myStatus === 'confirmed' ? 'Confirmado' : 'Verificando'}</button>`;
            }
        } else {
            buyBtnHtml = `<button class="buy-btn sold" disabled>Vendido</button>`;
        }

        // Click handler on the card itself (for available cards)
        const clickHandler = (isAvailable || isSelected) ? `onclick="toggleCardSelection('${card.serial}')"` : '';
        const cursorStyle = (isAvailable || isSelected) ? 'cursor: pointer;' : '';

        cardEl.innerHTML = `
            ${selectCheckHtml}
            <div class="card-header-gradient"></div>
            <div class="card-serial-badge">Cartón #${card.serial}</div>
            <div class="card-status-badge">${statusText}</div>
            <div class="mini-grid">${miniGridHtml}</div>
            <div class="card-buy-area">
                <div class="card-price">$${cardPrice}</div>
                ${buyBtnHtml}
            </div>
        `;

        grid.appendChild(cardEl);
    });

    if (window.lucide) window.lucide.createIcons();
}

// ============================================================
// Payment Modal (Multi-card)
// ============================================================
function openPaymentModal(serials, reservedAt) {
    activePaymentSerials = serials.map(String);
    const modal = document.getElementById('paymentModal');
    const cardInfo = document.getElementById('paymentModalCardInfo');
    const body = document.querySelector('.payment-modal-body');
    const footer = document.querySelector('.payment-modal-footer');
    const waiting = document.getElementById('paymentWaitingState');
    const timer = document.getElementById('paymentTimer');

    const total = activePaymentSerials.length * cardPrice;
    cardInfo.textContent = `${activePaymentSerials.length} cartón(es) — Total: $${total}`;

    // Check if all already sent payment
    const allSent = activePaymentSerials.every(s => myCardStatuses[s] === 'payment_sent');
    if (allSent) {
        body.classList.add('hidden');
        footer.classList.add('hidden');
        waiting.classList.remove('hidden');
        timer.style.display = 'none';
    } else {
        body.classList.remove('hidden');
        footer.classList.remove('hidden');
        waiting.classList.add('hidden');
        timer.style.display = 'flex';

        document.getElementById('paymentPhone').value = '';
        document.getElementById('paymentBank').value = '';
        document.getElementById('paymentCedula').value = '';

        startPaymentTimer(reservedAt);
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

// Open modal for already-reserved cards (button on individual cards)
function openPaymentModalForReserved() {
    const reservedSerials = Object.entries(myCardStatuses)
        .filter(([_, status]) => status === 'reserved' || status === 'payment_sent')
        .map(([serial, _]) => serial);

    if (reservedSerials.length === 0) return;

    const card = allCards.find(c => reservedSerials.includes(String(c.serial)));
    const reservedAt = card?.reservedAt || null;
    openPaymentModal(reservedSerials, reservedAt);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.add('hidden');
    activePaymentSerials = [];
    if (paymentTimerInterval) {
        clearInterval(paymentTimerInterval);
        paymentTimerInterval = null;
    }
}

function startPaymentTimer(reservedAt) {
    if (paymentTimerInterval) clearInterval(paymentTimerInterval);

    let endTime;
    if (reservedAt) {
        endTime = new Date(reservedAt).getTime() + 10 * 60 * 1000;
    } else {
        endTime = Date.now() + 10 * 60 * 1000;
    }

    const timerText = document.getElementById('paymentTimerText');
    const timerEl = document.getElementById('paymentTimer');

    function updateTimer() {
        const remaining = Math.max(0, endTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (remaining < 2 * 60 * 1000) {
            timerEl.className = 'payment-timer urgent';
        } else {
            timerEl.className = 'payment-timer';
        }

        if (remaining <= 0) {
            clearInterval(paymentTimerInterval);
            timerText.textContent = '00:00';
        }
    }

    updateTimer();
    paymentTimerInterval = setInterval(updateTimer, 1000);
}

// Submit Payment (batch)
document.getElementById('submitPaymentBtn').addEventListener('click', async () => {
    if (activePaymentSerials.length === 0) return;

    const phone = document.getElementById('paymentPhone').value.trim();
    const bank = document.getElementById('paymentBank').value.trim();
    const cedula = document.getElementById('paymentCedula').value.trim();

    if (!phone || !bank || !cedula) {
        showToast('Por favor completa todos los campos.', 'error');
        return;
    }

    try {
        const totalAmount = activePaymentSerials.length * cardPrice;

        const paymentMethod = document.getElementById('paymentMethod') ? document.getElementById('paymentMethod').value : 'Transferencia';
        const referenceNumber = phone + ' / ' + bank + ' / ' + cedula;

        // Registrar en pagos
        const { error: insertErr } = await supabaseClient.from('bingo_payments').insert({
            buyer_name: playerName,
            payment_method: paymentMethod,
            reference_number: referenceNumber,
            amount: totalAmount,
            status: 'pending',
            cards: activePaymentSerials
        });

        if (insertErr) throw insertErr;

        // Actualizar cartones
        const { error: updateErr } = await supabaseClient
            .from('bingo_cards')
            .update({ status: 'payment_sent' })
            .in('serial', activePaymentSerials);

        if (updateErr) throw updateErr;

        for (const serial of activePaymentSerials) {
            myCardStatuses[serial] = 'payment_sent';
            const card = allCards.find(c => String(c.serial) === String(serial));
            if (card) card.status = 'payment_sent';

            // Avisar a todos del update local
            bingoChannel.send({
                type: 'broadcast',
                event: 'card-purchased',
                payload: {
                    serial,
                    status: 'payment_sent',
                    buyerDbName: playerName,
                    buyerName: playerDisplayName,
                    paymentData: { method: paymentMethod, ref: referenceNumber, amount: totalAmount }
                }
            });
        }

        document.querySelector('.payment-modal-body').classList.add('hidden');
        document.querySelector('.payment-modal-footer').classList.add('hidden');
        document.getElementById('paymentWaitingState').classList.remove('hidden');
        document.getElementById('paymentTimer').style.display = 'none';

        if (paymentTimerInterval) {
            clearInterval(paymentTimerInterval);
            paymentTimerInterval = null;
        }

        renderStore();
        renderMyCards();
        showToast('Pago enviado. Esperando verificación del animador.', 'success');
        if (window.lucide) window.lucide.createIcons();

    } catch (err) {
        console.error('Error enviando pago:', err);
        showToast('Error de conexión.', 'error');
    }
});

// Cancel Reservation (batch)
document.getElementById('cancelReservationBtn').addEventListener('click', async () => {
    if (activePaymentSerials.length === 0) return;

    try {
        const { error: updateErr } = await supabaseClient
            .from('bingo_cards')
            .update({ status: 'available', buyer_name: null })
            .in('serial', activePaymentSerials);

        if (updateErr) throw updateErr;

        for (const serial of activePaymentSerials) {
            myCards.delete(serial);
            delete myCardStatuses[serial];

            const card = allCards.find(c => String(c.serial) === String(serial));
            if (card) {
                card.status = 'available';
                card.buyer_name = null;
                card.buyer = null;
            }

            // Notifica
            bingoChannel.send({
                type: 'broadcast',
                event: 'card-released',
                payload: { serial, buyer: playerName, buyerDbName: playerName, buyerName: playerDisplayName }
            });
        }

        closePaymentModal();
        renderStore();
        renderMyCards();
        updateStats();
        showToast('Reservas canceladas.', 'info');

    } catch (err) {
        console.error('Error cancelando:', err);
        showToast('Error de conexión.', 'error');
    }
});

// ============================================================
// My Cards Rendering
// ============================================================
function renderMyCards() {
    const grid = document.getElementById('myCardsGrid');
    grid.innerHTML = '';

    const confirmedCards = allCards.filter(c =>
        myCards.has(String(c.serial)) && myCardStatuses[c.serial] === 'confirmed'
    );

    if (confirmedCards.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i data-lucide="shopping-bag" class="w-16 h-16"></i>
                <p>Aún no tienes cartones confirmados. Compra y paga para obtener tus cartones.</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        updateSingButtons();
        return;
    }

    const isManual = markingMode === 'manual';

    confirmedCards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'play-card';
        cardEl.id = `play-card-${card.serial}`;

        let gridHtml = '';
        if (card.numbers) {
            for (let row = 0; row < 5; row++) {
                'BINGO'.split('').forEach((letter) => {
                    const val = card.numbers[letter] ? card.numbers[letter][row] : '';
                    const isFree = val === 'FREE';
                    let isMarked;
                    if (isManual) {
                        // En modo manual, solo marcamos FREE automáticamente
                        isMarked = isFree;
                    } else {
                        isMarked = isFree || calledNumbers.has(parseInt(val));
                    }
                    const classes = isFree ? 'bingo-cell free marked' : isMarked ? 'bingo-cell marked' : 'bingo-cell';
                    gridHtml += `<div class="${classes}" data-value="${val}">${isFree ? 'FREE' : val}</div>`;
                });
            }
        }

        cardEl.innerHTML = `
            <div class="play-card-header-bg"></div>
            <div class="play-card-serial">Cartón #${card.serial}</div>
            <div class="bingo-header">
                <div>B</div><div>I</div><div>N</div><div>G</div><div>O</div>
            </div>
            <div class="bingo-grid">${gridHtml}</div>
        `;

        // En modo manual, agregar click handlers a las celdas
        if (isManual) {
            const cells = cardEl.querySelectorAll('.bingo-cell:not(.free)');
            cells.forEach(cell => {
                cell.addEventListener('click', () => {
                    const val = cell.getAttribute('data-value');
                    if (val && calledNumbers.has(parseInt(val))) {
                        cell.classList.toggle('marked');
                        if (cell.classList.contains('marked')) {
                            cell.style.transition = 'none';
                            cell.style.transform = 'scale(1.2)';
                            setTimeout(() => {
                                cell.style.transition = 'transform 0.3s';
                                cell.style.transform = 'scale(0.95)';
                            }, 100);
                        } else {
                            cell.style.transform = '';
                        }
                    } else if (val && !calledNumbers.has(parseInt(val))) {
                        showToast(`El número ${val} aún no ha sido cantado.`, 'warning');
                    }
                });
                cell.style.cursor = 'pointer';
            });
        }

        grid.appendChild(cardEl);
    });

    // Restaurar marcas manuales previas si existen
    if (isManual) {
        restoreManualMarks();
    }

    if (window.lucide) window.lucide.createIcons();
    updateSingButtons();
}

// saveManualMarks / restoreManualMarks — preservar marcas manuales entre re-renders

function saveManualMarks() {
    const cards = document.querySelectorAll('.play-card');
    cards.forEach(cardEl => {
        const serial = cardEl.id.replace('play-card-', '');
        const marked = new Set();
        cardEl.querySelectorAll('.bingo-cell.marked:not(.free)').forEach(cell => {
            marked.add(cell.getAttribute('data-value'));
        });
        manualMarks[serial] = marked;
    });
}

function restoreManualMarks() {
    const cards = document.querySelectorAll('.play-card');
    cards.forEach(cardEl => {
        const serial = cardEl.id.replace('play-card-', '');
        if (manualMarks[serial]) {
            cardEl.querySelectorAll('.bingo-cell:not(.free)').forEach(cell => {
                const val = cell.getAttribute('data-value');
                if (manualMarks[serial].has(val)) {
                    cell.classList.add('marked');
                }
            });
        }
    });
}

function markMyCards() {
    if (markingMode === 'manual') {
        // En modo manual, NO dar pistas. Solo guardar marcas previas.
        saveManualMarks();
        renderStore();
        return;
    }

    // Modo automático: marcar automáticamente
    const myCardElements = document.querySelectorAll('.play-card');
    myCardElements.forEach(cardEl => {
        const cells = cardEl.querySelectorAll('.bingo-cell');
        cells.forEach(cell => {
            const val = cell.getAttribute('data-value');
            if (val && val !== 'FREE' && calledNumbers.has(parseInt(val))) {
                if (!cell.classList.contains('marked')) {
                    cell.classList.add('marked');
                    cell.style.transition = 'none';
                    cell.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        cell.style.transition = 'transform 0.3s';
                        cell.style.transform = 'scale(0.95)';
                    }, 100);
                }
            }
        });
    });
    renderStore();
}

function markCardAsWinner(serial, prizeType) {
    const cardEl = document.getElementById(`play-card-${serial}`);
    if (!cardEl) return;

    // Check if this specific prizeType badge already exists
    const existingBadges = cardEl.querySelectorAll('.winner-badge-inline');
    for (const badge of existingBadges) {
        if (badge.textContent.includes(prizeType)) return; // Already has this badge
    }

    // Crear badge pequeño inline — allows multiple badges (e.g. Línea + Bingo)
    const badge = document.createElement('div');
    badge.className = 'winner-badge-inline';
    badge.innerHTML = `🏆 ${prizeType}`;

    // Insertar después del último badge existente, o después del serial
    const lastBadge = cardEl.querySelector('.winner-badge-inline:last-of-type');
    if (lastBadge) {
        lastBadge.insertAdjacentElement('afterend', badge);
    } else {
        const serialEl = cardEl.querySelector('.play-card-serial');
        if (serialEl) {
            serialEl.insertAdjacentElement('afterend', badge);
        } else {
            cardEl.prepend(badge);
        }
    }
}

// ============================================================
// Toast Notifications
// ============================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// Payment Config Display
// ============================================================
function updatePaymentConfigDisplay() {
    const infoBox = document.getElementById('paymentConfigInfo');
    if (!infoBox) return;

    // animatorPaymentConfig puede ser un array (de Supabase) o un objeto (de broadcast)
    let bank = '', phone = '', cedula = '';

    if (Array.isArray(animatorPaymentConfig)) {
        // Formato array de Supabase: [{type:'pago_movil', telefono:'...', cedula:'...'}, {type:'transferencia', banco:'...', cuenta:'...', cedula:'...'}]
        animatorPaymentConfig.forEach(m => {
            if (m.banco) bank = m.banco;
            if (m.cuenta && !bank) bank = m.cuenta;
            if (m.telefono) phone = m.telefono;
            if (m.cedula && !cedula) cedula = m.cedula;
        });
    } else if (animatorPaymentConfig && typeof animatorPaymentConfig === 'object') {
        bank = animatorPaymentConfig.bank || '';
        phone = animatorPaymentConfig.phone || '';
        cedula = animatorPaymentConfig.cedula || '';
    }

    if (bank || phone || cedula) {
        document.getElementById('payConfigInfoBank').textContent = bank || '—';
        document.getElementById('payConfigInfoPhone').textContent = phone || '—';
        document.getElementById('payConfigInfoCedula').textContent = cedula || '—';
        infoBox.classList.remove('hidden');
    } else {
        infoBox.classList.add('hidden');
    }
}

// ============================================================
// Mode Selection Modal
// ============================================================
function showModeSelectionModal() {
    const modal = document.getElementById('modeSelectModal');
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

document.getElementById('modeManualBtn').addEventListener('click', () => {
    markingMode = 'manual';
    document.getElementById('modeSelectModal').classList.add('hidden');
    renderMyCards();
    updateSingButtons();
    showToast('🖐 Modo manual activado. Marca tus cartones tocando las celdas.', 'info');
});

document.getElementById('modeAutoBtn').addEventListener('click', () => {
    markingMode = 'auto';
    document.getElementById('modeSelectModal').classList.add('hidden');
    renderMyCards();
    updateSingButtons();
    showToast('⚡ Modo automático activado.', 'info');
});

// ============================================================
// Sing Buttons (Cantar)
// ============================================================
function updateSingButtons() {
    const bar = document.getElementById('singButtonsBar');
    if (!bar) return;

    const confirmedCount = Object.values(myCardStatuses).filter(s => s === 'confirmed').length;
    const isManual = markingMode === 'manual';

    if (isManual && confirmedCount > 0 && salesLocked) {
        bar.classList.remove('hidden');
        bar.style.display = 'flex';

        // Habilitar/deshabilitar botones según modo de juego actual
        const lineBtn = document.getElementById('singLineBtn');
        const figBtn = document.getElementById('singFigureBtn');
        const bingoBtn = document.getElementById('singBingoBtn');

        // Línea: solo cuando el modo actual es 'line' o posterior
        if (lineBtn) {
            const lineEnabled = currentGameMode === 'line';
            lineBtn.disabled = !lineEnabled;
            lineBtn.style.opacity = lineEnabled ? '1' : '0.4';
            lineBtn.style.cursor = lineEnabled ? 'pointer' : 'not-allowed';
        }

        // Figura: solo cuando el modo es 'figure'
        if (figBtn) {
            const figEnabled = currentGameMode === 'figure';
            figBtn.disabled = !figEnabled;
            figBtn.style.opacity = figEnabled ? '1' : '0.4';
            figBtn.style.cursor = figEnabled ? 'pointer' : 'not-allowed';
            figBtn.style.display = 'flex';
        }

        // Bingo: solo cuando el modo es 'bingo'
        if (bingoBtn) {
            const bingoEnabled = currentGameMode === 'bingo';
            bingoBtn.disabled = !bingoEnabled;
            bingoBtn.style.opacity = bingoEnabled ? '1' : '0.4';
            bingoBtn.style.cursor = bingoEnabled ? 'pointer' : 'not-allowed';
        }
    } else {
        bar.classList.add('hidden');
    }

    if (window.lucide) window.lucide.createIcons();
}

document.getElementById('singLineBtn').addEventListener('click', () => {
    claimWin('Línea');
});

document.getElementById('singFigureBtn').addEventListener('click', () => {
    claimWin('Figura');
});

document.getElementById('singBingoBtn').addEventListener('click', () => {
    claimWin('Bingo');
});

function claimWin(claimType) {
    if (gamePaused) {
        showToast('Espera... se está verificando otro canto.', 'warning');
        return;
    }

    // Encontrar los cartones confirmados del jugador
    const myConfirmed = allCards.filter(c =>
        myCards.has(String(c.serial)) && myCardStatuses[c.serial] === 'confirmed'
    );

    if (myConfirmed.length === 0) {
        showToast('No tienes cartones para cantar.', 'warning');
        return;
    }

    // Validar que al menos un cartón tenga la jugada correcta
    const validCards = myConfirmed.filter(card => validateClaimOnCard(card, claimType));

    if (validCards.length === 0) {
        showToast(`❌ Ninguno de tus cartones tiene la jugada completa para cantar ${claimType}.`, 'warning');
        return;
    }

    // Enviar claim solo para los cartones que realmente tienen la jugada
    validCards.forEach(card => {
        bingoChannel.send({
            type: 'broadcast',
            event: 'player-claims-win',
            payload: {
                playerName: playerDisplayName,
                cardSerial: card.serial,
                claimType
            }
        });
    });

    showToast(`🎤 ¡Has cantado ${claimType}! Esperando verificación del animador...`, 'success');
}

// ============================================================
// Claim Validation — Verify card content before claiming
// ============================================================
function validateClaimOnCard(card, claimType) {
    // Cards are rendered with id="play-card-${serial}" and class="play-card"
    const cardEl = document.getElementById(`play-card-${card.serial}`);
    if (!cardEl) return false;

    // Get all cells from the bingo-grid (not headers)
    const gridContainer = cardEl.querySelector('.bingo-grid');
    if (!gridContainer) return false;
    const cells = gridContainer.querySelectorAll('.bingo-cell');
    // cells are rendered row-major: row 0 cols B,I,N,G,O then row 1 cols B,I,N,G,O etc.
    // So cell index = row * 5 + col

    const grid = [];
    for (let row = 0; row < 5; row++) {
        grid[row] = [];
        for (let col = 0; col < 5; col++) {
            const idx = row * 5 + col;
            const cell = cells[idx];
            if (!cell) {
                grid[row][col] = false;
                continue;
            }
            // Center cell (row 2, col 2) is FREE, always marked
            if (row === 2 && col === 2) {
                grid[row][col] = true;
            } else {
                grid[row][col] = cell.classList.contains('marked');
            }
        }
    }

    if (claimType === 'Línea') {
        // Check any complete row (horizontal line)
        for (let row = 0; row < 5; row++) {
            if (grid[row].every(v => v)) return true;
        }
        // Check any complete column (vertical line)
        for (let col = 0; col < 5; col++) {
            let colComplete = true;
            for (let row = 0; row < 5; row++) {
                if (!grid[row][col]) {
                    colComplete = false;
                    break;
                }
            }
            if (colComplete) return true;
        }
        return false;
    }

    if (claimType === 'Bingo') {
        // All cells must be marked
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (!grid[row][col]) return false;
            }
        }
        return true;
    }

    if (claimType === 'Figura') {
        // Validate based on currentSelectedFigure
        return validateFigure(grid, currentSelectedFigure);
    }

    return false;
}

function validateFigure(grid, figure) {
    const patterns = {
        'X': [[0, 0], [0, 4], [1, 1], [1, 3], [2, 2], [3, 1], [3, 3], [4, 0], [4, 4]],
        'L': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
        'T': [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 2], [3, 2], [4, 2]],
        'N': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 2], [3, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
        'H': [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2], [2, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]]
    };
    const cells = patterns[figure];
    if (!cells) return false;
    return cells.every(([row, col]) => grid[row][col]);
}

// ============================================================
// Prize Display
// ============================================================
function updatePrizeDisplay() {
    const el = document.getElementById('prizeDisplay');
    if (!el) return;
    if (salesLocked && totalPrize > 0) {
        el.textContent = `$${totalPrize.toFixed(2)}`;
        el.parentElement.classList.remove('hidden');
    } else {
        el.parentElement.classList.add('hidden');
    }
}

// ============================================================
// Claim Overlay (Game Paused)
// ============================================================
function showClaimOverlay(data) {
    let overlay = document.getElementById('claimOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'claimOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.75);
            backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div style="text-align: center; max-width: 400px; padding: 32px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706);
                display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
                box-shadow: 0 0 30px rgba(245,158,11,0.4); animation: pulse 1.5s infinite;">
                <span style="font-size: 2rem;">🎤</span>
            </div>
            <h2 style="color: white; font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; font-family: 'Outfit', sans-serif;">
                ¡${data.playerName} cantó ${data.claimType}!
            </h2>
            <p style="color: #fbbf24; font-size: 1rem; margin-bottom: 8px;">Cartón #${data.cardSerial}</p>
            <p style="color: #9ca3af; font-size: 0.85rem;">Esperando verificación del animador...</p>
            <div style="margin-top: 16px;">
                <div style="width: 40px; height: 40px; border: 3px solid #fbbf24; border-top-color: transparent;
                    border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
        </div>
    `;
}

function hideClaimOverlay() {
    const overlay = document.getElementById('claimOverlay');
    if (overlay) overlay.remove();
}

// ============================================================
// Init Lucide Icons
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

// ============================================================
// Player Game-Ended Modal
// ============================================================
function showPlayerGameEndedModal(data) {
    let overlay = document.getElementById('playerGameEndedOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'playerGameEndedOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.85);
            backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease; padding: 20px; overflow-y: auto;
        `;
        document.body.appendChild(overlay);
    }

    const pot = data.totalPrize || 0;
    const winners = data.winners || [];

    // Find this player's winning cards
    const myWinningCards = winners.filter(w => {
        const serial = String(w.cardIndex || w.cardSerial || '');
        return myCards.has(serial);
    });

    // Build winners list with names and amounts
    let winnersHtml = winners.map(w => {
        let icon = '🏆', color = '#34d399';
        let amount = 0;
        if (w.prizeType && w.prizeType.includes('Figura')) { icon = '⭐'; color = '#60a5fa'; amount = pot * 0.10; }
        else if (w.prizeType && w.prizeType.includes('Línea')) { icon = '🏅'; color = '#fb923c'; amount = pot * 0.20; }
        else if (w.prizeType && w.prizeType.includes('Bingo')) { icon = '🏆'; color = '#34d399'; amount = pot * 0.50; }
        const serial = w.cardIndex || w.cardSerial || '?';
        const isMine = myCards.has(String(serial));
        return `<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.05);
            border: 1px solid ${isMine ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 1.1rem;">${icon}</span>
                <span style="color: white; font-weight: 700; font-size: 0.85rem;">#${serial}</span>
                <span style="color: ${color}; font-weight: 700; font-size: 0.7rem; text-transform: uppercase;">${w.prizeType || '?'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: ${color}; font-weight: 700; font-size: 0.85rem;">$${amount.toFixed(2)}</span>
                ${isMine ? '<span style="background: linear-gradient(135deg, #059669, #10b981); color: white; font-weight: 700; padding: 2px 8px; border-radius: 6px; font-size: 0.65rem;">TÚ</span>' : ''}
            </div>
        </div>`;
    }).join('');

    // Build payment form for EACH winning card of this player
    let paymentFormsHtml = '';
    if (myWinningCards.length > 0) {
        paymentFormsHtml = myWinningCards.map((w, idx) => {
            const serial = w.cardIndex || w.cardSerial || '';
            const prizeType = w.prizeType || '?';
            let amount = 0;
            if (prizeType.includes('Figura')) amount = pot * 0.10;
            else if (prizeType.includes('Línea')) amount = pot * 0.20;
            else if (prizeType.includes('Bingo')) amount = pot * 0.50;

            return `
            <div style="margin-top: 12px; background: linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.05));
                border: 1px solid rgba(52,211,153,0.3); border-radius: 12px; padding: 16px; text-align: left;">
                <h4 style="color: #34d399; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 4px;
                    letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
                    🎉 ¡Felicidades! Cartón #${serial}
                </h4>
                <p style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 12px;">Premio: ${prizeType} — Monto: <span style="color: #34d399; font-weight: 700;">$${amount.toFixed(2)}</span></p>
                <p style="color: #d1d5db; font-size: 0.75rem; margin-bottom: 8px;">Ingresa tus datos para recibir el pago:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <input type="text" id="wd_name_${serial}" placeholder="Tu nombre completo" style="width: 100%; padding: 8px 12px;
                        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;
                        font-size: 0.8rem; outline: none; box-sizing: border-box;">
                    <input type="text" id="wd_cedula_${serial}" placeholder="Cédula V-12345678" style="width: 100%; padding: 8px 12px;
                        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;
                        font-size: 0.8rem; outline: none; box-sizing: border-box;">
                    <input type="text" id="wd_bank_${serial}" placeholder="Banco receptor" style="width: 100%; padding: 8px 12px;
                        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;
                        font-size: 0.8rem; outline: none; box-sizing: border-box;">
                    <input type="tel" id="wd_phone_${serial}" placeholder="Teléfono 04XX..." style="width: 100%; padding: 8px 12px;
                        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white;
                        font-size: 0.8rem; outline: none; box-sizing: border-box;">
                </div>
                <button onclick="submitWinnerPaymentData('${serial}', '${prizeType.replace(/'/g, "\\'")}', ${amount})" style="width: 100%; margin-top: 10px; padding: 10px; border-radius: 10px;
                    background: linear-gradient(135deg, #059669, #10b981); color: white; font-weight: 700; border: none;
                    cursor: pointer; font-size: 0.85rem; transition: all 0.2s;">
                    ✅ Enviar Datos de Pago
                </button>
            </div>`;
        }).join('');
    }

    overlay.innerHTML = `
        <div style="text-align: center; max-width: 480px; width: 100%; background: rgba(15,23,42,0.95);
            border: 1px solid rgba(234,179,8,0.4); border-radius: 16px; padding: 24px;
            box-shadow: 0 0 40px rgba(234,179,8,0.15); max-height: 90vh; overflow-y: auto;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706);
                display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
                box-shadow: 0 0 25px rgba(245,158,11,0.4);">
                <span style="font-size: 1.8rem;">🏆</span>
            </div>
            <h2 style="color: white; font-size: 1.4rem; font-weight: 700; margin-bottom: 4px; font-family: 'Outfit', sans-serif;">
                ¡Partida Finalizada!
            </h2>
            <p style="color: #9ca3af; font-size: 0.8rem; margin-bottom: 16px;">Pote: $${pot.toFixed(2)}</p>
            <div style="margin-bottom: 12px;">
                <h4 style="color: #fbbf24; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
                    margin-bottom: 8px;">Ganadores</h4>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto;">
                    ${winnersHtml || '<p style="color: #6b7280; font-size: 0.85rem; font-style: italic;">No hubo ganadores.</p>'}
                </div>
            </div>
            ${paymentFormsHtml}
            <button onclick="document.getElementById('playerGameEndedOverlay').remove();"
                style="margin-top: 16px; padding: 10px 24px; border-radius: 10px; background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2); color: white; font-weight: 600; cursor: pointer;
                font-size: 0.85rem; transition: all 0.2s; width: 100%;">
                Cerrar
            </button>
        </div>
    `;
}

function submitWinnerPaymentData(cardSerial, prizeType, amount) {
    const name = document.getElementById(`wd_name_${cardSerial}`)?.value.trim();
    const cedula = document.getElementById(`wd_cedula_${cardSerial}`)?.value.trim();
    const bank = document.getElementById(`wd_bank_${cardSerial}`)?.value.trim();
    const phone = document.getElementById(`wd_phone_${cardSerial}`)?.value.trim();

    if (!name) {
        showToast('Por favor ingresa tu nombre.', 'warning');
        return;
    }

    bingoChannel.send({
        type: 'broadcast',
        event: 'winner-payment-data',
        payload: {
            playerName: playerDisplayName,
            gameId: currentGameId,
            cardSerial: String(cardSerial),
            prizeType,
            amount,
            paymentData: { name, cedula, bank, phone }
        }
    });

    showToast('✅ Datos enviados. El animador te contactará para el pago.', 'success');
    // Disable the button and show confirmation
    const btn = event.target;
    if (btn) {
        btn.textContent = '✅ Datos Enviados';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
    }
}
