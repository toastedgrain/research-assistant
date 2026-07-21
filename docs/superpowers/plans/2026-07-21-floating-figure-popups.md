# Floating Figure Popups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent figure rail with high-fidelity glass popups that auto-surface beside mentions, pin on click or drag, minimize to a dock, and preserve the existing PDF reader functionality.

**Architecture:** `Reader.tsx` owns the popup state machine, collision-free placement, scroll activation, z-order, dock, top pill, and jump coordination. `OverlayCard.tsx` owns the glass popup presentation and pointer drag interaction while exporting pure placement/state helpers for tests. `PdfPageView.tsx` exposes stable mention and asset DOM contracts and renders the temporary jump target ring.

**Tech Stack:** React 19 client components, Next.js 16 App Router, TypeScript, Tailwind CSS 4, pdf.js 6, Vitest 4. No new runtime dependency.

## Global Constraints

- Production edits are limited to `apps/web/components/Reader.tsx`, `apps/web/components/OverlayCard.tsx`, and `apps/web/components/PdfPageView.tsx`.
- Tests may modify `apps/web/components/OverlayCard.test.ts`.
- Do not change APIs, extraction, manifests, PDF parsing, citation resolution, learning tools, or selection contracts.
- Do not add an Ask bar, generated-answer feature, LLM call, permanent sidebar, or always-on connector.
- Preserve extracted figure crops on an opaque white background in light and dark mode.
- Ambient popups may disappear only when all of their mentions leave the active reading zone; pinned popups persist.
- Every production behavior change follows a failing-test-first cycle where it can be isolated as a pure function.

---

### Task 1: Popup state and collision placement primitives

**Files:**
- Modify: `apps/web/components/OverlayCard.tsx`
- Modify: `apps/web/components/OverlayCard.test.ts`

**Interfaces:**
- Produces: `PopupMode`, `PopupState`, `PopupRect`, `PlacementInput`, `placePopup(input): { x: number; y: number }`, `transitionPopup(popup, event): PopupState`.
- Consumes: no new application interfaces.

- [ ] **Step 1: Replace rail-layout tests with failing popup-placement tests**

```ts
import { describe, expect, it } from "vitest";
import { placePopup, transitionPopup, type PopupState } from "./OverlayCard";

describe("placePopup", () => {
  it("returns the same position for identical geometry", () => {
    const input = {
      popup: { width: 390, height: 336 },
      anchor: { left: 700, top: 420, right: 748, bottom: 438 },
      viewport: { width: 1512, height: 960 },
      occupied: [],
    };
    expect(placePopup(input)).toEqual(placePopup(input));
  });

  it("chooses a non-overlapping slot nearest the anchor", () => {
    const position = placePopup({
      popup: { width: 390, height: 336 },
      anchor: { left: 700, top: 420, right: 748, bottom: 438 },
      viewport: { width: 1512, height: 960 },
      occupied: [{ x: 1086, y: 350, width: 390, height: 336 }],
    });
    expect(position).not.toEqual({ x: 1086, y: 350 });
    expect(position.x).toBeGreaterThanOrEqual(8);
    expect(position.y).toBeGreaterThanOrEqual(84);
  });

  it("clamps placement inside the viewport", () => {
    const position = placePopup({
      popup: { width: 390, height: 336 },
      anchor: { left: 20, top: 900, right: 60, bottom: 918 },
      viewport: { width: 900, height: 700 },
      occupied: [],
    });
    expect(position.x).toBeGreaterThanOrEqual(8);
    expect(position.y + 336).toBeLessThanOrEqual(700 - 24);
  });
});

describe("transitionPopup", () => {
  const popup: PopupState = {
    assetId: "fig-1",
    mode: "open",
    position: { x: 100, y: 120 },
    anchorMentionId: "fig-1:p0:m0",
    z: 1,
  };

  it("pins on click or drag", () => {
    expect(transitionPopup(popup, { type: "pin" }).mode).toBe("pinned");
    expect(transitionPopup(popup, { type: "drag", position: { x: 180, y: 160 } }).mode).toBe("pinned");
  });

  it("moves minimized popups into the dock", () => {
    expect(transitionPopup(popup, { type: "dock" }).mode).toBe("docked");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd apps/web && npm test -- components/OverlayCard.test.ts`

