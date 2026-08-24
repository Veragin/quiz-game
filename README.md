# quiz-game

this project is about playing a quiz game. There is list of questions, every player fill up answers. Once everyone is ready, start the game, going one by one per question, player need to guess who answered what, getting point for every guess. The player who got most points won.

## Flow

- user has to login and pick a name
- room managment
- room has states: prepare, answering, guessing, scoreboard
    - prepare
        - wait for all players
        - set question list
    - answering
        - all players get list of questions and has to answer for every one
        - wait till all players submit
    - guessing
        - going through all questions one by one
        - has to pick a player for every answer and submit
        - reveal correct player assignmet and number of points
        - continue with next question
    * scoreboard
        - reveal the final score

## Implementation

- see project Room-voice-startup
- use it as a template
- remove all voice chat code (not needed here)
- keep the room managment
- use the already created implementation of the quiz game
- server side is in @src
- client side in @react
- the question list can be imported from a file and adjusted in the prepare phase

## Improvments

- each player votes the best answer (cant vote for his) => player with most votes get extra point

---

# Implementation plan

## Starting point

Three code bases live in this repo today and the plan is to fold them into one.

| Where | What it is | Fate |
| --- | --- | --- |
| `src/` | NestJS server: raw `ws` gateway, **one global game**, questions read from `questions.txt` at boot | game logic ported, transport & lifecycle rewritten |
| `react/` | Vite SPA: 5 quiz screens, single `useWebSocket` hook, no router | screens ported, data layer rewritten |
| `Room-voice-stratup/` | The template: socket.io, rooms, name-login auth, mobx services, react-router, shared types | becomes the skeleton, voice stripped, then the directory is deleted |

What each side is missing:

- The quiz server has no rooms, no `prepare` phase, no real auth (the client invents its own `token` via `Math.random()`), and it starts the guessing phase through an unauthenticated `GET /public/startGuessing`.
- The template has all of the above but knows nothing about questions, answers or scoring, and drags ~1400 lines of voice code (`voice.server.ts`, `VoiceService.ts`, private calls, worklets, sound) that must go.

The root `Makefile` was already copied from the template and points at things that do not exist yet — `docker/Dockerfile.build` (missing) and `make bash` cwd `/app/server` (missing). That is a strong hint the two-package layout below is the intended destination.

## Target architecture

### Repo layout

Adopt the template's two-package layout. The Makefile, the deploy Dockerfile and the shared-types symlink all assume it.

```
server/                  # was src/  (+ Room-voice-stratup/server scaffolding)
  src/
    main.ts              # socket.io adapter, PORT env
    app.module.ts        # ServeStatic ../../client/dist, AuthModule, RoomsModule, GameModule
    auth/                # from template, unchanged
    rooms/               # from template, voice listener hook removed
    game/                # NEW: game.module.ts, game.service.ts, game.gateway.ts, questions.ts
    types/index.ts       # single source of truth for shared types
client/                  # was react/  (+ Room-voice-stratup/client scaffolding)
  src/
    types -> ../../server/src/types   # symlink, same trick as the template
    context/             # SocketContext, AuthContext, RoomContext, GameContext
    services/            # RoomService, GameService (mobx)
    pages/               # LoginPage, RoomsPage, RoomPage
    components/          # Prepare, Answering, Guessing, Reveal, Scoreboard, PlayerStatus, Layout
docker/
  Dockerfile.dev         # dev container (current docker/Dockerfile, ports 3002 + 5174)
  Dockerfile.build       # multi-stage export, ported from the template
questions.txt            # default question list, read at room creation
```

### Transport

Everything moves to **socket.io** — the template's rooms and auth are built on it, and it gives us rooms/broadcast, ack callbacks and reconnection for free. The quiz client's `useWebSocket` hook and the `ws` gateway are dropped.

Client-generated tokens go away: identity is the server-issued `userId`/`token` from `AuthService`. **Every game structure keys on `userId`, not on the old `token`.**

### Per-room game state

The current `Game` service is a singleton — one game for the whole process. It becomes one state object per room, owned by `GameService` and keyed by `roomId`:

```ts
type TGamePhase = 'prepare' | 'answering' | 'guessing' | 'reveal' | 'scoreboard';

type TGameState = {
    roomId: string;
    phase: TGamePhase;
    questions: TQuestion[];              // { id, text }, editable in prepare
    players: Map<string, TGamePlayer>;   // userId → answers / guess / bestVote / score
    questionIndex: number;               // which question is being guessed
    order: string[];                     // shuffled userIds = the answer order for this question
    readyForNext: Set<string>;           // who pressed "Next" on the reveal screen
};

type TGamePlayer = {
    userId: string;
    answers: Record<string, string>;     // questionId → answer
    submitted: boolean;                  // answering phase done
    guess: string[] | null;              // per option index → guessed userId
    bestVote: number | null;             // index into `order` of the best answer
    score: number;
};
```

The room's host (`room.createdBy`) drives the phase transitions that are not automatic.

