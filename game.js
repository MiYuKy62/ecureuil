// État du jeu
const GameState = {
    players: [],
    currentPlayerIndex: 0,
    deck: [],
    discardPile: [],
    drawnCard: null,
    phase: 'setup', // setup, peek_initial, playing, action, round_end
    actionPhase: null, // peek_self, peek_opponent, swap_select_own, swap_select_other
    selectedCards: [],
    totalScores: [],
    eliminated: [], // Joueurs éliminés
    closerIndex: null, // Index du joueur qui a fermé
    lastRoundMode: false, // Dernier tour après fermeture
    turnsLeftAfterClose: 0, // Nombre de tours restants après fermeture
    isOnline: false, // Mode en ligne
    myPlayerIndex: -1, // Mon index dans la partie en ligne
    hasDiscardedThisTurn: false, // A défaussé sa carte piochée ce tour (temps de réflexion pour jeter une carte)
    // Données de fin de manche (pour synchronisation)
    roundEndData: null // { roundScores, closerBonus, closerWon, newlyEliminated }
};

// Exposer GameState globalement pour Network
window.GameState = GameState;

// Éléments du DOM
const elements = {
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    lobbyScreen: document.getElementById('lobby-screen'),
    // Mode selection
    localModeBtn: document.getElementById('local-mode-btn'),
    onlineModeBtn: document.getElementById('online-mode-btn'),
    localSetup: document.getElementById('local-setup'),
    onlineSetup: document.getElementById('online-setup'),
    // Online setup
    hostName: document.getElementById('host-name'),
    createGame: document.getElementById('create-game'),
    joinName: document.getElementById('join-name'),
    gameCodeInput: document.getElementById('game-code'),
    joinGame: document.getElementById('join-game'),
    // Lobby
    displayGameCode: document.getElementById('display-game-code'),
    copyCode: document.getElementById('copy-code'),
    copyLink: document.getElementById('copy-link'),
    playerCount: document.getElementById('player-count'),
    lobbyPlayerList: document.getElementById('lobby-player-list'),
    hostControls: document.getElementById('host-controls'),
    startOnlineGame: document.getElementById('start-online-game'),
    waitingMessage: document.getElementById('waiting-message'),
    leaveLobby: document.getElementById('leave-lobby'),
    // Game
    playerNames: document.getElementById('player-names'),
    startGame: document.getElementById('start-game'),
    currentPlayerDisplay: document.getElementById('current-player-display'),
    gamePhase: document.getElementById('game-phase'),
    onlineIndicator: document.getElementById('online-indicator'),
    opponentsArea: document.getElementById('opponents-area'),
    activePlayerArea: document.getElementById('active-player-area'),
    activePlayerName: document.getElementById('active-player-name'),
    activePlayerCards: document.getElementById('active-player-cards'),
    drawPile: document.getElementById('draw-pile'),
    discardPile: document.getElementById('discard-pile'),
    deckCount: document.getElementById('deck-count'),
    drawnCardContainer: document.getElementById('drawn-card-container'),
    drawnCard: document.getElementById('drawn-card'),
    discardDrawn: document.getElementById('discard-drawn'),
    endLookPhase: document.getElementById('end-look-phase'),
    closeRound: document.getElementById('close-round'),
    endMyTurn: document.getElementById('end-my-turn'),
    nextTurn: document.getElementById('next-turn'),
    peekModal: document.getElementById('peek-modal'),
    peekModalTitle: document.getElementById('peek-modal-title'),
    peekCard: document.getElementById('peek-card'),
    closePeek: document.getElementById('close-peek'),
    roundEndModal: document.getElementById('round-end-modal'),
    roundEndTitle: document.getElementById('round-end-title'),
    closerResult: document.getElementById('closer-result'),
    roundResults: document.getElementById('round-results'),
    eliminatedPlayers: document.getElementById('eliminated-players'),
    nextRound: document.getElementById('next-round'),
    gameOverBtn: document.getElementById('game-over-btn'),
    gameOverModal: document.getElementById('game-over-modal'),
    finalRanking: document.getElementById('final-ranking'),
    restartGame: document.getElementById('restart-game'),
    rulesBtn: document.getElementById('rules-btn'),
    rulesModal: document.getElementById('rules-modal'),
    closeRules: document.getElementById('close-rules'),
    closeRulesBtn: document.getElementById('close-rules-btn'),
    // Notification modal
    notificationModal: document.getElementById('notification-modal'),
    notificationIcon: document.getElementById('notification-icon'),
    notificationTitle: document.getElementById('notification-title'),
    notificationMessage: document.getElementById('notification-message'),
    closeNotification: document.getElementById('close-notification'),
    // Invite modal
    inviteModal: document.getElementById('invite-modal'),
    inviteName: document.getElementById('invite-name'),
    joinViaInvite: document.getElementById('join-via-invite'),
    cancelInvite: document.getElementById('cancel-invite')
};

// Code d'invitation depuis l'URL
let pendingInviteCode = null;

// Nombre de joueurs sélectionné
let selectedPlayerCount = 4;

// Initialisation
function init() {
    setupEventListeners();
    updatePlayerNameInputs();
    setupNetworkCallbacks();
    checkUrlForGameCode();
}

// Configuration des callbacks réseau
function setupNetworkCallbacks() {
    Network.onPlayersUpdate = (players) => {
        updateLobbyDisplay(players);
    };

    Network.onGameStart = (gameState) => {
        receiveGameState(gameState);
        elements.lobbyScreen.classList.remove('active');
        elements.gameScreen.classList.add('active');
        if (GameState.isOnline) {
            elements.onlineIndicator.classList.remove('hidden');
        }
    };

    Network.onGameStateUpdate = (state) => {
        receiveGameState(state);
    };

    Network.onPlayerAction = (action, playerId) => {
        handleRemoteAction(action, playerId);
    };

    Network.onError = (message) => {
        alert(message);
        goToMenu();
    };
}

// Configuration des event listeners
function setupEventListeners() {
    // Mode selection
    elements.localModeBtn.addEventListener('click', () => selectMode('local'));
    elements.onlineModeBtn.addEventListener('click', () => selectMode('online'));

    // Online mode
    elements.createGame.addEventListener('click', createOnlineGame);
    elements.joinGame.addEventListener('click', joinOnlineGame);
    elements.copyCode.addEventListener('click', copyGameCode);
    elements.copyLink.addEventListener('click', copyInviteLink);
    elements.startOnlineGame.addEventListener('click', startOnlineGame);
    elements.leaveLobby.addEventListener('click', leaveLobby);

    // Sélection du nombre de joueurs
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPlayerCount = parseInt(btn.dataset.count);
            updatePlayerNameInputs();
        });
    });

    // Démarrer la partie
    elements.startGame.addEventListener('click', startGame);

    // Piocher une carte
    elements.drawPile.addEventListener('click', () => handleAction('draw'));

    // Récupérer depuis la défausse
    elements.discardPile.addEventListener('click', () => handleAction('take-discard'));

    // Défausser la carte piochée
    elements.discardDrawn.addEventListener('click', () => handleAction('discard-drawn'));

    // Fin de la phase de regard initial
    elements.endLookPhase.addEventListener('click', () => handleAction('end-look'));

    // Tour suivant
    elements.nextTurn.addEventListener('click', nextTurn);
    
    // Terminer mon tour (sans piocher ni jeter)
    elements.endMyTurn.addEventListener('click', () => handleAction('end-my-turn'));

    // Fermer le modal de peek
    elements.closePeek.addEventListener('click', closePeekModal);

    // Fermer la manche (Je ferme !)
    elements.closeRound.addEventListener('click', () => handleAction('close-round'));

    // Manche suivante
    elements.nextRound.addEventListener('click', () => {
        if (GameState.isOnline) {
            if (Network.isHost) {
                startNewRoundOnline();
            } else {
                // L'invité demande à l'hôte de lancer la nouvelle manche
                Network.sendAction({ type: 'request_next_round' });
                elements.roundEndModal.classList.add('hidden');
            }
        } else {
            startNewRound();
        }
    });

    // Fin de partie - voir classement
    elements.gameOverBtn.addEventListener('click', showFinalRanking);

    // Nouvelle partie
    elements.restartGame.addEventListener('click', restartGame);
    
    // Règles du jeu
    elements.rulesBtn.addEventListener('click', openRulesModal);
    elements.closeRules.addEventListener('click', closeRulesModal);
    elements.closeRulesBtn.addEventListener('click', closeRulesModal);
    
    // Fermer le modal en cliquant en dehors
    elements.rulesModal.addEventListener('click', (e) => {
        if (e.target === elements.rulesModal) {
            closeRulesModal();
        }
    });
    
    // Notification modal
    elements.closeNotification.addEventListener('click', closeNotificationModal);
    elements.notificationModal.addEventListener('click', (e) => {
        if (e.target === elements.notificationModal) {
            closeNotificationModal();
        }
    });
    
    // Invite modal (lien d'invitation)
    elements.joinViaInvite.addEventListener('click', joinViaInvite);
    elements.cancelInvite.addEventListener('click', cancelInvite);
    elements.inviteName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinViaInvite();
    });
}

// Sélectionner le mode de jeu
function selectMode(mode) {
    if (mode === 'local') {
        elements.localModeBtn.classList.add('active');
        elements.onlineModeBtn.classList.remove('active');
        elements.localSetup.classList.remove('hidden');
        elements.onlineSetup.classList.add('hidden');
    } else {
        elements.localModeBtn.classList.remove('active');
        elements.onlineModeBtn.classList.add('active');
        elements.localSetup.classList.add('hidden');
        elements.onlineSetup.classList.remove('hidden');
    }
}

// Créer une partie en ligne
async function createOnlineGame() {
    const name = elements.hostName.value.trim() || 'Hôte';
    try {
        elements.createGame.disabled = true;
        elements.createGame.textContent = 'Création...';
        
        const code = await Network.createGame(name);
        
        elements.displayGameCode.textContent = code;
        elements.menuScreen.classList.remove('active');
        elements.lobbyScreen.classList.add('active');
        elements.hostControls.classList.remove('hidden');
        elements.waitingMessage.classList.add('hidden');
        
        GameState.isOnline = true;
    } catch (err) {
        alert(err.message);
    } finally {
        elements.createGame.disabled = false;
        elements.createGame.textContent = 'Créer';
    }
}

