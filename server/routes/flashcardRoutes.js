import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    getFlashcards, createDeck, createDeckFromReviewer, getReview, getDeck, updateDeck, deleteDeck,
    addCard, updateCard, deleteCard, rateCard,
} from '../controllers/flashcardController.js';

const flashcardRouter = express.Router();

flashcardRouter.use(userAuth);
flashcardRouter.get('/', getFlashcards);
// Fixed paths go before the ones with ids so they aren't read as ids.
flashcardRouter.get('/review', getReview);
flashcardRouter.post('/decks', createDeck);
flashcardRouter.post('/decks/from-reviewer', createDeckFromReviewer);
flashcardRouter.get('/decks/:deckId', getDeck);
flashcardRouter.patch('/decks/:deckId', updateDeck);
flashcardRouter.delete('/decks/:deckId', deleteDeck);
flashcardRouter.post('/decks/:deckId/cards', addCard);
flashcardRouter.patch('/cards/:cardId', updateCard);
flashcardRouter.delete('/cards/:cardId', deleteCard);
flashcardRouter.post('/cards/:cardId/rate', rateCard);

export default flashcardRouter;
