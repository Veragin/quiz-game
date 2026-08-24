# quiz-game

Multiplayer "who wrote this answer?" quiz. Everyone answers the same question
list, then the answers are dealt out anonymously one question at a time and
players guess who wrote what — plus one vote for the best answer of the round.

## Layout

```
server/            NestJS + socket.io (port 3002)
  src/auth/        name-only login, token → user
  src/rooms/       rooms, seats, reconnects; game-agnostic
  src/game/        the quiz itself, one game per room
  src/types/       ALL shared types live here and only here
client/            Vite + React 19 + mobx + react-router (dev port 5174)
  src/types        symlink → ../../server/src/types
  src/context/     Socket / Auth / Room / Game providers
  src/services/    RoomService, GameService (mobx stores)
  src/pages/       LoginPage, RoomsPage, RoomPage
  src/components/  Prepare, Answering, Guessing, Reveal, Scoreboard, ...
docker/            Dockerfile.dev (dev container), Dockerfile.build (deploy)
questions.txt      default question list, read once at boot
```

Two independent yarn packages — there is no root `package.json`. Run `yarn` in
`server/` and in `client/` separately.

## Shared types

`client/src/types` is a **symlink** to `server/src/types`. Always edit the
server-side file; the client sees the change automatically. `yarn build` in the
client runs `symlink-resolver` around the build because Vite/tsc cannot follow
the symlink out of the package (and `docker/Dockerfile.build` copies
`server/src/types` into the client stage for the same reason).

## Commands

| Where | Command | What |
| --- | --- | --- |
| root | `make start` | dev container up (ports 3002, 5174) |
| root | `make bash` | shell into the container at `/app/server` |
| root | `make build` | deploy tree into `../rosti/quiz` via `docker/Dockerfile.build` |
| `server/` | `yarn start` | ts-node, listens on `PORT` (default 3002) |
| `server/` | `yarn build` | tsc → `server/dist` |
| `client/` | `yarn start` | Vite dev server on 5174 |
| `client/` | `yarn build` | typecheck + bundle → `client/dist` |
| `client/` | `yarn lint` | eslint |

In production the server serves `client/dist` itself; in dev the SPA talks to
`http://localhost:3002`. `PUBLIC_URL` (default `/quiz` in the build image) sets
Vite's `base`, which carries through to the router and socket.io path.

## Game model

One `TGameState` per room, in memory, created with the room and destroyed with
it. A server restart wipes rooms, sessions and scores.

Phases: `prepare → answering → guessing ⇄ reveal → scoreboard`.

- **prepare** — the host (`room.createdBy`) edits the question list, seeded from
  `questions.txt`, and starts the game. Needs ≥ 2 connected players.
- **answering** — everyone answers *every* question; a blank answer is refused
  so no option can be empty later.
- **guessing** — one question at a time: the answers are shuffled and shown
  without authors. Each player assigns an author to every option and may vote
  for one best answer — never their own (enforced server-side, since the
  options are anonymous).
- **reveal** — authors, vote counts and the per-player breakdown. Everyone has
  to press *Next* (`readyForNext`) before the next round.
- **scoreboard** — final standings; the host can restart, which drops the room
  back to `prepare` and reopens it to newcomers.

Scoring: +1 per correctly guessed author, +1 for the author(s) of the
most-voted answer (ties share it, no votes means no bonus).

### Rules that are easy to break

- **`game:state` is built per recipient.** During `answering` a player only ever
  receives their own answers, and during `guessing` the author ordering
  (`game.order`) must never leave the server. `authorIds` is sorted so it cannot
  leak the option order. Broadcasting the state verbatim would give the game away.
- **Every "is everyone ready?" gate counts connected players only.** One closed
  tab must not freeze a round; the gate is re-evaluated whenever someone drops,
  returns or leaves (`RoomsService.onUserConnectionChanged`).
- **A player who leaves mid-game is flagged, not deleted** — their answer may
  already be on the table and the reveal has to be able to name them. In
  `prepare` the seat is simply removed.

## Rooms ↔ game wiring

`RoomsService` knows nothing about the quiz. `GameModule` subscribes to its
seams on init: `onRoomCreated` / `onRoomDeleted`, `onUserAddedToRoom` /
`onUserRemovedFromRoom`, `onUserConnectionChanged`, plus `setJoinGuard` (closes
the room once the game starts, while still letting seated players back in) and
`setRoomStatusProvider` (feeds `isOpen`/`phase` into the room list). Add new
cross-module behaviour the same way rather than importing the game into rooms.
