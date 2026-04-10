import React from 'react';
import type { RouteObject } from 'react-router-dom';

/**
 * Dev-only routes module
 * This module is tree-shaken in production builds by Vite
 */
export async function getDevRoutes(): Promise<RouteObject[]> {
  if (!import.meta.env.DEV) {
    return [];
  }

  const { LayoutTestPage } = await import('../pages/_LayoutTestPage.js');
  const { UiPreviewPage } = await import('../pages/_UiPreviewPage.js');
  const { ScrollTestPage } = await import('../pages/_ScrollTestPage.js');

  return [
    { path: '/_layout-test', element: React.createElement(LayoutTestPage) },
    { path: '/_ui-preview', element: React.createElement(UiPreviewPage) },
    { path: '/_scroll-test', element: React.createElement(ScrollTestPage) },
  ];
}