Expected: FAIL because `placePopup`, `transitionPopup`, `PopupMode`, and `PopupState` do not exist.

- [ ] **Step 3: Implement the pure types, state transitions, and placement algorithm**

```ts
export type PopupMode = "idle" | "open" | "pinned" | "docked";

export interface PopupState {
  assetId: string;
  mode: PopupMode;
  position: { x: number; y: number } | null;
  anchorMentionId: string | null;
  z: number;
}

export interface PopupRect { x: number; y: number; width: number; height: number }

export interface PlacementInput {
  popup: { width: number; height: number };
  anchor: { left: number; top: number; right: number; bottom: number };
  viewport: { width: number; height: number };
  occupied: PopupRect[];
}

export type PopupEvent =
  | { type: "pin" }
  | { type: "unpin" }
  | { type: "dock" }
  | { type: "restore"; position: { x: number; y: number }; z: number }
  | { type: "drag"; position: { x: number; y: number } };

export function transitionPopup(popup: PopupState, event: PopupEvent): PopupState {
  if (event.type === "pin") return { ...popup, mode: "pinned" };
  if (event.type === "unpin") return { ...popup, mode: "open" };
  if (event.type === "dock") return { ...popup, mode: "docked" };
  if (event.type === "restore") return { ...popup, mode: "pinned", position: event.position, z: event.z };
  return { ...popup, mode: "pinned", position: event.position };
}

export function placePopup(input: PlacementInput): { x: number; y: number } {
  const { popup, anchor, viewport, occupied } = input;
  const minY = 84;
  const maxY = Math.max(minY, viewport.height - popup.height - 24);
  const desiredY = Math.max(minY, Math.min(maxY, anchor.top - 70));
  const right = viewport.width - popup.width - 36;
  const columns: number[] = [];
  for (let column = 0; column < 4; column += 1) {
    columns.push(Math.max(8, right - column * (popup.width + 16)));
    columns.push(Math.min(right, 36 + column * (popup.width + 16)));
  }
  const conflicts = (x: number, y: number) => occupied.some((rect) =>
    x < rect.x + rect.width + 12 &&
    x + popup.width + 12 > rect.x &&
    y < rect.y + rect.height + 12 &&
    y + popup.height + 12 > rect.y,
  );
  for (const x of columns) {
    const candidates = [desiredY, ...occupied.flatMap((rect) => [rect.y + rect.height + 12, rect.y - popup.height - 12])]
      .filter((y) => y >= minY && y <= maxY)
      .sort((a, b) => Math.abs(a - desiredY) - Math.abs(b - desiredY));
    const y = candidates.find((candidate) => !conflicts(x, candidate));
    if (y !== undefined) return { x, y };
  }
  return { x: Math.max(8, right), y: desiredY };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd apps/web && npm test -- components/OverlayCard.test.ts`

Expected: all placement and transition tests PASS.

- [ ] **Step 5: Commit the primitives**

```bash
git add apps/web/components/OverlayCard.tsx apps/web/components/OverlayCard.test.ts
git commit -m "Add floating popup state and placement"
```

---

### Task 2: Mention and figure-region DOM contracts

**Files:**
- Modify: `apps/web/components/PdfPageView.tsx`
- Modify: `apps/web/components/Reader.tsx`

**Interfaces:**
- Produces: `onOpenAsset(assetId, mentionId, pin)`, `onMentionActivity(assetId, mentionId, active)`, stable `data-mention-id`, `data-mention-asset`, `data-asset-region`, and `flashAssetId`.
- Consumes: existing `Mention`, `BBox`, and extracted asset geometry from the manifest.

- [ ] **Step 1: Add stable mention event props and asset flash props**

Update `PdfPageView`’s props to this exact contract:

```ts
interface Props {
  doc: PDFDocumentProxy;
  pageIndex: number;
  width: number;
  active: boolean;
  dark: boolean;
  mentions: Mention[];
  citations: Citation[];
  textItems: PageTextItem[];
  onOpenAsset: (assetId: string, mentionId: string, pin: boolean) => void;
  onMentionActivity: (assetId: string, mentionId: string, active: boolean) => void;
  onOpenCitation: (citation: Citation) => void;
  onTextSelection: (selection: CapturedSelection) => void;
  highlightedAssetId: string | null;
  flashAssetId: string | null;
  assetRegions: Array<{ assetId: string; bbox: BBox }>;
  evidenceBBox?: BBox;
}
```

