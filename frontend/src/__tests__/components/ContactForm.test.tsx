import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/ContactForm";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("ContactForm", () => {
  it("renders all form fields", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("shows success message after submission", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/name/i), "John Doe");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/message/i), "Hello, this is a test message.");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("Message sent.")).toBeInTheDocument();
    });
  });

  it("shows error message on failed submission", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const user = userEvent.setup();

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/name/i), "John Doe");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/message/i), "Hello, this is a test message.");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("disables submit button while sending", async () => {
    let resolvePromise: (value: unknown) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const user = userEvent.setup();

    render(<ContactForm />);

    await user.type(screen.getByLabelText(/name/i), "John Doe");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/message/i), "Hello, this is a test message.");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    // Resolve the pending fetch
    resolvePromise!({ ok: true, json: () => Promise.resolve({}) });
  });
});
