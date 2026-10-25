// Deprecated compatibility subpath. `@tangle-network/sandbox-ui/primitives`
// re-exports `@tangle-network/ui/primitives` so existing imports keep
// resolving; new code imports `@tangle-network/ui/primitives` directly.
//
// Sandbox-ui serves only its own Logo, LogoProps, TangleKnot, HeadingProps,
// SectionTitle and SectionTitleProps here. A named export takes precedence over
// a name the star also forwards, so these shadow ui's same-named bindings.
export * from "@tangle-network/ui/primitives";

export { Logo, TangleKnot, type LogoProps } from "./logo";
export { type HeadingProps, SectionTitle, type SectionTitleProps } from "./heading";
