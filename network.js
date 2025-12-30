// Gestion du réseau avec PeerJS
const Network = {
    peer: null,
    connections: [], // Pour l'hôte : liste des connexions
    hostConnection: null, // Pour les clients : connexion vers l'hôte
    isHost: false,
    myId: null,
    myName: '',
    gameCode: null,
    players: [], // Liste des joueurs { id, name, isHost }
    onPlayersUpdate: null,
    onGameStart: null,
    onGameStateUpdate: null,
    onError: null,

    // Générer un code de partie aléatoire
    generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // Créer une partie (hôte)
    async createGame(playerName) {
        return new Promise((resolve, reject) => {
            this.myName = playerName || 'Hôte';
            this.isHost = true;
            this.gameCode = this.generateGameCode();
            
            // Créer le peer avec un ID basé sur le code
            const peerId = 'ecureuil-' + this.gameCode;
            this.peer = new Peer(peerId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Partie créée avec ID:', id);
                this.myId = id;
                this.players = [{
                    id: this.myId,
                    name: this.myName,
                    isHost: true,
                    peerId: this.myId
                }];
                this.broadcastPlayers();
                resolve(this.gameCode);
            });

            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Erreur Peer:', err);
                if (err.type === 'unavailable-id') {
                    reject(new Error('Ce code de partie existe déjà. Réessayez.'));
                } else {
                    reject(err);
                }
            });
        });
    },

    // Rejoindre une partie
    async joinGame(gameCode, playerName) {
        return new Promise((resolve, reject) => {
            this.myName = playerName || 'Joueur';
            this.isHost = false;
            this.gameCode = gameCode.toUpperCase();

            this.peer = new Peer({
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                this.myId = id;
                console.log('Mon ID:', id);

                // Se connecter à l'hôte
                const hostId = 'ecureuil-' + this.gameCode;
                console.log('Connexion à:', hostId);
                
                const conn = this.peer.connect(hostId, {
                    reliable: true,
                    metadata: { name: this.myName }
                });

                conn.on('open', () => {
                    console.log('Connecté à l\'hôte!');
                    this.hostConnection = conn;
                    
                    // Envoyer notre info
                    conn.send({
                        type: 'join',
                        name: this.myName,
                        id: this.myId
                    });

                    resolve(this.gameCode);
                });

                conn.on('data', (data) => {
                    this.handleData(data, conn);
                });

                conn.on('close', () => {
                    console.log('Déconnecté de l\'hôte');
                    if (this.onError) this.onError('Déconnecté de la partie');
                });

                conn.on('error', (err) => {
                    console.error('Erreur de connexion:', err);
                    reject(new Error('Impossible de rejoindre la partie. Vérifiez le code.'));
                });

                // Timeout si pas de connexion (15 secondes)
                setTimeout(() => {
                    if (!this.hostConnection) {
                        reject(new Error('Impossible de rejoindre la partie. Vérifiez le code ou réessayez.'));
                    }
                }, 15000);
            });

            this.peer.on('error', (err) => {
                console.error('Erreur Peer:', err);
                reject(err);
            });
        });
    },

    // Gérer une nouvelle connexion (hôte seulement)
    handleNewConnection(conn) {
        console.log('Nouvelle connexion:', conn.peer);

        conn.on('open', () => {
            this.connections.push(conn);
            console.log('Connexion établie avec:', conn.peer);
        });

        conn.on('data', (data) => {
            this.handleData(data, conn);
        });

        conn.on('close', () => {
            // Retirer le joueur
            this.connections = this.connections.filter(c => c !== conn);
            this.players = this.players.filter(p => p.peerId !== conn.peer);
            this.broadcastPlayers();
        });
    },

    // Gérer les données reçues
    handleData(data, conn) {
        console.log('Données reçues:', data.type);

        switch (data.type) {
            case 'join':
                // Un joueur rejoint (hôte seulement)
                if (this.isHost && this.players.length < 6) {
                    this.players.push({
                        id: data.id,
                        name: data.name,
                        isHost: false,
                        peerId: conn.peer
                    });
                    this.broadcastPlayers();
                }
                break;

            case 'players':
                // Mise à jour de la liste des joueurs (clients)
                this.players = data.players;
                if (this.onPlayersUpdate) this.onPlayersUpdate(this.players);
                break;

            case 'game-start':
                // La partie commence
                if (this.onGameStart) this.onGameStart(data.gameState);
                break;

            case 'game-state':
                // Mise à jour de l'état du jeu
                if (this.onGameStateUpdate) this.onGameStateUpdate(data.state);
                break;

            case 'player-action':
                // Action d'un joueur (hôte reçoit)
                if (this.isHost && this.onPlayerAction) {
                    this.onPlayerAction(data.action, data.playerId);
                }
                break;
        }
    },

    // Diffuser la liste des joueurs (hôte seulement)
    broadcastPlayers() {
        if (!this.isHost) return;

        const message = {
            type: 'players',
            players: this.players
        };

        this.connections.forEach(conn => {
            if (conn.open) conn.send(message);
        });

        if (this.onPlayersUpdate) this.onPlayersUpdate(this.players);
    },

    // Envoyer l'état du jeu à tous (hôte seulement)
    broadcastGameState(state) {
        if (!this.isHost) return;

        const message = {
            type: 'game-state',
            state: state
        };

        this.connections.forEach(conn => {
            if (conn.open) conn.send(message);
        });
    },

    // Démarrer la partie (hôte seulement)
    startGame(gameState) {
        if (!this.isHost) return;

        const message = {
            type: 'game-start',
            gameState: gameState
        };

        this.connections.forEach(conn => {
            if (conn.open) conn.send(message);
        });

        if (this.onGameStart) this.onGameStart(gameState);
    },

    // Envoyer une action au serveur (clients seulement)
    sendAction(action) {
        if (this.isHost) {
            // L'hôte traite directement
            if (this.onPlayerAction) this.onPlayerAction(action, this.myId);
        } else if (this.hostConnection && this.hostConnection.open) {
            this.hostConnection.send({
                type: 'player-action',
                action: action,
                playerId: this.myId
            });
        }
    },

    // Quitter la partie
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
        }
        this.peer = null;
        this.connections = [];
        this.hostConnection = null;
        this.isHost = false;
        this.myId = null;
        this.gameCode = null;
        this.players = [];
    },

    // Obtenir mon index de joueur
    getMyPlayerIndex() {
        // Chercher dans les players du GameState via peerId
        if (window.GameState && window.GameState.players) {
            const idx = window.GameState.players.findIndex(p => p.peerId === this.myId);
            if (idx !== -1) return idx;
        }
        // Fallback sur la liste du lobby
        return this.players.findIndex(p => p.id === this.myId);
    }
};

window.Network = Network;
