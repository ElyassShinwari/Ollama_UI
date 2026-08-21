import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as useRouter, f as createRouter, g as createRootRoute, h as createFileRoute, l as Scripts, m as lazyRouteComponent, p as Outlet, u as HeadContent } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-C1pKVFmd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-BsNccL3F.css";
var APP_NAME = "Hearth";
var Route$3 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#0c0c0d"
			},
			{
				name: "description",
				content: "ChatGPT-style studio for every Ollama model on your machine."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Instrument+Serif:ital@0;1&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "dark antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-background text-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter = () => import("./routes-BxoU4-Ni.mjs");
var Route$2 = createFileRoute("/")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatBytes(bytes) {
	if (bytes == null || Number.isNaN(bytes)) return null;
	if (bytes < 1024 ** 3) return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
	return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
function greetingForNow(date = /* @__PURE__ */ new Date()) {
	const h = date.getHours();
	if (h < 5) return "Working late";
	if (h < 12) return "Good morning";
	if (h < 18) return "Good afternoon";
	return "Good evening";
}
function sanitizeOllamaHost(raw) {
	const trimmed = raw.trim().replace(/\/+$/, "");
	const url = new URL(trimmed);
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Host must be http or https");
	return url.origin;
}
function isChatXaiModel(id) {
	const lower = id.toLowerCase();
	if (!lower.startsWith("grok")) return false;
	if (lower.includes("imagine") || lower.includes("image") || lower.includes("tts") || lower.includes("video") || lower.includes("embedding") || lower.includes("whisper") || lower.includes("build") || lower.includes("multi-agent")) return false;
	if (/\d{4}/.test(lower)) return false;
	return true;
}
function displayXaiName(id) {
	if (id === "grok-4.5") return "Grok 4.5";
	return id.replace(/^grok-/, "Grok ").replace(/-/g, " ").replace(/\bmini\b/i, "Mini");
}
async function listOllamaModels(hostRaw) {
	const host = sanitizeOllamaHost(hostRaw);
	const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(400) });
	if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
	return ((await res.json()).models ?? []).map((m) => ({
		id: m.name,
		name: m.name,
		provider: "ollama",
		transport: "server",
		size: m.size,
		family: m.details?.family,
		parameterSize: m.details?.parameter_size
	}));
}
async function listXaiModels() {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return [];
	try {
		const res = await fetch("https://api.x.ai/v1/models", {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(6e3)
		});
		if (!res.ok) return [{
			id: "grok-4.5",
			name: "Grok 4.5",
			provider: "xai",
			transport: "server"
		}];
		const models = ((await res.json()).data ?? []).map((m) => m.id).filter(isChatXaiModel).map((id) => ({
			id,
			name: displayXaiName(id),
			provider: "xai",
			transport: "server"
		}));
		if (models.length === 0) return [{
			id: "grok-4.5",
			name: "Grok 4.5",
			provider: "xai",
			transport: "server"
		}];
		const preferred = [
			"grok-4.5",
			"grok-4",
			"grok-3"
		];
		models.sort((a, b) => {
			const ai = preferred.indexOf(a.id);
			const bi = preferred.indexOf(b.id);
			if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
			if (ai === -1) return 1;
			if (bi === -1) return -1;
			return ai - bi;
		});
		return models;
	} catch {
		return [{
			id: "grok-4.5",
			name: "Grok 4.5",
			provider: "xai",
			transport: "server"
		}];
	}
}
async function* streamOllamaChat(opts) {
	const host = sanitizeOllamaHost(opts.host);
	const res = await fetch(`${host}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: opts.model,
			messages: opts.messages,
			stream: true,
			options: { temperature: opts.temperature }
		}),
		signal: opts.signal
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `Ollama error ${res.status}`);
	}
	if (!res.body) throw new Error("Ollama returned an empty stream");
	yield* readNdjson(res.body, (json) => {
		return json.message?.content ?? "";
	});
}
async function* streamXaiChat(opts) {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) throw new Error("Cloud models are not available in this environment");
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: opts.model,
			messages: opts.messages,
			temperature: opts.temperature,
			stream: true,
			max_tokens: 4096
		}),
		signal: opts.signal
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `xAI error ${res.status}`);
	}
	if (!res.body) throw new Error("xAI returned an empty stream");
	yield* readSse(res.body, (data) => {
		if (data === "[DONE]") return null;
		try {
			return JSON.parse(data).choices?.[0]?.delta?.content ?? "";
		} catch {
			return "";
		}
	});
}
async function* readNdjson(body, pick) {
	const reader = body.getReader();
	const dec = new TextDecoder();
	let buf = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buf += dec.decode(value, { stream: true });
		const lines = buf.split("\n");
		buf = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				const piece = pick(JSON.parse(line));
				if (piece) yield piece;
			} catch {}
		}
	}
}
async function* readSse(body, pick) {
	const reader = body.getReader();
	const dec = new TextDecoder();
	let buf = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buf += dec.decode(value, { stream: true });
		const lines = buf.split("\n");
		buf = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const piece = pick(trimmed.slice(5).trim());
			if (piece === null) return;
			if (piece) yield piece;
		}
	}
}
var Route$1 = createFileRoute("/api/chat")({ server: { handlers: { POST: async ({ request }) => {
	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const provider = body.provider === "xai" ? "xai" : "ollama";
	const model = typeof body.model === "string" ? body.model : "";
	const messages = Array.isArray(body.messages) ? body.messages : [];
	const temperature = typeof body.temperature === "number" && Number.isFinite(body.temperature) ? Math.min(2, Math.max(0, body.temperature)) : .7;
	const host = typeof body.host === "string" ? body.host : "http://127.0.0.1:11434";
	if (!model) return Response.json({ error: "Model is required" }, { status: 400 });
	if (messages.length === 0) return Response.json({ error: "Messages are required" }, { status: 400 });
	const encoder = new TextEncoder();
	const stream = new ReadableStream({ async start(controller) {
		const send = (payload) => {
			controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
		};
		try {
			const iterator = provider === "xai" ? streamXaiChat({
				model,
				messages,
				temperature,
				signal: request.signal
			}) : streamOllamaChat({
				host,
				model,
				messages,
				temperature,
				signal: request.signal
			});
			for await (const content of iterator) send({ content });
			send({ done: true });
		} catch (err) {
			if (err.name === "AbortError") send({ done: true });
			else send({ error: err instanceof Error ? err.message : "The model failed to reply" });
		} finally {
			controller.close();
		}
	} });
	return new Response(stream, { headers: {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive"
	} });
} } } });
var Route = createFileRoute("/api/models")({ server: { handlers: { GET: async ({ request }) => {
	const host = new URL(request.url).searchParams.get("host") || "http://127.0.0.1:11434";
	const [ollama, xai] = await Promise.all([listOllamaModels(host).then((models) => ({
		ok: true,
		models
	})).catch((err) => ({
		ok: false,
		models: [],
		error: err instanceof Error ? err.message : "Ollama unreachable"
	})), listXaiModels()]);
	return Response.json({
		models: [...ollama.models, ...xai],
		ollama: ollama.ok,
		xai: xai.length > 0,
		error: ollama.ok ? void 0 : ollama.error
	});
} } } });
var rootRouteChildren = {
	IndexRoute: Route$2.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$3
	}),
	ApiChatRoute: Route$1.update({
		id: "/api/chat",
		path: "/api/chat",
		getParentRoute: () => Route$3
	}),
	ApiModelsRoute: Route.update({
		id: "/api/models",
		path: "/api/models",
		getParentRoute: () => Route$3
	})
};
var routeTree = Route$3._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { greetingForNow as i, cn as n, formatBytes as r, router_exports as t };
