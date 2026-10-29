import {
  clampPreviewSplitRatio,
  defaultPreviewSplitRatio,
  previewSplitRatioAt,
  scrollbarGeometry,
  scrollTopFromThumbTop,
} from './editorViewport';

interface ScrollbarControls {
  track: HTMLDivElement;
  thumb: HTMLDivElement;
  horizontalTrack: HTMLDivElement;
  horizontalThumb: HTMLDivElement;
  target: HTMLElement;
  onScroll: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onHorizontalKeyDown: (event: KeyboardEvent) => void;
}

const scrollbarTrackWidth = 14;

function isVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && element.clientWidth > 0 && element.clientHeight > 0;
}

function isScrollable(element: HTMLElement): boolean {
  if (!isVisible(element)) return false;
  const style = window.getComputedStyle(element);
  const allows = (value: string) => value === 'auto' || value === 'scroll' || value === 'overlay';
  const scrollableY = element.scrollHeight > element.clientHeight + 1 && allows(style.overflowY);
  const scrollableX = element.scrollWidth > element.clientWidth + 1 && allows(style.overflowX);
  return scrollableY || scrollableX;
}

export class EditorViewportController {
  private readonly host: HTMLElement;
  private readonly splitter: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private readonly scrollbars = new Map<HTMLElement, ScrollbarControls>();
  private splitActive = false;
  private splitRatio = defaultPreviewSplitRatio;
  private savedEditorFlex = '';
  private savedEditorMinWidth = '';
  private savedPreviewFlex = '';
  private savedPreviewMinWidth = '';
  private draggingSplit = false;
  private refreshFrame: number | null = null;
  private destroyed = false;