// Rejoindre une partie en ligne
async function joinOnlineGame() {
    const name = elements.joinName.value.trim() || 'Joueur';
    const code = elements.gameCodeInput.value.trim().toUpperCase();
    
    if (!code) {
        alert('Entrez le code de la partie');
        return;
    }
    
    try {
        elements.joinGame.disabled = true;
        elements.joinGame.textContent = 'Connexion...';
        
        await Network.joinGame(code, name);
        
        elements.displayGameCode.textContent = code;
        elements.menuScreen.classList.remove('active');
        elements.lobbyScreen.classList.add('active');
        elements.hostControls.classList.add('hidden');
        elements.waitingMessage.classList.remove('hidden');
        
        GameState.isOnline = true;
    } catch (err) {
        alert(err.message);
    } finally {
        elements.joinGame.disabled = false;
        elements.joinGame.textContent = 'Rejoindre';
    }
}

// Copier le code de la partie
function copyGameCode() {
    const code = elements.displayGameCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
        elements.copyCode.textContent = '✓';
        setTimeout(() => {
            elements.copyCode.textContent = '📋';
        }, 2000);
    });
}

// Copier le lien d'invitation
function copyInviteLink() {
    const code = elements.displayGameCode.textContent;
    const baseUrl = window.location.origin + window.location.pathname;
    const inviteLink = `${baseUrl}?code=${code}`;
    
    navigator.clipboard.writeText(inviteLink).then(() => {
        elements.copyLink.textContent = '✓ Lien copié !';
        setTimeout(() => {
            elements.copyLink.textContent = '🔗 Copier le lien d\'invitation';
        }, 2000);
    });
}

// Vérifier si un code est dans l'URL au chargement
function checkUrlForGameCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        // Stocker le code
        pendingInviteCode = code;
        // Afficher la popup d'invitation
        elements.inviteModal.classList.remove('hidden');
        // Focus sur le champ pseudo
        elements.inviteName.focus();
        // Nettoyer l'URL sans recharger la page
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Rejoindre via le lien d'invitation
async function joinViaInvite() {
    const name = elements.inviteName.value.trim();
    
    if (!name) {
        elements.inviteName.style.borderColor = '#e74c3c';
        elements.inviteName.placeholder = 'Pseudo requis !';
        return;
    }
    
    if (!pendingInviteCode) {
        elements.inviteModal.classList.add('hidden');
        return;
    }
    
    // Masquer la popup
    elements.inviteModal.classList.add('hidden');
    
    // Rejoindre la partie
    GameState.isOnline = true;
    
    try {
        await Network.joinGame(pendingInviteCode, name);
        // Succès - aller au lobby
        elements.menuScreen.classList.remove('active');
        elements.lobbyScreen.classList.add('active');
        elements.hostControls.classList.add('hidden');
        elements.waitingMessage.classList.remove('hidden');
    } catch (error) {
        showNotification('error', 'Erreur', error.message || 'Impossible de rejoindre la partie');
    }
}

// Annuler l'invitation
function cancelInvite() {
    pendingInviteCode = null;
    elements.inviteModal.classList.add('hidden');
}

// Mettre à jour l'affichage du lobby
function updateLobbyDisplay(players) {
    elements.playerCount.textContent = players.length;
    elements.lobbyPlayerList.innerHTML = '';
    
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        if (player.isHost) div.classList.add('host');
        if (player.id === Network.myId) div.classList.add('me');
        
        div.innerHTML = `
            <span>${player.name}${player.id === Network.myId ? ' (vous)' : ''}</span>
            ${player.isHost ? '<span class="player-badge">Hôte</span>' : ''}
        `;
        elements.lobbyPlayerList.appendChild(div);
    });
    
    // Activer le bouton de lancement si assez de joueurs
    if (Network.isHost) {
        elements.startOnlineGame.disabled = players.length < 2;
        elements.startOnlineGame.textContent = players.length < 2 
            ? 'Lancer la partie (min. 2 joueurs)'
            : `Lancer la partie (${players.length} joueurs)`;
    }
}

// Démarrer la partie en ligne (hôte)
function startOnlineGame() {
    if (!Network.isHost || Network.players.length < 2) return;
    
    // Initialiser l'état du jeu
    initializeOnlineGameState();
    
    // Envoyer l'état à tous les joueurs
    Network.startGame(getSerializableGameState());
}

// Initialiser l'état du jeu pour le mode en ligne
function initializeOnlineGameState() {
    GameState.players = [];
    GameState.totalScores = [];
    GameState.eliminated = [];
    GameState.isOnline = true;
    
    Network.players.forEach((player, index) => {
        GameState.players.push({
            name: player.name,
            peerId: player.id,
            cards: [],
            hasLookedAtInitialCards: false
        });
        GameState.totalScores.push(0);
        GameState.eliminated.push(false);
    });
    
    // Initialiser le deck
    GameState.deck = CardUtils.shuffleDeck(CardUtils.createDeck());
    GameState.discardPile = [];
    GameState.currentPlayerIndex = 0;
    GameState.closerIndex = null;
    GameState.lastRoundMode = false;
    GameState.turnsLeftAfterClose = 0;
    GameState.drawnCard = null;
    GameState.hasDiscardedThisTurn = false;
    GameState.phase = 'peek_initial';
    
    // Distribuer les cartes
    GameState.players.forEach(player => {
        player.cards = [];
        for (let i = 0; i < 4; i++) {
            player.cards.push({
                card: GameState.deck.pop(),
                faceUp: false,
                canPeek: i >= 2,
                hasBeenPeeked: false
            });
        }
    });
    
    // Pas de carte dans la défausse au début - le premier joueur piochera
    // GameState.discardPile reste vide
    
    // Tirer aléatoirement le premier joueur
    GameState.currentPlayerIndex = Math.floor(Math.random() * GameState.players.length);
    
    // Trouver mon index
    GameState.myPlayerIndex = Network.getMyPlayerIndex();
}

// Obtenir l'état du jeu sérialisable
function getSerializableGameState() {
    return {
        players: GameState.players,
        currentPlayerIndex: GameState.currentPlayerIndex,
        deck: GameState.deck,
        discardPile: GameState.discardPile,
        drawnCard: GameState.drawnCard,
        phase: GameState.phase,
        actionPhase: GameState.actionPhase,
        selectedCards: GameState.selectedCards,
        totalScores: GameState.totalScores,
        eliminated: GameState.eliminated,
        closerIndex: GameState.closerIndex,
        lastRoundMode: GameState.lastRoundMode,
        turnsLeftAfterClose: GameState.turnsLeftAfterClose,
        hasDiscardedThisTurn: GameState.hasDiscardedThisTurn,
        roundEndData: GameState.roundEndData
    };
}

// Recevoir l'état du jeu (clients)
function receiveGameState(state) {
    const previousPhase = GameState.phase;
    
    GameState.players = state.players;
    GameState.currentPlayerIndex = state.currentPlayerIndex;
    GameState.deck = state.deck;
    GameState.discardPile = state.discardPile;
    GameState.drawnCard = state.drawnCard;
    GameState.phase = state.phase;
    GameState.actionPhase = state.actionPhase;
    GameState.selectedCards = state.selectedCards || [];
    GameState.totalScores = state.totalScores;
    GameState.eliminated = state.eliminated;
    GameState.closerIndex = state.closerIndex;
    GameState.lastRoundMode = state.lastRoundMode;
    GameState.turnsLeftAfterClose = state.turnsLeftAfterClose;
    GameState.hasDiscardedThisTurn = state.hasDiscardedThisTurn || false;
    GameState.roundEndData = state.roundEndData || null;
    GameState.isOnline = true;
    
    // Trouver mon index
    GameState.myPlayerIndex = Network.getMyPlayerIndex();
    
    // Si on vient de passer en phase round_end et qu'on a les données, afficher le modal
    if (GameState.phase === 'round_end' && GameState.roundEndData && previousPhase !== 'round_end') {
        const { roundScores, closerBonus, closerWon, newlyEliminated } = GameState.roundEndData;
        showRoundResults(roundScores, closerBonus, closerWon, newlyEliminated);
    }
    
    updateDisplay();
}

// Gérer une action (locale ou réseau)
function handleAction(actionType, data = {}) {
    // Vérifications préventives pour les actions de pioche
    if (actionType === 'draw' || actionType === 'take-discard') {
        if (GameState.phase !== 'playing') {
            console.log('Cannot draw: not in playing phase', GameState.phase);
            return;
        }
        if (GameState.drawnCard) {
            console.log('Cannot draw: already have a drawn card');
            return;
        }
        if (GameState.hasDiscardedThisTurn) {
            console.log('Cannot draw: already discarded this turn');
            return;
        }
    }
    
    if (GameState.isOnline) {
        // Phase peek_initial : tous les joueurs peuvent agir en même temps
        if (GameState.phase === 'peek_initial' && (actionType === 'peek-initial' || actionType === 'end-look')) {
            // Envoyer l'action (l'hôte l'exécute via onPlayerAction)
            Network.sendAction({ type: actionType, data });
            return;
        }
        
        // L'action discard-matching peut être faite par n'importe quel joueur à tout moment
        if (actionType === 'discard-matching') {
            Network.sendAction({ type: actionType, data });
            return;
        }
        
        // En ligne : vérifier si c'est mon tour
        const isMyTurn = GameState.currentPlayerIndex === GameState.myPlayerIndex;
        
        if (!isMyTurn) {
            return; // Pas mon tour
        }
        
        // Envoyer l'action (l'hôte l'exécute via onPlayerAction, le client attend la réponse)
        Network.sendAction({ type: actionType, data });
    } else {
        // Mode local : exécuter directement
        executeAction({ type: actionType, data });
    }
}

