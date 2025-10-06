declare module "*.png" {
  const src: import("next/dist/client/image").StaticImageData;
  export default src;
}

declare module "*.jpg" {
  const src: import("next/dist/client/image").StaticImageData;
  export default src;
}

declare module "*.jpeg" {
  const src: import("next/dist/client/image").StaticImageData;
  export default src;
}

declare module "*.webp" {
  const src: import("next/dist/client/image").StaticImageData;
  export default src;
}

declare module "*.svg" {
  const src: import("next/dist/client/image").StaticImageData;
  export default src;
}