  constructor(host: HTMLElement) {
    this.host = host;
    this.splitter = document.createElement('div');
    this.splitter.className = 'puff-preview-splitter';
    this.splitter.tabIndex = 0;
    this.splitter.setAttribute('role', 'separator');
    this.splitter.setAttribute('aria-orientation', 'vertical');
    this.splitter.setAttribute('aria-label', '調整編輯器與預覽寬度');
    this.splitter.innerHTML = '<span aria-hidden="true"></span>';
    this.bindSplitterEvents();
    this.resizeObserver = new ResizeObserver(() => this.schedule());
    this.resizeObserver.observe(host);
    this.mutationObserver = new MutationObserver(() => this.schedule());
    const content = this.contentElement();
    if (content) {
      this.mutationObserver.observe(content, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true,
      });
    }
    window.addEventListener('resize', this.schedule);
  }

  start() {
    this.schedule();
  }

  refresh = () => {
    this.refreshFrame = null;
    if (this.destroyed) return;
    const content = this.contentElement();
    if (!content) return;
    this.syncSplitter(content);
    this.syncScrollbars(content);
  };

  schedule = () => {
    if (this.destroyed || this.refreshFrame !== null) return;
    this.refreshFrame = window.requestAnimationFrame(this.refresh);
  };

  destroy() {
    this.destroyed = true;
    if (this.refreshFrame !== null) window.cancelAnimationFrame(this.refreshFrame);
    window.removeEventListener('resize', this.schedule);
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    this.restoreSplitter();
    this.splitter.remove();
    for (const target of [...this.scrollbars.keys()]) this.removeScrollbar(target);
    document.body.classList.remove('editor-splitter-dragging');
    document.body.classList.remove('editor-scrollbar-dragging');
  }

  private contentElement(): HTMLElement | null {
    return this.host.querySelector<HTMLElement>('.vditor-content');
  }

  private syncSplitter(content: HTMLElement) {
    const editorPane = content.querySelector<HTMLElement>(
      '.puff-codemirror-source.is-visible, .vditor-sv',
    );
    const preview = content.querySelector<HTMLElement>('.vditor-preview');
    const active = !!editorPane && !!preview && isVisible(editorPane) && isVisible(preview);
    if (!active) {
      this.restoreSplitter();
      return;
    }
    if (!this.splitActive) {
      this.splitActive = true;
      this.splitRatio = defaultPreviewSplitRatio;
      this.savedEditorFlex = editorPane.style.flex;
      this.savedEditorMinWidth = editorPane.style.minWidth;
      this.savedPreviewFlex = preview.style.flex;
      this.savedPreviewMinWidth = preview.style.minWidth;
    }
    if (!this.splitter.isConnected) content.insertBefore(this.splitter, preview);
    if (editorPane.style.minWidth !== '0') editorPane.style.minWidth = '0';
    if (editorPane.style.flex !== '1 1 0') editorPane.style.flex = '1 1 0';
    if (preview.style.minWidth !== '0') preview.style.minWidth = '0';
    this.applySplitRatio(content.clientWidth);
  }

  private applySplitRatio(contentWidth: number) {
    const content = this.contentElement();
    const preview = content?.querySelector<HTMLElement>('.vditor-preview');
    if (!content || !preview) return;
    const usableWidth = Math.max(0, contentWidth - this.splitter.offsetWidth);
    this.splitRatio = clampPreviewSplitRatio(this.splitRatio, usableWidth);
    const flex = `0 0 ${Math.round(usableWidth * this.splitRatio)}px`;
    if (preview.style.flex !== flex) preview.style.flex = flex;
    this.splitter.setAttribute('aria-valuemin', '25');
    this.splitter.setAttribute('aria-valuemax', '75');
    this.splitter.setAttribute('aria-valuenow', String(Math.round(this.splitRatio * 100)));
  }

  private restoreSplitter() {
    if (!this.splitActive) return;
    const content = this.contentElement();
    const editorPane = content?.querySelector<HTMLElement>(
      '.puff-codemirror-source, .vditor-sv',
    );
    const preview = content?.querySelector<HTMLElement>('.vditor-preview');
    if (editorPane) {
      editorPane.style.flex = this.savedEditorFlex;
      editorPane.style.minWidth = this.savedEditorMinWidth;
    }
    if (preview) {
      preview.style.flex = this.savedPreviewFlex;
      preview.style.minWidth = this.savedPreviewMinWidth;
    }
    this.splitter.remove();
    this.splitActive = false;
    this.splitRatio = defaultPreviewSplitRatio;
  }

  private bindSplitterEvents() {
    const applyAt = (clientX: number) => {
      const content = this.contentElement();
      if (!content) return;
      const usableWidth = Math.max(0, content.clientWidth - this.splitter.offsetWidth);
      const rect = content.getBoundingClientRect();
      this.splitRatio = previewSplitRatioAt(clientX, rect.left, usableWidth);
      this.applySplitRatio(content.clientWidth);
      this.schedule();
    };
    this.splitter.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.draggingSplit = true;
      this.splitter.classList.add('is-dragging');
      this.splitter.setPointerCapture(event.pointerId);
      document.body.classList.add('editor-splitter-dragging');
      applyAt(event.clientX);
    });
    this.splitter.addEventListener('pointermove', (event) => {
      if (!this.draggingSplit) return;
      applyAt(event.clientX);
    });
    const finish = (event: PointerEvent) => {
      if (!this.draggingSplit) return;
      this.draggingSplit = false;
      this.splitter.classList.remove('is-dragging');
      document.body.classList.remove('editor-splitter-dragging');
      if (this.splitter.hasPointerCapture(event.pointerId)) {
        this.splitter.releasePointerCapture(event.pointerId);
      }
    };
    this.splitter.addEventListener('pointerup', finish);
    this.splitter.addEventListener('pointercancel', finish);
    this.splitter.addEventListener('dblclick', () => {
      this.splitRatio = defaultPreviewSplitRatio;
      const content = this.contentElement();
      if (content) this.applySplitRatio(content.clientWidth);
      this.schedule();
    });
    this.splitter.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Home') {
        event.preventDefault();
        this.splitRatio = defaultPreviewSplitRatio;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const change = event.shiftKey ? 0.1 : 0.02;
        this.splitRatio += event.key === 'ArrowLeft' ? change : -change;
      } else {
        return;
      }
      const content = this.contentElement();
      if (content) this.applySplitRatio(content.clientWidth);
      this.schedule();
    });
  }

  private scrollTargets(content: HTMLElement): HTMLElement[] {
    const candidates = Array.from(content.querySelectorAll<HTMLElement>(
      '.puff-codemirror-source .cm-scroller, .vditor-sv, .vditor-ir, .vditor-ir pre, .vditor-wysiwyg pre.vditor-reset, .vditor-preview',
    ));
    return candidates.filter((element, index) =>
      candidates.indexOf(element) === index && isScrollable(element));
  }

  private syncScrollbars(content: HTMLElement) {
    const active = new Set(this.scrollTargets(content));
    for (const target of active) {
      if (!this.scrollbars.has(target)) this.addScrollbar(target);
      this.updateScrollbar(target);
    }
    for (const target of [...this.scrollbars.keys()]) {
      if (!active.has(target)) this.removeScrollbar(target);
    }
  }

  private addScrollbar(target: HTMLElement) {
    const track = document.createElement('div');
    track.className = 'puff-editor-scrollbar';
    track.tabIndex = 0;
    track.setAttribute('role', 'scrollbar');
    track.setAttribute('aria-orientation', 'vertical');
    track.setAttribute('aria-label', '捲動 Vditor 內容');
    const thumb = document.createElement('div');
    thumb.className = 'puff-editor-scrollbar-thumb';
    track.appendChild(thumb);
    this.host.appendChild(track);
    target.classList.add('puff-overlay-scroll-target');
    this.resizeObserver.observe(target);
    const onScroll = () => this.updateScrollbar(target);
    target.addEventListener('scroll', onScroll, { passive: true });

    let dragStartY = 0;
    let dragStartThumb = 0;
    let dragging = false;
    const setFromThumb = (thumbTop: number) => {
      const geometry = scrollbarGeometry(0, target.scrollHeight, target.clientHeight, track.clientHeight);
      target.scrollTop = scrollTopFromThumbTop(
        thumbTop,
        geometry.thumbHeight,
        target.scrollHeight,
        target.clientHeight,
        track.clientHeight,
      );
      this.updateScrollbar(target);
    };
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const geometry = scrollbarGeometry(
        target.scrollTop,
        target.scrollHeight,
        target.clientHeight,
        track.clientHeight,
      );
      const trackRect = track.getBoundingClientRect();
      const y = event.clientY - trackRect.top;
      const clickedThumb = y >= geometry.thumbTop && y <= geometry.thumbTop + geometry.thumbHeight;
      dragStartThumb = clickedThumb
        ? geometry.thumbTop
        : Math.max(0, Math.min(geometry.maximumThumbTop, y - geometry.thumbHeight / 2));
      if (!clickedThumb) setFromThumb(dragStartThumb);
      dragStartY = event.clientY;
      dragging = true;
      track.classList.add('is-dragging');
      document.body.classList.add('editor-scrollbar-dragging');
      track.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      setFromThumb(dragStartThumb + event.clientY - dragStartY);
    };
    const finishDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      document.body.classList.remove('editor-scrollbar-dragging');
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      let next = target.scrollTop;
      if (event.key === 'ArrowUp') next -= 44;
      else if (event.key === 'ArrowDown') next += 44;
      else if (event.key === 'PageUp') next -= target.clientHeight * 0.9;
      else if (event.key === 'PageDown') next += target.clientHeight * 0.9;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = target.scrollHeight;
      else return;
      event.preventDefault();
      target.scrollTop = next;
    };
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', finishDrag);
    track.addEventListener('pointercancel', finishDrag);
    track.addEventListener('keydown', onKeyDown);

    const horizontalTrack = document.createElement('div');
    horizontalTrack.className = 'puff-editor-scrollbar is-horizontal';
    horizontalTrack.tabIndex = 0;
    horizontalTrack.setAttribute('role', 'scrollbar');
    horizontalTrack.setAttribute('aria-orientation', 'horizontal');
    horizontalTrack.setAttribute('aria-label', '水平捲動編輯區內容');
    horizontalTrack.hidden = true;
    const horizontalThumb = document.createElement('div');
    horizontalThumb.className = 'puff-editor-scrollbar-thumb';
    horizontalTrack.appendChild(horizontalThumb);
    this.host.appendChild(horizontalTrack);

    let dragStartX = 0;
    let dragStartThumbX = 0;
    let draggingX = false;
    const setFromThumbX = (thumbLeft: number) => {
      const geometry = scrollbarGeometry(
        0,
        target.scrollWidth,
        target.clientWidth,
        horizontalTrack.clientWidth,
      );
      target.scrollLeft = scrollTopFromThumbTop(
        thumbLeft,
        geometry.thumbHeight,
        target.scrollWidth,
        target.clientWidth,
        horizontalTrack.clientWidth,
      );
      this.updateScrollbar(target);
    };
    const onHorizontalPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const geometry = scrollbarGeometry(
        target.scrollLeft,
        target.scrollWidth,
        target.clientWidth,
        horizontalTrack.clientWidth,
      );
      const trackRect = horizontalTrack.getBoundingClientRect();
      const x = event.clientX - trackRect.left;
      const clickedThumb = x >= geometry.thumbTop && x <= geometry.thumbTop + geometry.thumbHeight;
      dragStartThumbX = clickedThumb
        ? geometry.thumbTop
        : Math.max(0, Math.min(geometry.maximumThumbTop, x - geometry.thumbHeight / 2));
      if (!clickedThumb) setFromThumbX(dragStartThumbX);
      dragStartX = event.clientX;
      draggingX = true;
      horizontalTrack.classList.add('is-dragging');
      document.body.classList.add('editor-scrollbar-dragging', 'editor-scrollbar-dragging-x');
      horizontalTrack.setPointerCapture(event.pointerId);
    };
    const onHorizontalPointerMove = (event: PointerEvent) => {
      if (!draggingX) return;
      setFromThumbX(dragStartThumbX + event.clientX - dragStartX);
    };
    const finishHorizontalDrag = (event: PointerEvent) => {
      if (!draggingX) return;
      draggingX = false;
      horizontalTrack.classList.remove('is-dragging');
      document.body.classList.remove('editor-scrollbar-dragging', 'editor-scrollbar-dragging-x');
      if (horizontalTrack.hasPointerCapture(event.pointerId)) {
        horizontalTrack.releasePointerCapture(event.pointerId);
      }
    };
    const onHorizontalKeyDown = (event: KeyboardEvent) => {
      let next = target.scrollLeft;
      if (event.key === 'ArrowLeft') next -= 60;
      else if (event.key === 'ArrowRight') next += 60;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = target.scrollWidth;
      else return;
      event.preventDefault();
      target.scrollLeft = next;
    };
    horizontalTrack.addEventListener('pointerdown', onHorizontalPointerDown);
    horizontalTrack.addEventListener('pointermove', onHorizontalPointerMove);
    horizontalTrack.addEventListener('pointerup', finishHorizontalDrag);
    horizontalTrack.addEventListener('pointercancel', finishHorizontalDrag);
    horizontalTrack.addEventListener('keydown', onHorizontalKeyDown);

    this.scrollbars.set(target, {
      track,
      thumb,
      horizontalTrack,
      horizontalThumb,
      target,
      onScroll,
      onKeyDown,
      onHorizontalKeyDown,
    });
  }

  private updateScrollbar(target: HTMLElement) {
    const controls = this.scrollbars.get(target);
    if (!controls) return;
    const { track, thumb, horizontalTrack, horizontalThumb } = controls;
    const hostRect = this.host.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const verticalOverflow = target.scrollHeight > target.clientHeight + 1;
    const horizontalOverflow = target.scrollWidth > target.clientWidth + 1;
    track.hidden = !verticalOverflow;
    track.style.left = `${targetRect.right - hostRect.left - scrollbarTrackWidth}px`;
    track.style.top = `${targetRect.top - hostRect.top}px`;
    track.style.height = `${target.clientHeight}px`;
    const geometry = scrollbarGeometry(
      target.scrollTop,
      target.scrollHeight,
      target.clientHeight,
      track.clientHeight,
    );
    thumb.style.height = `${geometry.thumbHeight}px`;
    thumb.style.transform = `translateY(${geometry.thumbTop}px)`;
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(geometry.maximumScrollTop));
    track.setAttribute('aria-valuenow', String(Math.round(target.scrollTop)));

    horizontalTrack.hidden = !horizontalOverflow;
    if (horizontalOverflow) {
      const railWidth = Math.max(
        80,
        target.clientWidth - (verticalOverflow ? scrollbarTrackWidth : 0) - 2,
      );
      horizontalTrack.style.left = `${targetRect.left - hostRect.left + 1}px`;
      horizontalTrack.style.top = `${
        targetRect.top - hostRect.top + target.clientHeight - scrollbarTrackWidth + 1
      }px`;
      horizontalTrack.style.width = `${railWidth}px`;
      const horizontal = scrollbarGeometry(
        target.scrollLeft,
        target.scrollWidth,
        target.clientWidth,
        railWidth,
      );
      horizontalThumb.style.width = `${horizontal.thumbHeight}px`;
      horizontalThumb.style.transform = `translateX(${horizontal.thumbTop}px)`;
      horizontalTrack.setAttribute('aria-valuemin', '0');
      horizontalTrack.setAttribute('aria-valuemax', String(horizontal.maximumScrollTop));
      horizontalTrack.setAttribute('aria-valuenow', String(Math.round(target.scrollLeft)));
    }
  }

  private removeScrollbar(target: HTMLElement) {
    const controls = this.scrollbars.get(target);
    if (!controls) return;
    target.removeEventListener('scroll', controls.onScroll);
    controls.track.removeEventListener('keydown', controls.onKeyDown);
    controls.horizontalTrack.removeEventListener('keydown', controls.onHorizontalKeyDown);
    target.classList.remove('puff-overlay-scroll-target');
    target.style.removeProperty('scrollbar-width');
    this.resizeObserver.unobserve(target);
    controls.track.remove();
    controls.horizontalTrack.remove();
    this.scrollbars.delete(target);
  }
}
