export type ImageGenerationResultFromLog<TImage extends { id?: string }> =
    | {
          id: string;
          status: "success";
          image: TImage;
      }
    | {
          id: string;
          status: "failed";
          error: string;
      };

type ImageGenerationLogLike<TImage extends { id?: string }> = {
    id: string;
    images?: TImage[] | null;
    failCount?: number | null;
    status?: string | null;
    error?: string | null;
};

export function imageGenerationResultsFromLog<TImage extends { id?: string }>(log: ImageGenerationLogLike<TImage>): ImageGenerationResultFromLog<TImage>[] {
    const successResults = (log.images || []).map((image, index) => ({
        id: image.id || `${log.id}-image-${index}`,
        status: "success" as const,
        image,
    }));
    const failedCount = normalizedFailCount(log.failCount) || (successResults.length ? 0 : log.status === "失败" ? 1 : 0);
    const error = log.error?.trim() || "生成失败";
    const failedResults = Array.from({ length: failedCount }, (_, index) => ({
        id: `${log.id}-failed-${index}`,
        status: "failed" as const,
        error,
    }));

    return [...successResults, ...failedResults];
}

function normalizedFailCount(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
}