- [ ] **Step 2: Replace rail-era mention handlers with hover/focus/click contracts**

```tsx
const mentionId = `${mention.assetId}:p${pageIndex}:m${mention.index}`;

<button
  data-mention-id={mentionId}
  data-mention-asset={mention.assetId as string}
  type="button"
  title={`Open ${mention.text}`}
  onMouseEnter={() => onMentionActivity(mention.assetId as string, mentionId, true)}
  onMouseLeave={() => onMentionActivity(mention.assetId as string, mentionId, false)}
  onFocus={() => onMentionActivity(mention.assetId as string, mentionId, true)}
  onBlur={() => onMentionActivity(mention.assetId as string, mentionId, false)}
  onClick={() => onOpenAsset(mention.assetId as string, mentionId, true)}
  className="absolute z-30 cursor-pointer rounded-t border-b-2 border-indigo-500/55 bg-indigo-500/10 text-indigo-700 transition-colors hover:bg-indigo-500/20"
  style={mentionStyle}
/>
```

- [ ] **Step 3: Render extracted asset flash targets without adding interaction**

```tsx
{assetRegions.map((region) => (
  <div
    key={region.assetId}
    data-asset-region={region.assetId}
    aria-hidden="true"
    className={`pointer-events-none absolute z-20 rounded-xl transition-shadow duration-500 ${
      flashAssetId === region.assetId ? "shadow-[0_0_0_4px_rgba(59,91,219,0.35)]" : "shadow-none"
    }`}
    style={{
      left: `${region.bbox[0] * 100}%`,
      top: `${region.bbox[1] * 100}%`,
      width: `${(region.bbox[2] - region.bbox[0]) * 100}%`,
      height: `${(region.bbox[3] - region.bbox[1]) * 100}%`,
    }}
  />
))}
```

- [ ] **Step 4: Wire the new props in `Reader.tsx` with explicit temporary handlers**

Add these two temporary callbacks before the page render. They keep this intermediate commit
type-safe and are replaced by the real controller in Task 4:

```ts
const openPopup = useCallback((_assetId: string, _mentionId: string | null, _pin: boolean) => {}, []);
const handleMentionActivity = useCallback(
  (_assetId: string, _mentionId: string, _active: boolean) => {},
  [],
);
const flashAssetId: string | null = null;
```

```tsx
<PdfPageView
  {...existingProps}
  onOpenAsset={(assetId, mentionId) => openPopup(assetId, mentionId, true)}
  onMentionActivity={(assetId, mentionId, active) => handleMentionActivity(assetId, mentionId, active)}
  flashAssetId={flashAssetId}
  assetRegions={manifest.assets
    .filter((asset) => asset.page === index)
    .map((asset) => ({ assetId: asset.asset_id, bbox: asset.bbox }))}
/>
```

- [ ] **Step 5: Verify type safety and commit**

Run: `cd apps/web && npx tsc --noEmit`

Expected: exit code 0.

```bash
git add apps/web/components/PdfPageView.tsx apps/web/components/Reader.tsx
git commit -m "Expose popup mention and figure anchors"
```

---

### Task 3: Glass popup component and drag interaction

**Files:**
- Modify: `apps/web/components/OverlayCard.tsx`

**Interfaces:**
- Consumes: `PopupState`, `Asset`, `Mention[]`, `onMove`, `onPin`, `onDock`, `onRaise`, `onJumpToAsset`, `onJumpToMention`.
- Produces: a fixed-position popup with `data-popup-asset`, measured size, drag-to-pin, and the approved glass anatomy.

- [ ] **Step 1: Replace the rail-card prop contract**

```ts
interface Props {
  asset: Asset;
  popup: PopupState;
  mentions: Mention[];
  currentPage: number;
  onMove: (position: { x: number; y: number }) => void;
  onPin: (pinned: boolean) => void;
  onDock: () => void;
  onRaise: () => void;
  onJumpToAsset: () => void;
  onJumpToMention: (mention: Mention) => void;
}
```

- [ ] **Step 2: Implement pointer drag with viewport clamping**

