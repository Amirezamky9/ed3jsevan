import { useEffect, useState } from 'react';
import { DatabaseBackup, KeyRound, Loader2, Search, Trash2 } from 'lucide-react';
import { adminApi } from '../api';
import type { CleanupPreview, SeoMeta } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Field, Input } from '../../components/ui/input';
import { PasswordInput } from '../../components/ui/password-input';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/ui/toast';

/** تنظیمات: تغییر رمز، سئو و بک‌آپ. */
export function SettingsView() {
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  const [seo, setSeo] = useState<SeoMeta>({ title: '', description: '' });
  const [seoLoading, setSeoLoading] = useState(true);
  const [seoSaving, setSeoSaving] = useState(false);

  const [backingUp, setBackingUp] = useState(false);

  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getMenu()
      .then((menu) => {
        if (!cancelled) setSeo({ ...menu.seo });
      })
      .catch(() => {
        if (!cancelled)
          toast({ title: 'بارگذاری تنظیمات سئو ناموفق بود', variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setSeoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: 'رمز جدید باید حداقل ۶ کاراکتر باشد',
        variant: 'error',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'تکرار رمز جدید مطابقت ندارد', variant: 'error' });
      return;
    }
    setChanging(true);
    try {
      const ok = await adminApi.changePassword(currentPassword, newPassword);
      if (ok) {
        toast({ title: 'رمز تغییر کرد', variant: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast({ title: 'تغییر رمز ناموفق بود', variant: 'error' });
      }
    } catch {
      toast({ title: 'تغییر رمز ناموفق بود', variant: 'error' });
    } finally {
      setChanging(false);
    }
  };

  const saveSeo = async () => {
    setSeoSaving(true);
    try {
      const saved = await adminApi.updateSeo(seo);
      setSeo({ ...saved });
      toast({ title: 'ذخیره شد', variant: 'success' });
    } catch {
      toast({ title: 'ذخیره سئو ناموفق بود', variant: 'error' });
    } finally {
      setSeoSaving(false);
    }
  };

  const checkCleanup = async () => {
    setChecking(true);
    try {
      const result = await adminApi.getCleanupPreview();
      setPreview(result);
      if (result.totalFiles === 0) {
        toast({ title: 'عکس اضافی پیدا نشد', variant: 'success' });
      }
    } catch {
      toast({ title: 'بررسی عکس‌های اضافی ناموفق بود', variant: 'error' });
    } finally {
      setChecking(false);
    }
  };

  const doCleanup = async () => {
    setCleaning(true);
    try {
      const result = await adminApi.cleanupUploads();
      setPreview(null);
      toast({
        title: `${result.deletedCount.toLocaleString('fa-IR')} فایل حذف شد — ${formatBytes(result.freedBytes)} آزاد شد`,
        variant: 'success',
      });
    } catch {
      toast({ title: 'پاک‌سازی عکس‌ها ناموفق بود', variant: 'error' });
    } finally {
      setCleaning(false);
    }
  };

  const downloadBackup = async () => {
    setBackingUp(true);
    try {
      const json = await adminApi.exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eyvan-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: 'بک‌آپ دانلود شد', variant: 'success' });
    } catch {
      toast({ title: 'دانلود بک‌آپ ناموفق بود', variant: 'error' });
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="تنظیمات"
        description="رمز عبور، سئوی صفحه منو، بک‌آپ و پاک‌سازی عکس‌ها."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            تغییر رمز عبور
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert variant="info">
            در نسخه نمایشی رمز واقعاً تغییر نمی‌کند؛ با بک‌اند PHP فعال می‌شود.
          </Alert>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="رمز فعلی" htmlFor="settings-password-current">
              <PasswordInput
                id="settings-password-current"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="رمز جدید" htmlFor="settings-password-new">
              <PasswordInput
                id="settings-password-new"
                strength
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="تکرار رمز جدید" htmlFor="settings-password-confirm">
              <PasswordInput
                id="settings-password-confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <Button onClick={() => void changePassword()} disabled={changing}>
            {changing && <Loader2 className="size-4 animate-spin" />}
            تغییر رمز
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            سئو
          </CardTitle>
          <CardDescription>
            عنوان و توضیحی که در نتایج جست‌وجو برای صفحه منو نمایش داده می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {seoLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <Field
                label="عنوان صفحه"
                htmlFor="settings-seo-title"
                hint="در نتایج جست‌وجو نمایش داده می‌شود"
              >
                <Input
                  id="settings-seo-title"
                  value={seo.title}
                  onChange={(e) =>
                    setSeo((s) => ({ ...s, title: e.target.value }))
                  }
                  placeholder="ایوان | کافه و رستوران"
                />
              </Field>
              <Field label="توضیحات متا" htmlFor="settings-seo-description">
                <Textarea
                  id="settings-seo-description"
                  value={seo.description}
                  onChange={(e) =>
                    setSeo((s) => ({ ...s, description: e.target.value }))
                  }
                  showCount
                  maxLength={160}
                  autoResize
                  placeholder="توضیح کوتاه درباره کافه ایوان"
                />
              </Field>
              <Button onClick={() => void saveSeo()} disabled={seoSaving}>
                {seoSaving && <Loader2 className="size-4 animate-spin" />}
                ذخیره سئو
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseBackup className="size-5" />
            بک‌آپ
          </CardTitle>
          <CardDescription>
            بک‌آپ شامل منوی پیش‌نویس و منتشرشده است.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => void downloadBackup()}
            disabled={backingUp}
          >
            {backingUp && <Loader2 className="size-4 animate-spin" />}
            دانلود بک‌آپ
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="size-5" />
            پاک‌سازی عکس‌های اضافی
          </CardTitle>
          <CardDescription>
            وقتی عکس یک آیتم عوض می‌شود، فایل قبلی روی سرور می‌ماند. این بخش
            عکس‌هایی را که نه در پیش‌نویس و نه در نسخه منتشرشده استفاده
            شده‌اند و بیش از ۲۴ ساعت از آپلودشان گذشته پیدا می‌کند؛ عکس‌های
            تازه‌تر (کمتر از ۲۴ ساعت) همیشه نگه داشته می‌شوند تا آپلودی که
            هنوز ذخیره نشده اشتباه حذف نشود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void checkCleanup()}
              disabled={checking || cleaning}
            >
              {checking && <Loader2 className="size-4 animate-spin" />}
              بررسی عکس‌های اضافی
            </Button>
            {preview !== null && preview.totalFiles > 0 && (
              <Button
                variant="destructive"
                onClick={() => void doCleanup()}
                disabled={checking || cleaning}
              >
                {cleaning && <Loader2 className="size-4 animate-spin" />}
                حذف {preview.totalFiles.toLocaleString('fa-IR')} فایل (
                {formatBytes(preview.totalBytes)})
              </Button>
            )}
          </div>
          {preview !== null && preview.totalFiles === 0 && (
            <Alert variant="success">عکس اضافی برای حذف نیست.</Alert>
          )}
          {preview !== null && preview.totalFiles > 0 && (
            <p className="text-sm text-muted-foreground">
              {preview.totalFiles.toLocaleString('fa-IR')} فایل اضافی (
              {formatBytes(preview.totalBytes)}) — قدیمی‌ترین{' '}
              {preview.orphans[0]?.ageDays.toLocaleString('fa-IR')} روز پیش
              آپلود شده است. فقط همین فایل‌ها حذف می‌شوند؛ عکس‌هایی که در
              منو استفاده شده‌اند دست نمی‌خورند.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Bytes → «۱۲۳ کیلوبایت» / «۲٫۴ مگابایت» با ارقام فارسی. */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('fa-IR')} کیلوبایت`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString('fa-IR', {
    maximumFractionDigits: 1,
  })} مگابایت`;
}
