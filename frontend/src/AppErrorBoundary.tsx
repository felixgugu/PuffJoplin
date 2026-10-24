import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { api } from './api';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

function report(error: unknown, source: string, stack = '') {
  const message = error instanceof Error ? error.message : String(error);
  void api.reportFrontendError(message, stack, source).catch(() => undefined);
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    report(error, 'react', info.componentStack || '');
  }

  private handleWindowError = (event: ErrorEvent) => {
    report(event.error || event.message, 'window');
    this.setState({ error: event.error instanceof Error ? event.error : new Error(event.message) });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const stack = event.reason instanceof Error ? event.reason.stack || '' : '';
    report(event.reason, 'promise', stack);
    // Third-party preview renderers (especially diagram libraries) can reject
    // while the user is typing an incomplete diagram. Keep the editor usable
    // and leave renderer errors inside their preview area.
    event.preventDefault();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-screen">
        <div className="fatal-card">
          <div className="brand-mark large">P</div>
          <h1>介面發生錯誤</h1>
          <p>{this.state.error.message || '未知錯誤'}</p>
          <p className="error-report-note">錯誤已寫入 data/logs/puffjoplin.log，筆記資料未受影響。</p>
          <button className="primary" onClick={() => window.location.reload()}>重新載入</button>
          <button onClick={() => void api.openDataFolder()}>開啟資料資料夾</button>
        </div>
      </main>
    );
  }
}