```ts
const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);

const onPointerDown = (event: React.PointerEvent) => {
  if (!popup.position) return;
  onRaise();
  drag.current = {
    pointerId: event.pointerId,
    dx: event.clientX - popup.position.x,
    dy: event.clientY - popup.position.y,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
};

const onPointerMove = (event: React.PointerEvent) => {
  if (!drag.current || drag.current.pointerId !== event.pointerId) return;
  const bounds = rootRef.current?.getBoundingClientRect();
  const width = bounds?.width ?? 390;
  const height = bounds?.height ?? 336;
  onMove({
    x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - drag.current.dx)),
    y: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - drag.current.dy)),
  });
};
```

- [ ] **Step 3: Implement the approved popup anatomy**

Use these exact visual tokens on the root:

```tsx
<article
  ref={rootRef}
  data-popup-asset={asset.asset_id}
  className="fixed overflow-hidden rounded-[20px] border border-white/95 bg-white/70 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-[28px] backdrop-saturate-[1.6] dark:border-white/15 dark:bg-slate-900/75"
  style={{
    left: popup.position?.x ?? 0,
    top: popup.position?.y ?? 84,
    width: asset.kind === "table" ? 340 : 390,
    zIndex: popup.z,
  }}
  onPointerDown={onRaise}
>
```

Header requirements:

```tsx
<header
  className="flex cursor-grab touch-none select-none items-center gap-2 px-[18px] pb-2 pt-3 active:cursor-grabbing"
  onPointerDown={onPointerDown}
  onPointerMove={onPointerMove}
  onPointerUp={() => { drag.current = null; }}
  onPointerCancel={() => { drag.current = null; }}
>
  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3b5bdb]">{asset.label}</span>
  <span className="text-[11px] text-slate-400">· page {asset.page + 1}</span>
  <span className="flex flex-1 justify-center gap-[3px] opacity-35" aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => <i key={index} className="h-[3px] w-[3px] rounded-full bg-slate-900 dark:bg-white" />)}
  </span>
  <button type="button" aria-pressed={popup.mode === "pinned"} onClick={() => onPin(popup.mode !== "pinned")} className="grid h-[26px] w-[26px] place-items-center rounded-lg text-slate-500 hover:bg-slate-900/5 aria-pressed:bg-[#3b5bdb] aria-pressed:text-white">⌖</button>
  <button type="button" onClick={onDock} aria-label={`Minimize ${asset.label}`} className="grid h-[26px] w-[26px] place-items-center rounded-lg text-slate-500 hover:bg-slate-900/5">−</button>
</header>
```

Use an opaque `bg-white`, 12px-radius inset for the crop; 12.5px/1.55 caption text; a pill-shaped jump action; reverse-page links; and status copy exactly `Pinned` or `Auto · fades on scroll`. Do not render the Ask bar.

- [ ] **Step 4: Run type checking and the focused component tests**

Run:

```bash
cd apps/web
npx tsc --noEmit
npm test -- components/OverlayCard.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the popup component**

```bash
git add apps/web/components/OverlayCard.tsx
git commit -m "Build draggable glass figure popup"
```

---

### Task 4: Reader popup controller and ambient activation

**Files:**
- Modify: `apps/web/components/Reader.tsx`
- Modify: `apps/web/components/OverlayCard.test.ts`

**Interfaces:**
- Consumes: `PopupState`, `placePopup`, `transitionPopup`, mention and asset DOM data attributes.
- Produces: `openPopup`, `handleMentionActivity`, `dockPopup`, `restorePopup`, `jumpToAsset`, collision-free state updates, and scroll auto-surface.

- [ ] **Step 1: Add a failing pure activation-zone test**

```ts
import { isMentionActive } from "./OverlayCard";

