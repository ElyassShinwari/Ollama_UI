import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as Slot, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { C as ArrowUp, S as Check, _ as Cpu, a as Settings, b as ChevronRight, c as RefreshCw, d as PinOff, f as Pencil, g as Ellipsis, h as Menu, i as Square, l as Plus, m as Monitor, o as Search, p as PanelLeft, r as Trash2, s as RotateCcw, t as X, u as Pin, v as Copy, x as ChevronDown, y as Cloud } from "../_libs/lucide-react.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { i as greetingForNow, n as cn, r as formatBytes } from "./router-C1pKVFmd.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { a as DialogOverlay$1, i as DialogDescription$1, n as DialogClose, o as DialogPortal$1, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { a as Label2, c as Separator2, d as Trigger, i as ItemIndicator2, l as SubContent2, n as Content2, o as Portal2, r as Item2, s as Root2, t as CheckboxItem2, u as SubTrigger2 } from "../_libs/@radix-ui/react-dropdown-menu+[...].mjs";
import { n as Portal, r as Provider, t as Content2$1 } from "../_libs/@radix-ui/react-tooltip+[...].mjs";
import { t as Markdown } from "../_libs/react-markdown+[...].mjs";
import { t as remarkGfm } from "../_libs/remark-gfm.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { t as Root } from "../_libs/radix-ui__react-label.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BxoU4-Ni.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TooltipProvider = Provider;
var TooltipContent = import_react.forwardRef(({ className, sideOffset = 6, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2$1, {
	ref,
	sideOffset,
	className: cn("z-50 overflow-hidden rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-border", "origin-[var(--radix-tooltip-content-transform-origin)] data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props
}) }));
TooltipContent.displayName = Content2$1.displayName;
var Sheet = Dialog$1;
var SheetPortal = DialogPortal$1;
var SheetOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
	ref,
	className: cn("fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props
}));
SheetOverlay.displayName = DialogOverlay$1.displayName;
var SheetContent = import_react.forwardRef(({ className, children, side = "left", ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
	ref,
	className: cn("fixed z-50 flex h-full flex-col bg-sidebar text-foreground shadow-border transition ease-[var(--ease-smooth-out)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-400", side === "left" && "inset-y-0 left-0 w-[min(100%,20rem)] border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left", side === "right" && "inset-y-0 right-0 w-[min(100%,20rem)] border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
		className: "absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "Close"
		})]
	})]
})] }));
SheetContent.displayName = "SheetContent";
var SheetTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
	ref,
	className: cn("text-base font-medium", className),
	...props
}));
SheetTitle.displayName = DialogTitle$1.displayName;
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[opacity,transform,background-color,color,box-shadow] duration-150 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:not-disabled:scale-[0.96]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:opacity-90",
			secondary: "bg-secondary text-secondary-foreground hover:bg-raised",
			ghost: "text-foreground hover:bg-accent",
			outline: "border border-border bg-transparent hover:bg-accent",
			destructive: "bg-destructive text-foreground hover:opacity-90"
		},
		size: {
			default: "h-10 px-4",
			sm: "h-8 px-3 text-xs",
			lg: "h-12 px-5",
			icon: "size-10",
			"icon-sm": "size-8"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
function Composer({ value, onChange, onSend, onStop, disabled, streaming, placeholder }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
	}, [value]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto w-full max-w-3xl px-3 pb-4 md:px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("rounded-3xl bg-composer p-2 pl-4 shadow-composer", "focus-within:ring-1 focus-within:ring-ring/30"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				ref,
				rows: 1,
				value,
				disabled: disabled && !streaming,
				placeholder: placeholder ?? "Message Hearth",
				className: "max-h-52 min-h-12 w-full resize-none bg-transparent py-3 text-base leading-6 text-foreground outline-none placeholder:text-subtle",
				onChange: (e) => onChange(e.target.value),
				onKeyDown: (e) => {
					if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
						e.preventDefault();
						if (streaming) return;
						onSend();
					}
				}
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center justify-end pb-1",
				children: streaming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "icon-sm",
					className: "rounded-full",
					onClick: onStop,
					"aria-label": "Stop generating",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-3.5 fill-current" })
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "icon-sm",
					className: "rounded-full",
					onClick: onSend,
					disabled: disabled || !value.trim(),
					"aria-label": "Send message",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-4" })
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-center text-xs text-muted-foreground",
			children: "Replies come from the model you selected. Check anything important."
		})]
	});
}
function CopyButton({ text }) {
	const [copied, setCopied] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
		onClick: async () => {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		},
		"aria-label": copied ? "Copied" : "Copy code",
		children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" })
	});
}
function CodeBlock({ className, children }) {
	const text = String(children).replace(/\n$/, "");
	const lang = /language-(\w+)/.exec(className ?? "")?.[1];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "my-3 overflow-hidden rounded-xl border border-border bg-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-border px-3 py-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[11px] tracking-wide text-muted-foreground uppercase",
				children: lang ?? "code"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyButton, { text })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: text })
		})]
	});
}
function MessageMarkdown({ content }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "prose-hearth",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
			remarkPlugins: [remarkGfm],
			components: {
				a: ({ href, children }) => {
					if (!(href && (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")))) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children });
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href,
						target: "_blank",
						rel: "noreferrer noopener",
						children
					});
				},
				img: () => null,
				pre: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children }),
				code: ({ className, children, ...props }) => {
					if (Boolean(className) || String(children).includes("\n")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlock, {
						className,
						children
					});
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: cn(className),
						...props,
						children
					});
				}
			},
			children: content
		})
	});
}
function MessageBubble({ message, streaming, showRegen, onRegenerate }) {
	const isUser = message.role === "user";
	const [copied, setCopied] = (0, import_react.useState)(false);
	if (isUser) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-end",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "max-w-[min(100%,42rem)] rounded-3xl bg-secondary px-5 py-3 text-[15px] leading-7 whitespace-pre-wrap",
			children: message.content
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "group flex flex-col gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 24 24",
					className: "size-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "M12 4.5c2.7 3.4 4.8 5.6 4.8 8.4A4.8 4.8 0 1 1 7.2 12.9c0-2.8 2.1-5 4.8-8.4z"
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 pt-0.5 text-[15px] leading-7",
				children: [message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageMarkdown, { content: message.content }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-2 text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 animate-pulse rounded-full bg-foreground" }), "Thinking"]
				}), streaming && message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-foreground align-middle" }) : null]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("ml-10 flex items-center gap-0.5", streaming ? "opacity-0" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "icon-sm",
				variant: "ghost",
				"aria-label": "Copy",
				onClick: async () => {
					await navigator.clipboard.writeText(message.content);
					setCopied(true);
					window.setTimeout(() => setCopied(false), 1400);
				},
				children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" })
			}), showRegen && onRegenerate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "icon-sm",
				variant: "ghost",
				"aria-label": "Regenerate",
				onClick: onRegenerate,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
			}) : null]
		})]
	});
}
var DropdownMenu = Root2;
var DropdownMenuTrigger = Trigger;
var DropdownMenuSubTrigger = import_react.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SubTrigger2, {
	ref,
	className: cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none select-none focus:bg-accent data-[state=open]:bg-accent", inset && "pl-8", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "ml-auto size-4" })]
}));
DropdownMenuSubTrigger.displayName = SubTrigger2.displayName;
var DropdownMenuSubContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubContent2, {
	ref,
	className: cn("z-50 min-w-36 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-border", className),
	...props
}));
DropdownMenuSubContent.displayName = SubContent2.displayName;
var DropdownMenuContent = import_react.forwardRef(({ className, sideOffset = 6, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal2, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	sideOffset,
	className: cn("z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-border", "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
	...props
}) }));
DropdownMenuContent.displayName = Content2.displayName;
var DropdownMenuItem = import_react.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Item2, {
	ref,
	className: cn("relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none select-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40", inset && "pl-8", className),
	...props
}));
DropdownMenuItem.displayName = Item2.displayName;
var DropdownMenuCheckboxItem = import_react.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CheckboxItem2, {
	ref,
	className: cn("relative flex cursor-pointer items-center rounded-md py-2 pr-2 pl-8 text-sm outline-none select-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40", className),
	checked,
	...props,
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute left-2 flex size-4 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemIndicator2, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) })
	}), children]
}));
DropdownMenuCheckboxItem.displayName = CheckboxItem2.displayName;
var DropdownMenuLabel = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label2, {
	ref,
	className: cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className),
	...props
}));
DropdownMenuLabel.displayName = Label2.displayName;
var DropdownMenuSeparator = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator2, {
	ref,
	className: cn("-mx-1 my-1 h-px bg-border", className),
	...props
}));
DropdownMenuSeparator.displayName = Separator2.displayName;
function ModelPicker({ models, value, onChange, align = "start", className }) {
	const ollama = models.filter((m) => m.provider === "ollama");
	const xai = models.filter((m) => m.provider === "xai");
	const label = value?.name ?? "Choose a model";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			className: cn("h-9 max-w-[min(100%,20rem)] gap-1.5 px-2.5 font-medium", className),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "truncate",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted-foreground" })]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuContent, {
		align,
		className: "w-80",
		children: models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "px-3 py-6 text-center text-sm text-muted-foreground",
			children: "No models found yet."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			ollama.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "On this machine" }), ollama.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelItem, {
				model,
				selected: value?.id === model.id && value.provider === model.provider,
				onSelect: () => onChange(model)
			}, `${model.provider}:${model.id}:${model.transport}`))] }),
			ollama.length > 0 && xai.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuSeparator, {}),
			xai.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuLabel, { children: "Cloud" }), xai.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelItem, {
				model,
				selected: value?.id === model.id && value.provider === model.provider,
				onSelect: () => onChange(model)
			}, `${model.provider}:${model.id}`))] })
		] })
	})] });
}
function ModelItem({ model, selected, onSelect }) {
	const meta = [
		model.parameterSize,
		formatBytes(model.size),
		model.family,
		model.provider === "xai" ? "Cloud" : model.transport === "browser" ? "This computer" : "Ollama"
	].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
		onSelect,
		className: "items-start py-2.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 text-muted-foreground",
				children: model.provider === "xai" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cloud, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "size-4" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate font-medium",
					children: model.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate text-xs text-muted-foreground",
					children: meta
				})]
			}),
			selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mt-0.5 size-4" })
		]
	});
}
var defaultSettings = {
	ollamaHost: "http://127.0.0.1:11434",
	temperature: .7,
	systemPrompt: ""
};
function uid() {
	return crypto.randomUUID();
}
function titleFrom(content) {
	const t = content.replace(/\s+/g, " ").trim();
	if (!t) return "New chat";
	return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}
