import { useCallback } from "react";
import { App } from "antd";

import { fileDownloadErrorMessage, saveFile, type DownloadResult, type DownloadSource } from "@/services/file-download";

export function useFileDownload() {
    const { message } = App.useApp();

    return useCallback(
        async (source: DownloadSource, fileName: string): Promise<DownloadResult | undefined> => {
            try {
                const result = await saveFile(source, fileName);
                if (result.status === "saved") message.success(result.path ? `文件已保存：${result.path}` : "文件已保存");
                return result;
            } catch (error) {
                message.error(fileDownloadErrorMessage(error));
                return undefined;
            }
        },
        [message],
    );
}
