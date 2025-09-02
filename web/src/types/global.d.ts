import * as React from 'react';

declare module 'react' {
  interface InputHTMLAttributes<T> extends React.AriaAttributes, React.DOMAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

declare global {
  interface HTMLInputElement {
    webkitdirectory?: string;
  }

  interface File {
    webkitRelativePath?: string;
  }
}

export {};