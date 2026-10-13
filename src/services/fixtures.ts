import type { HomeData, Listing } from './types.ts';

export const LISTINGS: Listing[] = [
  { id: '1', title: 'Trilocale luminoso in centro', city: 'Milano', price: 420000, rooms: 3, mq: 85, description: 'Terzo piano con ascensore, doppia esposizione, cantina.' },
  { id: '2', title: 'Villa con giardino', city: 'Bergamo', price: 780000, rooms: 6, mq: 240, description: 'Villa indipendente su due livelli, giardino di 600 mq, box doppio.' },
  { id: '3', title: 'Bilocale ristrutturato', city: 'Torino', price: 168000, rooms: 2, mq: 52, description: 'Ristrutturato a nuovo, classe energetica B, vicino alla metro.' },
  { id: '4', title: 'Attico con terrazzo', city: 'Roma', price: 925000, rooms: 4, mq: 130, description: 'Attico panoramico con terrazzo di 70 mq.' },
  { id: '5', title: 'Casa colonica da riordinare', city: 'Siena', price: 295000, rooms: 7, mq: 310, description: 'Casale in pietra con 2 ettari di terreno.' },
  { id: '6', title: 'Monolocale vicino al mare', city: 'Rimini', price: 119000, rooms: 1, mq: 34, description: 'A 200 metri dalla spiaggia, ideale come investimento.' },
];

export const HOME: HomeData = {
  headline: 'Trova la casa giusta per te',
  featured: LISTINGS.slice(0, 3),
};
