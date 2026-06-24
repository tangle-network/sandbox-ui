// Ambient typings for the react-syntax-highlighter PrismLight build and the
// per-language Prism modules. The package ships no declarations and
// `@types/react-syntax-highlighter` is not installed, so these declare exactly
// the entry points the workbench code view imports. Kept local to the feature
// (not a global shim) so the surface stays minimal and auditable.

declare module "react-syntax-highlighter/dist/esm/prism-light" {
  import type { ComponentType, CSSProperties, HTMLAttributes, ReactNode } from "react"

  export interface PrismLightProps {
    language?: string
    /** Token → style map (a Prism theme object). */
    style?: Record<string, CSSProperties>
    /** Style applied to the generated <pre>. */
    customStyle?: CSSProperties
    /** Props forwarded to the inner <code>. */
    codeTagProps?: HTMLAttributes<HTMLElement>
    showLineNumbers?: boolean
    startingLineNumber?: number
    lineNumberStyle?: CSSProperties | ((lineNumber: number) => CSSProperties)
    wrapLines?: boolean
    wrapLongLines?: boolean
    className?: string
    children?: ReactNode
  }

  const PrismLight: ComponentType<PrismLightProps> & {
    registerLanguage: (name: string, func: unknown) => void
  }
  export default PrismLight
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/*" {
  const language: unknown
  export default language
}
