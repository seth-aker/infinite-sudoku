# A Sudoku Puzzle Server with a Vue Frontend

## Why write another sudoku app?
This application started as my first attempt at creating a sudoku puzzle generator, written entirely in typescript with a vue frontend. However, it was horrifically slow, especially at generating puzzles of greater difficulty. I eventually gave up on it. 

However, then I decided to revisit the puzzle generator portion and actually make it fast. The result of this was my [Cdoku Puzzle Generator](https://github.com/seth-aker/cdoku). Honestly, I deployed this app so that I could display/use the results of my application. Cdoku was designed to be *blazingly fast*&trade;, capable of generating hundreds of unique sudoku puzzles of various difficulties in seconds. This application presents the generated puzzles in a playable format.

## The Stack
- **Cdoku**: The root of the application, written in plain C99, generates the puzzles and passes them to the database.
- **SQLite**: Fast and simple database
- **Node/Express.js**: Tried and true javascript server library. Implements Controller-Service-Repository architecture.
- **Vue/Vite**: Simple SPA that displays the puzzles. Vue is lowkey better than React IMO which is why it is my go-to frontend framework.

## Infrastructure
Reusing a retired PC, this app is hosted on Ubuntu Server 24.04.4 LTS. Managed by an Nginx reverse-proxy pointing to two docker containers deployed via docker-compose. While this setup likely would quickly be overwhelmed by heavy loads, it is an economical and effective for this use case where I expect traffic to be extremely light. 

## Comming Next
- User authentication: Allow users to login, see their puzzle solving statistics, and be able to retrieve puzzle progress from different devices.
- Dark mode support
- Impoved CI/CD deployments: Turn the frontend and backend into a true monorepo with pnpm workspaces.
- Hard/Impossible difficulties (this technically comes from Cdoku, but it is part of the project)

## \*AI Disclosure\*
Absolutely no generative AI was used in the production of this site.
