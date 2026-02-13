import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterForm from "@/components/RegisterForm";

const mockPush = vi.fn();
const mockRegister = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockRegister.mockReset();
});

describe("RegisterForm", () => {
  it("renders all fields", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^email$/i), "test@example.com");
    await user.type(screen.getByLabelText(/^username$/i), "testuser");
    await user.type(screen.getByLabelText(/^password$/i), "Strong1234!");
    await user.type(screen.getByLabelText(/confirm password/i), "Different1!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("redirects on successful registration", async () => {
    mockRegister.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^email$/i), "test@example.com");
    await user.type(screen.getByLabelText(/^username$/i), "testuser");
    await user.type(screen.getByLabelText(/^password$/i), "Strong1234!");
    await user.type(screen.getByLabelText(/confirm password/i), "Strong1234!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("test@example.com", "testuser", "Strong1234!");
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows error on failed registration", async () => {
    mockRegister.mockResolvedValueOnce({ ok: false, error: "Email already registered" });
    const user = userEvent.setup();

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^email$/i), "test@example.com");
    await user.type(screen.getByLabelText(/^username$/i), "testuser");
    await user.type(screen.getByLabelText(/^password$/i), "Strong1234!");
    await user.type(screen.getByLabelText(/confirm password/i), "Strong1234!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Email already registered")).toBeInTheDocument();
    });
  });
});
