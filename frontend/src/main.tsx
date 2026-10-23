import "./lib/zodConfig"; // must run before any Zod schema is parsed
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ws } from "@/lib/ws";

void ws.connect();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
