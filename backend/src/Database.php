<?php
/**
 * SQLite storage. Schema (see API.md § Storage):
 *   snapshots(state TEXT PRIMARY KEY, data TEXT NOT NULL)  — 'draft' | 'published'
 *   meta(key TEXT PRIMARY KEY, value TEXT)                 — lastPublishedAt
 *   admin_users(id INTEGER PRIMARY KEY, password_hash TEXT NOT NULL, created_at TEXT)
 *   sessions(token_hash TEXT PRIMARY KEY, created_at TEXT, expires_at TEXT)
 *
 * On first run (empty snapshots table) the seed is loaded into BOTH snapshots
 * and lastPublishedAt stays null.
 */

declare(strict_types=1);

namespace Eyvan;

final class Database
{
    private \PDO $pdo;
    private string $dbPath;

    public function __construct(string $dbPath, string $appDir)
    {
        $this->dbPath = $dbPath;
        $dir = dirname($dbPath);
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('Cannot create database directory: ' . $dir);
        }
        $this->pdo = new \PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        // Avoid "database is locked" on shared hosting under concurrent edits.
        $this->pdo->exec('PRAGMA busy_timeout = 5000');
        $this->pdo->exec('PRAGMA foreign_keys = ON');
        $this->createSchema();
        $this->seedIfEmpty($appDir);
        $this->migrateCafeInfoDefaults();
        $this->migrateItemAssetPaths();
    }

    public function pdo(): \PDO
    {
        return $this->pdo;
    }

    public function dbPath(): string
    {
        return $this->dbPath;
    }

    private function createSchema(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS snapshots (
                state TEXT PRIMARY KEY,
                data  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS meta (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS admin_users (
                id            INTEGER PRIMARY KEY,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );'
        );
    }

    private function seedIfEmpty(string $appDir): void
    {
        $count = (int) $this->pdo->query('SELECT COUNT(*) FROM snapshots')->fetchColumn();
        if ($count > 0) {
            return;
        }
        $state = eyvan_load_seed($appDir);
        $json = self::encode($state);
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('INSERT INTO snapshots (state, data) VALUES (:state, :data)');
            $stmt->execute([':state' => 'draft', ':data' => $json]);
            $stmt->execute([':state' => 'published', ':data' => $json]);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Fill in the cafe's real address/phone/hours where a snapshot still
     * carries the old placeholder defaults (the seed only loads into an
     * empty database, so existing installs need this one-time fill).
     * Values an admin actually edited are left untouched.
     */
    private function migrateCafeInfoDefaults(): void
    {
        $defaults = [
            'address' => 'شاهرود، میدان آزادی، جنب مقبره امیر اعظم، ابتدای آفتاب شمالی',
            'phone' => '023-32240088',
            'hours' => 'همه‌روزه از ۸:۰۰ تا ۲۳:۰۰',
            'coordinatesLabel' => 'میدان آزادی، ابتدای آفتاب شمالی',
        ];
        $stale = [
            'address' => ['', 'نشانی دقیق و موقعیت نقشه پس از تایید شما در این بخش درج می‌شود'],
            'phone' => [''],
            'hours' => ['همه‌روزه از ۹:۰۰ تا ۲۳:۳۰'],
            'coordinatesLabel' => ['موقعیت مکانی آماده اتصال به نقشه'],
        ];
        foreach (['draft', 'published'] as $stateName) {
            $json = $this->getSnapshotJson($stateName);
            if ($json === null) {
                continue;
            }
            $state = self::decode($json);
            if (!isset($state['cafeInfo']) || !is_array($state['cafeInfo'])) {
                continue;
            }
            $changed = false;
            foreach ($defaults as $field => $value) {
                $current = $state['cafeInfo'][$field] ?? null;
                if (!is_string($current) || in_array(trim($current), $stale[$field], true)) {
                    $state['cafeInfo'][$field] = $value;
                    $changed = true;
                }
            }
            if ($changed) {
                $this->setSnapshotJson($stateName, self::encode($state));
            }
        }
    }

    /**
     * Repair known stale item photo paths in existing snapshots (the seed
     * only loads into an empty database): snack paths that pointed at
     * non-existent files, and the khiar-sekanjabin v4 photo refresh.
     * Only exact stale values are replaced.
     */
    private function migrateItemAssetPaths(): void
    {
        $fixes = [
            'item-0d46775d751f4e66' => [
                'frontImage' => ['src/assets/images/eyvan_croissant_v6.webp', 'src/assets/images/eyvan_croissant_v3.webp'],
            ],
            'item-bbc887c51c807b56' => [
                'frontImage' => ['src/assets/images/eyvan_chocolate_cheesecake_v7.webp', 'src/assets/images/eyvan_chocolate_cheesecake_v4.webp'],
            ],
            'item-9975eac993da1410' => [
                'cutoutImage' => ['src/assets/images/cutouts/eyvan_chocolate_twist.webp', 'src/assets/images/cutouts/eyvan_chocolate_twist_v2.webp'],
            ],
            'matcha-latte' => [
                'image' => ['src/assets/images/topdown_matcha_latte_v4.webp', 'src/assets/images/topdown_matcha_latte_v5.webp'],
            ],
            'white-hot-chocolate' => [
                'image' => ['src/assets/images/topdown_white-hot-chocolate_v2.webp', 'src/assets/images/topdown_white-hot-chocolate_v3.webp'],
            ],
            'hot-lotus' => [
                'image' => ['src/assets/images/topdown_hot-lotus_v2.webp', 'src/assets/images/topdown_hot-lotus_v3.webp'],
            ],
            'hot-nutella' => [
                'image' => ['src/assets/images/topdown_hot-nutella_v2.webp', 'src/assets/images/topdown_hot-nutella_v3.webp'],
            ],
            'hot-almond' => [
                'image' => ['src/assets/images/topdown_hot-almond.webp', 'src/assets/images/topdown_hot-almond_v2.webp'],
            ],
            'carrot-milk' => [
                'image' => ['src/assets/images/topdown_carrot-milk.webp', 'src/assets/images/topdown_carrot-milk_v2.webp'],
            ],
            'espresso' => [
                'image' => ['src/assets/images/topdown_espresso_1795167624349.webp', 'src/assets/images/topdown_espresso_v2.webp'],
                'frontImage' => ['src/assets/images/eyvan_espresso_shot_1795166293523.webp', 'src/assets/images/eyvan_espresso_v2.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/hot_espresso.webp', 'src/assets/images/cutouts/eyvan_espresso_v2.webp'],
            ],
            'hot-chocolate' => [
                'image' => ['src/assets/images/topdown_hot-chocolate.webp', 'src/assets/images/topdown_hot-chocolate_v2.webp'],
                'frontImage' => ['src/assets/images/eyvan_hot-chocolate.webp', 'src/assets/images/eyvan_hot-chocolate_v2.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/hot-chocolate.webp', 'src/assets/images/cutouts/hot-chocolate_v2.webp'],
            ],
            'white-hot-chocolate' => [
                'image' => ['src/assets/images/topdown_white-hot-chocolate.webp', 'src/assets/images/topdown_white-hot-chocolate_v2.webp'],
                'frontImage' => ['src/assets/images/eyvan_white-hot-chocolate.webp', 'src/assets/images/eyvan_white-hot-chocolate_v2.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/white-hot-chocolate.webp', 'src/assets/images/cutouts/white-hot-chocolate_v2.webp'],
            ],
            'hot-lotus' => [
                'image' => ['src/assets/images/topdown_hot-lotus.webp', 'src/assets/images/topdown_hot-lotus_v2.webp'],
                'frontImage' => ['src/assets/images/eyvan_hot-lotus.webp', 'src/assets/images/eyvan_hot-lotus_v2.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/hot-lotus.webp', 'src/assets/images/cutouts/hot-lotus_v2.webp'],
            ],
            'hot-nutella' => [
                'image' => ['src/assets/images/topdown_hot-nutella.webp', 'src/assets/images/topdown_hot-nutella_v2.webp'],
                'frontImage' => ['src/assets/images/eyvan_hot-nutella.webp', 'src/assets/images/eyvan_hot-nutella_v2.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/hot-nutella.webp', 'src/assets/images/cutouts/hot-nutella_v2.webp'],
            ],
            'hot-almond' => [
                'frontImage' => ['src/assets/images/eyvan_hot-almond.webp', 'src/assets/images/eyvan_hot-almond_v2.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/hot-almond.webp', 'src/assets/images/cutouts/hot-almond_v2.webp'],
            ],
            'carrot-milk' => [
                'frontImage' => ['src/assets/images/eyvan_carrot-milk.webp', 'src/assets/images/eyvan_carrot-milk_v2.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/carrot-milk.webp', 'src/assets/images/cutouts/carrot-milk_v2.webp'],
            ],
            'khiar-sekanjabin' => [
                'image' => ['src/assets/images/topdown_khiar_sekanjabin_v3.webp', 'src/assets/images/topdown_khiar_sekanjabin_v4.webp'],
                'cutoutImage' => ['src/assets/images/cutouts/eyvan_khiar_sekanjabin_v3.webp', 'src/assets/images/cutouts/eyvan_khiar_sekanjabin_v4.webp'],
            ],
        ];
        foreach (['draft', 'published'] as $stateName) {
            $json = $this->getSnapshotJson($stateName);
            if ($json === null) {
                continue;
            }
            $state = self::decode($json);
            if (!isset($state['items']) || !is_array($state['items'])) {
                continue;
            }
            $changed = false;
            foreach ($state['items'] as &$item) {
                $id = $item['id'] ?? null;
                if (!is_string($id) || !isset($fixes[$id])) {
                    continue;
                }
                foreach ($fixes[$id] as $field => [$stale, $fixed]) {
                    if (($item[$field] ?? null) === $stale) {
                        $item[$field] = $fixed;
                        $changed = true;
                    }
                }
            }
            unset($item);
            if ($changed) {
                $this->setSnapshotJson($stateName, self::encode($state));
            }
        }
    }
    /** Canonical JSON encoding (stable round-trips, so hasDraft compares cleanly). */
    public static function encode(mixed $value): string
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException('Failed to encode value as JSON.');
        }
        return $json;
    }

    public static function decode(string $json): array
    {
        $value = json_decode($json, true);
        if (!is_array($value)) {
            throw new \RuntimeException('Stored menu state is not valid JSON.');
        }
        return $value;
    }

    public function getSnapshotJson(string $state): ?string
    {
        $stmt = $this->pdo->prepare('SELECT data FROM snapshots WHERE state = :state');
        $stmt->execute([':state' => $state]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row === false ? null : (string) $row['data'];
    }

    public function setSnapshotJson(string $state, string $json): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO snapshots (state, data) VALUES (:state, :data)
             ON CONFLICT(state) DO UPDATE SET data = excluded.data'
        );
        $stmt->execute([':state' => $state, ':data' => $json]);
    }

    public function getMeta(string $key): ?string
    {
        $stmt = $this->pdo->prepare('SELECT value FROM meta WHERE key = :key');
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row === false || $row['value'] === null ? null : (string) $row['value'];
    }

    public function setMeta(string $key, ?string $value): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO meta (key, value) VALUES (:key, :value)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        );
        $stmt->execute([':key' => $key, ':value' => $value]);
    }

    public function transaction(callable $fn): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $result = $fn();
            $this->pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
