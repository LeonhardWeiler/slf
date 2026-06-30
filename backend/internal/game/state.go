package game

type GameState string

const (
	StateLobby      GameState = "lobby"
	StateCountdown  GameState = "countdown"
	StatePlaying    GameState = "playing"
	StateWaiting    GameState = "waiting"
	StateReview     GameState = "review"
	StateScoreboard GameState = "scoreboard"
	StateFinished   GameState = "finished"
)
