import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "@/components/LoginForm";

const mockPush = vi.fn();
const mockLogin = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockLogin.mockReset();
});

describe("LoginForm", () => {
  it("renders username and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redirects on successful login", async () => {
    mockLogin.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/username/i), "testuser");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "Test1234!");
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows error on failed login", async () => {
    mockLogin.mockResolvedValueOnce({ ok: false, error: "Invalid credentials" });
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/username/i), "testuser");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });
});
