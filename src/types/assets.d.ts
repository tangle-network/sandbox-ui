declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.woff2?inline" {
  const dataUrl: string;
  export default dataUrl;
}