var useChatStore = create()(persist((set, get) => ({
	conversations: [],
	activeId: null,
	selectedModel: null,
	settings: defaultSettings,
	sidebarCollapsed: false,
	search: "",
	setSearch: (search) => set({ search }),
	setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
	setSettings: (patch) => set((s) => ({ settings: {
		...s.settings,
		...patch
	} })),
	setSelectedModel: (model) => set((s) => ({
		selectedModel: model,
		conversations: s.conversations.map((c) => c.id === s.activeId ? {
			...c,
			model
		} : c)
	})),
	newChat: () => {
		const model = get().selectedModel;
		const now = Date.now();
		const conversation = {
			id: uid(),
			title: "New chat",
			model: model ?? {
				id: "pending",
				name: "Choose a model",
				provider: "ollama",
				transport: "server"
			},
			messages: [],
			createdAt: now,
			updatedAt: now
		};
		set((s) => ({
			conversations: [conversation, ...s.conversations],
			activeId: conversation.id
		}));
		return conversation.id;
	},
	setActive: (activeId) => {
		set({
			activeId,
			selectedModel: get().conversations.find((c) => c.id === activeId)?.model ?? get().selectedModel
		});
	},
	deleteConversation: (id) => set((s) => {
		const conversations = s.conversations.filter((c) => c.id !== id);
		return {
			conversations,
			activeId: s.activeId === id ? conversations[0]?.id ?? null : s.activeId
		};
	}),
	renameConversation: (id, title) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? {
		...c,
		title,
		updatedAt: Date.now()
	} : c) })),
	togglePin: (id) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? {
		...c,
		pinned: !c.pinned,
		updatedAt: Date.now()
	} : c) })),
	addUserMessage: (content) => {
		const now = Date.now();
		const user = {
			id: uid(),
			role: "user",
			content,
			createdAt: now
		};
		let conversationId = get().activeId;
		const existing = get().conversations.find((c) => c.id === conversationId);
		if (!conversationId || !existing) conversationId = get().newChat();
		set((s) => ({
			conversations: s.conversations.map((c) => {
				if (c.id !== conversationId) return c;
				const titled = c.messages.length === 0 && c.title === "New chat" ? titleFrom(content) : c.title;
				return {
					...c,
					title: titled,
					messages: [...c.messages, user],
					updatedAt: now,
					model: s.selectedModel ?? c.model
				};
			}),
			activeId: conversationId
		}));
		return {
			conversationId,
			user
		};
	},
	startAssistantMessage: (conversationId, model) => {
		const id = uid();
		const now = Date.now();
		const message = {
			id,
			role: "assistant",
			content: "",
			modelId: model.id,
			createdAt: now
		};
		set((s) => ({ conversations: s.conversations.map((c) => c.id === conversationId ? {
			...c,
			messages: [...c.messages, message],
			updatedAt: now
		} : c) }));
		return id;
	},
	appendToMessage: (conversationId, messageId, chunk) => set((s) => ({ conversations: s.conversations.map((c) => c.id === conversationId ? {
		...c,
		updatedAt: Date.now(),
		messages: c.messages.map((m) => m.id === messageId ? {
			...m,
			content: m.content + chunk
		} : m)
	} : c) })),
	finishMessage: (conversationId, messageId) => set((s) => ({ conversations: s.conversations.map((c) => c.id === conversationId ? {
		...c,
		updatedAt: Date.now(),
		messages: c.messages.map((m) => m.id === messageId ? { ...m } : m)
	} : c) })),
	removeMessage: (conversationId, messageId) => set((s) => ({ conversations: s.conversations.map((c) => c.id === conversationId ? {
		...c,
		messages: c.messages.filter((m) => m.id !== messageId),
		updatedAt: Date.now()
	} : c) })),
	replaceMessageContent: (conversationId, messageId, content) => set((s) => ({ conversations: s.conversations.map((c) => c.id === conversationId ? {
		...c,
		messages: c.messages.map((m) => m.id === messageId ? {
			...m,
			content
		} : m),
		updatedAt: Date.now()
	} : c) }))
}), {
	name: "hearth-chat",
	partialize: (s) => ({
		conversations: s.conversations,
		activeId: s.activeId,
		selectedModel: s.selectedModel,
		settings: s.settings,
		sidebarCollapsed: s.sidebarCollapsed
	})
}));
function selectActiveConversation(state) {
	return state.conversations.find((c) => c.id === state.activeId) ?? null;
}
async function probeBrowserOllama(host) {
	try {
		const res = await fetch(`${host.replace(/\/+$/, "")}/api/tags`, { signal: AbortSignal.timeout(2500) });
		if (!res.ok) return [];
		return ((await res.json()).models ?? []).map((m) => ({
			id: m.name,
			name: m.name,
			provider: "ollama",
			transport: "browser",
			size: m.size,
			family: m.details?.family,
			parameterSize: m.details?.parameter_size
		}));
	} catch {
		return [];
	}
}
function mergeModels(browser, server) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const model of [...browser, ...server]) {
		const key = `${model.provider}:${model.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(model);
	}
	return out;
}
async function fetchCatalog(host, browserModels = []) {
	const serverRes = await fetch(`/api/models?host=${encodeURIComponent(host)}`).then(async (r) => {
		if (!r.ok) return {
			models: [],
			ollama: false,
			xai: false,
			error: `Catalog ${r.status}`
		};
		return await r.json();
	}).catch(() => ({
		models: [],
		ollama: false,
		xai: false,
		error: "Could not reach the model catalog"
	}));
	return {
		models: mergeModels(browserModels, serverRes.models ?? []),
		status: {
			loading: false,
			ollamaBrowser: browserModels.length > 0,
			ollamaServer: Boolean(serverRes.ollama),
			xai: Boolean(serverRes.xai),
			error: serverRes.error
		}
	};
}
function withSystem(messages, systemPrompt) {
	if (!systemPrompt?.trim()) return messages;
	return [{
		role: "system",
		content: systemPrompt.trim()
	}, ...messages];
}
async function streamChat(body, onDelta, signal) {
	const messages = withSystem(body.messages, body.systemPrompt).slice(-41);
	if (body.provider === "ollama" && body.transport === "browser") {
		await streamOllamaBrowser({
			host: body.host,
			model: body.model,
			messages,
			temperature: body.temperature
		}, onDelta, signal);
		return;
	}
	const res = await fetch("/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			provider: body.provider,
			host: body.host,
			model: body.model,
			messages,
			temperature: body.temperature
		}),
		signal
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `Chat failed (${res.status})`);
	}
	await readSseStream(res, onDelta);
}
async function streamOllamaBrowser(opts, onDelta, signal) {
	const host = opts.host.replace(/\/+$/, "");
	const res = await fetch(`${host}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: opts.model,
			messages: opts.messages,
			stream: true,
			options: { temperature: opts.temperature }
		}),
		signal
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `Ollama error ${res.status}`);
	}
	if (!res.body) throw new Error("Ollama returned an empty stream");
	const reader = res.body.getReader();
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
				const json = JSON.parse(line);
				if (json.error) throw new Error(json.error);
				if (json.message?.content) onDelta(json.message.content);
			} catch (err) {
				if (err instanceof SyntaxError) continue;
				throw err;
			}
		}
	}
}
async function readSseStream(res, onDelta) {
	if (!res.body) throw new Error("Empty response");
	const reader = res.body.getReader();
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
			const data = trimmed.slice(5).trim();
			if (!data) continue;
			try {
				const json = JSON.parse(data);
				if (json.error) throw new Error(json.error);
				if (json.content) onDelta(json.content);
			} catch (err) {
				if (err instanceof SyntaxError) continue;
				throw err;
			}
		}
	}
}
var SUGGESTIONS = [
	"Explain a hard idea in plain language",
	"Draft a short, direct email",
	"Find holes in this plan",
	"Write a small function and walk through it"
];
function ChatView({ models, onOpenSidebar, onToggleSidebar }) {
	const conversation = useChatStore(selectActiveConversation);
	const selectedModel = useChatStore((s) => s.selectedModel);
	const settings = useChatStore((s) => s.settings);
	const setSelectedModel = useChatStore((s) => s.setSelectedModel);
	const addUserMessage = useChatStore((s) => s.addUserMessage);
	const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
	const appendToMessage = useChatStore((s) => s.appendToMessage);
	const removeMessage = useChatStore((s) => s.removeMessage);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [streamingId, setStreamingId] = (0, import_react.useState)(null);
	const abortRef = (0, import_react.useRef)(null);
	const scrollerRef = (0, import_react.useRef)(null);
	const bottomRef = (0, import_react.useRef)(null);
	const messages = conversation?.messages ?? [];
	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
	(0, import_react.useEffect)(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [messages, streamingId]);
	const greeting = (0, import_react.useMemo)(() => greetingForNow(), []);
	async function runCompletion(conversationId, history) {
		const model = useChatStore.getState().selectedModel;
		if (!model) {
			toast.error("Choose a model first");
			return;
		}
		const assistantId = startAssistantMessage(conversationId, model);
		setStreamingId(assistantId);
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			await streamChat({
				provider: model.provider,
				transport: model.transport,
				host: settings.ollamaHost,
				model: model.id,
				messages: history,
				temperature: settings.temperature,
				systemPrompt: settings.systemPrompt
			}, (chunk) => appendToMessage(conversationId, assistantId, chunk), controller.signal);
		} catch (err) {
			if (err.name === "AbortError") return;
			const message = err instanceof Error ? err.message : "The model failed to reply";
			if (!(useChatStore.getState().conversations.find((c) => c.id === conversationId)?.messages.find((m) => m.id === assistantId))?.content) appendToMessage(conversationId, assistantId, `I couldn't complete that reply. ${message}`);
			else toast.error(message);
		} finally {
			setStreamingId(null);
			abortRef.current = null;
		}
	}
	async function send(text) {
		const trimmed = text.trim();
		if (!trimmed || streamingId) return;
		setDraft("");
		const { conversationId, user } = addUserMessage(trimmed);
		await runCompletion(conversationId, [...(useChatStore.getState().conversations.find((c) => c.id === conversationId)?.messages ?? []).filter((m) => m.id !== user.id && (m.role === "user" || m.role === "assistant")).map((m) => ({
			role: m.role,
			content: m.content
		})), {
			role: "user",
			content: trimmed
		}]);
	}
	function stop() {
		abortRef.current?.abort();
	}
	async function regenerate() {
		if (!conversation || streamingId) return;
		const lastUser = [...conversation.messages].reverse().find((m) => m.role === "user");
		const lastAsst = [...conversation.messages].reverse().find((m) => m.role === "assistant");
		if (!lastUser || !lastAsst) return;
		removeMessage(conversation.id, lastAsst.id);
		const history = conversation.messages.filter((m) => m.id !== lastAsst.id).filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
			role: m.role,
			content: m.content
		}));
		await runCompletion(conversation.id, history);
	}
	const empty = messages.length === 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-w-0 flex-1 flex-col bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex h-14 shrink-0 items-center gap-1 px-2 md:px-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "icon",
						variant: "ghost",
						className: "md:hidden",
						onClick: onOpenSidebar,
						"aria-label": "Open sidebar",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "icon",
						variant: "ghost",
						className: "hidden md:inline-flex",
						onClick: onToggleSidebar,
						"aria-label": "Toggle sidebar",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeft, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelPicker, {
						models,
						value: selectedModel,
						onChange: setSelectedModel
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: scrollerRef,
				className: "scrollbar-thin min-h-0 flex-1 overflow-y-auto",
				children: empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-serif text-4xl tracking-tight md:text-5xl",
							children: greeting
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 max-w-md text-muted-foreground",
							children: selectedModel ? `Talking with ${selectedModel.name}. Switch models anytime from the menu above.` : "Choose a model to begin."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-8 grid gap-2 sm:grid-cols-2",
							children: SUGGESTIONS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "rounded-xl border border-border bg-card px-4 py-3 text-left text-sm leading-6 transition-colors hover:bg-accent",
								onClick: () => send(s),
								children: s
							}, s))
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6",
					children: [messages.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageBubble, {
						message,
						streaming: streamingId === message.id,
						showRegen: message.id === lastAssistant?.id && !streamingId,
						onRegenerate: regenerate
					}, message.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: bottomRef })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, {
				value: draft,
				onChange: setDraft,
				onSend: () => send(draft),
				onStop: stop,
				streaming: Boolean(streamingId),
				disabled: !selectedModel,
				placeholder: selectedModel ? `Message ${selectedModel.name}` : "Choose a model to begin"
			})
		]
	});
}
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	type,
	className: cn("flex h-10 w-full rounded-lg border border-input bg-secondary px-3 text-sm text-foreground shadow-none outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-subtle focus-visible:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50", className),
	ref,
	...props
}));
Input.displayName = "Input";
function Skeleton({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("animate-pulse rounded-md bg-secondary", className),
		...props
	});
}
var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
	ref,
	className: cn("fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props
}));
DialogOverlay.displayName = DialogOverlay$1.displayName;
var DialogContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
	ref,
	className: cn("fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-border duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
		className: "absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "Close"
		})]
	})]
})] }));
DialogContent.displayName = DialogContent$1.displayName;
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-1.5", className),
		...props
	});
}
function DialogFooter({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
		...props
	});
}
var DialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
	ref,
	className: cn("text-lg font-medium tracking-tight", className),
	...props
}));
DialogTitle.displayName = DialogTitle$1.displayName;
var DialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
DialogDescription.displayName = DialogDescription$1.displayName;
function startOfDay(ts) {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}
function groupConversations(conversations) {
	const now = startOfDay(Date.now());
	const day = 864e5;
	const groups = [
		{
			label: "Pinned",
			items: []
		},
		{
			label: "Today",
			items: []
		},
		{
			label: "Yesterday",
			items: []
		},
		{
			label: "Previous 7 days",
			items: []
		},
		{
			label: "Older",
			items: []
		}
	];
	for (const c of conversations) {
		if (c.pinned) {
			groups[0].items.push(c);
			continue;
		}
		const delta = now - startOfDay(c.updatedAt);
		if (delta < day) groups[1].items.push(c);
		else if (delta < day * 2) groups[2].items.push(c);
		else if (delta < day * 7) groups[3].items.push(c);
		else groups[4].items.push(c);
	}
	return groups.filter((g) => g.items.length > 0);
}
function Sidebar({ className, onNewChat, onOpenSettings, onNavigate }) {
	const conversations = useChatStore((s) => s.conversations);
	const activeId = useChatStore((s) => s.activeId);
	const search = useChatStore((s) => s.search);
	const setSearch = useChatStore((s) => s.setSearch);
	const setActive = useChatStore((s) => s.setActive);
	const deleteConversation = useChatStore((s) => s.deleteConversation);
	const renameConversation = useChatStore((s) => s.renameConversation);
	const togglePin = useChatStore((s) => s.togglePin);
	const [renaming, setRenaming] = (0, import_react.useState)(null);
	const [title, setTitle] = (0, import_react.useState)("");
	const filtered = (0, import_react.useMemo)(() => {
		const q = search.trim().toLowerCase();
		const list = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
		if (!q) return list;
		return list.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
	}, [conversations, search]);
	const groups = (0, import_react.useMemo)(() => groupConversations(filtered), [filtered]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: cn("flex h-full flex-col bg-sidebar", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 px-3 pt-4 pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1 items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlameMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-serif text-lg tracking-tight",
						children: "Hearth"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "icon-sm",
					variant: "ghost",
					onClick: onNewChat,
					"aria-label": "New chat",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 pb-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "h-10 w-full justify-start gap-2",
					variant: "secondary",
					onClick: onNewChat,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New chat"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 pb-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: search,
						onChange: (e) => setSearch(e.target.value),
						placeholder: "Search chats",
						className: "h-9 bg-secondary/80 pl-9"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3",
				children: groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-8 text-center text-sm text-muted-foreground",
					children: "Saved conversations will live here."
				}) : groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "px-2 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
						children: group.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-col gap-0.5",
						children: group.items.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cn("group flex items-center rounded-lg pr-1", c.id === activeId ? "bg-accent" : "hover:bg-accent/70"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm",
								onClick: () => {
									setActive(c.id);
									onNavigate?.();
								},
								children: c.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "icon-sm",
									variant: "ghost",
									className: "opacity-100 md:opacity-0 md:group-hover:opacity-100",
									"aria-label": "Conversation actions",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ellipsis, { className: "size-4" })
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuContent, {
								align: "end",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
										onSelect: () => {
											setRenaming(c);
											setTitle(c.title);
										},
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" }), "Rename"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
										onSelect: () => togglePin(c.id),
										children: [c.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PinOff, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, { className: "size-4" }), c.pinned ? "Unpin" : "Pin"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuItem, {
										onSelect: () => deleteConversation(c.id),
										className: "text-destructive focus:text-destructive",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" }), "Delete"]
									})
								]
							})] })]
						}) }, c.id))
					})]
				}, group.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-t border-border p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "ghost",
					className: "h-10 w-full justify-start gap-2",
					onClick: onOpenSettings,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-4" }), "Settings"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: Boolean(renaming),
				onOpenChange: (o) => !o && setRenaming(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Rename chat" }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: title,
						onChange: (e) => setTitle(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter" && renaming) {
								renameConversation(renaming.id, title.trim() || "New chat");
								setRenaming(null);
							}
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setRenaming(null),
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => {
							if (!renaming) return;
							renameConversation(renaming.id, title.trim() || "New chat");
							setRenaming(null);
						},
						children: "Save"
					})] })
				] })
			})
		]
	});
}
function FlameMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 24 24",
		className: cn("size-6 shrink-0", className),
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			width: "24",
			height: "24",
			rx: "6",
			fill: "currentColor",
			className: "text-primary"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			fill: "currentColor",
			className: "text-background",
			d: "M12 4.5c2.7 3.4 4.8 5.6 4.8 8.4A4.8 4.8 0 1 1 7.2 12.9c0-2.8 2.1-5 4.8-8.4z"
		})]
	});
}
function ConnectScreen({ catalog, host, onHostCommit, onRefresh, onScanLocal, onChoose }) {
	const [query, setQuery] = (0, import_react.useState)("");
	const [hostDraft, setHostDraft] = (0, import_react.useState)(host);
	const { models, status } = catalog;
	const filtered = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		if (!q) return models;
		return models.filter((m) => `${m.name} ${m.family ?? ""} ${m.parameterSize ?? ""}`.toLowerCase().includes(q));
	}, [models, query]);
	const ollama = filtered.filter((m) => m.provider === "ollama");
	const xai = filtered.filter((m) => m.provider === "xai");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "scrollbar-thin h-full overflow-y-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full max-w-2xl flex-col px-4 py-10 md:py-14",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlameMark, { className: "mb-5 size-10" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-serif text-4xl tracking-tight text-balance md:text-5xl",
							children: "Which model shall we sit with?"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 max-w-lg text-base text-muted-foreground text-pretty",
							children: "Hearth lists every Ollama model already downloaded, then lets you switch mid-chat — the same way you change models in ChatGPT."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-6 flex flex-col gap-2 sm:flex-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: "Filter models",
						className: "h-11 flex-1"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "secondary",
							className: "h-11 flex-1 sm:flex-none",
							onClick: onRefresh,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-4" }), "Refresh"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "outline",
							className: "h-11 flex-1 sm:flex-none",
							onClick: onScanLocal,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, { className: "size-4" }), "This PC"]
						})]
					})]
				}),
				status.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16 rounded-xl" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16 rounded-xl" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16 rounded-xl" })
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					ollama.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelGroup, {
						title: "On this machine",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "size-3.5" }),
						children: ollama.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelCard, {
							model,
							onChoose
						}, `${model.provider}:${model.id}:${model.transport}`))
					}),
					xai.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelGroup, {
						title: "Cloud",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cloud, { className: "size-3.5" }),
						children: xai.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelCard, {
							model,
							onChoose
						}, `${model.provider}:${model.id}`))
					}),
					filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-border bg-card px-5 py-8 text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: "No models found"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted-foreground text-pretty",
							children: "Start Ollama with models you have already downloaded, scan this computer, or point Hearth at another host below."
						})]
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-8 flex flex-col gap-2 border-t border-border pt-6",
					onSubmit: (e) => {
						e.preventDefault();
						onHostCommit(hostDraft.trim() || "http://127.0.0.1:11434");
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						htmlFor: "connect-host",
						className: "text-sm font-medium",
						children: "Ollama host"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "connect-host",
							value: hostDraft,
							onChange: (e) => setHostDraft(e.target.value),
							placeholder: "http://127.0.0.1:11434"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							variant: "secondary",
							children: "Look there"
						})]
					})]
				})
			]
		})
	});
}
function ModelGroup({ title, icon, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mb-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
			className: "mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase",
			children: [icon, title]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-col gap-2",
			children
		})]
	});
}
function ModelCard({ model, onChoose }) {
	const meta = [
		model.parameterSize,
		formatBytes(model.size),
		model.family,
		model.provider === "xai" ? "Cloud" : null
	].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => onChoose(model),
		className: cn("flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left", "transition-[background-color,border-color] duration-150 hover:border-ring/40 hover:bg-accent"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground",
			children: model.provider === "xai" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cloud, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "size-4" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "min-w-0 flex-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate font-medium",
				children: model.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block truncate text-xs text-muted-foreground",
				children: meta || "Ready"
			})]
		})]
	});
}
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn("text-sm font-medium text-foreground", className),
	...props
}));
Label.displayName = Root.displayName;
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
	className: cn("flex min-h-20 w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-subtle focus-visible:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50", className),
	ref,
	...props
}));
Textarea.displayName = "Textarea";
function SettingsDialog({ open, onOpenChange, onHostChange }) {
	const settings = useChatStore((s) => s.settings);
	const setSettings = useChatStore((s) => s.setSettings);
	const [host, setHost] = (0, import_react.useState)(settings.ollamaHost);
	const [temperature, setTemperature] = (0, import_react.useState)(String(settings.temperature));
	const [systemPrompt, setSystemPrompt] = (0, import_react.useState)(settings.systemPrompt);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (next) => {
			if (next) {
				setHost(settings.ollamaHost);
				setTemperature(String(settings.temperature));
				setSystemPrompt(settings.systemPrompt);
			}
			onOpenChange(next);
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Settings" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Point Hearth at Ollama and tune how replies feel." })] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "ollama-host",
								children: "Ollama host"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "ollama-host",
								value: host,
								onChange: (e) => setHost(e.target.value),
								placeholder: "http://127.0.0.1:11434",
								autoComplete: "off"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Hearth lists every model already downloaded there, then lets you switch mid-chat."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
							htmlFor: "temperature",
							children: ["Temperature · ", temperature]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: "temperature",
							type: "range",
							min: 0,
							max: 2,
							step: .1,
							value: Number(temperature) || 0,
							onChange: (e) => setTemperature(e.target.value),
							className: "h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "system-prompt",
							children: "System prompt"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "system-prompt",
							value: systemPrompt,
							onChange: (e) => setSystemPrompt(e.target.value),
							placeholder: "Optional instructions for every reply",
							rows: 4
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "ghost",
				onClick: () => onOpenChange(false),
				children: "Cancel"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				onClick: () => {
					const parsed = Number(temperature);
					setSettings({
						ollamaHost: host.trim() || "http://127.0.0.1:11434",
						temperature: Number.isFinite(parsed) ? parsed : .7,
						systemPrompt
					});
					onOpenChange(false);
					onHostChange?.();
				},
				children: "Save"
			})] })
		] })
	});
}
var emptyCatalog = {
	models: [],
	status: {
		loading: true,
		ollamaBrowser: false,
		ollamaServer: false,
		xai: false
	}
};
function ChatApp() {
	const selectedModel = useChatStore((s) => s.selectedModel);
	const setSelectedModel = useChatStore((s) => s.setSelectedModel);
	const settings = useChatStore((s) => s.settings);
	const setSettings = useChatStore((s) => s.setSettings);
	const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);
	const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed);
	const newChat = useChatStore((s) => s.newChat);
	const [catalog, setCatalog] = (0, import_react.useState)(emptyCatalog);
	const [browserModels, setBrowserModels] = (0, import_react.useState)([]);
	const [mobileOpen, setMobileOpen] = (0, import_react.useState)(false);
	const [settingsOpen, setSettingsOpen] = (0, import_react.useState)(false);
	const [hydrated, setHydrated] = (0, import_react.useState)(() => useChatStore.persist.hasHydrated());
	const refresh = (0, import_react.useCallback)(async (localModels = browserModels) => {
		setCatalog((c) => c.models.length > 0 ? c : {
			...c,
			status: {
				...c.status,
				loading: true
			}
		});
		const next = await fetchCatalog(useChatStore.getState().settings.ollamaHost, localModels);
		setCatalog(next);
		const current = useChatStore.getState().selectedModel;
		if (current) {
			const match = next.models.find((m) => m.id === current.id && m.provider === current.provider);
			if (match) setSelectedModel(match);
		}
	}, [browserModels, setSelectedModel]);
	(0, import_react.useEffect)(() => {
		const unsub = useChatStore.persist.onFinishHydration(() => setHydrated(true));
		if (useChatStore.persist.hasHydrated()) setHydrated(true);
		return unsub;
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		refresh();
		const id = window.setInterval(() => void refresh(), 3e4);
		return () => window.clearInterval(id);
	}, [
		refresh,
		settings.ollamaHost,
		hydrated
	]);
	function chooseModel(model) {
		setSelectedModel(model);
		const state = useChatStore.getState();
		if (!state.activeId) state.newChat();
	}
	async function scanThisComputer() {
		const host = useChatStore.getState().settings.ollamaHost;
		const found = await probeBrowserOllama(host);
		setBrowserModels(found);
		await refresh(found);
		if (found.length === 0) toast.error("No Ollama models on this computer yet");
		else toast.success(`Found ${found.length} local model${found.length === 1 ? "" : "s"}`);
	}
	const sidebar = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sidebar, {
		className: "h-full w-full",
		onNewChat: () => {
			newChat();
			setMobileOpen(false);
		},
		onOpenSettings: () => {
			setSettingsOpen(true);
			setMobileOpen(false);
		},
		onNavigate: () => setMobileOpen(false)
	});
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-dvh items-center justify-center bg-background text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlameMark, { className: "size-10" })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TooltipProvider, {
		delayDuration: 250,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-dvh overflow-hidden bg-background text-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("hidden h-full shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out md:block", sidebarCollapsed ? "w-0 border-r-0" : "w-72"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full w-72",
							children: sidebar
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
						open: mobileOpen,
						onOpenChange: setMobileOpen,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
							side: "left",
							className: "p-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
								className: "sr-only",
								children: "Conversations"
							}), sidebar]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "flex min-w-0 flex-1 flex-col",
						children: selectedModel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatView, {
							models: catalog.models,
							onOpenSidebar: () => setMobileOpen(true),
							onToggleSidebar: () => setSidebarCollapsed(!sidebarCollapsed)
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectScreen, {
							catalog,
							host: settings.ollamaHost,
							onHostCommit: (host) => {
								setSettings({ ollamaHost: host });
							},
							onRefresh: () => void refresh(),
							onScanLocal: () => void scanThisComputer(),
							onChoose: chooseModel
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsDialog, {
				open: settingsOpen,
				onOpenChange: setSettingsOpen,
				onHostChange: () => void refresh()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				theme: "dark",
				position: "top-center"
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatApp, {});
}
//#endregion
export { Home as component };
