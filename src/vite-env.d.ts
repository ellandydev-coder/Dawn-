/// <reference types="vite/client" />

// 🎯 Worklets / Workers como URL
declare module '*?worker&url' {
  const url: string;
  export default url;
}

declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*?worker' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}
