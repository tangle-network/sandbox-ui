import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Check public declarations against the consumer's real installed Interface. */
export function validateInterfaceContract({ root, consumerDir }) {
  const contract = join(consumerDir, "src/interface-contract.ts");
  writeFileSync(contract, `
import type { AgentInteractiveSessionControlClaim, HarnessType, ReasoningEffort } from '@tangle-network/agent-interface';
import { modelProvider as canonicalProvider, snapHarnessToModel as canonicalSnap } from '@tangle-network/agent-interface';
import { modelProvider, snapHarnessToModel } from '@tangle-network/sandbox-ui/chat';
import type { ReasoningLevel, ReasoningLevelPickerProps } from '@tangle-network/sandbox-ui/chat';
import type { HarnessPickerProps } from '@tangle-network/sandbox-ui/dashboard';
import type { SendMessageOptions, UsePtySessionOptions } from '@tangle-network/sandbox-ui/hooks';
import type { TerminalViewProps } from '@tangle-network/sandbox-ui/terminal';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type Contracts = [
  Assert<Equal<HarnessPickerProps['value'], HarnessType>>,
  Assert<Equal<ReasoningLevel, 'auto' | ReasoningEffort>>,
  Assert<Equal<NonNullable<ReasoningLevelPickerProps['available']>[number], ReasoningEffort>>,
  Assert<Equal<NonNullable<SendMessageOptions['reasoningEffort']>, ReasoningEffort>>,
  Assert<Equal<NonNullable<UsePtySessionOptions['control']>, AgentInteractiveSessionControlClaim>>,
  Assert<Equal<NonNullable<TerminalViewProps['control']>, AgentInteractiveSessionControlClaim>>,
  Assert<Equal<typeof modelProvider, typeof canonicalProvider>>,
  Assert<Equal<typeof snapHarnessToModel, typeof canonicalSnap>>,
];
`);
  execFileSync(join(root, "node_modules/.bin/tsc"), [
    "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022",
    "--module", "ESNext", "--moduleResolution", "bundler", "--lib", "ES2022,DOM", contract,
  ], { cwd: consumerDir, stdio: "inherit" });
}
