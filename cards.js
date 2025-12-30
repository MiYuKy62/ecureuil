// Définition des cartes
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = {
    '♠': 'black',
    '♣': 'black',
    '♥': 'red',
    '♦': 'red'
};

const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Créer un deck complet de 52 cartes
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({
                suit,
                value,
                color: SUIT_COLORS[suit],
                id: `${value}${suit}`
            });
        }
    }
    return deck;
}

// Mélanger le deck (algorithme de Fisher-Yates)
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Créer l'élément HTML d'une carte
function createCardElement(card, faceUp = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    
    if (faceUp && card) {
        cardEl.classList.add('card-front', card.color);
        cardEl.innerHTML = `
            <span class="card-value">${card.value}</span>
            <span class="card-suit">${card.suit}</span>
        `;
        cardEl.dataset.cardId = card.id;
    } else {
        cardEl.classList.add('card-back');
    }
    
    return cardEl;
}

// Obtenir la valeur en points d'une carte
function getCardPoints(card) {
    if (!card) return 0;
    
    switch (card.value) {
        case 'A':
            return 1;
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            return parseInt(card.value);
        case '10':
            return 10; // Action spéciale : regarder sa propre carte
        case 'J':
            return 10; // Valet - action spéciale : regarder carte adversaire
        case 'Q':
            return 10; // Dame - action spéciale : échanger cartes
        case 'K':
            // Roi noir = 30 points, Roi rouge = -2 points
            return card.color === 'black' ? 30 : -2;
        default:
            return 0;
    }
}

// Vérifier si une carte a une action spéciale
function getCardAction(card) {
    if (!card) return null;
    
    switch (card.value) {
        case 'J':
            return {
                type: 'peek_opponent',
                description: 'Regarder une carte d\'un adversaire'
            };
        case '10':
            return {
                type: 'peek_self',
                description: 'Regarder une de vos cartes'
            };
        case 'Q':
            return {
                type: 'swap',
                description: 'Échanger une carte avec n\'importe quel joueur'
            };
        default:
            return null;
    }
}

// Exporter les fonctions
window.CardUtils = {
    createDeck,
    shuffleDeck,
    createCardElement,
    getCardPoints,
    getCardAction,
    SUITS,
    VALUES,
    SUIT_COLORS
};