// Gérer une action distante (hôte seulement)
function handleRemoteAction(action, playerId) {
    if (!Network.isHost) return;
    
    // Trouver l'index du joueur
    const playerIndex = GameState.players.findIndex(p => p.peerId === playerId);
    if (playerIndex === -1) {
        console.log('Joueur non trouvé:', playerId);
        return;
    }
    
    // Pour l'action "request_next_round", on lance la nouvelle manche
    if (action.type === 'request_next_round') {
        startNewRoundOnline();
        return;
    }
    
    // Pour l'action "player-ready" ou "end-look", n'importe quel joueur peut la faire pendant la phase peek_initial
    if (action.type === 'player-ready' || action.type === 'end-look') {
        if (GameState.phase === 'peek_initial') {
            GameState.players[playerIndex].hasLookedAtInitialCards = true;
            checkAllPlayersReady();
        }
        return;
    }
    
    // Pour l'action "discard-matching", n'importe quel joueur peut la faire à tout moment
    if (action.type === 'discard-matching') {
        // Pas de vérification de tour - tout le monde peut tenter de jeter une carte
        // On passe le playerIndex pour savoir qui fait l'action
        discardMatchingCardForPlayer(playerIndex, action.data.cardIndex);
        Network.broadcastGameState(getSerializableGameState());
        return;
    } else if (action.type === 'peek-initial') {
        // Pendant la phase peek_initial, chaque joueur peut regarder SES cartes
        if (GameState.phase !== 'peek_initial') {
            return;
        }
        // Exécuter pour ce joueur spécifique
        peekInitialCardForPlayer(playerIndex, action.data.cardIndex);
        Network.broadcastGameState(getSerializableGameState());
        return;
    } else {
        // Vérifier que c'est bien son tour
        const isHisTurn = playerIndex === GameState.currentPlayerIndex;
        
        if (!isHisTurn) {
            console.log('Pas le tour du joueur', playerIndex, 'tour actuel:', GameState.currentPlayerIndex);
            return;
        }
    }
    
    // Exécuter l'action
    executeAction(action, playerIndex);
    
    // Diffuser le nouvel état
    Network.broadcastGameState(getSerializableGameState());
}

// Exécuter une action
function executeAction(action, playerIndex = null) {
    switch (action.type) {
        case 'draw':
            drawCard();
            break;
        case 'take-discard':
            takeFromDiscard();
            break;
        case 'discard-drawn':
            discardDrawnCard();
            break;
        case 'replace-card':
            replaceCard(action.data.cardIndex);
            break;
        case 'discard-matching':
            discardMatchingCard(action.data.cardIndex);
            break;
        case 'peek-initial':
            peekInitialCard(action.data.cardIndex);
            break;
        case 'end-look':
            endLookPhase();
            break;
        case 'close-round':
            closeRound();
            break;
        case 'end-my-turn':
            endTurn();
            break;
        case 'peek-own':
            peekOwnCard(action.data.cardIndex);
            break;
        case 'peek-opponent':
            handleOpponentCardClickAction(action.data.playerIndex, action.data.cardIndex);
            break;
        case 'swap-own':
            selectOwnCardForSwap(action.data.cardIndex);
            break;
        case 'swap-other':
            handleOpponentCardClickAction(action.data.playerIndex, action.data.cardIndex);
            break;
    }
    
    // Update display en mode local
    if (!GameState.isOnline) {
        updateDisplay();
    }
}

// Quitter le lobby
function leaveLobby() {
    Network.disconnect();
    GameState.isOnline = false;
    elements.lobbyScreen.classList.remove('active');
    elements.menuScreen.classList.add('active');
}

// Retour au menu
function goToMenu() {
    Network.disconnect();
    GameState.isOnline = false;
    elements.gameScreen.classList.remove('active');
    elements.lobbyScreen.classList.remove('active');
    elements.menuScreen.classList.add('active');
}

// Nouvelle manche en ligne
function startNewRoundOnline() {
    if (!Network.isHost) return;
    
    elements.roundEndModal.classList.add('hidden');
    
    // Réinitialiser pour la nouvelle manche
    GameState.deck = CardUtils.shuffleDeck(CardUtils.createDeck());
    GameState.discardPile = [];
    GameState.closerIndex = null;
    GameState.lastRoundMode = false;
    GameState.turnsLeftAfterClose = 0;
    GameState.drawnCard = null;
    GameState.hasDiscardedThisTurn = false;
    GameState.roundEndData = null; // Réinitialiser les données de fin de manche

    GameState.players.forEach((player, index) => {
        if (GameState.eliminated[index]) return;
        
        player.cards = [];
        for (let i = 0; i < 4; i++) {
            player.cards.push({
                card: GameState.deck.pop(),
                faceUp: false,
                canPeek: i >= 2,
                hasBeenPeeked: false
            });
        }
        player.hasLookedAtInitialCards = false;
    });

    GameState.discardPile.push(GameState.deck.pop());
    
    // Trouver le premier joueur non éliminé
    GameState.currentPlayerIndex = 0;
    while (GameState.eliminated[GameState.currentPlayerIndex]) {
        GameState.currentPlayerIndex = (GameState.currentPlayerIndex + 1) % GameState.players.length;
    }
    
    GameState.phase = 'peek_initial';
    
    // Broadcast
    Network.broadcastGameState(getSerializableGameState());
    updateDisplay();
}

// Mettre à jour les champs de nom des joueurs
function updatePlayerNameInputs() {
    elements.playerNames.innerHTML = '';
    for (let i = 1; i <= selectedPlayerCount; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-name-input';
        input.placeholder = `Joueur ${i}`;
        input.dataset.playerIndex = i - 1;
        elements.playerNames.appendChild(input);
    }
}

// Démarrer la partie
function startGame() {
    // Récupérer les noms des joueurs
    const nameInputs = document.querySelectorAll('.player-name-input');
    GameState.players = [];
    GameState.totalScores = [];
    GameState.eliminated = [];

    nameInputs.forEach((input, index) => {
        GameState.players.push({
            name: input.value || `Joueur ${index + 1}`,
            cards: [],
            hasLookedAtInitialCards: false
        });
        GameState.totalScores.push(0);
        GameState.eliminated.push(false);
    });

    // Initialiser le deck
    GameState.deck = CardUtils.shuffleDeck(CardUtils.createDeck());
    GameState.discardPile = [];
    GameState.currentPlayerIndex = 0;
    GameState.closerIndex = null;
    GameState.lastRoundMode = false;
    GameState.turnsLeftAfterClose = 0;
    GameState.hasDiscardedThisTurn = false;
    GameState.drawnCard = null;

    // Distribuer 4 cartes à chaque joueur
    GameState.players.forEach(player => {
        player.cards = [];
        for (let i = 0; i < 4; i++) {
            player.cards.push({
                card: GameState.deck.pop(),
                faceUp: false,
                canPeek: i >= 2 // Seulement les 2 cartes du bas peuvent être regardées
            });
        }
    });

    // Mettre une carte dans la défausse
    GameState.discardPile.push(GameState.deck.pop());

    // Passer à l'écran de jeu
    elements.menuScreen.classList.remove('active');
    elements.gameScreen.classList.add('active');

    // Phase initiale : regarder les cartes du bas
    GameState.phase = 'peek_initial';
    updateDisplay();
}

// Mettre à jour l'affichage
function updateDisplay() {
    // En mode en ligne, afficher depuis le point de vue de mon joueur
    const displayPlayerIndex = GameState.isOnline ? GameState.myPlayerIndex : GameState.currentPlayerIndex;
    const currentPlayer = GameState.players[GameState.currentPlayerIndex];
    const isMyTurn = GameState.isOnline ? (GameState.currentPlayerIndex === GameState.myPlayerIndex) : true;

    // Mettre à jour le titre
    if (GameState.isOnline) {
        elements.currentPlayerDisplay.textContent = isMyTurn 
            ? `C'est votre tour !` 
            : `Tour de : ${currentPlayer.name}`;
    } else {
        elements.currentPlayerDisplay.textContent = `Tour de : ${currentPlayer.name}`;
    }

    // Mettre à jour la phase
    updatePhaseDisplay();

    // Mettre à jour le tableau des scores
    updateScoreboard();

    // Mettre à jour la zone des adversaires
    updateOpponentsDisplay();

    // Mettre à jour la zone du joueur actif (moi en mode en ligne)
    updateActivePlayerDisplay();

    // Mettre à jour la pioche et la défausse
    updateDeckDisplay();

    // Mettre à jour les boutons d'action
    updateActionButtons();
}

// Mettre à jour le tableau des scores
function updateScoreboard() {
    const scoreboard = document.getElementById('scoreboard-content');
    if (!scoreboard) return;
    
    // Créer un tableau des joueurs avec leurs scores pour le tri
    const playersWithScores = GameState.players.map((player, index) => ({
        player,
        index,
        score: GameState.totalScores[index] || 0,
        eliminated: GameState.eliminated[index] || false,
        cardCount: player.cards ? player.cards.length : 0
    }));
    
    // Trier par score (le plus bas est le meilleur), les éliminés à la fin
    playersWithScores.sort((a, b) => {
        if (a.eliminated && !b.eliminated) return 1;
        if (!a.eliminated && b.eliminated) return -1;
        return a.score - b.score;
    });
    
    // Générer le HTML
    scoreboard.innerHTML = playersWithScores.map((data, displayRank) => {
        const isCurrentTurn = data.index === GameState.currentPlayerIndex;
        const isMe = GameState.isOnline && data.index === GameState.myPlayerIndex;
        const rank = data.eliminated ? '💀' : displayRank + 1;
        
        let classes = 'score-row';
        if (isCurrentTurn) classes += ' current-turn';
        if (data.eliminated) classes += ' eliminated';
        if (isMe) classes += ' is-me';
        
        let rankClass = 'score-rank';
        if (!data.eliminated) {
            if (displayRank === 0) rankClass += ' rank-1';
            else if (displayRank === 1) rankClass += ' rank-2';
            else if (displayRank === 2) rankClass += ' rank-3';
        }
        
        return `
            <div class="${classes}">
                <div class="${rankClass}">${rank}</div>
                <div class="score-player-info">
                    <div class="score-player-name">${data.player.name}${isMe ? ' (vous)' : ''}</div>
                    <div class="score-player-cards">${data.cardCount} carte${data.cardCount > 1 ? 's' : ''}</div>
                </div>
                <div class="score-value">${data.score} pts</div>
            </div>
        `;
    }).join('');
}