it("activates mentions only within the 10% to 82% reading zone", () => {
  expect(isMentionActive({ top: 200 }, 1000)).toBe(true);
  expect(isMentionActive({ top: 50 }, 1000)).toBe(false);
  expect(isMentionActive({ top: 900 }, 1000)).toBe(false);
});
```

Run: `cd apps/web && npm test -- components/OverlayCard.test.ts`

Expected: FAIL because `isMentionActive` does not exist.

- [ ] **Step 2: Implement and verify the activation helper**

```ts
export function isMentionActive(rect: Pick<DOMRect, "top">, viewportHeight: number): boolean {
  return rect.top > viewportHeight * 0.1 && rect.top < viewportHeight * 0.82;
}
```

Run: `cd apps/web && npm test -- components/OverlayCard.test.ts`

Expected: PASS.

- [ ] **Step 3: Replace rail state with popup state and z-order**

```ts
const [popups, setPopups] = useState<Record<string, PopupState>>({});
const [autoSurface, setAutoSurface] = useState(true);
const [flashAssetId, setFlashAssetId] = useState<string | null>(null);
const [progress, setProgress] = useState(0);
const [currentSection, setCurrentSection] = useState("");
const zCounter = useRef(100);
```

Delete rail positions, rail visibility, rail measurement frames, compact sheets, rail refs,
and all `layoutRail` calls.

- [ ] **Step 4: Implement popup opening and collision placement**

```ts
const openPopup = useCallback((assetId: string, mentionId: string | null, pin: boolean) => {
  const anchor = mentionId
    ? scrollRef.current?.querySelector<HTMLElement>(`[data-mention-id="${CSS.escape(mentionId)}"]`)
    : scrollRef.current?.querySelector<HTMLElement>(`[data-mention-asset="${CSS.escape(assetId)}"]`);
  const anchorRect = anchor?.getBoundingClientRect();
  if (!anchorRect) return;
  setPopups((previous) => {
    const occupied = Object.values(previous)
      .filter((popup) => popup.assetId !== assetId && (popup.mode === "open" || popup.mode === "pinned") && popup.position)
      .map((popup) => ({ x: popup.position!.x, y: popup.position!.y, width: 390, height: 336 }));
    const existing = previous[assetId];
    const position = existing?.position ?? placePopup({
      popup: { width: 390, height: 336 },
      anchor: anchorRect,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      occupied,
    });
    return {
      ...previous,
      [assetId]: {
        assetId,
        mode: pin ? "pinned" : existing?.mode === "pinned" ? "pinned" : "open",
        position,
        anchorMentionId: mentionId,
        z: ++zCounter.current,
      },
    };
  });
}, []);

const handleMentionActivity = useCallback((assetId: string, mentionId: string, active: boolean) => {
  if (active) openPopup(assetId, mentionId, false);
}, [openPopup]);
```

Hover and focus may open an ambient popup, but leaving a mention does not close it directly;
the scroll-zone pass in Step 5 is the single owner of ambient dismissal.

- [ ] **Step 5: Implement rAF-throttled scroll activation, progress, and section updates**

On each reader scroll frame:

```ts
const viewportHeight = scroll.clientHeight;
const mentions = Array.from(scroll.querySelectorAll<HTMLElement>("[data-mention-id]"));
const activeByAsset = new Map<string, HTMLElement>();
for (const mention of mentions) {
  const assetId = mention.dataset.mentionAsset;
  if (assetId && isMentionActive(mention.getBoundingClientRect(), viewportHeight)) {
    if (!activeByAsset.has(assetId)) activeByAsset.set(assetId, mention);
  }
}
if (autoSurface) {
  for (const [assetId, mention] of activeByAsset) {
    openPopup(assetId, mention.dataset.mentionId ?? null, false);
  }
}
setPopups((current) => Object.fromEntries(Object.entries(current).map(([assetId, popup]) => [
  assetId,
  popup.mode === "open" && !activeByAsset.has(assetId) ? { ...popup, mode: "idle" } : popup,
])));
setProgress(scroll.scrollTop / Math.max(1, scroll.scrollHeight - scroll.clientHeight));
```

Determine `currentSection` from the last manifest section whose page is less than or equal to
`currentPage`. Schedule through one dirty-only `requestAnimationFrame`; clear its ref after
execution and in cleanup to remain safe under React Strict Mode.

- [ ] **Step 6: Implement drag, pin, dock, restore, and z-order handlers**

```ts
const updatePopup = (assetId: string, event: PopupEvent) =>
  setPopups((current) => ({ ...current, [assetId]: transitionPopup(current[assetId], event) }));

const raisePopup = (assetId: string) =>
  setPopups((current) => ({
    ...current,
    [assetId]: { ...current[assetId], z: ++zCounter.current },
  }));

