import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { createElement } from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => {
    return createElement("a", { href: props.href as string }, props.children as string);
  },
}));
