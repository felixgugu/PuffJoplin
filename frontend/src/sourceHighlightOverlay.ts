import { highlightMarkdownSource } from './sourceHighlight';

const highlightDelay = 70;

export class SourceHighlightOverlay {
  readonly textarea: HTMLTextAreaElement;

  private readonly highlight: HTMLPreElement;
  private readonly code: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private source = '';
  private visible = false;
  private composing = false;
  private timer: number | null = null;
  private layoutFrame: number | null = null;
  private destroyed = false;

  constructor(textarea: HTMLTextAreaElement) {
    const parent = textarea.parentElement;
    if (!parent) throw new Error('Vditor source textarea has no parent');

    this.textarea = textarea;
    this.highlight = document.createElement('pre');
    this.highlight.className = 'puff-source-highlight';
    this.highlight.setAttribute('aria-hidden', 'true');
    this.highlight.hidden = true;
    this.code = document.createElement('code');
    this.code.className = 'language-markdown';
    this.highlight.appendChild(this.code);

    textarea.insertAdjacentElement('afterend', this.highlight);
    textarea.classList.add('puff-source-textarea');

    textarea.addEventListener('input', this.handleInput);
    textarea.addEventListener('scroll', this.syncScroll, { passive: true });
    textarea.addEventListener('compositionstart', this.handleCompositionStart);
    textarea.addEventListener('compositionend', this.handleCompositionEnd);
    window.addEventListener('resize', this.scheduleLayout);
    this.resizeObserver = new ResizeObserver(this.scheduleLayout);
    this.resizeObserver.observe(textarea);
    this.resizeObserver.observe(parent);

    this.source = textarea.value;
    this.renderPlain();
  }

  update(source = this.textarea.value, immediate = false) {
    if (this.destroyed) return;
    this.source = source;
    this.cancelScheduledHighlight();
    if (!this.visible) {
      this.renderPlain();
      return;
    }
    if (immediate) {
      this.renderHighlighted();
      return;
    }
    this.textarea.classList.add('is-typing');
    this.highlight.classList.add('is-typing');
    this.scheduleHighlight();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.highlight.hidden = !visible;
    this.textarea.classList.toggle('puff-source-highlight-active', visible);
    this.cancelScheduledHighlight();
    if (!visible) {
      this.highlight.classList.remove('is-visible');
      this.textarea.classList.remove('is-typing', 'is-composing');
      this.highlight.classList.remove('is-typing', 'is-composing');
      this.renderPlain();
      return;
    }
    this.renderHighlighted();
    this.scheduleLayout();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelScheduledHighlight();
    this.textarea.removeEventListener('input', this.handleInput);
    this.textarea.removeEventListener('scroll', this.syncScroll);
    this.textarea.removeEventListener('compositionstart', this.handleCompositionStart);
    this.textarea.removeEventListener('compositionend', this.handleCompositionEnd);
    window.removeEventListener('resize', this.scheduleLayout);
    this.resizeObserver.disconnect();
    if (this.layoutFrame !== null) window.cancelAnimationFrame(this.layoutFrame);
    this.textarea.classList.remove(
      'puff-source-textarea',
      'puff-source-highlight-active',
      'is-typing',
      'is-composing',
    );
    this.highlight.remove();
  }

  private handleInput = () => {
    if (this.composing) return;
    this.update(this.textarea.value);
  };

  private handleCompositionStart = () => {
    this.composing = true;
    this.cancelScheduledHighlight();
    this.textarea.classList.add('is-composing');
    this.highlight.classList.add('is-composing');
  };

  private handleCompositionEnd = () => {
    this.composing = false;
    this.textarea.classList.remove('is-composing');
    this.highlight.classList.remove('is-composing');
    this.update(this.textarea.value);
  };

  private scheduleHighlight() {
    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.destroyed || this.composing || !this.visible) return;
      this.renderHighlighted();
    }, highlightDelay);
  }

  private cancelScheduledHighlight() {
    if (this.timer === null) return;
    window.clearTimeout(this.timer);
    this.timer = null;
  }

  private renderPlain() {
    this.code.textContent = this.sourceWithFinalLine();
    this.textarea.classList.add('is-typing');
    this.highlight.classList.add('is-typing');
    this.syncScroll();
  }

  private renderHighlighted() {
    try {
      this.code.innerHTML = highlightMarkdownSource(this.source) +
        (this.source ? '\n' : '');
    } catch {
      this.code.textContent = this.sourceWithFinalLine();
    }
    this.textarea.classList.remove('is-typing', 'is-composing');
    this.highlight.classList.remove('is-typing', 'is-composing');
    this.highlight.classList.add('is-visible');
    this.syncScroll();
    this.scheduleLayout();
  }

  private sourceWithFinalLine(): string {
    return this.source ? `${this.source}\n` : '';
  }

  private syncScroll = () => {
    this.highlight.scrollTop = this.textarea.scrollTop;
    this.highlight.scrollLeft = this.textarea.scrollLeft;
  };

  private scheduleLayout = () => {
    if (this.destroyed || !this.visible || this.layoutFrame !== null) return;
    this.layoutFrame = window.requestAnimationFrame(() => {
      this.layoutFrame = null;
      if (this.destroyed || !this.visible) return;
      const parent = this.textarea.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const textareaRect = this.textarea.getBoundingClientRect();
      this.highlight.style.left = `${textareaRect.left - parentRect.left}px`;
      this.highlight.style.top = `${textareaRect.top - parentRect.top}px`;
      this.highlight.style.width = `${textareaRect.width}px`;
      this.highlight.style.height = `${textareaRect.height}px`;
      this.syncScroll();
    });
  };
}