const restorePopup = (assetId: string) => {
  const mention = scrollRef.current?.querySelector<HTMLElement>(`[data-mention-asset="${CSS.escape(assetId)}"]`);
  if (!mention) return;
  const current = popups[assetId];
  const position = placePopup({
    popup: { width: 390, height: 336 },
    anchor: mention.getBoundingClientRect(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    occupied: visiblePopupRects(popups, assetId),
  });
  updatePopup(assetId, { type: "restore", position, z: ++zCounter.current });
};
```

Define the occupied geometry from the rendered popup elements so collision placement uses
actual card sizes instead of estimates:

```ts
const visiblePopupRects = (state: Record<string, PopupState>, exceptAssetId: string): PopupRect[] =>
  Object.values(state).flatMap((popup) => {
    if (popup.assetId === exceptAssetId || (popup.mode !== "open" && popup.mode !== "pinned")) return [];
    const element = document.querySelector<HTMLElement>(
      `[data-popup-asset="${CSS.escape(popup.assetId)}"]`,
    );
    const rect = element?.getBoundingClientRect();
    if (rect) return [{ x: rect.left, y: rect.top, width: rect.width, height: rect.height }];
    if (!popup.position) return [];
    return [{ x: popup.position.x, y: popup.position.y, width: 390, height: 336 }];
  });
```

- [ ] **Step 7: Implement jump-to-asset and reverse-link navigation**

```ts
const jumpToAsset = (assetId: string) => {
  const asset = assetsById.get(assetId);
  if (!asset) return;
  scrollToPage(asset.page);
  window.requestAnimationFrame(() => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-asset-region="${CSS.escape(assetId)}"]`);
    const container = scrollRef.current;
    if (target && container) {
      const root = container.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      container.scrollTo({ top: container.scrollTop + rect.top - root.top - 140, behavior: "smooth" });
    }
    setFlashAssetId(assetId);
    window.setTimeout(() => setFlashAssetId(null), 1600);
  });
};
```

- [ ] **Step 8: Render visible popups and commit the controller**

Render only `mode === "open" || mode === "pinned"`. Pass actual reverse-index mentions to
each `OverlayCard`. Render dock chips for `mode === "docked"`.

Run:

```bash
cd apps/web
npx tsc --noEmit
npm test -- components/OverlayCard.test.ts
```

Expected: both commands exit 0.

```bash
git add apps/web/components/Reader.tsx apps/web/components/OverlayCard.test.ts
git commit -m "Add ambient floating popup controller"
```

---

### Task 5: Centered reader canvas, top pill, outline overlay, and dock

**Files:**
- Modify: `apps/web/components/Reader.tsx`

**Interfaces:**
- Consumes: popup controller state from Task 4 and existing manifest/current-page data.
- Produces: the approved centered page layout, glass top pill, temporary outline, and closed-figure dock.

- [ ] **Step 1: Replace the three-column rail grid with the centered canvas**

```tsx
<div className={`relative h-screen overflow-hidden font-sans ${dark ? "dark bg-slate-950 text-slate-100" : "bg-[linear-gradient(160deg,#f4f6fb_0%,#eef1f8_45%,#e8ecf5_100%)] text-slate-900"}`}>
  <div ref={scrollRef} className="h-full overflow-y-auto px-6 pb-28 pt-[88px]">
    <main className="mx-auto w-fit">
      {pages}
    </main>
  </div>
</div>
```

Delete the permanent figure rail, thumbnail strip, sheet state, rail hairline, and grid-width
calculations. Keep the PDF page width capped at 760px and preserve virtualization.

- [ ] **Step 2: Build the top glass pill from existing controls**

```tsx
<header className="fixed left-1/2 top-[22px] z-[220] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/90 bg-white/65 px-[18px] py-2 shadow-[0_8px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/15 dark:bg-slate-900/70">
  <span className="h-2 w-2 rounded-full bg-[#3b5bdb]" />
  <h1 className="max-w-[360px] truncate text-[13px] font-semibold">{manifest.title || "Untitled paper"}</h1>
  <span className="text-xs text-slate-400">{currentSection}</span>
  <span className="h-4 w-px bg-slate-900/10 dark:bg-white/10" />
  <span className="text-xs text-slate-500">p. {currentPage + 1} / {manifest.page_count}</span>
  <span className="relative h-1 w-[72px] overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
    <span className="absolute inset-y-0 left-0 rounded-full bg-[#3b5bdb]" style={{ width: `${Math.max(4, progress * 100)}%` }} />
  </span>
  <button type="button" onClick={() => setOutlineOpen((open) => !open)} aria-label="Toggle outline">☰</button>
  <label className="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={autoSurface} onChange={(event) => setAutoSurface(event.target.checked)} /> auto</label>
  <button type="button" onClick={() => setDark((value) => !value)} aria-label="Toggle dark mode">{dark ? "☀" : "☾"}</button>
</header>
```

- [ ] **Step 3: Convert the outline into a temporary glass overlay**

Render the existing section and asset buttons inside a fixed panel at `left: 24px; top: 84px;
bottom: 24px; width: 240px`, with the same glass recipe. Do not change section navigation or
asset opening behavior. Close it after a navigation action on viewports narrower than 1100px.

- [ ] **Step 4: Render the closed-popup dock**

```tsx
{dockedPopups.length > 0 && (
  <div className="fixed bottom-6 left-1/2 z-[210] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/90 bg-white/60 px-3 py-2 shadow-[0_10px_34px_rgba(15,23,42,0.14)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/15 dark:bg-slate-900/70">
    <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Closed</span>
    {dockedPopups.map((popup) => (
      <button key={popup.assetId} type="button" onClick={() => restorePopup(popup.assetId)} className="rounded-full border border-[#3b5bdb]/20 bg-[#3b5bdb]/10 px-3 py-1 text-[12.5px] font-semibold text-[#2f4ac2] hover:bg-[#3b5bdb]/20">
        {assetsById.get(popup.assetId)?.label}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify responsive layout and commit**

Run: `cd apps/web && npx tsc --noEmit`

Expected: exit code 0.

Manually verify widths 1512px, 1280px, and 900px: the paper remains readable, the top pill
does not cover the PDF, popups remain within the viewport, and the dock does not cover page
content.

```bash
git add apps/web/components/Reader.tsx
git commit -m "Restyle reader around floating popups"
```

---

### Task 6: Full behavioral and visual verification

**Files:**
- Modify only if a failing verification requires a scoped correction:
  `apps/web/components/Reader.tsx`, `apps/web/components/OverlayCard.tsx`,
  `apps/web/components/PdfPageView.tsx`, `apps/web/components/OverlayCard.test.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified, reviewable floating-popup reader.

- [ ] **Step 1: Run the full automated test suite**

Run: `cd apps/web && npm test`

Expected: all test files PASS with zero failures.

- [ ] **Step 2: Run the production build**

Run: `cd apps/web && npm run build`

Expected: Next.js compilation, TypeScript checking, page-data collection, and static-page
generation complete with exit code 0.

- [ ] **Step 3: Verify the real ResNet fixture in the browser**

Open:

`http://localhost:3000/read/1e0651b6810ecba34a3dbc5b5b0209226f889004607c1f203540a48d64e5a93a`

Verify in this order:

1. A visible `Fig. 1` mention auto-surfaces one ambient popup.
2. Scrolling that mention out of the active zone removes the ambient popup.
3. Clicking a mention pins the popup and it survives scrolling.
4. Dragging moves and pins the popup while keeping it at least 8px inside viewport edges.
5. Opening two more assets produces no automatic overlap.
6. Pin toggle returns the popup to ambient behavior.
7. Minimize creates a dock chip; the chip restores the popup pinned.
8. Jump-to-figure positions the extracted region 140px below the reader top and rings it.
9. A reverse-page chip navigates to the correct mention.
10. Dark mode leaves the extracted crop white and legible.
11. No Ask bar, permanent sidebar, or always-on connector is present.

- [ ] **Step 4: Capture review screenshots**

Capture the reader at 1512×960 with one ambient popup, at 1512×960 with three pinned popups
and one dock chip, and at 900×900 with one pinned popup. Confirm the glass hierarchy matches
the supplied reference and the PDF remains the visual center.

- [ ] **Step 5: Inspect the final diff and commit corrections**

Run:

```bash
git diff --check
git status --short
git diff --stat main...HEAD
```

Expected: no whitespace errors; production changes remain confined to the three approved
reader components; test and design/plan documents are the only additional files.

If verification required corrections, commit them:

```bash
git add apps/web/components/Reader.tsx apps/web/components/OverlayCard.tsx apps/web/components/PdfPageView.tsx apps/web/components/OverlayCard.test.ts
git commit -m "Polish floating popup interactions"
```
