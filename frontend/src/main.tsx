import "./lib/zodConfig"; // must run before any Zod schema is parsed
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ThemeProvider } from "@/lib/theme";
import { ws } from "@/lib/ws";

void ws.connect();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</StrictMode>,
);
