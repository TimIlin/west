import Card from './Card.js';
import Game from './Game.js';
import TaskQueue from './TaskQueue.js';
import SpeedRate from './SpeedRate.js';

function isDuck(card) {
    return card && card.quacks && card.swims;
}

function isDog(card) {
    return card instanceof Dog;
}

function getCreatureDescription(card) {
    if (isDuck(card) && isDog(card)) {
        return 'Утка-Собака';
    }
    if (isDuck(card)) {
        return 'Утка';
    }
    if (isDog(card)) {
        return 'Собака';
    }
    return 'Существо';
}

class Creature extends Card{
    constructor(name, maxPower, image) {
        super(name,maxPower,image)
    }

    getDescriptions(){
        return [getCreatureDescription(this), ...super.getDescriptions()]
    }
}

class Duck extends Creature {
    constructor() {
        super("Мирная утка", 2);
    }

    quacks() {
        console.log('quack');
    }

    swims() {
        console.log('float: both;');
    }
}

class Dog extends Creature {
    constructor() {
        super("Пес-бандит", 3);
    }
}
class PseudoDuck extends Dog {
    constructor() {
        super("Псевдоутка,", 3);
    }

    quacks() {
        console.log('quack');
    }

    swims() {
        console.log('swims');
    }
}


class Trasher extends Dog {
    constructor() {
        super("Громила", 5);
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        const reducedValue = Math.max(value - 1, 0);
        
        if (value > 0 && reducedValue <= 0) {
            this.view.signalAbility(() => {
                continuation(reducedValue);
            });
        } 
        else if (value > 0 && reducedValue > 0) {
            this.view.signalAbility(() => {
                continuation(reducedValue);
            });
        }
        else {
            continuation(reducedValue);
        }
    }

    getDescriptions() {
        const baseDescriptions = super.getDescriptions();
        return ['Получает на 1 меньше урона', ...baseDescriptions];
    }
}

class Gatling extends Creature {
    constructor() {
        super("Гатлинг", 6);
    }

    attack(gameContext, continuation) {
        const taskQueue = new TaskQueue();
        const {currentPlayer, oppositePlayer} = gameContext;

        taskQueue.push(onDone => this.view.showAttack(onDone));

        const oppositeCards = oppositePlayer.table.filter(card => card !== null);

        oppositeCards.forEach(card => {
            taskQueue.push(onDone => {
                this.dealDamageToCreature(2, card, gameContext, onDone);
            });
            
            taskQueue.push(onDone => oppositePlayer.removeDead(onDone));
        });

        taskQueue.continueWith(continuation);
    }

    getDescriptions() {
        const baseDescriptions = super.getDescriptions();
        return ['Атакует: 2 урона всем картам противника', ...baseDescriptions];
    }
}

class Lad extends Dog {
    constructor() {
        super("Браток", 2);
    }

    static getInGameCount() {
        return this.inGameCount || 0;
    }

    static setInGameCount(value) {
        this.inGameCount = value;
    }

    static getBonus() {
        const count = this.getInGameCount();
        return count * (count + 1) / 2;
    }

    doAfterComingIntoPlay(gameContext, continuation) {
        const currentCount = Lad.getInGameCount();
        Lad.setInGameCount(currentCount + 1);
        
        super.doAfterComingIntoPlay(gameContext, continuation);
    }

    doBeforeRemoving(continuation) {
        const currentCount = Lad.getInGameCount();
        Lad.setInGameCount(currentCount - 1);
        
        super.doBeforeRemoving(continuation);
    }

    modifyDealedDamageToCreature(value, toCard, gameContext, continuation) {
        const bonus = Lad.getBonus();
        const increasedValue = value + bonus;
        
        if (bonus > 0) {
            this.view.signalAbility(() => {
                continuation(increasedValue);
            });
        } else {
            continuation(increasedValue);
        }
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        const bonus = Lad.getBonus();
        const reducedValue = Math.max(value - bonus, 0);
        
        if (bonus > 0 && value > 0) {
            this.view.signalAbility(() => {
                continuation(reducedValue);
            });
        } else {
            continuation(reducedValue);
        }
    }

