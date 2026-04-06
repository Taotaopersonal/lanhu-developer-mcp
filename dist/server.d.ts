import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
export declare const Logger: {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
};
export declare class LanhuMcpServer {
    private readonly server;
    private readonly token;
    private sseTransport;
    constructor(token: string);
    private getFileNameFromUrl;
    private downloadImage;
    private extractImageUrls;
    private extractImageUrlsFromString;
    private getRelativePath;
    private replaceImageUrls;
    private compressJsonData;
    private isTaroProject;
    private addRpxUnitsForTaro;
    private registerTools;
    connect(transport: Transport): Promise<void>;
    startHttpServer(port: number): Promise<void>;
}
