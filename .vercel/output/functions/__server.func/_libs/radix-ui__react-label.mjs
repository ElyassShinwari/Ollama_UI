import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "./@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "./@radix-ui/react-collection+[...].mjs";
import { y as Primitive } from "./@radix-ui/react-dialog+[...].mjs";
//#region node_modules/@radix-ui/react-label/dist/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", {
	value,
	configurable: true
});
var Root = /* @__PURE__ */ import_react.forwardRef(/* @__PURE__ */ __name(function Label2(props, forwardedRef) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.label, {
		...props,
		ref: forwardedRef,
		onMouseDown: (event) => {
			if (event.target.closest("button, input, select, textarea")) return;
			props.onMouseDown?.(event);
			if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
		}
	});
}, "Label"));
//#endregion
export { Root as t };
