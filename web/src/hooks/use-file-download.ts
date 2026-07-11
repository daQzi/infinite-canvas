import { useCallback } from "react";
import { App } from "antd";

import { saveFile, type DownloadResult, type DownloadSource } from "@/services/file-download";

export function useFileDownload() {
    const { message } = App.useApp();

    return useCallback(
        async (source: DownloadSource, fileName: string): Promise<DownloadResult | undefined> => {
            try {
                const result = await saveFile(source, fileName);
                if (result.status === "saved") message.success(result.path ? `文件已保存：${result.path}` : "文件已保存");
                return result;
            } catch (error) {
                message.error(error instanceof Error ? error.message : "文件保存失败");
                return undefined;
            }
        },
        [message],
    );
}
