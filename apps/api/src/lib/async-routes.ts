import type { RequestHandler } from 'express';
import express from 'express';
import { asyncHandler } from './route-utils';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'] as const;
let patched = false;

/**
 * Ensures rejected promises from async route handlers reach Express error middleware.
 * Patches Router.prototype once so every `Router()` benefits.
 * Call before any route modules are loaded (side-effect import from index).
 */
export function enableAsyncRouteErrors(): void {
  if (patched) return;
  patched = true;

  const proto = Object.getPrototypeOf(express.Router()) as Record<string, (...args: unknown[]) => unknown>;

  for (const method of METHODS) {
    const original = proto[method];
    if (typeof original !== 'function') continue;

    proto[method] = function patchedMethod(this: unknown, path: unknown, ...handlers: unknown[]) {
      const wrapped = handlers.map((handler) => {
        if (typeof handler !== 'function') return handler;
        // Skip Express error middleware (arity 4)
        if ((handler as (...args: unknown[]) => unknown).length > 3) return handler;
        return asyncHandler(handler as RequestHandler);
      });
      return original.call(this, path, ...wrapped);
    };
  }
}

enableAsyncRouteErrors();
