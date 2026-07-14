import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AgentComposer, type ComposerFile } from "./agent-composer";

function makeImageFile(name = "image.png", type = "image/png"): File {
  return new File([new Uint8Array(10)], name, { type });
}

describe("AgentComposer — clipboard paste", () => {
  it("pasting a generic-named image file calls onAttach with a renamed file", () => {
    const onAttach = vi.fn();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={onAttach}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /message input/i });

    const dt = new DataTransfer();
    dt.items.add(makeImageFile());
    fireEvent.paste(textarea, { clipboardData: dt });

    expect(onAttach).toHaveBeenCalledTimes(1);
    const files = onAttach.mock.calls[0][0] as FileList;
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("pasted-image-1.png");
  });

  it("pasting plain text does not call onAttach and lands in the textarea", async () => {
    const onAttach = vi.fn();
    const user = userEvent.setup();
    const Wrapper = () => {
      const [value, setValue] = useState("");
      return (
        <AgentComposer
          value={value}
          onChange={setValue}
          onSubmit={() => {}}
          onAttach={onAttach}
        />
      );
    };
    render(<Wrapper />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await user.click(textarea);
    await user.paste("hello world");

    expect(onAttach).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("hello world");
  });

  it("does nothing when onAttach is not provided", () => {
    render(<AgentComposer value="" onChange={() => {}} onSubmit={() => {}} />);
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    const dt = new DataTransfer();
    dt.items.add(makeImageFile());
    // Should not throw even though there's no onAttach to call.
    expect(() => fireEvent.paste(textarea, { clipboardData: dt })).not.toThrow();
  });
});

describe("AgentComposer — accept enforcement", () => {
  it("pasting a non-matching type routes to onRejectFiles, never onAttach", () => {
    const onAttach = vi.fn();
    const onRejectFiles = vi.fn();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={onAttach}
        onRejectFiles={onRejectFiles}
        accept=".pdf"
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    const dt = new DataTransfer();
    dt.items.add(makeImageFile());
    fireEvent.paste(textarea, { clipboardData: dt });

    expect(onAttach).not.toHaveBeenCalled();
    expect(onRejectFiles).toHaveBeenCalledTimes(1);
    const rejections = onRejectFiles.mock.calls[0][0] as Array<{
      file: File;
      reason: string;
    }>;
    expect(rejections).toHaveLength(1);
    expect(rejections[0]?.reason).toMatch(/pasted-image-1\.png/);
  });

  it("dropping mixed types delivers only the matching files", () => {
    const onAttach = vi.fn();
    const onRejectFiles = vi.fn();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={onAttach}
        onRejectFiles={onRejectFiles}
        accept="image/*"
      />,
    );
    const surface = screen.getByTestId("agent-composer");
    const dt = new DataTransfer();
    dt.items.add(makeImageFile("shot.png"));
    dt.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
    fireEvent.drop(surface, { dataTransfer: dt });

    expect(onAttach).toHaveBeenCalledTimes(1);
    const files = onAttach.mock.calls[0][0] as FileList;
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("shot.png");
    expect(onRejectFiles).toHaveBeenCalledTimes(1);
    expect(onRejectFiles.mock.calls[0][0]).toHaveLength(1);
  });

  it("without accept, every dropped file passes through", () => {
    const onAttach = vi.fn();
    const onRejectFiles = vi.fn();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={onAttach}
        onRejectFiles={onRejectFiles}
      />,
    );
    const surface = screen.getByTestId("agent-composer");
    const dt = new DataTransfer();
    dt.items.add(makeImageFile("shot.png"));
    dt.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
    fireEvent.drop(surface, { dataTransfer: dt });

    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0][0]).toHaveLength(2);
    expect(onRejectFiles).not.toHaveBeenCalled();
  });
});

describe("AgentComposer — thumbnails", () => {
  it("renders an <img> for a chip with previewUrl", () => {
    const attachments: ComposerFile[] = [
      {
        id: "1",
        name: "photo.png",
        kind: "file",
        status: "ready",
        previewUrl: "data:image/png;base64,AAAA",
      },
    ];
    const { container } = render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={() => {}}
        attachments={attachments}
      />,
    );
    // Presentational (alt="") thumbnails are excluded from the accessibility
    // tree, so query the DOM directly rather than via role.
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,AAAA");
  });
});

describe("AgentComposer — error + retry", () => {
  const errorFile: ComposerFile[] = [
    {
      id: "err-1",
      name: "broken.png",
      kind: "file",
      status: "error",
      errorMessage: "Upload failed: network error",
    },
  ];

  it("renders the errorMessage on an error chip", () => {
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={() => {}}
        attachments={errorFile}
      />,
    );
    expect(screen.getByText("Upload failed: network error")).toBeInTheDocument();
  });

  it("clicking retry calls onRetryFile with the file id", async () => {
    const onRetryFile = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={() => {}}
        attachments={errorFile}
        onRetryFile={onRetryFile}
      />,
    );
    await user.click(screen.getByRole("button", { name: /retry upload/i }));
    expect(onRetryFile).toHaveBeenCalledWith("err-1");
  });

  it("does not render a retry button when onRetryFile is absent", () => {
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAttach={() => {}}
        attachments={errorFile}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /retry upload/i }),
    ).not.toBeInTheDocument();
  });
});

describe("AgentComposer — canSubmitWhileBusy", () => {
  it("Enter fires onSubmit while busy when canSubmitWhileBusy is set", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentComposer
        value="hello"
        onChange={() => {}}
        onSubmit={onSubmit}
        busy
        canSubmitWhileBusy
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Enter does not fire onSubmit while busy without the flag", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentComposer
        value="hello"
        onChange={() => {}}
        onSubmit={onSubmit}
        busy
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("AgentComposer — canSubmitAttachmentsOnly", () => {
  const readyFile = [
    { id: "f1", name: "shot.png", kind: "file" as const, status: "ready" as const },
  ];

  it("Enter fires onSubmit with empty text when an attachment is staged", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={onSubmit}
        onAttach={() => {}}
        attachments={readyFile}
        canSubmitAttachmentsOnly
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Enter does not fire onSubmit with empty text without the flag", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={onSubmit}
        onAttach={() => {}}
        attachments={readyFile}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Enter does not fire onSubmit with the flag but no attachments", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentComposer
        value=""
        onChange={() => {}}
        onSubmit={onSubmit}
        onAttach={() => {}}
        canSubmitAttachmentsOnly
      />,
    );
    const textarea = screen.getByRole("textbox", { name: /message input/i });
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
