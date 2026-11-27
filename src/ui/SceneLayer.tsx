/**
 * Memoized boundary around the lazy 3D layer. The shell re-renders on camera
 * settle, hover and dialog state; none change this component's props, and its
 * own store subscriptions already re-render it when the scene changes. Without
 * this boundary every App render reconciles the whole lazy Canvas tree.
 */
import { memo } from 'react';
import { SceneLayerImpl } from './SceneLayerImpl';

export const SceneLayer = memo(SceneLayerImpl);
SceneLayer.displayName = 'SceneLayer';
