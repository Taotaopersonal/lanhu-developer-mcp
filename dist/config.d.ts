interface ServerConfig {
    token: string;
    port: number;
    configSources: {
        token: "cli" | "env" | "default";
        port: "cli" | "env" | "default";
    };
}
export declare function getServerConfig(isStdioMode: boolean): ServerConfig;
export {};
