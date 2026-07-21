# Floating Figure Popups — Design

## Purpose

Replace the permanent figure sidebar with floating, draggable, pinnable figure and table
popups based on the supplied “Research Assistant Popup States” reference. Preserve the
existing PDF reader, extraction pipeline, learning tools, citations, and selection behavior.
The Ask bar from the reference is explicitly excluded because it has no existing backend and
would be a dead affordance.

## Visual system

The PDF is the visual center: a white page column on a cool blue-gray canvas with clear left
and right margin zones for popups. A compact frosted-glass pill at the top presents the paper
title, current section/page, reading progress, outline toggle, auto-surface toggle, and dark
mode control. The permanent outline and figure rail are absent from the resting layout; the
outline may open as a temporary overlay without reducing the PDF width.

Popups use the reference’s apparatus-like glass treatment:

- translucent white surface with backdrop blur and saturation;
- 20px outer radius, white hairline border, and restrained deep shadow;
- 300–400px width selected by asset kind and crop aspect ratio;
- header containing uppercase asset label, source page, drag grip, pin toggle, and minimize;
- extracted crop displayed on an opaque white inset mat;
- caption, reverse-page links, status, and “Jump to figure/table” action;
- indigo `#3b5bdb` as the only interaction accent;
- dark mode changes the canvas and glass but never inverts or darkens figure crops.

Closed popups appear as compact chips in a centered glass dock near the bottom. Existing
learning and selection controls keep their behavior and remain visually below the popup
layer.

## State model

Each asset has one popup record:

```ts
type PopupMode = "idle" | "open" | "pinned" | "docked";

interface PopupState {
  assetId: string;
  mode: PopupMode;
  position: { x: number; y: number } | null;
  anchorMentionId: string | null;
  z: number;
}
```

- `idle`: not rendered.
- `open`: ambient popup associated with a currently active or hovered mention.
- `pinned`: persists through scrolling and virtualization.
- `docked`: represented by a chip in the closed-figure dock.

Popup position is computed on first open, replaced by user drag, and recomputed when a
docked popup is restored. Reopening an already visible popup preserves its position unless
the user selects a different reverse-link anchor and explicitly jumps there.

## Interaction model

When auto-surface is enabled, a mention activates while its hotspot lies between 10% and 82%
of the reader viewport. An idle asset opens ambiently at the first active mention. An ambient
popup returns to idle when none of its mentions remain in the activation zone. Pinned popups
never close from scrolling.

Hovering or focusing a mention opens an idle popup ambiently. Clicking a mention opens and
pins it. The pin button toggles `open` and `pinned`. Starting a drag pins the popup, raises its
z-order, and moves it by the pointer offset; coordinates are clamped at least 8px inside the
viewport. Pointer-down anywhere on a popup raises it.

Minimizing changes the mode to `docked`. Selecting a dock chip restores the popup pinned at
a newly computed collision-free position. “Jump to figure/table” scrolls the page containing
the extracted asset into view and displays a temporary indigo ring around its known bounding
box. Reverse-page chips scroll to the selected mention and update the active anchor.

All transient motion is disabled under `prefers-reduced-motion: reduce`, while opacity and
state changes remain understandable.

## Placement and collision handling

Automatic placement uses viewport coordinates and measured popup dimensions:

1. Desired vertical position is the active mention’s top minus 70px, clamped between 84px
   and `viewportHeight - popupHeight - 24px`.
2. Candidate columns are tried in this order: right margin, left margin, then inward columns
   stepping by popup width plus 16px.
3. A candidate conflicts when its horizontal range overlaps a visible popup and its vertical
   interval is within 12px of that popup.
4. For each column, try the desired position, then the nearest free position immediately
   above or below an occupied interval.
5. The first fitting column wins. Only when every column is full may placement fall back to
   the clamped desired position.

User-authored drag positions are respected and are not automatically collision-resolved.
Detached or virtualized mention nodes are normal: ambient opening is skipped when no anchor
can be measured, while pinned popups remain stable.

## Component boundaries

Production changes are limited to the reader presentation layer:

- `Reader.tsx` owns popup records, z-order, auto-surface observation, collision placement,
  top pill, dock, reading progress, outline overlay, and jump/flash coordination.
- `OverlayCard.tsx` renders popup anatomy and owns pointer-drag mechanics, pin/minimize
  controls, focus behavior, and reduced-motion-aware transitions.
- `PdfPageView.tsx` exposes stable mention IDs, hover/focus/click events, and the temporary
  extracted-asset flash region.

Pure placement and state-transition helpers may live beside these components for isolated
tests. No API, extraction, schema, PDF parsing, citation-resolution, learning, or selection
contracts change. No third-party popup, connector, or diagramming library is introduced.

## Responsive behavior

At wide desktop widths, the paper remains centered and popups prefer the margin columns. At
narrow widths where a margin cannot contain the popup, collision placement uses the opposite
or inward column while keeping the popup inside the viewport. The paper never scales below
its existing readable minimum. The top pill and dock may reduce secondary text or wrap chips,
but their primary controls remain available. Dragging always clamps the popup into the current
viewport after a resize.

## Verification

Automated coverage will verify:

- deterministic initial placement for identical mention and viewport geometry;
- collision-free automatic placement for several popups;
- viewport clamping during placement and drag;
- click-to-pin and drag-to-pin transitions;
- ambient close when all mentions leave the activation zone;
- pinned persistence when anchors unmount;
- dock, restore, reverse-link, and jump-to-figure transitions;
- reduced-motion state behavior.

Browser verification will cover the real extracted ResNet fixture: auto-surface, hover, pin,
drag, z-order, dock/restore, jump flash, dark mode, and responsive desktop/narrow layouts.
The full web test suite and production build must pass before completion.

## Explicit non-goals

- No Ask bar or generated-answer feature.
- No API, extraction, manifest, or persistence changes.
- No permanent sidebar or always-on connector layer.
- No LLM calls.
