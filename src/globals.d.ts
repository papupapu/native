declare const __DEV__: boolean;

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.scss';

interface Window {
  __INITIAL_STATE__?: Record<string, unknown>;
  __ROUTER_DATA__?: import('react-router').HydrationState;
  __recoverableErrors?: string[];
}
