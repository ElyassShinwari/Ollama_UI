import { i as __toESM, t as __commonJSMin } from "../../_runtime.mjs";
import { u as require_react } from "../@floating-ui/react-dom+[...].mjs";
//#region node_modules/react/cjs/react-jsx-runtime.production.js
/**
* @license React
* react-jsx-runtime.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
	var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	function jsxProd(type, config, maybeKey) {
		var key = null;
		void 0 !== maybeKey && (key = "" + maybeKey);
		void 0 !== config.key && (key = "" + config.key);
		if ("key" in config) {
			maybeKey = {};
			for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
		} else maybeKey = config;
		config = maybeKey.ref;
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type,
			key,
			ref: void 0 !== config ? config : null,
			props: maybeKey
		};
	}
	exports.Fragment = REACT_FRAGMENT_TYPE;
	exports.jsx = jsxProd;
	exports.jsxs = jsxProd;
}));
//#endregion
//#region node_modules/react/jsx-runtime.js
var require_jsx_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_jsx_runtime_production();
}));
//#endregion
//#region node_modules/@radix-ui/react-compose-refs/dist/index.mjs
var import_jsx_runtime = require_jsx_runtime();
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var __defProp$3 = Object.defineProperty;
var __name$3 = (target, value) => __defProp$3(target, "name", {
	value,
	configurable: true
});
function setRef(ref, value) {
	if (typeof ref === "function") return ref(value);
	else if (ref !== null && ref !== void 0) ref.current = value;
}
__name$3(setRef, "setRef");
function composeRefs(...refs) {
	return (node) => {
		let hasCleanup = false;
		const cleanups = refs.map((ref) => {
			const cleanup = setRef(ref, node);
			if (!hasCleanup && typeof cleanup == "function") hasCleanup = true;
			return cleanup;
		});
		if (hasCleanup) return () => {
			for (let i = 0; i < cleanups.length; i++) {
				const cleanup = cleanups[i];
				if (typeof cleanup == "function") cleanup();
				else setRef(refs[i], null);
			}
		};
	};
}
__name$3(composeRefs, "composeRefs");
function useComposedRefs(...refs) {
	return import_react.useCallback(composeRefs(...refs), refs);
}
__name$3(useComposedRefs, "useComposedRefs");
//#endregion
//#region node_modules/@radix-ui/react-context/dist/index.mjs
var __defProp$2 = Object.defineProperty;
var __name$2 = (target, value) => __defProp$2(target, "name", {
	value,
	configurable: true
});
// @__NO_SIDE_EFFECTS__
function createContext2(rootComponentName, defaultContext) {
	const Context = import_react.createContext(defaultContext);
	Context.displayName = rootComponentName + "Context";
	const Provider = /* @__PURE__ */ __name$2((props) => {
		const { children, ...context } = props;
		const value = import_react.useMemo(() => context, Object.values(context));
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Context.Provider, {
			value,
			children
		});
	}, "Provider");
	Provider.displayName = rootComponentName + "Provider";
	function useContext2(consumerName, options = {}) {
		const { optional = false } = options;
		const context = import_react.useContext(Context);
		if (context) return context;
		if (defaultContext !== void 0) return defaultContext;
		if (optional) return void 0;
		throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
	}
	__name$2(useContext2, "useContext");
	return [Provider, useContext2];
}
__name$2(createContext2, "createContext");
// @__NO_SIDE_EFFECTS__
function createContextScope(scopeName, createContextScopeDeps = []) {
	let defaultContexts = [];
	function createContext3(rootComponentName, defaultContext) {
		const BaseContext = import_react.createContext(defaultContext);
		BaseContext.displayName = rootComponentName + "Context";
		const index = defaultContexts.length;
		defaultContexts = [...defaultContexts, defaultContext];
		const Provider = /* @__PURE__ */ __name$2((props) => {
			const { scope, children, ...context } = props;
			const Context = scope?.[scopeName]?.[index] || BaseContext;
			const value = import_react.useMemo(() => context, Object.values(context));
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Context.Provider, {
				value,
				children
			});
		}, "Provider");
		Provider.displayName = rootComponentName + "Provider";
		function useContext2(consumerName, scope, options = {}) {
			const { optional = false } = options;
			const Context = scope?.[scopeName]?.[index] || BaseContext;
			const context = import_react.useContext(Context);
			if (context) return context;
			if (defaultContext !== void 0) return defaultContext;
			if (optional) return void 0;
			throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
		}
		__name$2(useContext2, "useContext");
		return [Provider, useContext2];
	}
	__name$2(createContext3, "createContext");
	const createScope = /* @__PURE__ */ __name$2(() => {
		const scopeContexts = defaultContexts.map((defaultContext) => {
			return import_react.createContext(defaultContext);
		});
		return /* @__PURE__ */ __name$2(function useScope(scope) {
			const contexts = scope?.[scopeName] || scopeContexts;
			return import_react.useMemo(() => ({ [`__scope${scopeName}`]: {
				...scope,
				[scopeName]: contexts
			} }), [scope, contexts]);
		}, "useScope");
	}, "createScope");
	createScope.scopeName = scopeName;
	return [createContext3, composeContextScopes(createScope, ...createContextScopeDeps)];
}
__name$2(createContextScope, "createContextScope");
function composeContextScopes(...scopes) {
	const baseScope = scopes[0];
	if (scopes.length === 1) return baseScope;
	const createScope = /* @__PURE__ */ __name$2(() => {
		const scopeHooks = scopes.map((createScope2) => ({
			useScope: createScope2(),
			scopeName: createScope2.scopeName
		}));
		return /* @__PURE__ */ __name$2(function useComposedScopes(overrideScopes) {
			const nextScopes = scopeHooks.reduce((nextScopes2, { useScope, scopeName }) => {
				const currentScope = useScope(overrideScopes)[`__scope${scopeName}`];
				return {
					...nextScopes2,
					...currentScope
				};
			}, {});
			return import_react.useMemo(() => ({ [`__scope${baseScope.scopeName}`]: nextScopes }), [nextScopes]);
		}, "useComposedScopes");
	}, "createScope");
	createScope.scopeName = baseScope.scopeName;
	return createScope;
}
__name$2(composeContextScopes, "composeContextScopes");
//#endregion
//#region node_modules/@radix-ui/react-slot/dist/index.mjs
var __defProp$1 = Object.defineProperty;
var __name$1 = (target, value) => __defProp$1(target, "name", {
	value,
	configurable: true
});
// @__NO_SIDE_EFFECTS__
function createSlot(ownerName) {
	const Slot2 = import_react.forwardRef((props, forwardedRef) => {
		let { children, ...slotProps } = props;
		let slottableElement = null;
		let hasSlottable = false;
		const newChildren = [];
		if (isLazyComponent(children) && typeof use === "function") children = use(children._payload);
		import_react.Children.forEach(children, (maybeSlottable) => {
			if (isSlottable(maybeSlottable)) {
				hasSlottable = true;
				const slottable = maybeSlottable;
				let child = "child" in slottable.props ? slottable.props.child : slottable.props.children;
				if (isLazyComponent(child) && typeof use === "function") child = use(child._payload);
				slottableElement = getSlottableElementFromSlottable(slottable, child);
				newChildren.push(slottableElement?.props?.children);
			} else newChildren.push(maybeSlottable);
		});
		if (slottableElement) slottableElement = import_react.cloneElement(slottableElement, void 0, newChildren);
		else if (!hasSlottable && import_react.Children.count(children) === 1 && import_react.isValidElement(children)) slottableElement = children;
		const slottableElementRef = slottableElement ? getElementRef(slottableElement) : void 0;
		const composedRef = useComposedRefs(forwardedRef, slottableElementRef);
		if (!slottableElement) {
			if (children || children === 0) throw new Error(hasSlottable ? createSlottableError(ownerName) : createSlotError(ownerName));
			return children;
		}
		const mergedProps = mergeProps(slotProps, slottableElement.props ?? {});
		if (slottableElement.type !== import_react.Fragment) mergedProps.ref = forwardedRef ? composedRef : slottableElementRef;
		return import_react.cloneElement(slottableElement, mergedProps);
	});
	Slot2.displayName = `${ownerName}.Slot`;
	return Slot2;
}
__name$1(createSlot, "createSlot");
var Slot = /* @__PURE__ */ createSlot("Slot");
var SLOTTABLE_IDENTIFIER = Symbol.for("radix.slottable");
// @__NO_SIDE_EFFECTS__
function createSlottable(ownerName) {
	const Slottable2 = /* @__PURE__ */ __name$1((props) => "child" in props ? props.children(props.child) : props.children, "Slottable");
	Slottable2.displayName = `${ownerName}.Slottable`;
	Slottable2.__radixId = SLOTTABLE_IDENTIFIER;
	return Slottable2;
}
__name$1(createSlottable, "createSlottable");
var getSlottableElementFromSlottable = /* @__PURE__ */ __name$1((slottable, child) => {
	if ("child" in slottable.props) {
		const child2 = slottable.props.child;
		if (!import_react.isValidElement(child2)) return null;
		return import_react.cloneElement(child2, void 0, slottable.props.children(child2.props.children));
	}
	return import_react.isValidElement(child) ? child : null;
}, "getSlottableElementFromSlottable");
function mergeProps(slotProps, childProps) {
	const overrideProps = { ...childProps };
	for (const propName in childProps) {
		const slotPropValue = slotProps[propName];
		const childPropValue = childProps[propName];
		if (/^on[A-Z]/.test(propName)) {
			if (slotPropValue && childPropValue) overrideProps[propName] = (...args) => {
				const result = childPropValue(...args);
				slotPropValue(...args);
				return result;
			};
			else if (slotPropValue) overrideProps[propName] = slotPropValue;
		} else if (propName === "style") overrideProps[propName] = {
			...slotPropValue,
			...childPropValue
		};
		else if (propName === "className") overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
	}
	return {
		...slotProps,
		...overrideProps
	};
}
__name$1(mergeProps, "mergeProps");
function getElementRef(element) {
	let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
	let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
	if (mayWarn) return element.ref;
	getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
	mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
	if (mayWarn) return element.props.ref;
	return element.props.ref || element.ref;
}
__name$1(getElementRef, "getElementRef");
function isSlottable(child) {
	return import_react.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
__name$1(isSlottable, "isSlottable");
var REACT_LAZY_TYPE = Symbol.for("react.lazy");
function isLazyComponent(element) {
	return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
}
__name$1(isLazyComponent, "isLazyComponent");
function isPromiseLike(value) {
	return typeof value === "object" && value !== null && "then" in value;
}
__name$1(isPromiseLike, "isPromiseLike");
var createSlotError = /* @__PURE__ */ __name$1((ownerName) => {
	return `${ownerName} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`;
}, "createSlotError");
var createSlottableError = /* @__PURE__ */ __name$1((ownerName) => {
	return `${ownerName} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`;
}, "createSlottableError");
var use = import_react[" use ".trim().toString()];
//#endregion
//#region node_modules/@radix-ui/react-collection/dist/index.mjs
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", {
	value,
	configurable: true
});
// @__NO_SIDE_EFFECTS__
function createCollection(name) {
	const PROVIDER_NAME = name + "CollectionProvider";
	const [createCollectionContext, createCollectionScope] = /* @__PURE__ */ createContextScope(PROVIDER_NAME);
	const [CollectionProviderImpl, useCollectionContext] = createCollectionContext(PROVIDER_NAME, {
		collectionRef: { current: null },
		itemMap: /* @__PURE__ */ new Map()
	});
	const CollectionProvider = /* @__PURE__ */ __name((props) => {
		const { scope, children } = props;
		const ref = import_react.useRef(null);
		const itemMap = import_react.useRef(/* @__PURE__ */ new Map()).current;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionProviderImpl, {
			scope,
			itemMap,
			collectionRef: ref,
			children
		});
	}, "CollectionProvider");
	CollectionProvider.displayName = PROVIDER_NAME;
	const COLLECTION_SLOT_NAME = name + "CollectionSlot";
	const CollectionSlotImpl = /* @__PURE__ */ createSlot(COLLECTION_SLOT_NAME);
	const CollectionSlot = import_react.forwardRef((props, forwardedRef) => {
		const { scope, children } = props;
		const composedRefs = useComposedRefs(forwardedRef, useCollectionContext(COLLECTION_SLOT_NAME, scope).collectionRef);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionSlotImpl, {
			ref: composedRefs,
			children
		});
	});
	CollectionSlot.displayName = COLLECTION_SLOT_NAME;
	const ITEM_SLOT_NAME = name + "CollectionItemSlot";
	const ITEM_DATA_ATTR = "data-radix-collection-item";
	const CollectionItemSlotImpl = /* @__PURE__ */ createSlot(ITEM_SLOT_NAME);
	const CollectionItemSlot = import_react.forwardRef((props, forwardedRef) => {
		const { scope, children, ...itemData } = props;
		const ref = import_react.useRef(null);
		const composedRefs = useComposedRefs(forwardedRef, ref);
		const context = useCollectionContext(ITEM_SLOT_NAME, scope);
		import_react.useEffect(() => {
			context.itemMap.set(ref, {
				ref,
				...itemData
			});
			return () => void context.itemMap.delete(ref);
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionItemSlotImpl, {
			[ITEM_DATA_ATTR]: "",
			ref: composedRefs,
			children
		});
	});
	CollectionItemSlot.displayName = ITEM_SLOT_NAME;
	function useCollection(scope) {
		const context = useCollectionContext(name + "CollectionConsumer", scope);
		return import_react.useCallback(() => {
			const collectionNode = context.collectionRef.current;
			if (!collectionNode) return [];
			const orderedNodes = Array.from(collectionNode.querySelectorAll(`[${ITEM_DATA_ATTR}]`));
			return Array.from(context.itemMap.values()).sort((a, b) => orderedNodes.indexOf(a.ref.current) - orderedNodes.indexOf(b.ref.current));
		}, [context.collectionRef, context.itemMap]);
	}
	__name(useCollection, "useCollection");
	return [
		{
			Provider: CollectionProvider,
			Slot: CollectionSlot,
			ItemSlot: CollectionItemSlot
		},
		useCollection,
		createCollectionScope
	];
}
__name(createCollection, "createCollection");
var __instanciated = /* @__PURE__ */ new WeakMap();
var OrderedDict = class _OrderedDict extends Map {
	static {
		__name(this, "OrderedDict");
	}
	#keys;
	constructor(entries) {
		super(entries);
		this.#keys = [...super.keys()];
		__instanciated.set(this, true);
	}
	set(key, value) {
		if (__instanciated.get(this)) {
			if (this.has(key)) this.#keys[this.#keys.indexOf(key)] = key;
			else this.#keys.push(key);
		}
		super.set(key, value);
		return this;
	}
	insert(index, key, value) {
		const has = this.has(key);
		const length = this.#keys.length;
		const relativeIndex = toSafeInteger(index);
		let actualIndex = relativeIndex >= 0 ? relativeIndex : length + relativeIndex;
		const safeIndex = actualIndex < 0 || actualIndex >= length ? -1 : actualIndex;
		if (safeIndex === this.size || has && safeIndex === this.size - 1 || safeIndex === -1) {
			this.set(key, value);
			return this;
		}
		const size = this.size + (has ? 0 : 1);
		if (relativeIndex < 0) actualIndex++;
		const keys = [...this.#keys];
		let nextValue;
		let shouldSkip = false;
		for (let i = actualIndex; i < size; i++) if (actualIndex === i) {
			let nextKey = keys[i];
			if (keys[i] === key) nextKey = keys[i + 1];
			if (has) this.delete(key);
			nextValue = this.get(nextKey);
			this.set(key, value);
		} else {
			if (!shouldSkip && keys[i - 1] === key) shouldSkip = true;
			const currentKey = keys[shouldSkip ? i : i - 1];
			const currentValue = nextValue;
			nextValue = this.get(currentKey);
			this.delete(currentKey);
			this.set(currentKey, currentValue);
		}
		return this;
	}
	with(index, key, value) {
		const copy = new _OrderedDict(this);
		copy.insert(index, key, value);
		return copy;
	}
	before(key) {
		const index = this.#keys.indexOf(key) - 1;
		if (index < 0) return;
		return this.entryAt(index);
	}
	/**
	* Sets a new key-value pair at the position before the given key.
	*/
	setBefore(key, newKey, value) {
		const index = this.#keys.indexOf(key);
		if (index === -1) return this;
		return this.insert(index, newKey, value);
	}
	after(key) {
		let index = this.#keys.indexOf(key);
		index = index === -1 || index === this.size - 1 ? -1 : index + 1;
		if (index === -1) return;
		return this.entryAt(index);
	}
	/**
	* Sets a new key-value pair at the position after the given key.
	*/
	setAfter(key, newKey, value) {
		const index = this.#keys.indexOf(key);
		if (index === -1) return this;
		return this.insert(index + 1, newKey, value);
	}
	first() {
		return this.entryAt(0);
	}
	last() {
		return this.entryAt(-1);
	}
	clear() {
		this.#keys = [];
		return super.clear();
	}
	delete(key) {
		const deleted = super.delete(key);
		if (deleted) this.#keys.splice(this.#keys.indexOf(key), 1);
		return deleted;
	}
	deleteAt(index) {
		const key = this.keyAt(index);
		if (key !== void 0) return this.delete(key);
		return false;
	}
	at(index) {
		const key = at(this.#keys, index);
		if (key !== void 0) return this.get(key);
	}
	entryAt(index) {
		const key = at(this.#keys, index);
		if (key !== void 0) return [key, this.get(key)];
	}
	indexOf(key) {
		return this.#keys.indexOf(key);
	}
	keyAt(index) {
		return at(this.#keys, index);
	}
	from(key, offset) {
		const index = this.indexOf(key);
		if (index === -1) return;
		let dest = index + offset;
		if (dest < 0) dest = 0;
		if (dest >= this.size) dest = this.size - 1;
		return this.at(dest);
	}
	keyFrom(key, offset) {
		const index = this.indexOf(key);
		if (index === -1) return;
		let dest = index + offset;
		if (dest < 0) dest = 0;
		if (dest >= this.size) dest = this.size - 1;
		return this.keyAt(dest);
	}
	find(predicate, thisArg) {
		let index = 0;
		for (const entry of this) {
			if (Reflect.apply(predicate, thisArg, [
				entry,
				index,
				this
			])) return entry;
			index++;
		}
	}
	findIndex(predicate, thisArg) {
		let index = 0;
		for (const entry of this) {
			if (Reflect.apply(predicate, thisArg, [
				entry,
				index,
				this
			])) return index;
			index++;
		}
		return -1;
	}
	filter(predicate, thisArg) {
		const entries = [];
		let index = 0;
		for (const entry of this) {
			if (Reflect.apply(predicate, thisArg, [
				entry,
				index,
				this
			])) entries.push(entry);
			index++;
		}
		return new _OrderedDict(entries);
	}
	map(callbackfn, thisArg) {
		const entries = [];
		let index = 0;
		for (const entry of this) {
			entries.push([entry[0], Reflect.apply(callbackfn, thisArg, [
				entry,
				index,
				this
			])]);
			index++;
		}
		return new _OrderedDict(entries);
	}
	reduce(...args) {
		const [callbackfn, initialValue] = args;
		let index = 0;
		let accumulator = initialValue ?? this.at(0);
		for (const entry of this) {
			if (index === 0 && args.length === 1) accumulator = entry;
			else accumulator = Reflect.apply(callbackfn, this, [
				accumulator,
				entry,
				index,
				this
			]);
			index++;
		}
		return accumulator;
	}
	reduceRight(...args) {
		const [callbackfn, initialValue] = args;
		let accumulator = initialValue ?? this.at(-1);
		for (let index = this.size - 1; index >= 0; index--) {
			const entry = this.at(index);
			if (index === this.size - 1 && args.length === 1) accumulator = entry;
			else accumulator = Reflect.apply(callbackfn, this, [
				accumulator,
				entry,
				index,
				this
			]);
		}
		return accumulator;
	}
	toSorted(compareFn) {
		const entries = [...this.entries()].sort(compareFn);
		return new _OrderedDict(entries);
	}
	toReversed() {
		const reversed = new _OrderedDict();
		for (let index = this.size - 1; index >= 0; index--) {
			const key = this.keyAt(index);
			const element = this.get(key);
			reversed.set(key, element);
		}
		return reversed;
	}
	toSpliced(...args) {
		const entries = [...this.entries()];
		entries.splice(...args);
		return new _OrderedDict(entries);
	}
	slice(start, end) {
		const result = new _OrderedDict();
		let stop = this.size - 1;
		if (start === void 0) return result;
		if (start < 0) start = start + this.size;
		if (end !== void 0 && end > 0) stop = end - 1;
		for (let index = start; index <= stop; index++) {
			const key = this.keyAt(index);
			const element = this.get(key);
			result.set(key, element);
		}
		return result;
	}
	every(predicate, thisArg) {
		let index = 0;
		for (const entry of this) {
			if (!Reflect.apply(predicate, thisArg, [
				entry,
				index,
				this
			])) return false;
			index++;
		}
		return true;
	}
	some(predicate, thisArg) {
		let index = 0;
		for (const entry of this) {
			if (Reflect.apply(predicate, thisArg, [
				entry,
				index,
				this
			])) return true;
			index++;
		}
		return false;
	}
};
function at(array, index) {
	if ("at" in Array.prototype) return Array.prototype.at.call(array, index);
	const actualIndex = toSafeIndex(array, index);
	return actualIndex === -1 ? void 0 : array[actualIndex];
}
__name(at, "at");
function toSafeIndex(array, index) {
	const length = array.length;
	const relativeIndex = toSafeInteger(index);
	const actualIndex = relativeIndex >= 0 ? relativeIndex : length + relativeIndex;
	return actualIndex < 0 || actualIndex >= length ? -1 : actualIndex;
}
__name(toSafeIndex, "toSafeIndex");
function toSafeInteger(number) {
	return number !== number || number === 0 ? 0 : Math.trunc(number);
}
__name(toSafeInteger, "toSafeInteger");
// @__NO_SIDE_EFFECTS__
function createCollection2(name) {
	const PROVIDER_NAME = name + "CollectionProvider";
	const [createCollectionContext, createCollectionScope] = /* @__PURE__ */ createContextScope(PROVIDER_NAME);
	const [CollectionContextProvider, useCollectionContext] = createCollectionContext(PROVIDER_NAME, {
		collectionElement: null,
		collectionRef: { current: null },
		collectionRefObject: { current: null },
		itemMap: new OrderedDict(),
		setItemMap: /* @__PURE__ */ __name(() => void 0, "setItemMap")
	});
	const CollectionProvider = /* @__PURE__ */ __name(({ state, ...props }) => {
		return state ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionProviderImpl, {
			...props,
			state
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionInit, { ...props });
	}, "CollectionProvider");
	CollectionProvider.displayName = PROVIDER_NAME;
	const CollectionInit = /* @__PURE__ */ __name((props) => {
		const state = useInitCollection();
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionProviderImpl, {
			...props,
			state
		});
	}, "CollectionInit");
	CollectionInit.displayName = PROVIDER_NAME + "Init";
	const CollectionProviderImpl = /* @__PURE__ */ __name((props) => {
		const { scope, children, state } = props;
		const ref = import_react.useRef(null);
		const [collectionElement, setCollectionElement] = import_react.useState(null);
		const composeRefs = useComposedRefs(ref, setCollectionElement);
		const [itemMap, setItemMap] = state;
		import_react.useEffect(() => {
			if (!collectionElement) return;
			const observer = getChildListObserver(() => {});
			observer.observe(collectionElement, {
				childList: true,
				subtree: true
			});
			return () => {
				observer.disconnect();
			};
		}, [collectionElement]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionContextProvider, {
			scope,
			itemMap,
			setItemMap,
			collectionRef: composeRefs,
			collectionRefObject: ref,
			collectionElement,
			children
		});
	}, "CollectionProviderImpl");
	CollectionProviderImpl.displayName = PROVIDER_NAME + "Impl";
	const COLLECTION_SLOT_NAME = name + "CollectionSlot";
	const CollectionSlotImpl = /* @__PURE__ */ createSlot(COLLECTION_SLOT_NAME);
	const CollectionSlot = import_react.forwardRef((props, forwardedRef) => {
		const { scope, children } = props;
		const composedRefs = useComposedRefs(forwardedRef, useCollectionContext(COLLECTION_SLOT_NAME, scope).collectionRef);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionSlotImpl, {
			ref: composedRefs,
			children
		});
	});
	CollectionSlot.displayName = COLLECTION_SLOT_NAME;
	const ITEM_SLOT_NAME = name + "CollectionItemSlot";
	const ITEM_DATA_ATTR = "data-radix-collection-item";
	const CollectionItemSlotImpl = /* @__PURE__ */ createSlot(ITEM_SLOT_NAME);
	const CollectionItemSlot = import_react.forwardRef((props, forwardedRef) => {
		const { scope, children, ...itemData } = props;
		const ref = import_react.useRef(null);
		const [element, setElement] = import_react.useState(null);
		const composedRefs = useComposedRefs(forwardedRef, ref, setElement);
		const { setItemMap } = useCollectionContext(ITEM_SLOT_NAME, scope);
		const itemDataRef = import_react.useRef(itemData);
		if (!shallowEqual(itemDataRef.current, itemData)) itemDataRef.current = itemData;
		const memoizedItemData = itemDataRef.current;
		import_react.useEffect(() => {
			const itemData2 = memoizedItemData;
			setItemMap((map) => {
				if (!element) return map;
				if (!map.has(element)) {
					map.set(element, {
						...itemData2,
						element
					});
					return map.toSorted(sortByDocumentPosition);
				}
				return map.set(element, {
					...itemData2,
					element
				}).toSorted(sortByDocumentPosition);
			});
			return () => {
				setItemMap((map) => {
					if (!element || !map.has(element)) return map;
					map.delete(element);
					return new OrderedDict(map);
				});
			};
		}, [
			element,
			memoizedItemData,
			setItemMap
		]);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CollectionItemSlotImpl, {
			[ITEM_DATA_ATTR]: "",
			ref: composedRefs,
			children
		});
	});
	CollectionItemSlot.displayName = ITEM_SLOT_NAME;
	function useInitCollection() {
		return import_react.useState(new OrderedDict());
	}
	__name(useInitCollection, "useInitCollection");
	function useCollection(scope) {
		const { itemMap } = useCollectionContext(name + "CollectionConsumer", scope);
		return itemMap;
	}
	__name(useCollection, "useCollection");
	return [{
		Provider: CollectionProvider,
		Slot: CollectionSlot,
		ItemSlot: CollectionItemSlot
	}, {
		createCollectionScope,
		useCollection,
		useInitCollection
	}];
}
__name(createCollection2, "createCollection");
function shallowEqual(a, b) {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object") return false;
	if (a == null || b == null) return false;
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;
	for (const key of keysA) {
		if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
		if (a[key] !== b[key]) return false;
	}
	return true;
}
__name(shallowEqual, "shallowEqual");
function isElementPreceding(a, b) {
	return !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING);
}
__name(isElementPreceding, "isElementPreceding");
function sortByDocumentPosition(a, b) {
	return !a[1].element || !b[1].element ? 0 : isElementPreceding(a[1].element, b[1].element) ? -1 : 1;
}
__name(sortByDocumentPosition, "sortByDocumentPosition");
function getChildListObserver(callback) {
	return new MutationObserver((mutationsList) => {
		for (const mutation of mutationsList) if (mutation.type === "childList") {
			callback();
			return;
		}
	});
}
__name(getChildListObserver, "getChildListObserver");
//#endregion
export { createContextScope as a, createSlottable as i, Slot as n, useComposedRefs as o, createSlot as r, require_jsx_runtime as s, createCollection as t };
