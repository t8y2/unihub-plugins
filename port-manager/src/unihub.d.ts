/**
 * UniHub 插件全局类型定义
 */

interface PortInfo {
  pid: number;
  name: string;
  port: number;
  protocol: "TCP" | "UDP";
  state: string;
  address: string;
}

declare global {
  interface Window {
    unihub: {
      db: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
        keys: () => Promise<string[]>;
        clear: () => Promise<void>;
      };

      clipboard: {
        readText: () => Promise<string>;
        writeText: (text: string) => Promise<void>;
        readImage: () => Promise<string | null>;
        writeImage: (dataUrl: string) => Promise<void>;
        subscribe: () => Promise<void>;
        unsubscribe: () => Promise<void>;
        onChange: (
          callback: (data: { content: string; timestamp: number }) => void,
        ) => () => void;
      };

      fs: {
        readFile: (path: string) => Promise<string | null>;
        writeFile: (path: string, content: string) => Promise<boolean>;
        readDir: (path: string) => Promise<string[]>;
        exists: (path: string) => Promise<boolean>;
        stat: (
          path: string,
        ) => Promise<{
          isFile: boolean;
          isDirectory: boolean;
          size: number;
          mtime: Date;
        } | null>;
        mkdir: (path: string) => Promise<boolean>;
        selectFile: () => Promise<string | null>;
        selectDirectory: () => Promise<string | null>;
      };

      system: {
        getInfo: () => Promise<{
          platform: string;
          arch: string;
          version: string;
          appPath: string;
          userDataPath: string;
          tempPath: string;
        }>;
        openExternal: (url: string) => Promise<void>;
        showInFolder: (path: string) => Promise<void>;
        getPorts: () => Promise<PortInfo[]>;
        killProcess: (pid: number) => Promise<void>;
      };

      http: {
        request: (options: {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          body?: unknown;
        }) => Promise<{
          status: number;
          headers: Record<string, string>;
          data: unknown;
        }>;
      };

      notification: {
        show: (options: {
          title: string;
          body?: string;
          icon?: string;
        }) => Promise<void>;
      };
    };
  }
}

export {};
