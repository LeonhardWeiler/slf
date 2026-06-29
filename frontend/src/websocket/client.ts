class WSClient {
  private ws: WebSocket;

  connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket("ws://localhost:8080/ws");

      this.ws.onopen = () => resolve();
    });
  }

  send(event: string, data: any) {
    if (this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({ event, data }));
  }
}

export const wsClient = new WSClient();
