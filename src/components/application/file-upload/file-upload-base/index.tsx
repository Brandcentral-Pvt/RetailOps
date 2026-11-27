import { useState, useRef, useImperativeHandle, forwardRef } from "react";

export interface UploadedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    progress: number;
    fileObject?: File;
    failed?: boolean;
    status: "pending" | "uploading" | "done" | "error";
}

interface FileUploadProgressBarProps {
    isDisabled?: boolean;
    /** Custom upload handler: receives (file, onProgress) and should return a promise */
    uploadHandler?: (file: File, onProgress: (progress: number) => void) => Promise<void>;
    /** Called when files are dropped. Return false to prevent files from being added. */
    onFilesDropped?: (files: File[]) => void | boolean;
    /** Called when an upload completes successfully */
    onUploadComplete?: (result: { file: File; id: string }) => void;
    /** Called when an upload fails */
    onUploadError?: (error: Error, fileId: string) => void;
}

const FileUploadProgressBar = forwardRef<{
    startUploads: () => void;
    startUpload: (id: string) => void;
}, FileUploadProgressBarProps>((props, ref) => {
    const {
        isDisabled,
        uploadHandler,
        onFilesDropped,
        onUploadComplete,
        onUploadError,
    } = props;
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

    const performUpload = async (fileObject: File, id: string) => {
        const handler = uploadHandler;
        if (!handler) {
            console.warn("No uploadHandler provided");
            return;
        }

        setUploadedFiles((prev) =>
            prev.map((f) =>
                f.id === id ? { ...f, status: "uploading", progress: 0, failed: false } : f
            )
        );

        try {
            await handler(fileObject, (progress) => {
                setUploadedFiles((prev) =>
                    prev.map((f) =>
                        f.id === id ? { ...f, progress, failed: false, status: "uploading" } : f
                    )
                );
            });
            setUploadedFiles((prev) =>
                prev.map((f) =>
                    f.id === id ? { ...f, progress: 100, status: "done", failed: false } : f
                )
            );
            onUploadComplete?.({ file: fileObject, id });
        } catch (err) {
            setUploadedFiles((prev) =>
                prev.map((f) =>
                    f.id === id ? { ...f, progress: 0, status: "error", failed: true } : f
                )
            );
            onUploadError?.(err as Error, id);
        }
    };

    const startUpload = (id: string) => {
        const file = uploadedFiles.find((f) => f.id === id);
        if (file && file.fileObject && file.status === "pending") {
            performUpload(file.fileObject, id);
        }
    };

    const startUploads = () => {
        uploadedFiles
            .filter((f) => f.status === "pending" && f.fileObject)
            .forEach((f) => performUpload(f.fileObject!, f.id));
    };

    useImperativeHandle(ref, () => ({
        startUploads,
        startUpload,
    }));

    const handleDropFiles = (files: FileList) => {
        const newFiles = Array.from(files);
        const proceed = onFilesDropped?.(newFiles);
        if (proceed === false) {
            return;
        }

        const newFilesWithIds = newFiles.map((file) => ({
            id: Math.random().toString(),
            name: file.name,
            size: file.size,
            type: file.type,
            progress: 0,
            fileObject: file,
            status: "pending" as const,
        }));

        setUploadedFiles([...newFilesWithIds, ...uploadedFiles]);
    };

    const handleDeleteFile = (id: string) => {
        setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
    };

    const handleRetryFile = (id: string) => {
        const file = uploadedFiles.find((f) => f.id === id);
        if (!file || !file.fileObject) return;

        setUploadedFiles((prev) =>
            prev.map((f) =>
                f.id === id ? { ...f, progress: 0, status: "pending", failed: false } : f
            )
        );

        performUpload(file.fileObject, id);
    };

    const getReadableFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return (
        <div
            className="file-upload-root"
            style={{
                border: "2px dashed #e2e8f0",
                borderRadius: 8,
                padding: 20,
                textAlign: "center",
                background: "#f8fafc",
                transition: "border-color 0.2s",
            }}
        >
            <div
                className="file-upload-dropzone"
                style={{
                    padding: 40,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    color: "#64748b",
                    fontSize: 14,
                    fontWeight: 500,
                }}
            >
                {isDisabled
                    ? "Uploads are disabled"
                    : "Click or drag GMS CSV/Excel report here"}
            </div>

            {uploadedFiles.length > 0 && (
                <div
                    className="file-upload-list"
                    style={{
                        marginTop: 16,
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: 16,
                    }}
                >
                    {uploadedFiles.map((file) => (
                        <div
                            key={file.id}
                            className="file-upload-list-item"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                borderBottom: "1px solid #f1f5f9",
                                fontSize: 13,
                                background:
                                    file.status === "uploading"
                                        ? "#f0f7ff"
                                        : undefined,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                <span
                                    title={file.name}
                                    style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        color: file.failed ? "#ef4444" : "#334155",
                                    }}
                                >
                                    {file.name}
                                </span>
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: "#94a3b8",
                                        marginLeft: 6,
                                    }}
                                >
                                    {getReadableFileSize(file.size)}
                                </span>
                            </div>
                            {file.status === "uploading" ? (
                                <div style={{ width: 100, flexShrink: 0 }}>
                                    <div
                                        style={{
                                            height: 6,
                                            background: "#e2e8f0",
                                            borderRadius: 3,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: "100%",
                                                width: `${file.progress}%`,
                                                background: "#1349c6",
                                                transition: "width 0.2s",
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "#64748b",
                                            marginTop: 2,
                                            textAlign: "right",
                                        }}
                                    >
                                        {file.progress}%
                                    </div>
                                </div>
                            ) : file.status === "error" ? (
                                <button
                                    onClick={() => handleRetryFile(file.id)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#ef4444",
                                        cursor: "pointer",
                                        fontSize: 11,
                                        padding: 4,
                                    }}
                                >
                                    Retry
                                </button>
                            ) : file.status === "done" ? (
                                <span style={{ fontSize: 11, color: "#22c55e" }}>
                                    Done
                                </span>
                            ) : (
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                    Pending
                                </span>
                            )}
                            <button
                                onClick={() => handleDeleteFile(file.id)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#94a3b8",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    padding: 4,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

FileUploadProgressBar.displayName = "FileUploadProgressBar";

export default FileUploadProgressBar;
