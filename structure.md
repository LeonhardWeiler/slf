Projektstruktur

slf/

│

├── README.md

├── flake.nix

├── flake.lock

├── docker-compose.yml

├── .gitignore

├── .editorconfig

├── .env.example

│

├── .gitlab/

│   └── ci/

│       ├── build.yml

│       ├── docker.yml

│       └── deploy.yml

│

├── .gitlab-ci.yml

│

├── backend/

│   ├── go.mod

│   ├── go.sum

│   ├── air.toml

│   │

│   ├── cmd/

│   │   └── server/

│   │       └── main.go

│   │

│   ├── internal/

│   │   ├── config/

│   │   ├── game/

│   │   │   ├── room.go

│   │   │   ├── player.go

│   │   │   ├── round.go

│   │   │   ├── category.go

│   │   │   ├── scoring.go

│   │   │   └── alphabet.go

│   │   │

│   │   ├── websocket/

│   │   │   ├── hub.go

│   │   │   ├── client.go

│   │   │   ├── messages.go

│   │   │   ├── handlers.go

│   │   │   └── validation.go

│   │   │

│   │   ├── service/

│   │   ├── util/

│   │   └── qr/

│   │

│   └── Dockerfile

│

├── frontend/

│   ├── package.json

│   ├── bun.lock

│   ├── vite.config.ts

│   ├── tsconfig.json

│   ├── tailwind.config.ts

│   ├── components.json

│   │

│   ├── public/

│   │

│   └── src/

│       ├── main.tsx

│       ├── App.tsx

│       │

│       ├── assets/

│       │

│       ├── pages/

│       │   ├── Home.tsx

│       │   ├── Lobby.tsx

│       │   ├── Game.tsx

│       │   ├── Review.tsx

│       │   ├── Scoreboard.tsx

│       │   └── Endscreen.tsx

│       │

│       ├── components/

│       │   ├── layout/

│       │   ├── game/

│       │   ├── lobby/

│       │   ├── review/

│       │   ├── scoreboard/

│       │   └── ui/

│       │

│       ├── hooks/

│       ├── lib/

│       ├── store/

│       ├── websocket/

│       ├── types/

│       ├── utils/

│       └── styles/

│

├── shared/

│   ├── protocol/

│   │   ├── events.ts

│   │   ├── schemas.ts

│   │   └── types.ts

│   │

│   └── constants/

│       ├── alphabet.ts

│       └── defaults.ts

│

├── scripts/

│   ├── dev.sh

│   ├── lint.sh

│   └── docker-build.sh

│

└── docs/

    ├── architecture.md

    ├── websocket-protocol.md

    ├── game-state.md

    ├── scoring.md

    └── ui-flow.md
