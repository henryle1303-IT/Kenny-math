// Leave multipart overhead below Vercel Functions' 4.5 MB request limit.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
