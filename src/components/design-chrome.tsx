'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
export function DesignChrome({children}:{children:ReactNode}) {
  return /^\/design\/[^/]+\/?$/.test(usePathname()) ? null : children;
}
