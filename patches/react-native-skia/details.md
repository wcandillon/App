# `react-native-skia` patches

The patch below was rebased from `@shopify/react-native-skia` 2.11.2 when the App moved to `react-native-skia` 2.15.4 (the package was renamed, and `victory-native` 43 depends on the new name). Five 2.11.2 patches were dropped. 2.15.4 fixes the first four below (another one, `size-backing-store-to-painted-size`, was already removed by rendering inline charts at their fitted size, https://github.com/Expensify/App/pull/106512):

- `fix-runtime-aware-cache-uaf` (Sentry APP-AVB, https://github.com/Expensify/App/issues/90135): `RuntimeAwareCache` no longer exists. Its replacement, `JSICache`, is owned by the runtime's `global` (as `NativeState`), so it is destroyed by the runtime itself while the runtime is still valid. The HybridApp teardown order can no longer free cached JSI values into a dead runtime.
- `defer-webgl-context-loss-to-unmount` (https://github.com/Expensify/App/issues/98254): a view's `<canvas>` no longer owns a WebGL context. Every view draws on one WebGL context shared by the page and copies its frame onto its own element through a 2D context, so there is no per-element context to lose. The part of that patch that kept the hidden backdrop painted lives on as `001+keep-canvas-bitmap-on-dispose`.
- `load-skia-web-fail-closed` (https://github.com/Expensify/App/issues/102042): since 2.15.4 `LoadSkiaWeb` no longer caches a failed init, and rewords a `LinkError` into a message naming the `canvaskit-wasm` version mismatch (https://github.com/wcandillon/react-native-skia/pull/4432). The check for a CanvasKit that links but comes up without its bindings was not taken as is: upstream verifies the downloaded binary against a size and SHA-256 fingerprint instead (`verifyWasm`), which is on in development only. The App serves the binary under a versioned URL (`CANVASKIT_WASM_FILENAME`), which is what prevents the mismatch in production; pass `verifyWasm: true` to `WithSkiaWeb`'s `opts` if a production safety net is wanted again.
- `redraw-texture-view-when-window-visible` (https://github.com/Expensify/App/issues/101396): fixed in 2.15.4 by https://github.com/wcandillon/react-native-skia/pull/4434, which latches the `TextureView`'s retained buffer when its window becomes visible again.

The fifth, `fallback-to-software-surface` (Sentry APP-7MV, https://github.com/Expensify/App/issues/97104, introduced in https://github.com/Expensify/App/pull/97219, upstream https://github.com/Shopify/react-native-skia/pull/3996), is handled in the App instead:

- With a single shared context the per-page context limit can no longer be exhausted, which was the cause of APP-7MV.
- What is left is the renderer being refused a context after `isSkiaWebSupported` passed. It throws while it is created, in a layout effect, where `SkiaWebChart`'s error boundary catches it and shows the WebGL empty state.
- Not covered: `SharedWebGLContext.acquireScreen` throws "Could not create surface" when the context exists but a surface of the requested size cannot be made. The first draw of a chart runs from a microtask and later ones from a ResizeObserver callback, so that error reaches no boundary and the canvas stays blank. The 2.11.2 patch swallowed it. It needs an upstream fix (return null there, like a lost context) rather than a patch.

### [react-native-skia+2.15.4+001+keep-canvas-bitmap-on-dispose.patch](react-native-skia+2.15.4+001+keep-canvas-bitmap-on-dispose.patch)

- Reason:

    ```
    Keeps charts painted on screens hidden in React <Activity>.

    In 2.15.4 WebGLRenderer.dispose() sets the element's width and height to 0
    to free its 2D bitmap. dispose() runs from a layout effect cleanup, and
    React runs those cleanups when an <Activity> is hidden, not only on
    unmount. ScreenActivityWrapper keeps the hidden screen painted as a static
    backdrop (AlwaysPaintedView), so zeroing the size blanks every chart in
    that backdrop.

    dispose() now leaves the element's size alone. The renderer the re-run
    creates on the same element sizes it again in onResize() and repaints. The
    cost is one 2D bitmap per hidden canvas (4 bytes per device pixel); a
    canvas that is really unmounted is collected with its element. This is
    much cheaper than what the 2.11.2 patch kept for the same purpose (a live
    WebGL context and its drawing buffer per hidden canvas).
    ```

- Upstream PR/issue: https://github.com/Shopify/react-native-skia/issues/3976 (the size reset comes from the fix for it, https://github.com/Shopify/react-native-skia/pull/4002)
- E/App issue: https://github.com/Expensify/App/issues/98254
- PR introducing patch: https://github.com/Expensify/App/pull/100714 (rebased onto 2.15.4 in the Skia 2.15.4 upgrade PR)
