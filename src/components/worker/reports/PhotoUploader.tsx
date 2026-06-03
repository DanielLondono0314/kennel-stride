import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface PhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  label?: string;
  /** Storage bucket; reuses the existing report-card bucket by default. */
  bucket?: string;
}

/** Small photo uploader reused across the worker report forms. */
export function PhotoUploader({
  photos,
  onChange,
  max = 4,
  label = "Fotos",
  bucket = "report-card-photos",
}: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || photos.length >= max) return;

    setUploading(true);
    const next = [...photos];
    for (let i = 0; i < Math.min(files.length, max - photos.length); i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) {
        toast.error(`Error subiendo ${file.name}: ${error.message}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      next.push(urlData.publicUrl);
    }
    onChange(next);
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div className="space-y-1.5">
      <Label>
        {label} (máx. {max})
      </Label>
      <div className="flex flex-wrap gap-3">
        {photos.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
            <img src={url} alt="" width={80} height={80} loading="lazy" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}