Room lifecycle hooks it into `RoomsService`: a game is created with the room, and torn down when the room is deleted. `RoomsService.onUserRemovedFromRoom` — the same listener seam the voice module used — is what the game subscribes to in order to drop a leaving player, so `RoomsService` keeps no dependency on the game.

### Message contract

Client → server (all with ack callbacks, all validated against phase + host where relevant):

| Event | Payload | Allowed in |
| --- | --- | --- |
| `game:request-state` | — | any (state pull after mount / reconnect) |
| `game:set-questions` | `{ questions: string[] }` | prepare, host only |
| `game:start` | — | prepare, host only |
| `game:submit-answers` | `{ answers: Record<string,string> }` | answering |
| `game:submit-guess` | `{ guess: string[], bestVote: number \| null }` | guessing |
| `game:next` | — | reveal |
| `game:restart` | — | scoreboard, host only |

Server → client:

| Event | Payload |
| --- | --- |
| `game:state` | phase + everything the current phase needs, per-recipient (see below) |
| `game:players` | `{ userId, name, isDisconnected, ready }[]` — the "3 / 5 ready" badge |
| `game:reveal` | `{ questionId, authors: string[], votes: number[], gained: number, breakdown }` |
| `game:scoreboard` | `{ userId, score }[]`, sorted |

`game:state` is **built per recipient**, not broadcast verbatim: during `answering` a player receives only their own answers, and during `guessing` the option list must not leak its authors. This is a real change from the current server, which happily broadcasts `guessingResults` — the correct answer ordering — inside every `stateChange`.

## Phases

### Phase 0 — Scaffolding

1. `git mv src server/src`, `git mv react client`, move the template's `server/package.json`, `tsconfig.json`, `.yarnrc.yml`, `.yarn/` and the client equivalents into place; merge the root `package.json` scripts into `server/package.json`.
2. Create `client/src/types` as a symlink to `../../server/src/types` and add `symlink-resolver` to the client build script, exactly as the template does.
3. Port `docker/Dockerfile.dev` (from the current `docker/Dockerfile`) and `docker/Dockerfile.build` (from the template, `PUBLIC_URL=/quiz`); update `docker-compose.yml` to expose `3002` and `5174`.
4. Delete `dist/`, `public/dist/`, `public/index.html`, `public/main.css` — the old hand-written page and stale build output. Keep `public/video/` if the shark theme is still wanted, otherwise move it to `client/public/`.

**Done when** `make start && make bash` works and both `yarn build`s pass on the untouched code.

### Phase 1 — Template intake, voice removed

1. Copy in `auth/` (as-is), `rooms/` (as-is), `types/index.ts` (trimmed).
2. Delete `voice/`, `VoiceService.ts`, `VoiceContext`, `SoundContext`, `SoundService`, `worklets/`, `VoiceControls`, `VoiceNotifications`, `PrivateCallPanel`, `PrivateCallsTable`, `VolumeSettings`, `public/sounds/`, and the `TPrivateCall*` types.
3. Strip voice references out of `RoomPage.tsx` (the speaking dot, call buttons and the `separated`/`canCall`/`canInvite` logic — roughly lines 105-190) and out of `App.tsx`'s provider tree. `RoomsService.onUserRemovedFromRoom` **stays** — the game will use it.
4. Drop `@nestjs/platform-ws` / `ws` from the server deps; add `socket.io-client`, `mobx`, `mobx-react-lite`, `react-router-dom`, `styled-components` to the client.

**Done when** login → room list → create/join/leave/rename works end to end with no voice code left in the tree.

### Phase 2 — Game module (server)

1. `game.service.ts`: the state above, plus `createGame`, `destroyGame`, `setQuestions`, `start`, `submitAnswers`, `submitGuess`, `markNextReady`, `removePlayer`, `isOpen` / `isSeated`, and a `getStateFor(userId)` projector.
2. Port the scoring and shuffle from `src/Game.ts` (`nextGuessing`, the per-answer comparison in `vote`) into `startRound()` / `scoreRound()`, now scoped to a room.
3. `questions.ts`: read `questions.txt` once at boot into a default list; each new room starts from a copy so edits are per-room.
4. `game.gateway.ts`: the events above, resolving the user via `RoomsGateway.getUser`, rejecting wrong-phase and non-host calls, and broadcasting to `roomId`.
5. `game.module.ts` wires the two `RoomsService` seams on init: `onUserRemovedFromRoom` (drop a leaving player) and `setJoinGuard` (close the room once the game starts — Phase 6).
6. Delete `Controller.ts` (`GET /public/startGuessing`), `ClientManager.ts` and `WebsocketGateway.ts` — all three are superseded.

`isOpen` is simply `phase === 'prepare'`, so `game:restart` dropping the room back to `prepare` reopens it to new players — which is the sensible reading of "play again", but call it out in review in case a rematch should stay locked to the original line-up.

**Done when** a scripted socket.io client can play a full game with no UI.