// Mettre à jour l'affichage de la phase
function updatePhaseDisplay() {
    const isMyTurn = GameState.isOnline ? (GameState.currentPlayerIndex === GameState.myPlayerIndex) : true;
    const currentPlayerName = GameState.players[GameState.currentPlayerIndex]?.name || 'Joueur';
    const myIndex = GameState.isOnline ? GameState.myPlayerIndex : GameState.currentPlayerIndex;
    const myPlayer = GameState.players[myIndex];
    
    // Phase peek_initial : afficher le joueur actuel en mode local
    if (GameState.phase === 'peek_initial') {
        if (GameState.isOnline) {
            if (myPlayer && myPlayer.hasLookedAtInitialCards) {
                // J'ai déjà regardé mes cartes, attendre les autres
                elements.gamePhase.textContent = '✓ Vous avez mémorisé vos cartes. En attente des autres joueurs...';
            } else {
                // Je dois encore regarder mes cartes
                elements.gamePhase.textContent = 'Cliquez sur une de vos 2 cartes du bas pour les mémoriser (les deux seront révélées)';
            }
        } else {
            // Mode local : afficher le nom du joueur actuel
            if (myPlayer && myPlayer.hasLookedAtInitialCards) {
                elements.gamePhase.textContent = `✓ ${currentPlayerName} a mémorisé ses cartes. En attente des autres...`;
            } else {
                elements.gamePhase.textContent = `${currentPlayerName}, cliquez sur une carte du bas pour voir vos 2 cartes`;
            }
        }
        return;
    }
    
    if (GameState.isOnline && !isMyTurn) {
        // Ce n'est pas mon tour
        elements.gamePhase.textContent = `⏳ C'est au tour de ${currentPlayerName}...`;
        return;
    }
    
    switch (GameState.phase) {
        case 'playing':
            if (GameState.lastRoundMode) {
                const turnsLeft = GameState.turnsLeftAfterClose;
                elements.gamePhase.textContent = `⚠️ DERNIER TOUR ! ${turnsLeft} joueur(s) restant(s) à jouer`;
            } else if (GameState.drawnCard) {
                elements.gamePhase.textContent = 'Cliquez sur une de vos cartes pour l\'échanger, ou défaussez';
            } else if (GameState.hasDiscardedThisTurn) {
                // Après avoir défaussé, temps de réflexion
                const hasMatching = checkHasMatchingCards();
                if (hasMatching) {
                    elements.gamePhase.textContent = 'Jetez une carte (🟢 sûr) ou cliquez sur "Terminer mon tour"';
                } else {
                    elements.gamePhase.textContent = 'Tentez de jeter une carte (🟠 risqué) ou cliquez sur "Terminer mon tour"';
                }
            } else {
                // Début du tour, pas encore pioché
                const hasMatching = checkHasMatchingCards();
                if (hasMatching) {
                    elements.gamePhase.textContent = 'Piochez ou prenez la défausse';
                } else {
                    elements.gamePhase.textContent = 'Piochez ou prenez la défausse';
                }
            }
            break;
        case 'action':
            switch (GameState.actionPhase) {
                case 'peek_self':
                    elements.gamePhase.textContent = 'Cliquez sur une de vos cartes pour la regarder';
                    break;
                case 'peek_opponent':
                    elements.gamePhase.textContent = 'Cliquez sur une carte d\'un adversaire pour la regarder';
                    break;
                case 'swap_select_own':
                    elements.gamePhase.textContent = 'Sélectionnez une de vos cartes à échanger';
                    break;
                case 'swap_select_other':
                    elements.gamePhase.textContent = 'Sélectionnez une carte d\'un autre joueur';
                    break;
            }
            break;
    }
}

// Vérifier si le joueur actuel a des cartes correspondant à la défausse
function checkHasMatchingCards() {
    if (GameState.discardPile.length === 0) return false;
    const myIndex = GameState.isOnline ? GameState.myPlayerIndex : GameState.currentPlayerIndex;
    const myPlayer = GameState.players[myIndex];
    if (!myPlayer) return false;
    
    const topDiscard = GameState.discardPile[GameState.discardPile.length - 1];
    return myPlayer.cards.some(c => c.card.value === topDiscard.value);
}

