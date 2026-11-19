# Sandbox UI

Build a React workspace for a coding agent. Show what the agent ran, open the files it changed, and review its patch. You supply the sandbox data and decide who can access it.

[Explore the Storybook](https://sandbox-ui-storybook.pages.dev/) · [Integration guide](https://github.com/tangle-network/sandbox-ui/blob/main/docs/integration.md) · [npm package](https://www.npmjs.com/package/@tangle-network/sandbox-ui)

## Show a file change

In a React app, install the package.

```sh
npm install @tangle-network/sandbox-ui
```

This component shows a one-line fix. Pass the original and updated file contents to display your own patch.

```tsx
import { DiffView } from "@tangle-network/sandbox-ui/workbench/diff";
import "@tangle-network/sandbox-ui/styles";

export default function ReviewChange() {
  return (
    <DiffView
      filename="greet.ts"
      baseline={'export const greet = (name: string) => "Hello, name";'}
      current={'export const greet = (name: string) => `Hello, ${name}`;'}
      themeType="light"
    />
  );
}
```

## Build a workspace

| What you want to show | Where to start |
| --- | --- |
| A conversation alongside files, a diff, and a terminal | [SandboxWorkbench](https://github.com/tangle-network/sandbox-ui/blob/main/docs/integration.md#existing-sandbox-workbench) |
| A live run with a trace and the selected agent's output | [LiveRun](https://github.com/tangle-network/sandbox-ui/blob/main/docs/integration.md#live-run-viewer) |
| An app running inside a sandbox | [EmbeddedAppView](https://github.com/tangle-network/sandbox-ui/blob/main/docs/integration.md#embed-a-sandbox-app) |
| A saved run or research report | [AgentRecord and ResearchReport](https://github.com/tangle-network/sandbox-ui/blob/main/docs/integration.md#retained-records-and-reports) |
| A dashboard with workspace and account navigation | [Sidebar components](https://github.com/tangle-network/sandbox-ui/blob/main/docs/sidebar.md) |

Import the subpath for the feature you use. The [integration guide](https://github.com/tangle-network/sandbox-ui/blob/main/docs/integration.md) covers optional dependencies, CSS imports, fonts, and theming. For the composed agent shell, composer, and pickers, see [component ownership](https://github.com/tangle-network/sandbox-ui/blob/main/UI-DIRECTION.md#canonical-ownership).

## Run the examples locally

```sh
git clone https://github.com/tangle-network/sandbox-ui.git
cd sandbox-ui
pnpm install --frozen-lockfile
pnpm storybook
```

Open <http://localhost:6006>. Each story shows a component with sample data. The [visual test guide](https://github.com/tangle-network/sandbox-ui/blob/main/tests/visual/README.md) covers running the browser suite and reviewing snapshot changes.

[MIT license](https://github.com/tangle-network/sandbox-ui/blob/main/LICENSE)
