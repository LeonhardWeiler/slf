package game

type GameState string

const (
	StateLobby       GameState = "Lobby"
	StateCountdown   GameState = "Countdown"
	StatePlaying     GameState = "Playing"
	StateReviewing   GameState = "Reviewing"
	StateRoundResult GameState = "RoundResult"
	StateGameOver    GameState = "GameOver"
)
