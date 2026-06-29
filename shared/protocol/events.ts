export const Events = {
  CREATE_LOBBY: "create_lobby",
  JOIN_LOBBY: "join_lobby",
  LEAVE_LOBBY: "leave_lobby",

  LOBBY_STATE: "lobby_state",

  START_GAME: "start_game",

  START_ROUND: "start_round",

  SUBMIT_ANSWERS: "submit_answers",

  BUZZ: "buzz",

  REVIEW: "review",

  ROUND_END: "round_end",

  GAME_END: "game_end",

  ERROR: "error",
} as const;
