<?php
/**
 * Orphaned-upload garbage collection (GET/POST /api/admin/cleanup-uploads
 * + backend/scripts/cleanup-uploads.php).
 *
 * Why this exists: every admin photo upload stores a NEW unique file
 * (sha256 + timestamp + random suffix) and never overwrites the old one,
 * so replacing a photo leaves the previous file on disk forever. On a
 * disk-limited shared host those orphans accumulate; this collector
 * deletes them.
 *
 * Safety rules (all deliberate):
 * - Only files inside the uploads directory, and only image files
 *   (webp/png/jpg/jpeg) — the uploader only ever writes those. A stray
 *   .htaccess, index.html or anything else is left alone.
 * - A file is an orphan only when NO draft or published item references
 *   its URL in any of the three photo slots. The published snapshot
 *   still shows the old photo until the admin publishes, so checking
 *   the draft alone would delete live photos.
 * - Grace window (24h): a file uploaded minutes ago is skipped even
 *   when unreferenced — the upload lands on disk BEFORE the PATCH that
 *   attaches it, and an admin may still be editing. A concurrent
 *   cleanup must never eat an in-flight upload.
 * - Deletion is explicit: the preview (GET) only lists, the POST and
 *   the CLI --confirm flag delete. The CLI defaults to dry-run.
 */

declare(strict_types=1);

namespace Eyvan;

final class UploadCleanup
{
    /** Grace window: orphans younger than this are kept. */
    public const GRACE_SECONDS = 24 * 3600;

    /** Image extensions the uploader writes (see Uploads::MIME_EXTENSIONS). */
    private const IMAGE_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg'];

    public function __construct(
        private string $uploadsDir,
        private string $uploadsUrl,
        private MenuStore $store,
        private int $graceSeconds = self::GRACE_SECONDS,
    ) {}

    /**
     * Orphans: unreferenced image files older than the grace window.
     * Sorted oldest-first so the worst offenders are listed first.
     *
     * @return array{orphans: list<array{file: string, size: int, ageDays: float}>, totalBytes: int, totalFiles: int}
     */
    public function preview(): array
    {
        $referenced = $this->referencedBasenames();
        $now = time();
        $orphans = [];
        $totalBytes = 0;
        $dir = rtrim($this->uploadsDir, '/');
        if (!is_dir($dir)) {
            return ['orphans' => [], 'totalBytes' => 0, 'totalFiles' => 0];
        }
        foreach (scandir($dir) ?: [] as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            $path = $dir . '/' . $name;
            if (!is_file($path)) {
                continue;
            }
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!in_array($ext, self::IMAGE_EXTENSIONS, true)) {
                continue;
            }
            if (isset($referenced[$name])) {
                continue;
            }
            $mtime = filemtime($path);
            if ($mtime === false) {
                continue;
            }
            $age = $now - $mtime;
            if ($age < $this->graceSeconds) {
                continue;
            }
            $size = filesize($path);
            if ($size === false) {
                $size = 0;
            }
            $orphans[] = [
                'file' => $name,
                'size' => $size,
                'ageDays' => round($age / 86400, 1),
            ];
            $totalBytes += $size;
        }
        usort($orphans, static fn(array $a, array $b): int => $b['ageDays'] <=> $a['ageDays']);
        return ['orphans' => $orphans, 'totalBytes' => $totalBytes, 'totalFiles' => count($orphans)];
    }

    /**
     * Delete every orphan from preview() and report what went.
     *
     * @return array{deleted: list<array{file: string, size: int}>, freedBytes: int, deletedCount: int}
     */
    public function deleteOrphans(): array
    {
        $preview = $this->preview();
        $deleted = [];
        $freed = 0;
        $dir = rtrim($this->uploadsDir, '/');
        foreach ($preview['orphans'] as $orphan) {
            // The basename can never escape the uploads dir (no slashes in
            // a scandir entry), but re-check anyway: this is a delete.
            if (basename($orphan['file']) !== $orphan['file']) {
                continue;
            }
            if (@unlink($dir . '/' . $orphan['file'])) {
                $deleted[] = ['file' => $orphan['file'], 'size' => $orphan['size']];
                $freed += $orphan['size'];
            }
        }
        return ['deleted' => $deleted, 'freedBytes' => $freed, 'deletedCount' => count($deleted)];
    }

    /** Basenames of every /uploads/ photo referenced by draft or published. */
    private function referencedBasenames(): array
    {
        $referenced = [];
        $prefix = rtrim($this->uploadsUrl, '/') . '/';
        foreach ([$this->store->getDraft(), $this->store->getPublished()] as $snapshot) {
            foreach ($snapshot['items'] ?? [] as $item) {
                if (!is_array($item)) {
                    continue;
                }
                foreach (Uploads::SLOTS as $slot) {
                    $value = $item[$slot] ?? '';
                    if (!is_string($value) || !str_starts_with($value, $prefix)) {
                        continue;
                    }
                    $base = basename($value);
                    if ($base !== '') {
                        $referenced[$base] = true;
                    }
                }
            }
        }
        return $referenced;
    }
}
