import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    console.error("[renderer] React error boundary caught an exception");
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="app-shell">
          <div className="brand-mark" aria-hidden="true">TL</div>
          <main className="status-card" role="alert">
            <p className="eyebrow">TeacherLyft Assistant</p>
            <h1>TeacherLyft Assistant encountered an error.</h1>
            <p>Please retry. If the problem continues, restart the Assistant.</p>
            <button className="primary wide" onClick={() => window.location.reload()}>Retry</button>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}
