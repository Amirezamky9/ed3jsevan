#!/usr/bin/env php
<?php
/**
 * Orphaned-upload garbage collection (CLI).
 *
 * Lists (default) or deletes (--confirm) uploaded photos that no draft or
 * published item references in any photo slot, and that are older than the
 * 24-hour grace window. Same rules as the admin endpoints — see
 * src/UploadCleanup.php for the safety reasoning.
 *
 * Usage (from anywhere; paths resolve from this script's location):
 *   php backend/scripts/cleanup-uploads.php [--dry-run] [--confirm]
 *                                            [--grace-seconds=N] [--help]
 *
 *   --dry-run        list orphans without deleting anything (the default).
 *   --confirm        actually delete the listed orphans.
 *   --grace-seconds  override the 24h grace window (seconds).
 *
 * Config uses the same resolution as the web entry (config.php → PHP
 * constant → EYVAN_* environment variable → repo default), so on shared
 * hosting the usual cron line is:
 *   0 4 * * * /usr/bin/php /home/<user>/eyvan/app/scripts/cleanup-uploads.php --confirm >> /home/<user>/eyvan/data/cleanup.log 2>&1
 * Run it once with --dry-run first to see what it would delete.
 */

declare(strict_types=1);

$appDir = dirname(__DIR__);
require_once $appDir . '/src/bootstrap.php';

$confirm = false;
$graceSeconds = \Eyvan\UploadCleanup::GRACE_SECONDS;
$argvCopy = array_slice($argv, 1);
foreach ($argvCopy as $arg) {
    if ($arg === '--confirm') {
        $confirm = true;
    } elseif ($arg === '--dry-run') {
        $confirm = false;
    } elseif ($arg === '--help' || $arg === '-h') {
        fwrite(STDOUT, "Usage: php cleanup-uploads.php [--dry-run] [--confirm] [--grace-seconds=N]\n");
        fwrite(STDOUT, "  --dry-run (default): list orphans, delete nothing.\n");
        fwrite(STDOUT, "  --confirm: delete the listed orphans.\n");
        fwrite(STDOUT, "  --grace-seconds=N: override the 24h grace window.\n");
        exit(0);
    } elseif (str_starts_with($arg, '--grace-seconds=')) {
        $value = (int) substr($arg, strlen('--grace-seconds='));
        if ($value < 0) {
            fwrite(STDERR, "error: --grace-seconds must be >= 0\n");
            exit(2);
        }
        $graceSeconds = $value;
    } else {
        fwrite(STDERR, "error: unknown argument '{$arg}' (try --help)\n");
        exit(2);
    }
}

$config = \Eyvan\eyvan_config($appDir);
$db = new \Eyvan\Database($config['db_path'], $config['app_dir']);
$store = new \Eyvan\MenuStore($db);
$cleanup = new \Eyvan\UploadCleanup(
    $config['uploads_dir'],
    $config['uploads_url'],
    $store,
    $graceSeconds,
);

$preview = $cleanup->preview();
$orphans = $preview['orphans'];
$totalFiles = $preview['totalFiles'];
$totalBytes = $preview['totalBytes'];

if ($totalFiles === 0) {
    fwrite(STDOUT, "No orphaned uploads found. Nothing to do.\n");
    exit(0);
}

foreach ($orphans as $orphan) {
    $kb = number_format($orphan['size'] / 1024, 1);
    fwrite(STDOUT, "  {$orphan['file']}  {$kb} KB  {$orphan['ageDays']} days old\n");
}
fwrite(STDOUT, "{$totalFiles} orphaned file(s), " . number_format($totalBytes / 1024, 1) . " KB total.\n");

if (!$confirm) {
    fwrite(STDOUT, "Dry run: nothing deleted. Re-run with --confirm to delete.\n");
    exit(0);
}

$result = $cleanup->deleteOrphans();
fwrite(STDOUT, "Deleted {$result['deletedCount']} file(s), freed " . number_format($result['freedBytes'] / 1024, 1) . " KB.\n");
exit(0);
