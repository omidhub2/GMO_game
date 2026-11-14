# GMO Game

GMO Arena: a Next.js application with a Persian backgammon interface, game rules, player lobby, wallet, and tournament modules.

## Local development

```sh
npm ci
npm run dev
```

Open http://localhost:3000/games/backgammon to play backgammon locally.

Keep local credentials in `.env`. Environment files are excluded from Git. Database-backed features require separate configuration; see [database setup](docs/DATABASE_SETUP.md).

## Checks

```sh
npm run typecheck
npm test
```

## Documentation

- [Backgammon](docs/BACKGAMMON.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)

The current backgammon lobby and game run locally. Invitation links carry setup information; game state is not synchronized between devices yet.
