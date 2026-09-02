import { render, screen } from "@testing-library/react"
import * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const lifecycle: Array<{ event: "hydrate" | "cleanUp"; container: HTMLElement | null }> = []

vi.mock("@pierre/diffs", () => {
  class FileDiff {
    container: HTMLElement | null = null
    constructor(
      public options: Record<string, unknown> | undefined,
      _pool?: unknown,
      public isContainerManaged?: boolean,
    ) {}
    hydrate({ fileContainer }: { fileContainer: HTMLElement }) {
      this.container = fileContainer
      const shadow = fileContainer.shadowRoot ?? fileContainer.attachShadow({ mode: "open" })
      const pre = document.createElement("pre")
      pre.textContent = "rendered"
      shadow.appendChild(pre)
      lifecycle.push({ event: "hydrate", container: fileContainer })
    }
    cleanUp() {
      lifecycle.push({ event: "cleanUp", container: this.container })
      this.container = null
    }
  }
  return {
    FileDiff,
    getSingularPatch: (patch: string) => ({ patch }),
  }
})

import { DiffView } from "./diff-view"

// Testing Library unmounts the previous test's tree in its own afterEach, so
// the log is cleared at the start of each test, after that unmount landed.
beforeEach(() => {
  lifecycle.length = 0
})

const baseline = "const a = 1;\nconst b = 2;\n"
const current = "const a = 1;\nconst b = 22;\n"

describe("DiffView", () => {
  it("renders the diff into a host element it owns", () => {
    render(<DiffView filename="x.ts" baseline={baseline} current={current} />)
    const host = screen.getByTestId("diff-view")
    const containers = host.querySelectorAll("diffs-container")
    expect(containers).toHaveLength(1)
    expect(containers[0].shadowRoot?.textContent).toBe("rendered")
    expect(lifecycle.map((entry) => entry.event)).toEqual(["hydrate"])
  })

  it("survives StrictMode's mount, unmount, remount with one live container", () => {
    render(
      <React.StrictMode>
        <DiffView filename="x.ts" baseline={baseline} current={current} showFileHeader={false} />
      </React.StrictMode>,
    )
    const host = screen.getByTestId("diff-view")
    // StrictMode ran the effect twice; the first container was removed, so a
    // reader sees exactly one rendered diff, produced by a fresh element.
    expect(host.querySelectorAll("diffs-container")).toHaveLength(1)
    expect(lifecycle.map((entry) => entry.event)).toEqual(["hydrate", "cleanUp", "hydrate"])
    expect(lifecycle[0].container).not.toBe(lifecycle[2].container)
    expect(host.querySelector("diffs-container")?.shadowRoot?.textContent).toBe("rendered")
  })

  it("passes the file-header switch to the renderer options", () => {
    const { unmount } = render(<DiffView filename="x.ts" baseline={baseline} current={current} showFileHeader={false} />)
    unmount()
    expect(lifecycle.map((entry) => entry.event)).toEqual(["hydrate", "cleanUp"])
  })

  it("says so when both sides are identical", () => {
    render(<DiffView filename="x.ts" baseline={baseline} current={baseline} />)
    expect(screen.getByText(/identical/)).toBeInTheDocument()
    expect(screen.queryByTestId("diff-view")).not.toBeInTheDocument()
    expect(lifecycle).toHaveLength(0)
  })
})