// Mettre à jour l'affichage des adversaires
function updateOpponentsDisplay() {
    elements.opponentsArea.innerHTML = '';
    
    // En mode en ligne, je suis toujours en bas, les autres sont les adversaires
    const myIndex = GameState.isOnline ? GameState.myPlayerIndex : GameState.currentPlayerIndex;

    GameState.players.forEach((player, index) => {
        if (index === myIndex) return; // Ne pas m'afficher dans les adversaires
        if (GameState.eliminated[index]) return; // Ne pas afficher les éliminés

        const container = document.createElement('div');
        container.className = 'opponent-container';
        container.dataset.playerIndex = index;

        // Indiquer si c'est le tour de ce joueur
        if (index === GameState.currentPlayerIndex) {
            container.classList.add('current-turn');
        }

        if (index === GameState.closerIndex) {
            container.classList.add('closer');
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'opponent-name';
        let nameSuffix = '';
        if (index === GameState.closerIndex) nameSuffix += ' 🔒';
        if (index === GameState.currentPlayerIndex && GameState.isOnline) nameSuffix += ' 🎯';
        nameEl.textContent = player.name + nameSuffix;
        container.appendChild(nameEl);

        const cardsEl = document.createElement('div');
        cardsEl.className = 'opponent-cards';
        
        // Calculer le nombre de colonnes selon le nombre de cartes (forme quasi-carrée)
        const numCards = player.cards.length;
        const cols = Math.ceil(Math.sqrt(numCards));
        cardsEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;
        
        // Adapter la taille des cartes selon le nombre de colonnes
        if (cols >= 5) {
            cardsEl.classList.add('huge-cards');
        } else if (cols >= 4) {
            cardsEl.classList.add('lots-of-cards');
        } else if (cols >= 3) {
            cardsEl.classList.add('many-cards');
        }

        player.cards.forEach((cardData, cardIndex) => {
            // En mode en ligne, les cartes des autres sont toujours faces cachées
            // sauf si faceUp est true (révélée temporairement)
            const showFaceUp = GameState.isOnline ? cardData.faceUp : cardData.faceUp;
            const cardEl = CardUtils.createCardElement(cardData.card, showFaceUp);
            cardEl.dataset.playerIndex = index;
            cardEl.dataset.cardIndex = cardIndex;

            // Rendre cliquable si en phase d'action appropriée ET c'est mon tour
            const isMyTurn = GameState.isOnline ? (GameState.currentPlayerIndex === GameState.myPlayerIndex) : true;
            if (isMyTurn && GameState.phase === 'action' && 
                (GameState.actionPhase === 'peek_opponent' || GameState.actionPhase === 'swap_select_other')) {
                cardEl.classList.add('selectable');
                cardEl.addEventListener('click', () => {
                    if (GameState.isOnline) {
                        // En mode en ligne, pour peek_opponent on affiche le modal localement
                        if (GameState.actionPhase === 'peek_opponent') {
                            const targetCardData = GameState.players[index].cards[cardIndex];
                            showPeekModal(targetCardData.card, `Carte de ${GameState.players[index].name} :`);
                        }
                        // Puis on envoie l'action au serveur
                        handleAction(GameState.actionPhase === 'peek_opponent' ? 'peek-opponent' : 'swap-other', 
                            { playerIndex: index, cardIndex });
                    } else {
                        handleOpponentCardClick(index, cardIndex);
                    }
                });
            }

            cardsEl.appendChild(cardEl);
        });

        container.appendChild(cardsEl);

        // Ajouter le score
        const scoreBadge = document.createElement('div');
        scoreBadge.className = 'score-badge';
        scoreBadge.textContent = `Score: ${GameState.totalScores[index]}`;
        container.appendChild(scoreBadge);

        elements.opponentsArea.appendChild(container);
    });
}

// Mettre à jour l'affichage du joueur actif
function updateActivePlayerDisplay() {
    console.log('updateActivePlayerDisplay - phase:', GameState.phase, 'actionPhase:', GameState.actionPhase);
    
    // En mode en ligne, afficher toujours MES cartes en bas
    const myIndex = GameState.isOnline ? GameState.myPlayerIndex : GameState.currentPlayerIndex;
    const myPlayer = GameState.players[myIndex];
    const isMyTurn = GameState.isOnline ? (GameState.currentPlayerIndex === GameState.myPlayerIndex) : true;
    
    console.log('myIndex:', myIndex, 'isMyTurn:', isMyTurn);
    
    if (!myPlayer) return;
    
    // Afficher si j'ai déjà regardé mes cartes pendant la phase peek
    let playerNameSuffix = '';
    if (GameState.isOnline) {
        playerNameSuffix = ' (vous)';
        if (GameState.phase === 'peek_initial' && myPlayer.hasLookedAtInitialCards) {
            playerNameSuffix = ' (vous) ✓ Prêt';
        }
    }
    
    elements.activePlayerName.textContent = GameState.isOnline 
        ? `${myPlayer.name}${playerNameSuffix}` 
        : myPlayer.name;
    elements.activePlayerCards.innerHTML = '';
    
    // Calculer le nombre de colonnes selon le nombre de cartes (forme quasi-carrée)
    const numCards = myPlayer.cards.length;
    const cols = Math.ceil(Math.sqrt(numCards));
    elements.activePlayerCards.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    
    // Adapter la taille des cartes selon le nombre de colonnes
    elements.activePlayerCards.classList.remove('many-cards', 'lots-of-cards', 'huge-cards');
    if (cols >= 5) {
        elements.activePlayerCards.classList.add('huge-cards');
    } else if (cols >= 4) {
        elements.activePlayerCards.classList.add('lots-of-cards');
    } else if (cols >= 3) {
        elements.activePlayerCards.classList.add('many-cards');
    }

    myPlayer.cards.forEach((cardData, cardIndex) => {
        // En mode en ligne, je vois mes cartes face cachée sauf si je les ai regardées
        // On utilise un système de "mémoire" côté client
        const cardEl = CardUtils.createCardElement(cardData.card, cardData.faceUp);
        cardEl.dataset.cardIndex = cardIndex;

        // Phase initiale : TOUS les joueurs peuvent regarder leurs cartes du bas EN MÊME TEMPS
        // Vérifier si le joueur n'a pas déjà regardé ses cartes
        // On vérifie si AUCUNE carte peekable n'a été vue (car les 2 sont révélées ensemble)
        const anyPeeked = myPlayer.cards.some(c => c.canPeek && c.hasBeenPeeked);
        if (GameState.phase === 'peek_initial' && cardData.canPeek && !anyPeeked && !myPlayer.hasLookedAtInitialCards) {
            cardEl.classList.add('selectable');
            cardEl.addEventListener('click', () => {
                // Exécuter localement pour afficher immédiatement
                peekInitialCard(cardIndex);
                
                if (GameState.isOnline) {
                    // En mode en ligne, envoyer au serveur (l'hôte met à jour son état)
                    Network.sendAction({ type: 'peek-initial', data: { cardIndex } });
                }
            });
        }

        // Phase de jeu : permettre de remplacer une carte (seulement si c'est mon tour ET j'ai pioché)
        if (isMyTurn && GameState.phase === 'playing' && GameState.drawnCard) {
            cardEl.classList.add('selectable');
            cardEl.addEventListener('click', () => {
                if (GameState.isOnline) {
                    handleAction('replace-card', { cardIndex });
                } else {
                    replaceCard(cardIndex);
                }
            });
        }
        // Phase de jeu : permettre de tenter de jeter une carte SEULEMENT si on n'a PAS pioché
        // N'importe quel joueur peut tenter de jeter une carte qui correspond à la défausse
        // Pas d'indication visuelle - le joueur doit se souvenir de ses cartes !
        else if (GameState.phase === 'playing' && !GameState.drawnCard && GameState.discardPile.length > 0) {
            cardEl.classList.add('selectable');
            cardEl.addEventListener('click', () => {
                if (GameState.isOnline) {
                    handleAction('discard-matching', { cardIndex });
                } else {
                    discardMatchingCard(cardIndex);
                }
            });
        }

        // Phase d'action : regarder sa propre carte
        if (isMyTurn && GameState.phase === 'action' && GameState.actionPhase === 'peek_self') {
            console.log('Adding selectable for peek_self on card', cardIndex);
            cardEl.classList.add('selectable');
            cardEl.addEventListener('click', () => {
                console.log('Card clicked for peek_self');
                if (GameState.isOnline) {
                    // Afficher le modal localement d'abord
                    const myCardData = myPlayer.cards[cardIndex];
                    showPeekModal(myCardData.card, 'Votre carte :');
                    // Puis envoyer l'action au serveur
                    handleAction('peek-own', { cardIndex });
                } else {
                    peekOwnCard(cardIndex);
                }
            });
        }

        // Phase d'action : sélectionner sa carte pour swap
        if (isMyTurn && GameState.phase === 'action' && GameState.actionPhase === 'swap_select_own') {
            console.log('Adding selectable for swap_select_own on card', cardIndex);
            cardEl.classList.add('selectable');
            cardEl.addEventListener('click', () => {
                console.log('Card clicked for swap_select_own');
                if (GameState.isOnline) {
                    handleAction('swap-own', { cardIndex });
                } else {
                    selectOwnCardForSwap(cardIndex);
                }
            });
        }

        elements.activePlayerCards.appendChild(cardEl);
    });

    // Score du joueur actif
    const existingScore = elements.activePlayerArea.querySelector('.score-badge');
    if (existingScore) existingScore.remove();
    
    const scoreBadge = document.createElement('div');
    scoreBadge.className = 'score-badge';
    scoreBadge.style.marginTop = '1rem';
    scoreBadge.textContent = `Score total: ${GameState.totalScores[myIndex]}`;
    elements.activePlayerArea.appendChild(scoreBadge);
}

// Mettre à jour l'affichage du deck
function updateDeckDisplay() {
    elements.deckCount.textContent = GameState.deck.length;
    
    // Vérifier si le joueur peut piocher
    const isMyTurn = GameState.isOnline ? (GameState.currentPlayerIndex === GameState.myPlayerIndex) : true;
    const canDraw = isMyTurn && GameState.phase === 'playing' && !GameState.drawnCard && !GameState.hasDiscardedThisTurn;
    
    // Mettre à jour visuellement la pioche (désactivée ou non)
    if (canDraw) {
        elements.drawPile.classList.remove('disabled');
    } else {
        elements.drawPile.classList.add('disabled');
    }

    // Mettre à jour la défausse
    if (GameState.discardPile.length > 0) {
        const topCard = GameState.discardPile[GameState.discardPile.length - 1];
        elements.discardPile.className = `card card-front discard-pile ${topCard.color}`;
        elements.discardPile.innerHTML = `
            <span class="card-value">${topCard.value}</span>
            <span class="card-suit">${topCard.suit}</span>
            <span class="deck-label">Défausse</span>
        `;
        // Désactiver visuellement si ne peut pas piocher
        if (!canDraw) {
            elements.discardPile.classList.add('disabled');
        }
    } else {
        elements.discardPile.className = 'card discard-pile empty';
        elements.discardPile.innerHTML = '<span class="deck-label">Défausse</span>';
    }

    // Carte piochée
    if (GameState.drawnCard) {
        elements.drawnCardContainer.classList.remove('hidden');
        elements.drawnCard.className = `card card-front ${GameState.drawnCard.color}`;
        elements.drawnCard.innerHTML = `
            <span class="card-value">${GameState.drawnCard.value}</span>
            <span class="card-suit">${GameState.drawnCard.suit}</span>
        `;
    } else {
        elements.drawnCardContainer.classList.add('hidden');
    }
}

// Mettre à jour les boutons d'action
function updateActionButtons() {
    elements.endLookPhase.classList.add('hidden');
    elements.nextTurn.classList.add('hidden');
    elements.closeRound.classList.add('hidden');
    elements.endMyTurn.classList.add('hidden');

    // En mode en ligne, vérifier si c'est mon tour
    const isMyTurn = GameState.isOnline ? (GameState.currentPlayerIndex === GameState.myPlayerIndex) : true;
    
    // Phase peek_initial : TOUS les joueurs peuvent regarder, pas besoin de vérifier isMyTurn
    if (GameState.phase === 'peek_initial') {
        const myIndex = GameState.isOnline ? GameState.myPlayerIndex : GameState.currentPlayerIndex;
        const myPlayer = GameState.players[myIndex];
        if (myPlayer && !myPlayer.hasLookedAtInitialCards) {
            // Vérifier si les cartes du bas (canPeek) ont été vues
            const peekableCards = myPlayer.cards.filter(c => c.canPeek);
            const allPeeked = peekableCards.length > 0 && peekableCards.every(c => c.hasBeenPeeked);
            if (allPeeked) {
                elements.endLookPhase.classList.remove('hidden');
            }
        }
        return; // On ne veut pas les autres boutons pendant peek_initial
    }
    
    if (!isMyTurn) return; // Pas mon tour, pas de boutons

    // Afficher le bouton "Je ferme" APRÈS avoir fait l'action principale (pioché + défaussé/remplacé)
    // Le joueur doit d'abord jouer son tour avant de pouvoir fermer
    if (GameState.phase === 'playing' && !GameState.drawnCard && !GameState.lastRoundMode && GameState.hasDiscardedThisTurn) {
        elements.closeRound.classList.remove('hidden');
    }
    
    // Afficher le bouton "Terminer mon tour" après avoir fait l'action principale
    // (après avoir défaussé la carte piochée OU après avoir remplacé une carte)
    if (GameState.phase === 'playing' && !GameState.drawnCard && GameState.hasDiscardedThisTurn) {
        elements.endMyTurn.classList.remove('hidden');
    }
}

// Regarder une carte initiale (phase de début)
// Maintenant révèle les DEUX cartes du bas en même temps
function peekInitialCard(cardIndex) {
    // En mode en ligne, utiliser mon index
    const playerIndex = GameState.isOnline ? GameState.myPlayerIndex : GameState.currentPlayerIndex;
    const player = GameState.players[playerIndex];
    
    // Trouver les deux cartes du bas (indices 2 et 3)
    const bottomCards = [];
    for (let i = 2; i < player.cards.length; i++) {
        const cardData = player.cards[i];
        if (cardData.canPeek && !cardData.hasBeenPeeked) {
            bottomCards.push({ index: i, cardData });
        }
    }
    
    if (bottomCards.length === 0) return;
    
    // Marquer toutes les cartes du bas comme vues
    bottomCards.forEach(({ cardData }) => {
        cardData.hasBeenPeeked = true;
    });

    // Afficher les deux cartes dans le modal
    if (bottomCards.length === 2) {
        showPeekModalBothCards(bottomCards[0].cardData.card, bottomCards[1].cardData.card, 'Mémorisez vos 2 cartes !');
    } else if (bottomCards.length === 1) {
        showPeekModal(bottomCards[0].cardData.card, 'Mémorisez cette carte !');
    }
    
    // Update display
    updateDisplay();
}

// Regarder une carte initiale pour un joueur spécifique (hôte seulement)
// Maintenant marque TOUTES les cartes du bas comme vues (car elles sont révélées ensemble)
function peekInitialCardForPlayer(playerIndex, cardIndex) {
    const player = GameState.players[playerIndex];
    if (!player) return;
    
    // Marquer TOUTES les cartes du bas comme vues
    for (let i = 2; i < player.cards.length; i++) {
        const cardData = player.cards[i];
        if (cardData.canPeek) {
            cardData.hasBeenPeeked = true;
        }
    }
}

// Vérifier si une carte peut être jetée (même valeur que la défausse)
function canDiscardMatching(card) {
    if (GameState.discardPile.length === 0) return false;
    const topDiscard = GameState.discardPile[GameState.discardPile.length - 1];
    return card.value === topDiscard.value;
}

// Fin de la phase de regard initial
function endLookPhase() {
    // En mode en ligne, chaque joueur marque qu'il a fini de regarder
    if (GameState.isOnline) {
        const myIndex = GameState.myPlayerIndex;
        GameState.players[myIndex].hasLookedAtInitialCards = true;
        
        // Mettre à jour l'affichage localement
        updateDisplay();
        
        // Si je suis l'hôte, vérifier si tout le monde est prêt
        if (Network.isHost) {
            checkAllPlayersReady();
        }
    } else {
        // Mode local : marquer le joueur actuel comme prêt
        const currentPlayer = GameState.players[GameState.currentPlayerIndex];
        currentPlayer.hasLookedAtInitialCards = true;

        // Vérifier si tous les joueurs ont regardé leurs cartes
        const allReady = GameState.players.every(p => p.hasLookedAtInitialCards);
        
        if (allReady) {
            // Tous les joueurs ont regardé leurs cartes, commencer la partie
            GameState.currentPlayerIndex = Math.floor(Math.random() * GameState.players.length);
            GameState.phase = 'playing';
            updateDisplay();
        } else {
            // Passer au joueur suivant qui n'a pas encore regardé
            let nextIndex = (GameState.currentPlayerIndex + 1) % GameState.players.length;
            while (GameState.players[nextIndex].hasLookedAtInitialCards) {
                nextIndex = (nextIndex + 1) % GameState.players.length;
            }
            GameState.currentPlayerIndex = nextIndex;
            updateDisplay();
        }
    }
}

// Vérifier si tous les joueurs sont prêts (hôte seulement)
function checkAllPlayersReady() {
    const allReady = GameState.players.every(p => p.hasLookedAtInitialCards);
    
    if (allReady) {
        // Tous les joueurs sont prêts, commencer la partie
        // Le currentPlayerIndex a été tiré aléatoirement à l'initialisation
        GameState.phase = 'playing';
        updateDisplay();
        Network.broadcastGameState(getSerializableGameState());
    } else {
        // Mettre à jour et broadcast l'état
        updateDisplay();
        Network.broadcastGameState(getSerializableGameState());
    }
}

// Piocher une carte
function drawCard() {
    if (GameState.phase !== 'playing' || GameState.drawnCard) return;
    if (GameState.hasDiscardedThisTurn) return; // Déjà fait l'action principale ce tour
    if (GameState.deck.length === 0) {
        // Remélanger la défausse
        const topDiscard = GameState.discardPile.pop();
        GameState.deck = CardUtils.shuffleDeck(GameState.discardPile);
        GameState.discardPile = [topDiscard];
    }

    GameState.drawnCard = GameState.deck.pop();
    updateDisplay();
    
    // Broadcast en mode online
    if (GameState.isOnline && Network.isHost) {
        Network.broadcastGameState(getSerializableGameState());
    }
}

// Prendre depuis la défausse
function takeFromDiscard() {
    if (GameState.phase !== 'playing' || GameState.drawnCard) return;
    if (GameState.hasDiscardedThisTurn) return; // Déjà fait l'action principale ce tour
    if (GameState.discardPile.length === 0) return;

    GameState.drawnCard = GameState.discardPile.pop();
    updateDisplay();
    
    // Broadcast en mode online
    if (GameState.isOnline && Network.isHost) {
        Network.broadcastGameState(getSerializableGameState());
    }
}

// Défausser la carte piochée
function discardDrawnCard() {
    if (!GameState.drawnCard) return;

    const drawnCard = GameState.drawnCard;
    console.log('discardDrawnCard - card value:', drawnCard.value, 'type:', typeof drawnCard.value);
    
    GameState.discardPile.push(drawnCard);
    GameState.drawnCard = null;

    // Vérifier si la carte a une action spéciale
    const action = CardUtils.getCardAction(drawnCard);
    console.log('Card action:', action);
    
    if (action) {
        startAction(action);
        // Broadcast en mode online pour que les autres voient la phase action
        if (GameState.isOnline && Network.isHost) {
            Network.broadcastGameState(getSerializableGameState());
        }
    } else {
        // Pas d'action spéciale : donner un temps de réflexion pour jeter une carte qui match
        GameState.hasDiscardedThisTurn = true;
        updateDisplay();
        
        // Broadcast en mode online
        if (GameState.isOnline && Network.isHost) {
            Network.broadcastGameState(getSerializableGameState());
        }
    }
}

// Remplacer une carte
function replaceCard(cardIndex) {
    if (!GameState.drawnCard) return;

    const currentPlayer = GameState.players[GameState.currentPlayerIndex];
    const oldCard = currentPlayer.cards[cardIndex].card;

    // Remplacer la carte
    currentPlayer.cards[cardIndex].card = GameState.drawnCard;
    currentPlayer.cards[cardIndex].faceUp = true; // Montrer temporairement
    
    // Défausser l'ancienne carte
    GameState.discardPile.push(oldCard);
    GameState.drawnCard = null;
    
    // Marquer immédiatement que l'action principale est faite (empêche de repiocher)
    GameState.hasDiscardedThisTurn = true;

    // Cacher la carte après un moment
    setTimeout(() => {
        currentPlayer.cards[cardIndex].faceUp = false;
        updateDisplay();
        if (GameState.isOnline && Network.isHost) {
            Network.broadcastGameState(getSerializableGameState());
        }
    }, 1500);

    updateDisplay();
    
    // Vérifier si l'ancienne carte a une action spéciale
    const action = CardUtils.getCardAction(oldCard);
    console.log('Replaced card action:', action, 'card:', oldCard.value);
    
    if (action) {
        // Déclencher l'action de la carte défaussée après un court délai
        setTimeout(() => {
            startAction(action);
            // Broadcast en mode online pour que les autres voient la phase action
            if (GameState.isOnline && Network.isHost) {
                Network.broadcastGameState(getSerializableGameState());
            }
        }, 800);
    } else {
        // Broadcast immédiat en mode online
        if (GameState.isOnline && Network.isHost) {
            Network.broadcastGameState(getSerializableGameState());
        }
    }
}

// Jeter une carte (tentative de match avec la défausse) - version pour le mode local
function discardMatchingCard(cardIndex) {
    // En mode local, utiliser le joueur actuel
    discardMatchingCardForPlayer(GameState.currentPlayerIndex, cardIndex);
}

// Jeter une carte (tentative de match avec la défausse) - version avec playerIndex
// Si la carte correspond : elle est jetée et le joueur a une carte de moins
// Si elle ne correspond pas : le joueur récupère sa carte + 1 carte de la pioche (pénalité)
function discardMatchingCardForPlayer(playerIndex, cardIndex) {
    if (GameState.phase !== 'playing') return;
    if (GameState.discardPile.length === 0) return;

    const player = GameState.players[playerIndex];
    if (!player || !player.cards[cardIndex]) return;
    
    const cardData = player.cards[cardIndex];
    const topDiscard = GameState.discardPile[GameState.discardPile.length - 1];

    // Vérifier si la carte correspond
    if (cardData.card.value === topDiscard.value) {
        // MATCH ! Jeter la carte
        GameState.discardPile.push(cardData.card);
        
        // Retirer la carte du jeu du joueur
        player.cards.splice(cardIndex, 1);
        
        // Afficher le message de succès seulement pour le joueur qui a fait l'action
        const isMyAction = !GameState.isOnline || (playerIndex === GameState.myPlayerIndex);
        if (isMyAction) {
            showNotification(
                'Bien joué ! 🎉',
                `Vous avez jeté votre ${cardData.card.value}${cardData.card.suit} avec succès ! Vous avez maintenant ${player.cards.length} cartes.`,
                'success'
            );
        }
        
        updateDisplay();
        
        // Note: on ne termine PAS le tour car ce n'était pas forcément le tour de ce joueur
    } else {
        // PAS DE MATCH - Pénalité !
        
        // La carte jetée va dans la défausse temporairement puis revient
        // En fait non : la carte reste dans la main ET on pioche une carte supplémentaire
        
        // Piocher une carte de pénalité de la pioche
        if (GameState.deck.length === 0) {
            // Remélanger la défausse si le deck est vide
            const topDiscard = GameState.discardPile.pop();
            GameState.deck = CardUtils.shuffleDeck(GameState.discardPile);
            GameState.discardPile = [topDiscard];
        }
        
        const penaltyCard = GameState.deck.pop();
        
        // Ajouter la carte de pénalité au joueur (face cachée)
        player.cards.push({
            card: penaltyCard,
            faceUp: false,
            canPeek: false,
            hasBeenPeeked: false
        });
        
        // Montrer un message d'erreur seulement pour le joueur qui a fait l'action
        const isMyAction = !GameState.isOnline || (playerIndex === GameState.myPlayerIndex);
        if (isMyAction) {
            showNotification(
                'Mauvaise carte !',
                `Vous avez jeté un ${cardData.card.value}${cardData.card.suit} mais la défausse a un ${topDiscard.value}${topDiscard.suit}. Vous recevez une carte de pénalité !`,
                'error'
            );
        }
        
        updateDisplay();
        
        // Note: on ne termine PAS le tour car ce n'était pas forcément le tour de ce joueur
    }
}

// Démarrer une action spéciale
function startAction(action) {
    console.log('startAction called:', action);
    GameState.phase = 'action';
    
    switch (action.type) {
        case 'peek_self':
            GameState.actionPhase = 'peek_self';
            console.log('Action phase set to peek_self');
            break;
        case 'peek_opponent':
            GameState.actionPhase = 'peek_opponent';
            console.log('Action phase set to peek_opponent');
            break;
        case 'swap':
            GameState.actionPhase = 'swap_select_own';
            GameState.selectedCards = [];
            console.log('Action phase set to swap_select_own');
            break;
    }
    
    console.log('GameState.phase:', GameState.phase, 'GameState.actionPhase:', GameState.actionPhase);
    updateDisplay();
}

// Regarder sa propre carte (action du 10)
function peekOwnCard(cardIndex) {
    const currentPlayer = GameState.players[GameState.currentPlayerIndex];
    const cardData = currentPlayer.cards[cardIndex];

    // Afficher le modal seulement pour le joueur qui fait l'action
    const isMyAction = !GameState.isOnline || (GameState.currentPlayerIndex === GameState.myPlayerIndex);
    if (isMyAction) {
        showPeekModal(cardData.card, 'Votre carte :');
        // La phase sera changée quand le modal sera fermé (dans closePeekModal)
    } else {
        // C'est une action distante (hôte qui exécute pour un client)
        // Changer la phase et terminer le tour (le client verra via le broadcast)
        GameState.phase = 'playing';
        GameState.actionPhase = null;
        GameState.hasDiscardedThisTurn = true;
        updateDisplay();
        if (GameState.isOnline && Network.isHost) {
            Network.broadcastGameState(getSerializableGameState());
        }
    }
}

// Regarder la carte d'un adversaire (action du Valet)
function handleOpponentCardClick(playerIndex, cardIndex) {
    if (GameState.actionPhase === 'peek_opponent') {
        const cardData = GameState.players[playerIndex].cards[cardIndex];
        showPeekModal(cardData.card, `Carte de ${GameState.players[playerIndex].name} :`);
        
        GameState.phase = 'playing';
        GameState.actionPhase = null;
        GameState.hasDiscardedThisTurn = true; // Permettre de jeter une carte après
        updateDisplay();
    } else if (GameState.actionPhase === 'swap_select_other') {
        // Effectuer l'échange
        const ownSelection = GameState.selectedCards[0];
        const currentPlayer = GameState.players[GameState.currentPlayerIndex];
        const otherPlayer = GameState.players[playerIndex];

        const tempCard = currentPlayer.cards[ownSelection.cardIndex].card;
        currentPlayer.cards[ownSelection.cardIndex].card = otherPlayer.cards[cardIndex].card;
        otherPlayer.cards[cardIndex].card = tempCard;

        GameState.phase = 'playing';
        GameState.actionPhase = null;
        GameState.selectedCards = [];
        GameState.hasDiscardedThisTurn = true; // Permettre de jeter une carte après

        updateDisplay();
    }
}

// Version pour les actions distantes (hôte seulement)
function handleOpponentCardClickAction(playerIndex, cardIndex) {
    if (GameState.actionPhase === 'peek_opponent') {
        // Pour peek, on ne fait que changer la phase côté hôte
        // Le modal sera affiché côté client qui a fait l'action
        GameState.phase = 'playing';
        GameState.actionPhase = null;
        GameState.hasDiscardedThisTurn = true; // Permettre de jeter une carte après
        updateDisplay();
        
        // Broadcast en mode online
        if (GameState.isOnline && Network.isHost) {
            Network.broadcastGameState(getSerializableGameState());
        }
    } else if (GameState.actionPhase === 'swap_select_other') {
        // Effectuer l'échange
        const ownSelection = GameState.selectedCards[0];
        const currentPlayer = GameState.players[GameState.currentPlayerIndex];
        const otherPlayer = GameState.players[playerIndex];

        const tempCard = currentPlayer.cards[ownSelection.cardIndex].card;
        currentPlayer.cards[ownSelection.cardIndex].card = otherPlayer.cards[cardIndex].card;
        otherPlayer.cards[cardIndex].card = tempCard;

        GameState.phase = 'playing';
        GameState.actionPhase = null;
        GameState.selectedCards = [];
        GameState.hasDiscardedThisTurn = true; // Permettre de jeter une carte après

        updateDisplay();
        
        // Broadcast en mode online
        if (GameState.isOnline && Network.isHost) {
            Network.broadcastGameState(getSerializableGameState());
        }
    }
}

// Sélectionner sa carte pour l'échange (action de la Dame)
function selectOwnCardForSwap(cardIndex) {
    GameState.selectedCards = [{ playerIndex: GameState.currentPlayerIndex, cardIndex }];
    GameState.actionPhase = 'swap_select_other';
    updateDisplay();
    
    // Broadcast pour que les autres voient la transition de phase
    if (GameState.isOnline && Network.isHost) {
        Network.broadcastGameState(getSerializableGameState());
    }
}

// Afficher le modal de peek
function showPeekModal(card, title) {
    elements.peekModalTitle.textContent = title;
    elements.peekCard.className = `card card-front large ${card.color}`;
    elements.peekCard.innerHTML = `
        <span class="card-value">${card.value}</span>
        <span class="card-suit">${card.suit}</span>
    `;
    // S'assurer qu'il n'y a qu'une seule carte affichée
    const existingSecondCard = elements.peekModal.querySelector('.peek-second-card');
    if (existingSecondCard) {
        existingSecondCard.remove();
    }
    elements.peekModal.classList.remove('hidden');
}

// Afficher le modal de peek avec deux cartes
function showPeekModalBothCards(card1, card2, title) {
    elements.peekModalTitle.textContent = title;
    
    // Créer un container pour les deux cartes
    const modalContent = elements.peekModal.querySelector('.modal-content');
    
    // Supprimer une éventuelle deuxième carte existante
    const existingSecondCard = modalContent.querySelector('.peek-second-card');
    if (existingSecondCard) {
        existingSecondCard.remove();
    }
    
    // Première carte
    elements.peekCard.className = `card card-front large ${card1.color}`;
    elements.peekCard.innerHTML = `
        <span class="card-value">${card1.value}</span>
        <span class="card-suit">${card1.suit}</span>
    `;
    
    // Créer la deuxième carte
    const secondCard = document.createElement('div');
    secondCard.className = `card card-front large ${card2.color} peek-second-card`;
    secondCard.innerHTML = `
        <span class="card-value">${card2.value}</span>
        <span class="card-suit">${card2.suit}</span>
    `;
    secondCard.style.marginLeft = '1rem';
    
    // Insérer après la première carte (créer un wrapper si nécessaire)
    let cardsWrapper = modalContent.querySelector('.peek-cards-wrapper');
    if (!cardsWrapper) {
        cardsWrapper = document.createElement('div');
        cardsWrapper.className = 'peek-cards-wrapper';
        cardsWrapper.style.display = 'flex';
        cardsWrapper.style.justifyContent = 'center';
        cardsWrapper.style.gap = '1rem';
        cardsWrapper.style.marginBottom = '1rem';
        
        // Déplacer la première carte dans le wrapper
        elements.peekCard.parentNode.insertBefore(cardsWrapper, elements.peekCard);
        cardsWrapper.appendChild(elements.peekCard);
    }
    
    cardsWrapper.appendChild(secondCard);
    
    elements.peekModal.classList.remove('hidden');
}

// Fermer le modal de peek
function closePeekModal() {
    elements.peekModal.classList.add('hidden');
    
    // Nettoyer la deuxième carte si elle existe
    const modalContent = elements.peekModal.querySelector('.modal-content');
    const secondCard = modalContent.querySelector('.peek-second-card');
    if (secondCard) {
        secondCard.remove();
    }
    
    // En mode en ligne, le tour est géré par l'hôte via le broadcast
    if (GameState.isOnline) {
        // Si c'est la phase action et c'est mon tour, passer en mode "peut jeter une carte"
        if (GameState.phase === 'action' && GameState.currentPlayerIndex === GameState.myPlayerIndex) {
            // Revenir à la phase playing avec hasDiscardedThisTurn pour permettre de jeter
            GameState.phase = 'playing';
            GameState.actionPhase = null;
            GameState.hasDiscardedThisTurn = true;
            updateDisplay();
            if (Network.isHost) {
                Network.broadcastGameState(getSerializableGameState());
            }
        } else {
            updateDisplay();
        }
        return;
    }
    
    // Mode local
    if (GameState.phase === 'action') {
        // Après une action, permettre de jeter une carte
        GameState.phase = 'playing';
        GameState.actionPhase = null;
        GameState.hasDiscardedThisTurn = true;
        updateDisplay();
    } else if (GameState.phase === 'peek_initial') {
        updateDisplay();
    } else {
        updateDisplay();
    }
}

// Fin du tour
function endTurn() {
    GameState.drawnCard = null;
    GameState.actionPhase = null;
    GameState.hasDiscardedThisTurn = false; // Réinitialiser pour le prochain tour
    
    // Si on est en mode dernier tour, décrémenter et vérifier
    if (GameState.lastRoundMode) {
        GameState.turnsLeftAfterClose--;
        
        if (GameState.turnsLeftAfterClose <= 0) {
            // Fin de la manche
            endRound();
            return;
        }
    }
    
    // Passer au joueur suivant (en sautant les éliminés)
    do {
        GameState.currentPlayerIndex = (GameState.currentPlayerIndex + 1) % GameState.players.length;
    } while (GameState.eliminated[GameState.currentPlayerIndex]);
    
    // Vérifier si on revient au joueur qui a fermé
    if (GameState.lastRoundMode && GameState.currentPlayerIndex === GameState.closerIndex) {
        endRound();
        return;
    }
    
    updateDisplay();
    
    // Note: Le broadcast est fait dans handleRemoteAction après executeAction
}

// Tour suivant (manuel)
function nextTurn() {
    endTurn();
}

// Démarrer une nouvelle manche
function startNewRound() {
    elements.roundEndModal.classList.add('hidden');
    
    // Réinitialiser le deck et distribuer
    GameState.deck = CardUtils.shuffleDeck(CardUtils.createDeck());
    GameState.discardPile = [];
    GameState.closerIndex = null;
    GameState.lastRoundMode = false;
    GameState.turnsLeftAfterClose = 0;
    GameState.hasDiscardedThisTurn = false;
    GameState.drawnCard = null;
    GameState.roundEndData = null; // Réinitialiser les données de fin de manche

    GameState.players.forEach((player, index) => {
        if (GameState.eliminated[index]) return;
        
        player.cards = [];
        for (let i = 0; i < 4; i++) {
            player.cards.push({
                card: GameState.deck.pop(),
                faceUp: false,
                canPeek: i >= 2,
                hasBeenPeeked: false
            });
        }
        player.hasLookedAtInitialCards = false;
    });

    GameState.discardPile.push(GameState.deck.pop());
    
    // Trouver le premier joueur non éliminé
    GameState.currentPlayerIndex = 0;
    while (GameState.eliminated[GameState.currentPlayerIndex]) {
        GameState.currentPlayerIndex = (GameState.currentPlayerIndex + 1) % GameState.players.length;
    }
    
    GameState.phase = 'peek_initial';

    updateDisplay();
}

// Calculer les points d'un joueur
function calculatePlayerScore(playerIndex) {
    const player = GameState.players[playerIndex];
    let score = 0;
    player.cards.forEach(cardData => {
        score += CardUtils.getCardPoints(cardData.card);
    });
    return score;
}

// Fermer la manche (Je ferme !)
function closeRound() {
    if (GameState.lastRoundMode || GameState.closerIndex !== null) return;

    GameState.closerIndex = GameState.currentPlayerIndex;
    GameState.lastRoundMode = true;
    
    // Compter les joueurs non éliminés qui doivent encore jouer (tous sauf celui qui ferme)
    let turnsLeft = 0;
    for (let i = 0; i < GameState.players.length; i++) {
        if (i !== GameState.closerIndex && !GameState.eliminated[i]) {
            turnsLeft++;
        }
    }
    GameState.turnsLeftAfterClose = turnsLeft;
    
    console.log('closeRound - closerIndex:', GameState.closerIndex, 'turnsLeft:', turnsLeft);

    // Si personne d'autre à jouer, fin de manche
    if (turnsLeft === 0) {
        endRound();
        return;
    }

    // Passer au joueur suivant (sans décrémenter car on n'a pas encore joué de tour)
    do {
        GameState.currentPlayerIndex = (GameState.currentPlayerIndex + 1) % GameState.players.length;
    } while (GameState.eliminated[GameState.currentPlayerIndex]);
    
    updateDisplay();
    
    // Broadcast en mode online
    if (GameState.isOnline && Network.isHost) {
        Network.broadcastGameState(getSerializableGameState());
    }
}

// Fin de manche - calculer les scores
function endRound() {
    GameState.phase = 'round_end';

    // Calculer les scores de chaque joueur pour cette manche
    const roundScores = [];
    GameState.players.forEach((player, index) => {
        if (GameState.eliminated[index]) {
            roundScores.push({ index, score: 0, eliminated: true });
        } else {
            const score = calculatePlayerScore(index);
            roundScores.push({ index, score, eliminated: false });
        }
    });

    // Trouver le score le plus bas parmi les joueurs actifs
    const activeScores = roundScores.filter(s => !s.eliminated);
    const minScore = Math.min(...activeScores.map(s => s.score));

    // Vérifier si le joueur qui a fermé a gagné
    let closerBonus = 0;
    let closerWon = false;
    if (GameState.closerIndex !== null && !GameState.eliminated[GameState.closerIndex]) {
        const closerScore = roundScores[GameState.closerIndex].score;
        if (closerScore <= minScore) {
            // Le joueur qui a fermé a le moins de points : -4
            closerBonus = -4;
            closerWon = true;
        } else {
            // Le joueur qui a fermé n'a pas le moins : +10 pénalité
            closerBonus = 10;
            closerWon = false;
        }
    }

    // Appliquer les scores
    const newlyEliminated = [];
    roundScores.forEach(({ index, score, eliminated }) => {
        if (eliminated) return;

        let finalScore = score;
        if (index === GameState.closerIndex) {
            finalScore += closerBonus;
        }
        GameState.totalScores[index] += finalScore;

        // Vérifier élimination à 100 points
        if (GameState.totalScores[index] >= 100 && !GameState.eliminated[index]) {
            GameState.eliminated[index] = true;
            newlyEliminated.push(index);
        }
    });

    // Stocker les données de fin de manche pour la synchronisation
    GameState.roundEndData = { roundScores, closerBonus, closerWon, newlyEliminated };

    // Broadcast en mode online AVANT d'afficher le modal
    if (GameState.isOnline && Network.isHost) {
        Network.broadcastGameState(getSerializableGameState());
    }

    // Afficher les résultats
    showRoundResults(roundScores, closerBonus, closerWon, newlyEliminated);
}

// Afficher les résultats de la manche
function showRoundResults(roundScores, closerBonus, closerWon, newlyEliminated) {
    // Titre
    elements.roundEndTitle.textContent = 'Fin de la manche !';

    // Résultat du joueur qui a fermé
    if (GameState.closerIndex !== null) {
        const closerName = GameState.players[GameState.closerIndex].name;
        if (closerWon) {
            elements.closerResult.textContent = `🎉 ${closerName} a fermé et gagné ! Bonus : -4 points`;
            elements.closerResult.className = 'closer-result winner';
        } else {
            elements.closerResult.textContent = `😱 ${closerName} a fermé mais n'a pas le moins de points ! Pénalité : +10 points`;
            elements.closerResult.className = 'closer-result loser';
        }
        elements.closerResult.style.display = 'block';
    } else {
        elements.closerResult.style.display = 'none';
    }

    // Tableau des scores
    let resultsHTML = '<div class="results-table">';
    roundScores
        .filter(s => !s.eliminated)
        .sort((a, b) => a.score - b.score)
        .forEach(({ index, score }) => {
            const player = GameState.players[index];
            const bonus = index === GameState.closerIndex ? closerBonus : 0;
            const bonusText = bonus !== 0 ? ` (${bonus > 0 ? '+' : ''}${bonus})` : '';
            const totalRound = score + bonus;
            const isEliminated = newlyEliminated.includes(index);
            
            resultsHTML += `
                <div class="result-row ${isEliminated ? 'player-eliminated' : ''}">
                    <span class="result-name">${player.name}${index === GameState.closerIndex ? ' 🔒' : ''}</span>
                    <span class="result-cards">${getCardsDisplay(player)}</span>
                    <span class="result-score ${totalRound < 0 ? 'negative' : totalRound > 20 ? 'high' : ''}">${totalRound}${bonusText}</span>
                    <span class="result-total">Total: ${GameState.totalScores[index]}</span>
                </div>
            `;
        });
    resultsHTML += '</div>';
    elements.roundResults.innerHTML = resultsHTML;

    // Joueurs éliminés
    if (newlyEliminated.length > 0) {
        let elimHTML = '<h4>💀 Joueurs éliminés (100+ points) :</h4><ul>';
        newlyEliminated.forEach(idx => {
            elimHTML += `<li>${GameState.players[idx].name} (${GameState.totalScores[idx]} points)</li>`;
        });
        elimHTML += '</ul>';
        elements.eliminatedPlayers.innerHTML = elimHTML;
        elements.eliminatedPlayers.classList.remove('hidden');
    } else {
        elements.eliminatedPlayers.classList.add('hidden');
    }

    // Vérifier si la partie est terminée
    const activePlayers = GameState.eliminated.filter(e => !e).length;
    if (activePlayers <= 1) {
        elements.nextRound.classList.add('hidden');
        elements.gameOverBtn.classList.remove('hidden');
    } else {
        elements.nextRound.classList.remove('hidden');
        elements.gameOverBtn.classList.add('hidden');
    }

    elements.roundEndModal.classList.remove('hidden');
}

// Afficher les cartes d'un joueur
function getCardsDisplay(player) {
    return player.cards.map(c => `${c.card.value}${c.card.suit}`).join(' ');
}

// Afficher le classement final
function showFinalRanking() {
    elements.roundEndModal.classList.add('hidden');
    
    // Trier les joueurs par score
    const ranking = GameState.players
        .map((player, index) => ({
            name: player.name,
            score: GameState.totalScores[index],
            eliminated: GameState.eliminated[index]
        }))
        .sort((a, b) => {
            // Les non-éliminés d'abord, puis par score
            if (a.eliminated && !b.eliminated) return 1;
            if (!a.eliminated && b.eliminated) return -1;
            return a.score - b.score;
        });

    let rankHTML = '';
    ranking.forEach((player, idx) => {
        const position = idx + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
        const rankClass = position === 1 ? 'first' : position === 2 ? 'second' : position === 3 ? 'third' : '';
        
        rankHTML += `
            <div class="final-rank ${rankClass} ${player.eliminated ? 'player-eliminated' : ''}">
                <span class="rank-position">${medal}</span>
                <span class="rank-name">${player.name}${player.eliminated ? ' (éliminé)' : ''}</span>
                <span class="rank-score">${player.score} pts</span>
            </div>
        `;
    });

    elements.finalRanking.innerHTML = rankHTML;
    elements.gameOverModal.classList.remove('hidden');
}

// Recommencer la partie
function restartGame() {
    elements.gameOverModal.classList.add('hidden');
    elements.gameScreen.classList.remove('active');
    elements.menuScreen.classList.add('active');
}

// Ouvrir le modal des règles
function openRulesModal() {
    elements.rulesModal.classList.remove('hidden');
}

// Fermer le modal des règles
function closeRulesModal() {
    elements.rulesModal.classList.add('hidden');
}

// Afficher une notification
// type: 'error', 'success', 'warning'
function showNotification(title, message, type = 'error') {
    const icons = {
        error: '❌',
        success: '✅',
        warning: '⚠️'
    };
    
    elements.notificationIcon.textContent = icons[type] || icons.error;
    elements.notificationTitle.textContent = title;
    elements.notificationMessage.textContent = message;
    
    // Appliquer la classe de type
    const modalContent = elements.notificationModal.querySelector('.modal-content');
    modalContent.classList.remove('error', 'success', 'warning');
    modalContent.classList.add(type);
    
    elements.notificationModal.classList.remove('hidden');
}

// Fermer le modal de notification
function closeNotificationModal() {
    elements.notificationModal.classList.add('hidden');
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', init);
