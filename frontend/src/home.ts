import { wsClient } from "./websocket/client";

wsClient.connect();

wsClient.send("create_lobby", {
  name: "Leo"
});