### Phase 3 — Game client (data layer)

1. `GameService` (mobx, modelled on `RoomService`): holds `phase`, `questions`, `myAnswers`, `options`, `guess`, `bestVote`, `reveal`, `scoreboard`, `players`; subscribes on `setSocket`, emits `game:request-state` after mounting.
2. `GameContext` provider, mounted inside the `/room` route where `VoiceProvider` used to be.
3. Delete `hooks/useWebSocket.ts` and `hooks/useGameState.ts` — `GameService` replaces both.

### Phase 4 — Screens

Port the existing quiz screens onto `GameService`, keeping their CSS modules and the shark theme:

- **Prepare** (new) — player list, editable question list (add / edit / remove / reorder, seeded from `questions.txt`), host-only **Start**.
- **Answering** — `QuizScreen.tsx`, wired to `game:submit-answers`; submit disabled until every question is filled.
- **Guessing** — `GuessingScreen.tsx` phase `guessing`, plus the new best-answer control.
- **Reveal** — `GuessingScreen.tsx` phase `result`, now also showing the best-answer tally and who got the bonus.
- **Scoreboard** — `ScoreboardScreen.tsx`, names resolved from `game:players` instead of the old token list; host-only **Play again**.
- **PlayerStatus** — `PlayerVotes.tsx` renamed, driven by `game:players.ready` (it already renders "n / m ready" and a per-player tooltip).

`Layout.tsx` is folded into the template's page chrome so the room header (name, leave, rename) stays available during the game.

### Phase 5 — Best-answer vote (the improvement)

On the guessing screen each player also picks the single best answer. Rules:

- One vote per question, cast together with the guess in `game:submit-guess`.
- **You cannot vote for your own answer.** The options are anonymised, so this is enforced **server-side** by comparing `order[bestVote]` against the voter's `userId` and rejecting the submit; the UI additionally greys out the player's own answer, which it can do because the client knows its own answer text for the current question.
- After the round, the author(s) with the most votes get **+1**. Ties: everyone tied gets the point. Zero votes cast (e.g. two-player room): no bonus.
- `game:reveal` carries the per-answer vote counts so the reveal screen can show them.

### Phase 6 — Robustness

The port is the moment to fix what the single-room prototype gets away with:

- **Disconnects deadlock the round.** `Game.vote` waits for `votePendingCount === 0` over every player ever seen, so one closed tab freezes the game forever. Gate all "everyone is ready" checks on connected players only (`isDisconnected === false`), and re-evaluate the gate whenever someone drops or leaves.
- **Closed rooms.** A player joining mid-`answering` has no answers and can never become ready, so once the game starts the room accepts nobody new. Implement it as a **join guard** registered by `GameModule` into `RoomsService` — the mirror image of the existing `onUserRemovedFromRoom` seam, so the rooms module stays game-agnostic and no circular dependency appears:

  ```ts
  // rooms.service.ts
  setJoinGuard(guard: (roomId: string, userId: string) => string | null): void
  // game.module.ts (on init)
  roomsService.setJoinGuard((roomId, userId) =>
      gameService.isSeated(roomId, userId) ? null : gameService.isOpen(roomId) ? null : 'Game already in progress',
  );
  ```

  Two things the guard must get right:
  - It runs **before** the "already seated" branch is allowed to matter, but must not break it — `joinRoom` returns success early for a user who still holds a seat (`rooms.service.ts:72`), and that path is how a refresh or a dropped socket gets its player back. Block **new** seats only, never re-seating.
  - `listRooms()` gains an `isOpen`/`phase` field so `RoomsPage` can disable the Join button and show the room as in progress, instead of letting the click fail on the ack.
- **Missing answers.** `getState` builds options as `data[token].answers[questionId]`, which is `undefined` for a player who skipped a question. Require every question to be answered before `submitted` flips true, and still guard the projector.
- **`result → guessing` handshake.** Advancing currently relies on clients re-sending `vote: null` and on `playerCount === votePendingCount`. Replace with the explicit `game:next` / `readyForNext` set.
- **Reconnect.** `game:request-state` must fully rehydrate mid-game, mirroring `rooms:request-state`.
- **Answer leak.** As noted above, never send the author ordering during `guessing`.

### Phase 7 — Cleanup

Delete `Room-voice-stratup/`, refresh the Makefile (`QUIZ_OUT`, `make bash` into `server/`), and write a short `CLAUDE.md` describing the layout, the shared-types symlink and the dev ports.

## Confirmed decisions

1. **Question editing** — host only, in `prepare`.
2. **Room join during a game** — the room is **closed** the moment the game starts. Nobody new gets in, not even as a spectator. Only players already seated can come back (see *Closed rooms* in Phase 6).
3. **Best answer** — voted per question during `guessing`, together with the guess. Not implemented anywhere yet; it is new work in Phase 5.
4. **Persistence** — in memory only, owned by the room. Game state is created with the room and dies with it; a server restart wipes rooms, sessions and scores.
