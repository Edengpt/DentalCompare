import { ExternalLink, FileText, ImageIcon } from "lucide-react";

/**
 * One of the patient's medical files, shown in place rather than as a download.
 *
 * Served by /api/files, which checks on every request that the viewer is the
 * patient, an admin, or a clinic the request was delivered to — the raw blob
 * URL never reaches the browser. An image renders as an image; a PDF in the
 * browser's own viewer. Either can open full size in a new tab.
 */
export function MedicalFileViewer({
  src,
  label,
  kind,
  openLabel,
}: {
  /** The /api/files URL, never the blob URL. */
  src: string;
  label: string;
  kind: "image" | "pdf";
  openLabel: string;
}) {
  const Icon = kind === "image" ? ImageIcon : FileText;
  return (
    <figure className="border-border/60 bg-card overflow-hidden rounded-2xl border">
      <figcaption className="border-border/60 flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <Icon className="text-teal-deep h-4 w-4" />
          {label}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-deep inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline"
        >
          {openLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </figcaption>
      {kind === "image" ? (
        <a href={src} target="_blank" rel="noopener noreferrer" className="block bg-black/90">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route; next/image would cache it */}
          <img src={src} alt={label} className="mx-auto max-h-[28rem] w-auto object-contain" />
        </a>
      ) : (
        <iframe src={src} title={label} className="h-[32rem] w-full bg-white" />
      )}
    </figure>
  );
}

/** The blob's own extension says which viewer fits — PDF, or an image of some kind. */
export function medicalFileKind(blobUrl: string): "image" | "pdf" {
  try {
    return new URL(blobUrl).pathname.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
  } catch {
    return "pdf";
  }
}
