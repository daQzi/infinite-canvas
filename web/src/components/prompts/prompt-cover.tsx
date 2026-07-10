import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function hasPromptCover(coverUrl: string) {
    return Boolean(coverUrl.trim());
}

export function PromptCover({ coverUrl, alt, className, imageClassName }: { coverUrl: string; alt: string; className?: string; imageClassName?: string }) {
    const normalizedCoverUrl = coverUrl.trim();
    const [failedCoverUrl, setFailedCoverUrl] = useState("");
    const showPlaceholder = !hasPromptCover(normalizedCoverUrl) || failedCoverUrl === normalizedCoverUrl;

    if (showPlaceholder) {
        return (
            <div role="img" aria-label={`${alt}：暂无封面`} className={cn("flex flex-col items-center justify-center gap-2 bg-stone-100 text-stone-400 dark:bg-stone-900 dark:text-stone-500", className)}>
                <ImageIcon aria-hidden="true" className="size-8" strokeWidth={1.5} />
                <span className="text-xs">暂无封面</span>
            </div>
        );
    }

    return <img src={normalizedCoverUrl} alt={alt} className={cn("object-cover", className, imageClassName)} onError={() => setFailedCoverUrl(normalizedCoverUrl)} />;
}
