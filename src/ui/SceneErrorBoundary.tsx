/**
 * Safety net for the lazy 3D layer (crash-on-load fix).
 *
 * three r187 has no WebGL1 fallback, so a WebGL2-less browser (or any context
 * creation failure) makes R3F's <Canvas> throw while mounting. Without a
 * boundary React unmounts the ENTIRE root — including the authoritative 2D
 * shell — and a persisted "3d" override turns that into an unrecoverable
 * reload loop. This boundary contains the failure to the optional scene: it
 * drops the stuck override, asks the app to fall back to 2D, and renders
 * nothing so the 2D DOM shell stays fully usable.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearManualMode } from '../lib/device-tier';

export interface SceneErrorBoundaryProps {
  children: ReactNode;
  /** Called on failure; App uses it to setMode('2d'). */
  onError: () => void;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  override state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Drop the persisted override first: a reload must not retry the crash.
    clearManualMode();
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}
