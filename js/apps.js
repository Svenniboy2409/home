/*
 * ✦ Starport destinations ✦
 *
 * This is the one file to edit when you want to change what Starport shows.
 * Every entry becomes a card in the grid and a planet in the orbit view.
 * The order here decides the keyboard shortcuts (1 = first, 2 = second, …).
 *
 *   id        unique, lowercase, no spaces (used to remember favourites)
 *   name      big title on the card
 *   kicker    small line above the title
 *   desc      one or two sentences
 *   url       where the warp takes you
 *   icon      image in assets/ (square)
 *   accent    main colour of the card glow and planet atmosphere
 *   accent2   second colour for gradients
 *   kind      "app" or "game" (decides the section and the orbit ring)
 *   keywords  extra words the search should find this by
 *   scene     games only: background particles, "stars" or "dice"
 */
export const destinations = [
  {
    id: 'wonderland',
    name: 'Super Mario Wonderland',
    kicker: 'Platform Game',
    // TODO: your own description
    desc: 'A colourful platform adventure, right in your browser. Run, jump and explore.',
    url: 'https://super-mario-wonderland.web.app',
    icon: 'assets/games/wonderland.svg',
    accent: '#ff8a5c',
    accent2: '#ffd23f',
    kind: 'game',
    keywords: ['mario', 'platformer', 'jump', 'adventure', 'game'],
    scene: 'stars',
  },
  {
    id: 'boardgames',
    name: 'DIY Board Games',
    kicker: 'Board Game Collection',
    // TODO: your own description
    desc: 'Roll the dice: a collection of board games to play together online.',
    url: 'https://diy-board-games.web.app',
    icon: 'assets/games/boardgames.svg',
    accent: '#2dd4bf',
    accent2: '#8b7bff',
    kind: 'game',
    keywords: ['board', 'dice', 'party', 'friends', 'game'],
    scene: 'dice',
  },
  {
    id: 'scent',
    name: 'Scent',
    kicker: 'Perfume Collection',
    desc: 'Browse well-known fragrances, explore their notes and keep your collection and wishlist side by side.',
    url: 'https://svenniboy2409.github.io/scent-perfume-app/',
    icon: 'assets/apps/scent.svg',
    accent: '#d6ad5a',
    accent2: '#f3d38c',
    kind: 'app',
    keywords: ['perfume', 'fragrance', 'parfum', 'notes', 'wishlist', 'collection'],
  },
  {
    id: 'mixly',
    name: 'Mixly',
    kicker: 'Cocktail Collection',
    desc: 'Discover classic cocktails, save your favourites and craft your own recipes, with a moody bar vibe.',
    url: 'https://svenniboy2409.github.io/cocktail-app/',
    icon: 'assets/apps/mixly.svg',
    accent: '#e0a458',
    accent2: '#f0be7c',
    kind: 'app',
    keywords: ['cocktail', 'drinks', 'bar', 'recipes', 'mocktail'],
  },
  {
    id: 'wenslijst',
    name: 'Wenslijst',
    kicker: 'Gift Wishlists',
    desc: 'Paste a product link and it fills itself in. Share lists with friends, and the surprise stays a surprise.',
    url: 'https://gift-app-beryl.vercel.app/',
    icon: 'assets/apps/wenslijst.png',
    accent: '#e07a50',
    accent2: '#f2a07e',
    kind: 'app',
    keywords: ['gift', 'gifts', 'presents', 'wishlist', 'cadeau', 'birthday'],
  },
  {
    id: 'creami',
    name: 'Creami',
    kicker: 'Frozen Treat Recipes',
    desc: 'Ice cream, gelato and sorbet for every Ninja CREAMi, with the right program for each step.',
    url: 'https://svenniboy2409.github.io/creami-app/',
    icon: 'assets/apps/creami.svg',
    accent: '#f28ba8',
    accent2: '#fbe7b5',
    kind: 'app',
    keywords: ['ice cream', 'gelato', 'sorbet', 'ninja', 'dessert', 'recipes'],
  },
];
