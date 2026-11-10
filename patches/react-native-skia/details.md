# `react-native-skia` patches

These patches were rebased from `@shopify/react-native-skia` 2.11.2 when the App moved to `react-native-skia` 2.15.4 (the package was renamed, and `victory-native` 43 depends on the new name). Four 2.11.2 patches were dropped because 2.15.4 fixes them (a fifth, `size-backing-store-to-painted-size`, was already removed by rendering inline charts at their fitted size, https://github.com/Expensify/App/pull/106512):

- `fix-runtime-aware-cache-uaf` (Sentry APP-AVB, https://github.com/Expensify/App/issues/90135): `RuntimeAwareCache` no longer exists. Its replacement, `JSICache`, is owned by the runtime's `global` (as `NativeState`), so it is destroyed by the runtime itself while the runtime is still valid. The HybridApp teardown order can no longer free cached JSI values into a dead runtime.
- `defer-webgl-context-loss-to-unmount` (https://github.com/Expensify/App/issues/98254): a view's `<canvas>` no longer owns a WebGL context. Every view draws on one WebGL context shared by the page and copies its frame onto its own element through a 2D context, so there is no per-element context to lose. The part of that patch that kept the hidden backdrop painted lives on as `002+keep-canvas-bitmap-on-dispose`.
- `load-skia-web-fail-closed` (https://github.com/Expensify/App/issues/102042): since 2.15.4 `LoadSkiaWeb` no longer caches a failed init, and rewords a `LinkError` into a message naming the `canvaskit-wasm` version mismatch (https://github.com/wcandillon/react-native-skia/pull/4432). The check for a CanvasKit that links but comes up without its bindings was not taken as is: upstream verifies the downloaded binary against a size and SHA-256 fingerprint instead (`verifyWasm`), which is on in development only. The App serves the binary under a versioned URL (`CANVASKIT_WASM_FILENAME`), which is what prevents the mismatch in production; pass `verifyWasm: true` to `WithSkiaWeb`'s `opts` if a production safety net is wanted again.
- `redraw-texture-view-when-window-visible` (https://github.com/Expensify/App/issues/101396): fixed in 2.15.4 by https://github.com/wcandillon/react-native-skia/pull/4434, which latches the `TextureView`'s retained buffer when its window becomes visible again.

The old `fallback-to-software-surface` patch is replaced by the much smaller `001+report-surface-unavailable`: with a single shared context the per-page context limit can no longer be exhausted, so only the "no WebGL at all" case is left.

### [react-native-skia+2.15.4+001+report-surface-unavailable.patch](react-native-skia+2.15.4+001+report-surface-unavailable.patch)

- Reason:

    ```
    Keeps the "skia-surface-unavailable" contract SkiaWebChart relies on
    (useIsSkiaSurfaceUnavailable shows the "unable to display chart" empty state).

    In 2.15.4 the web renderer throws in two places when it cannot render:
    the WebGLRenderer constructor (no WebGL context: hardware acceleration
    disabled or GPU blocklisted; or no 2D context for the element), which runs
    from a layout effect, and SharedWebGLContext.acquireScreen ("Could not
    create surface"), which runs from render() and so from a ResizeObserver
    callback. The first would reach SkiaWebChart's error boundary, which shows
    "chart failed to load" and reports a CanvasKit load failure to Sentry,
    which is the wrong message and the wrong signal. The second escapes as an
    uncatchable error.

    Both now dispatch a bubbling "skia-surface-unavailable" CustomEvent on the
    canvas (a no-op without a listener) instead of throwing. The constructor
    failure leaves the view without a renderer; the render() failure keeps the
    frame, like a lost context does. The dispatch is deferred a frame because
    the renderer is built in a layout effect, which runs before the effect that
    attaches the listener.

    Unlike the 2.11.2 patch this does not fall back to a CanvasKit software
    surface. A CPU fallback fits 2.15.4 well (each view already presents its
    frame through a 2D context) and is better done upstream.
    ```

- Upstream PR/issue: https://github.com/Shopify/react-native-skia/pull/3996 (2.11.2 software fallback, not merged)
- E/App issue: https://github.com/Expensify/App/issues/97104
- PR introducing patch: https://github.com/Expensify/App/pull/97219 (rebased onto 2.15.4 in the Skia 2.15.4 upgrade PR)

### [react-native-skia+2.15.4+002+keep-canvas-bitmap-on-dispose.patch](react-native-skia+2.15.4+002+keep-canvas-bitmap-on-dispose.patch)

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