    getDescriptions() {
        const baseDescriptions = super.getDescriptions();
        const descriptions = ['Чем их больше, тем они сильнее'];
        
        if (Lad.prototype.hasOwnProperty('modifyDealedDamageToCreature') || 
            Lad.prototype.hasOwnProperty('modifyTakenDamage')) {
        }
        
        return [...descriptions, ...baseDescriptions];
    }
}
class Rogue extends Creature {
    constructor() {
        super("Изгой", 2);
    }

    stealAbilities(gameContext) {
        const {currentPlayer, oppositePlayer} = gameContext;
        const allCards = [
            ...currentPlayer.table.filter(card => card && card !== this),
            ...oppositePlayer.table.filter(card => card && card !== this)
        ];

        const abilitiesToSteal = [
            'modifyDealedDamageToCreature',
            'modifyDealedDamageToPlayer',
            'modifyTakenDamage'
        ];

        allCards.forEach(card => {
            if (!card) return;

            const cardPrototype = Object.getPrototypeOf(card);

            abilitiesToSteal.forEach(abilityName => {
                if (cardPrototype.hasOwnProperty(abilityName)) {
                    
                    if (!this[abilityName]) {
                        this[abilityName] = card[abilityName].bind(this);
                    }
                    
                    delete cardPrototype[abilityName];
                    
                    if (card.updateView) {
                        card.updateView();
                    }
                }
            });
        });

        allCards.forEach(card => {
            if (card && card.updateView) {
                card.updateView();
            }
        });

        if (gameContext.updateView) {
            gameContext.updateView();
        }
    }

    doBeforeAttack(gameContext, continuation) {
        this.view.signalAbility(() => {
            this.stealAbilities(gameContext);
            
            super.doBeforeAttack(gameContext, continuation);
        });
    }

    modifyDealedDamageToCreature(value, toCard, gameContext, continuation) {
        if (this.modifyDealedDamageToCreature !== Rogue.prototype.modifyDealedDamageToCreature) {
            this.modifyDealedDamageToCreature(value, toCard, gameContext, continuation);
        } else {
            continuation(value);
        }
    }

    modifyDealedDamageToPlayer(value, gameContext, continuation) {
        if (this.modifyDealedDamageToPlayer !== Rogue.prototype.modifyDealedDamageToPlayer) {
            this.modifyDealedDamageToPlayer(value, gameContext, continuation);
        } else {
            continuation(value);
        }
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        if (this.modifyTakenDamage !== Rogue.prototype.modifyTakenDamage) {
            this.modifyTakenDamage(value, fromCard, gameContext, continuation);
        } else {
            continuation(value);
        }
    }

    getDescriptions() {
        const baseDescriptions = super.getDescriptions();
        return ['При атаке похищает способности у карт того же типа', ...baseDescriptions];
    }
}

class Nemo extends Creature {
    constructor() {
        super("Немо", 4);
    }

    doBeforeAttack(gameContext, continuation) {
        this.view.signalAbility(() => {
            const {currentPlayer, oppositePlayer} = gameContext;
            
            const targetCard = oppositePlayer.table.find(card => card !== null);
            
            if (targetCard && targetCard !== this) {
                const oldPrototype = Object.getPrototypeOf(this);
                const targetPrototype = Object.getPrototypeOf(targetCard);
                
                Object.setPrototypeOf(this, targetPrototype);
                
                this.updateView();
                
                if (targetPrototype.hasOwnProperty('doBeforeAttack') && 
                    targetPrototype.doBeforeAttack !== Creature.prototype.doBeforeAttack) {
                    
                    targetPrototype.doBeforeAttack.call(this, gameContext, () => {
                        continuation();
                    });
                } else {
                    continuation();
                }
            } else {
                continuation();
            }
        });
    }

    getDescriptions() {
        const baseDescriptions = super.getDescriptions();
        return ['Крадет прототип и способности врага', ...baseDescriptions];
    }
}

const seriffStartDeck = [
    new Duck(),
    new Duck(),
    new Duck(),
    new Rogue(),
];
const banditStartDeck = [
    new Lad(),
    new Lad(),
    new Nemo(),
];

const game = new Game(seriffStartDeck, banditStartDeck);

SpeedRate.set(1);

game.play(false, (winner) => {
    alert('Победил ' + winner.name);
});